import base64
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
from lcars_utilities import DailyUtilities


class Result:
    def __init__(self, stdout="", stderr="", returncode=0):
        self.stdout, self.stderr, self.returncode = stdout, stderr, returncode


class DailyUtilitiesTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.commands = []
        self.clipboard = "First officer report"

        def which(name):
            return f"/usr/bin/{name}" if name in {"xclip", "lpstat", "cancel"} else None

        def run(command, **kwargs):
            self.commands.append((command, kwargs))
            if command[0] == "lpstat":
                return Result("system default destination: bridge\nprinter bridge is idle. enabled\nbridge-42 operator 2048 Sun 13 Sep 2026\n")
            if command[0].endswith("xclip") and "-o" in command:
                return Result(self.clipboard)
            return Result()

        self.utilities = DailyUtilities(self.root / "config", "linux", self.root / "home", runner=run, which=which, now=lambda: 1_800_000_000)

    def tearDown(self):
        self.folder.cleanup()

    def test_clipboard_history_is_opt_in_bounded_and_private_mode_clears_it(self):
        read_once = self.utilities.operate({"operation": "clipboard-read"})
        self.assertEqual(read_once["value"], self.clipboard)
        self.assertEqual(read_once["status"]["clipboard"]["history"], [])
        self.utilities.operate({"operation": "policy", "historyEnabled": True, "limit": 5})
        self.utilities.operate({"operation": "clipboard-read"})
        status = self.utilities.status()
        self.assertEqual(status["clipboard"]["history"][0]["text"], self.clipboard)
        self.utilities.operate({"operation": "clipboard-write", "id": status["clipboard"]["history"][0]["id"]})
        self.assertEqual(self.commands[-1][1]["input"], self.clipboard)
        private = self.utilities.operate({"operation": "policy", "privateMode": True})
        self.assertEqual(private["clipboard"]["history"], [])

    def test_capture_is_signature_checked_and_saved_to_a_fixed_lcars_folder(self):
        raw = b"\x89PNG\r\n\x1a\n" + b"test-image"
        result = self.utilities.operate({"operation": "save-capture", "kind": "screenshot", "data": "data:image/png;base64," + base64.b64encode(raw).decode()})
        target = Path(result["path"])
        self.assertEqual(target.read_bytes(), raw)
        self.assertEqual(target.parent, self.root / "home" / "Pictures" / "LCARS Captures")
        with self.assertRaises(ValueError):
            self.utilities.operate({"operation": "save-capture", "kind": "screenshot", "data": "data:image/png;base64," + base64.b64encode(b"not a png").decode()})

    def test_print_cancellation_requires_exact_single_use_portal_approval(self):
        payload = self.utilities.request_description({"action": "cancel-print", "target": "bridge-42"})
        approval = {"id": "approval-1", "kind": "print", "decision": "approved", "payload": payload}
        result = self.utilities.operate({"operation": "cancel-print", "target": "bridge-42"}, approval)
        self.assertTrue(result["ok"])
        self.assertEqual(self.commands[-2][0], ["/usr/bin/cancel", "bridge-42"])
        with self.assertRaises(PermissionError):
            self.utilities.operate({"operation": "cancel-print", "target": "bridge-42"}, approval)

    def test_state_contains_no_unbounded_or_unrequested_capture_data(self):
        self.utilities.operate({"operation": "policy", "historyEnabled": True})
        state = json.loads((self.root / "config" / "daily-utilities.json").read_text())
        self.assertEqual(state["schema"], 1)
        self.assertNotIn("capture", state)


if __name__ == "__main__":
    unittest.main()
