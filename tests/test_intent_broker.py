import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
from lcars_intents import IntentBroker


class IntentBrokerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.clock = [1000.0]
        self.broker = IntentBroker(self.temporary.name, "linux", now=lambda: self.clock[0])

    def tearDown(self):
        self.temporary.cleanup()

    def submit(self, kind="open-file"):
        return self.broker.operate({"operation": "submit", "kind": kind, "client": "TEST APP", "title": "Test request", "payload": {"directory": "~"}})["request"]

    def test_sensitive_routes_cannot_be_silently_allowed(self):
        with self.assertRaises(PermissionError):
            self.broker.operate({"operation": "policy", "kind": "microphone", "policy": "allow"})
        request = self.submit("microphone")
        self.assertEqual(request["decision"], "waiting")

    def test_ordinary_allow_and_deny_policies_are_immediate(self):
        self.broker.operate({"operation": "policy", "kind": "notification", "policy": "allow"})
        self.assertEqual(self.submit("notification")["decision"], "approved")
        self.broker.operate({"operation": "policy", "kind": "open-with", "policy": "deny"})
        self.assertEqual(self.submit("open-with")["decision"], "denied")

    def test_operator_can_resolve_waiting_request(self):
        request = self.submit("open-file")
        path = str(Path.home() / "Documents" / "example.txt")
        resolved = self.broker.operate({"operation": "resolve", "id": request["id"], "decision": "approved", "operator": "CAPTAIN", "result": {"path": path}})["request"]
        self.assertEqual(resolved["decision"], "approved")
        self.assertEqual(resolved["result"]["path"], path)
        self.assertEqual(resolved["operator"], "CAPTAIN")

    def test_file_result_cannot_escape_home(self):
        request = self.submit("open-folder")
        with self.assertRaises(PermissionError):
            self.broker.operate({"operation": "resolve", "id": request["id"], "decision": "approved", "result": {"path": "/etc"}})

    def test_waiting_request_expires_and_history_is_bounded(self):
        request = self.submit("camera")
        self.clock[0] += 121
        self.assertEqual(self.broker.request(request["id"])["decision"], "expired")
        for index in range(170):
            self.broker.operate({"operation": "submit", "kind": "notification", "title": str(index), "payload": {}})
        self.assertLessEqual(len(self.broker.status()["requests"]), 100)
        stored = json.loads((Path(self.temporary.name) / "portal-broker.json").read_text())
        self.assertLessEqual(len(stored["requests"]), 150)

    def test_payload_is_bounded(self):
        with self.assertRaises(ValueError):
            self.broker.operate({"operation": "submit", "kind": "share", "payload": {"data": "x" * 9000}})


if __name__ == "__main__":
    unittest.main()

