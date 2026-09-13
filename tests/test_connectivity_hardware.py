import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

from shared.lcars_connectivity import ConnectivityHardware


class ConnectivityHardwareTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.commands = []

        def runner(argv, **_kwargs):
            self.commands.append(list(argv))
            if argv == ["nmcli", "-t", "-f", "UUID,NAME,TYPE,DEVICE,AUTOCONNECT", "connection", "show"]:
                output = "vpn-1:HOME VPN:vpn::yes\nwifi-1:HOME WIFI:802-11-wireless:wlan0:yes\n"
            elif argv[:5] == ["nmcli", "-g", "802-11-wireless.mode", "connection"]:
                output = "infrastructure\n"
            elif argv == ["nmcli", "-t", "-f", "DEVICE,TYPE", "device"]:
                output = "wlan0:wifi\n"
            elif argv[:2] == ["firewall-cmd", "--state"]:
                output = "running\n"
            elif argv[:2] == ["firewall-cmd", "--get-active-zones"]:
                output = "public\n  interfaces: wlan0\n"
            elif argv[:2] == ["lpstat", "-p"]:
                output = "printer Bridge ready and enabled\n"
            elif argv[:2] == ["lpstat", "-d"]:
                output = "system default destination: Bridge\n"
            elif argv[:2] == ["scanimage", "-L"]:
                output = "device `scan:one' is a Federation Scanner\n"
            elif argv == ["lsusb"]:
                output = "Bus 001 Device 002: ID 1234:5678 LCARS Input Device\n"
            elif argv[:4] == ["ip", "route", "show", "default"]:
                output = "default via 192.168.1.1 dev wlan0\n"
            elif argv[:2] == ["getent", "ahosts"]:
                output = "93.184.216.34 STREAM example.com\n"
            elif argv and argv[0] == "ping":
                output = "64 bytes from 1.1.1.1: time=14.2 ms\n"
            else:
                output = "success\n"
            return SimpleNamespace(returncode=0, stdout=output, stderr="")

        available = {"nmcli", "firewall-cmd", "lpstat", "scanimage", "lsusb", "ip", "getent", "ping"}
        self.service = ConnectivityHardware(
            Path(self.temp.name), "linux", runner=runner,
            which=lambda name: f"/usr/bin/{name}" if name in available else None,
            storage_provider=lambda: [{"id": "/dev/sdb1", "name": "AWAY DATA", "removable": True, "mounted": False}],
            globber=lambda pattern: [],
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_reports_real_capabilities_connections_and_peripherals(self):
        status = self.service.status(True)
        self.assertEqual(status["version"], "31.4")
        self.assertEqual(status["connections"]["vpn"][0]["id"], "vpn-1")
        self.assertEqual(status["connections"]["savedNetworks"][0]["id"], "wifi-1")
        self.assertTrue(status["connections"]["firewall"]["active"])
        self.assertEqual(status["hardware"]["printers"][0]["name"], "Bridge")
        self.assertEqual(status["hardware"]["scanners"][0]["id"], "scan:one")
        self.assertEqual(status["hardware"]["usb"][0]["detail"], "1234:5678")
        self.assertEqual(status["hardware"]["removable"][0]["id"], "/dev/sdb1")

    def test_protected_connection_requires_matching_single_use_portal_approval(self):
        payload = self.service.request_description({"action": "vpn-connect", "target": "vpn-1"})
        approval = {"id": "approval-1", "kind": "authorize", "decision": "approved", "payload": payload}
        with self.assertRaises(PermissionError):
            self.service.operate({"operation": "execute", "action": "vpn-connect", "target": "vpn-1"})
        result = self.service.operate({"operation": "execute", "action": "vpn-connect", "target": "vpn-1"}, approval)
        self.assertTrue(result["ok"])
        self.assertIn(["nmcli", "connection", "up", "uuid", "vpn-1"], self.commands)
        with self.assertRaises(PermissionError):
            self.service.operate({"operation": "execute", "action": "vpn-connect", "target": "vpn-1"}, approval)

    def test_approval_binds_policy_parameters_without_persisting_secrets(self):
        data = {"action": "set-metered", "target": "wifi-1", "metered": "yes"}
        payload = self.service.request_description(data)
        self.assertEqual(payload["parameters"], {"metered": "yes"})
        approval = {"id": "approval-metered", "kind": "authorize", "decision": "approved", "payload": payload}
        with self.assertRaises(PermissionError):
            self.service.operate({"operation": "execute", "action": "set-metered", "target": "wifi-1", "metered": "no"}, approval)

    def test_rejects_unknown_targets_and_enforces_removable_policy(self):
        with self.assertRaises(ValueError):
            self.service.request_description({"action": "vpn-connect", "target": "vpn-1; shutdown"})
        with self.assertRaises(PermissionError):
            self.service.authorize_removable_mount(False)
        changed = self.service.operate({"operation": "set-removable-policy", "policy": "allow", "confirmed": True})
        self.assertEqual(changed["status"]["policy"]["removable"], "allow")
        self.assertTrue(self.service.authorize_removable_mount(False))

    def test_diagnostics_are_explicit_and_bounded(self):
        result = self.service.operate({"operation": "diagnostics"})
        self.assertEqual(result["diagnostics"]["gateway"], "192.168.1.1")
        self.assertEqual(result["diagnostics"]["dns"], "READY")
        self.assertEqual(result["diagnostics"]["internet"], "REACHABLE")
        self.assertEqual(result["diagnostics"]["latencyMs"], 14)
        self.assertTrue(all(isinstance(command, list) for command in self.commands))


if __name__ == "__main__":
    unittest.main()
