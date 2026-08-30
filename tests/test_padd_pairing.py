import json
import hashlib
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "shared"))
from lcars_padd import PaddController
from lcars_federation_crypto import encrypt, open_json, request_signature, seal_json


class PaddPairingTests(unittest.TestCase):
    def make_controller(self, folder):
        assets = Path(folder) / "padd"
        assets.mkdir()
        (assets / "index.html").write_text("LCARS PADD", encoding="utf-8")
        return PaddController(Path(folder) / "config", assets, "28.0.0", "test", listen=False)

    def test_aes_256_gcm_matches_nist_vector(self):
        with patch("lcars_federation_crypto.os.urandom", return_value=b"\0" * 12):
            nonce, ciphertext, tag = encrypt(b"\0" * 32, b"\0" * 16)
        self.assertEqual(nonce, b"\0" * 12)
        self.assertEqual(ciphertext.hex(), "cea7403d4d606b6e074ec5d3baf39d18")
        self.assertEqual(tag.hex(), "d0d1c8a799996bf0265b98b5d48ab919")

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

    def test_media_targets_and_dismiss_all_are_safely_queued(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Media PADD", "192.168.1.12")
            device = controller.authenticate(paired["token"])
            controller.queue_action(device, {"action": "media", "value": {"player": "spotify.instance42", "command": "play-pause"}})
            controller.queue_action(device, {"action": "notice-dismiss-all", "value": "ignored"})
            commands = controller.pop_commands()
            self.assertEqual(commands[0]["value"], {"player": "spotify.instance42", "command": "play-pause"})
            self.assertEqual(commands[1]["action"], "notice-dismiss-all")
            self.assertEqual(commands[1]["value"], "all")
            with self.assertRaises(ValueError):
                controller.queue_action(device, {"action": "media", "value": {"player": "spotify", "command": "delete"}})

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
            heartbeat = controller.heartbeat(device, {"battery": 0, "network": "wifi", "latencyMs": 14, "version": "28.3-test"}, "192.168.1.10")
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

    def test_presets_notifications_copy_and_version_compatibility(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            first = controller.pair(armed["pairing"]["code"], "One", "192.168.1.20")
            armed = controller.manage({"operation": "start"})
            second = controller.pair(armed["pairing"]["code"], "Two", "192.168.1.21")
            controller.manage({"operation": "preset", "id": first["device"]["id"], "preset": "command"})
            controller.manage({"operation": "notifications", "id": first["device"]["id"], "notifications": {"priorityOnly": False, "connectionEvents": False, "routineResults": True}})
            controller.manage({"operation": "copy-settings", "id": second["device"]["id"], "sourceId": first["device"]["id"]})
            copied = controller.authenticate(second["token"])
            self.assertEqual(copied["role"], "command")
            self.assertFalse(copied["notifications"]["priorityOnly"])
            controller.heartbeat(copied, {"version": "28.2", "network": "wifi"})
            self.assertEqual(controller.authenticate(second["token"])["compatibility"], "compatible")
            controller.heartbeat(copied, {"version": "27.2", "network": "wifi"})
            self.assertEqual(controller.authenticate(second["token"])["compatibility"], "client-outdated")
            controller.heartbeat(copied, {"version": "29.1", "network": "wifi"})
            self.assertEqual(controller.authenticate(second["token"])["compatibility"], "station-outdated")

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

    def test_sensitive_approvals_expire_without_entering_the_command_queue(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Command PADD", "192.168.1.30")
            controller.manage({"operation": "role", "id": paired["device"]["id"], "role": "command"})
            controller.queue_action(controller.authenticate(paired["token"]), {"action": "routine", "value": "routine-1"})
            controller.approvals[0]["expiresAt"] = int(time.time()) - 1
            self.assertEqual(controller.status()["approvals"], [])
            self.assertEqual(controller.pop_commands(), [])
            self.assertTrue(any(item["action"] == "request-expired" for item in controller.status()["activity"]))

    def test_federation_identity_selective_sync_and_offline_delivery(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Federation PADD", "192.168.1.40")
            ident = paired["device"]["id"]
            self.assertTrue(paired["station"]["id"].startswith("station-"))
            self.assertEqual(paired["transport"], "aes-256-gcm")
            controller.manage({"operation": "sync-policy", "id": ident, "sync": {"media": False, "telemetry": False, "notifications": True}})
            controller.sync({"page": "media", "media": [{"id": "spotify"}], "meters": [{"label": "CPU", "value": 50}], "notices": [{"id": "priority", "priority": "priority", "text": "Red alert"}, {"id": "routine", "priority": "routine", "text": "Routine"}]})
            state = controller.state_for(controller.authenticate(paired["token"]))
            self.assertEqual(state["state"]["media"], [])
            self.assertEqual(state["state"]["meters"], [])
            self.assertEqual([item["id"] for item in state["state"]["notices"]], ["priority"])
            controller.manage({"operation": "delivery", "id": ident, "kind": "page", "payload": {"page": "media", "title": "Media Console"}})
            queued = controller.state_for(controller.authenticate(paired["token"]))
            self.assertEqual(queued["queueDepth"], 1)
            self.assertEqual(queued["signal"]["type"], "page")
            controller.acknowledge_signal(queued["device"], queued["signal"]["id"])
            self.assertEqual(controller.state_for(controller.authenticate(paired["token"]))["queueDepth"], 0)

    def test_signed_aes_gcm_transport_rejects_replay(self):
        with tempfile.TemporaryDirectory() as folder:
            controller = self.make_controller(folder)
            armed = controller.manage({"operation": "start"})
            paired = controller.pair(armed["pairing"]["code"], "Secure PADD", "192.168.1.41")
            device, token = paired["device"], paired["token"]
            key = hashlib.sha256(token.encode()).digest()
            route, timestamp, nonce = "/api/padd/action", str(int(time.time())), "nonce-001"
            envelope = seal_json(key, {"action": "media", "value": "play-pause"}, f"POST:{route}:{device['id']}")
            raw = json.dumps(envelope, separators=(",", ":")).encode()
            headers = {"X-LCARS-Device": device["id"], "X-LCARS-Time": timestamp, "X-LCARS-Nonce": nonce, "X-LCARS-Signature": request_signature(key, timestamp, nonce, "POST", route, raw)}
            authenticated, authenticated_key, secure = controller.authenticate_request(headers, "POST", route, raw, "192.168.1.41")
            self.assertTrue(secure)
            self.assertEqual(authenticated["id"], device["id"])
            self.assertEqual(authenticated["transport"], "aes-256-gcm")
            self.assertEqual(controller.status()["devices"][0]["transport"], "aes-256-gcm")
            self.assertEqual(controller.decode_secure_body(authenticated_key, "POST", route, authenticated, raw)["action"], "media")
            response = controller.encode_secure_response(authenticated_key, route, authenticated, {"ok": True})
            self.assertTrue(open_json(key, response, f"RESPONSE:{route}:{device['id']}")["ok"])
            replayed, _, _ = controller.authenticate_request(headers, "POST", route, raw, "192.168.1.41")
            self.assertIsNone(replayed)


if __name__ == "__main__":
    unittest.main()
