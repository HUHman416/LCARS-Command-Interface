import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
from lcars_padd import PaddController


class PaddPairingTests(unittest.TestCase):
    def make_controller(self, folder):
        assets = Path(folder) / "padd"
        assets.mkdir()
        (assets / "index.html").write_text("LCARS PADD", encoding="utf-8")
        return PaddController(Path(folder) / "config", assets, "28.1-dev.1", "test", listen=False)

    def test_one_use_pairing_hashes_tokens_and_supports_revocation(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            self.assertFalse(controller.status(True)["enabled"])
            armed = controller.manage({"operation": "start"})
            code = armed["pairing"]["code"]
            paired = controller.pair(code, "Captain's PADD", "192.168.1.5")
            self.assertEqual(paired["device"]["role"], "operator")
            self.assertIsNone(controller.status(True)["pairing"])
            record = json.loads(controller.device_file.read_text(encoding="utf-8"))
            self.assertNotIn(paired["token"], controller.device_file.read_text(encoding="utf-8"))
            self.assertEqual(len(record["devices"][0]["tokenHash"]), 64)
            self.assertEqual(controller.authenticate(paired["token"])["id"], paired["device"]["id"])
            controller.manage({"operation": "revoke", "id": paired["device"]["id"]})
            self.assertIsNone(controller.authenticate(paired["token"]))

    def test_roles_gate_commands_and_command_queue_is_drained(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Ops PADD", "192.168.1.8")
            device = controller.authenticate(paired["token"])
            controller.queue_action(device, {"action": "media", "value": "play-pause"})
            with self.assertRaises(PermissionError):
                controller.queue_action(device, {"action": "routine", "value": "routine-1"})
            controller.manage({"operation": "role", "id": device["id"], "role": "command"})
            command_device = controller.authenticate(paired["token"])
            requested = controller.queue_action(command_device, {"action": "routine", "value": "routine-1"})
            self.assertTrue(requested["approvalRequired"])
            self.assertEqual([item["action"] for item in controller.pop_commands()], ["media"])
            approval = controller.status()["approvals"][0]
            controller.manage({"operation": "approve", "approvalId": approval["id"]})
            self.assertEqual([item["action"] for item in controller.pop_commands()], ["routine"])
            self.assertEqual(controller.pop_commands(), [])

    def test_shared_state_does_not_show_apps_to_non_command_roles(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Status PADD", "192.168.1.9")
            controller.sync({"page": "media", "volume": 72, "apps": [{"id": "discord", "name": "Discord"}], "routines": [{"id": "one", "name": "Routine"}]})
            state = controller.state_for(controller.authenticate(paired["token"]))
            self.assertEqual(state["state"]["page"], "media")
            self.assertEqual(state["state"]["volume"], 72)
            self.assertEqual(state["state"]["apps"], [])
            self.assertTrue(state["capabilities"]["media"])
            self.assertFalse(state["capabilities"]["app"])

    def test_granular_permissions_layout_heartbeat_and_identify(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Science PADD", "192.168.1.10")
            ident = paired["device"]["id"]
            controller.manage({"operation": "permissions", "id": ident, "permissions": {"media": False, "communications": False, "telemetry": True}})
            controller.manage({"operation": "layout", "id": ident, "widgets": ["status", "communications"]})
            controller.manage({"operation": "profile", "id": ident, "value": "bridge-station"})
            controller.manage({"operation": "proximity", "id": ident, "enabled": True})
            controller.manage({"operation": "identify", "id": ident})
            device = controller.authenticate(paired["token"])
            heartbeat = controller.heartbeat(device, {"battery": 0, "network": "wifi", "latencyMs": 14, "version": "28.1-test"}, "192.168.1.10")
            self.assertEqual(heartbeat["device"]["battery"], 0)
            self.assertEqual(heartbeat["device"]["latencyMs"], 14)
            controller.sync({"notices": [{"id": "one", "text": "Priority"}], "meters": [{"label": "CPU", "value": 42}]})
            state = controller.state_for(controller.authenticate(paired["token"]))
            self.assertFalse(state["capabilities"]["media"])
            self.assertEqual(state["state"]["notices"], [])
            self.assertEqual(state["state"]["widgets"], ["status", "communications"])
            self.assertEqual(state["device"]["workstation"], "bridge-station")
            self.assertTrue(state["device"]["proximity"])
            self.assertEqual(state["signal"]["type"], "identify")

    def test_text_clipboard_is_opt_in_bounded_and_approval_gated(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Command PADD", "192.168.1.11")
            ident = paired["device"]["id"]
            controller.manage({"operation": "role", "id": ident, "role": "command"})
            device = controller.authenticate(paired["token"])
            self.assertFalse(controller.state_for(device)["capabilities"]["clipboard"])
            with self.assertRaises(PermissionError):
                controller.queue_action(device, {"action": "clipboard", "value": "alpha"})
            controller.manage({"operation": "clipboard", "enabled": True})
            self.assertTrue(controller.state_for(device)["capabilities"]["clipboard"])
            requested = controller.queue_action(device, {"action": "clipboard", "value": "alpha\nbeta"})
            self.assertTrue(requested["approvalRequired"])
            approval = controller.status()["approvals"][0]
            self.assertEqual(approval["value"], "alpha\nbeta")
            controller.manage({"operation": "deny", "approvalId": approval["id"]})
            self.assertEqual(controller.pop_commands(), [])
            self.assertTrue(any(item["action"] == "request-denied" for item in controller.status()["activity"]))


if __name__ == "__main__":
    unittest.main()
