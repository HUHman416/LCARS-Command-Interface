"""Capability-aware connectivity and peripheral inventory for LCARS 31.4."""
from __future__ import annotations

import glob
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path


PROTECTED_ACTIONS = {
    "vpn-connect", "vpn-disconnect", "hotspot-start", "hotspot-stop",
    "forget-network", "set-metered",
}
POLICIES = {"ask", "allow", "block"}


def _text(value, limit=160):
    return str(value or "").strip()[:limit]


def _split_escaped(value, separator=":"):
    fields, current, escaped = [], [], False
    for character in str(value):
        if escaped:
            current.append(character)
            escaped = False
        elif character == "\\":
            escaped = True
        elif character == separator:
            fields.append("".join(current))
            current = []
        else:
            current.append(character)
    fields.append("".join(current))
    return fields


class ConnectivityHardware:
    """Report real adapters and execute only reviewed, allowlisted operations."""

    def __init__(self, config_dir, platform="linux", runner=None, which=None, storage_provider=None, globber=None):
        self.config_dir = Path(config_dir)
        self.state_file = self.config_dir / "connectivity-hardware.json"
        self.platform = "windows" if str(platform).lower().startswith("win") else "linux"
        self.runner = runner or subprocess.run
        self.which = which or shutil.which
        self.storage_provider = storage_provider or (lambda: [])
        self.globber = globber or glob.glob
        self.state = self._load()
        self.cache = {"at": 0.0, "value": None}
        self.last_diagnostics = {"ranAt": 0, "gateway": "NOT TESTED", "dns": "NOT TESTED", "internet": "NOT TESTED", "latencyMs": None, "detail": "Run diagnostics for an active station check."}

    def _load(self):
        state = {"schema": 1, "removablePolicy": "ask", "consumedApprovals": []}
        try:
            raw = json.loads(self.state_file.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                policy = _text(raw.get("removablePolicy"), 12).lower()
                state["removablePolicy"] = policy if policy in POLICIES else "ask"
                consumed = raw.get("consumedApprovals", [])
                if isinstance(consumed, list):
                    state["consumedApprovals"] = [_text(item, 64) for item in consumed[-50:] if _text(item, 64)]
        except Exception:
            pass
        return state

    def _save(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.state_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        os.replace(temporary, self.state_file)

    def _run(self, argv, timeout=8):
        return self.runner(list(argv), capture_output=True, text=True, timeout=timeout)

    def _available(self, name):
        return bool(self.which(name))

    def _linux_status(self):
        connections, saved, hotspot = [], [], {"available": False, "active": False, "name": "", "interface": "", "control": False, "reason": "NetworkManager hotspot controls are unavailable"}
        nmcli = self._available("nmcli")
        if nmcli:
            hotspot.update(available=True, control=True, reason="")
            try:
                rows = self._run(["nmcli", "-t", "-f", "UUID,NAME,TYPE,DEVICE,AUTOCONNECT", "connection", "show"], 8).stdout
                for line in rows.splitlines():
                    fields = _split_escaped(line)
                    if len(fields) < 5:
                        continue
                    ident, name, kind, device, autoconnect = fields[:5]
                    if not ident or not name:
                        continue
                    item = {"id": ident, "name": name[:120], "kind": kind, "active": bool(device), "device": device, "autoconnect": autoconnect.casefold() == "yes", "metered": "unknown", "meteredControl": True}
                    if kind in {"vpn", "wireguard"}:
                        connections.append(item)
                    if kind in {"802-11-wireless", "wifi"}:
                        saved.append(item)
                        if device:
                            try:
                                mode = self._run(["nmcli", "-g", "802-11-wireless.mode", "connection", "show", "uuid", ident], 3).stdout.strip().casefold()
                                if mode == "ap":
                                    hotspot.update(active=True, name=name[:120], interface=device)
                            except Exception:
                                pass
                if not hotspot["interface"]:
                    devices = self._run(["nmcli", "-t", "-f", "DEVICE,TYPE", "device"], 4).stdout
                    hotspot["interface"] = next((_split_escaped(row)[0] for row in devices.splitlines() if len(_split_escaped(row)) > 1 and _split_escaped(row)[1] == "wifi"), "")
                hotspot["available"] = bool(hotspot["interface"])
                if not hotspot["available"]:
                    hotspot.update(control=False, reason="No NetworkManager Wi-Fi interface was detected")
            except Exception as exc:
                hotspot.update(control=False, reason=f"NetworkManager inventory failed: {_text(exc, 120)}")

        firewall = {"available": False, "active": False, "provider": "NONE", "profiles": [], "detail": "No supported firewall status adapter was detected"}
        if self._available("firewall-cmd"):
            try:
                state = self._run(["firewall-cmd", "--state"], 4)
                zones = self._run(["firewall-cmd", "--get-active-zones"], 4).stdout.splitlines()
                profiles = [line.strip() for line in zones if line.strip() and not line.startswith(" ")]
                firewall.update(available=True, active=state.returncode == 0 and "running" in state.stdout.casefold(), provider="FIREWALLD", profiles=profiles, detail="Live firewalld state")
            except Exception:
                pass
        elif self._available("ufw"):
            try:
                result = self._run(["ufw", "status"], 5)
                active = bool(re.search(r"(?im)^status:\s*active", result.stdout))
                firewall.update(available=True, active=active, provider="UFW", profiles=["DEFAULT"], detail="Live UFW state")
            except Exception:
                pass

        printers = []
        if self._available("lpstat"):
            try:
                raw = self._run(["lpstat", "-p"], 5).stdout
                for line in raw.splitlines():
                    match = re.match(r"printer\s+(\S+)\s+(.+)", line, re.I)
                    if match:
                        printers.append({"id": match.group(1), "name": match.group(1), "state": _text(match.group(2), 100), "default": False})
                default = self._run(["lpstat", "-d"], 4).stdout.rsplit(":", 1)[-1].strip()
                for item in printers:
                    item["default"] = item["id"] == default
            except Exception:
                pass

        scanners = []
        if self._available("scanimage"):
            try:
                for index, line in enumerate(self._run(["scanimage", "-L"], 8).stdout.splitlines()[:24]):
                    match = re.search(r"device [`']([^`']+)[`'] is (.+)", line)
                    if match:
                        scanners.append({"id": match.group(1), "name": _text(match.group(2), 120), "state": "READY"})
                    elif line.strip():
                        scanners.append({"id": f"scanner-{index}", "name": _text(line, 120), "state": "DETECTED"})

            except Exception:
                pass

        cameras = []
        for path_string in sorted(self.globber("/dev/video*"))[:24]:
            path = Path(path_string)
            name = path.name
            try:
                name = (Path("/sys/class/video4linux") / path.name / "name").read_text(encoding="utf-8").strip() or name
            except Exception:
                pass
            cameras.append({"id": str(path), "name": _text(name, 120), "state": "PRESENT"})

        controllers = []
        for path_string in sorted(self.globber("/dev/input/js*"))[:24]:
            path = Path(path_string)
            name = path.name
            try:
                name = (Path("/sys/class/input") / path.name / "device/name").read_text(encoding="utf-8").strip() or name
            except Exception:
                pass
            controllers.append({"id": str(path), "name": _text(name, 120), "state": "CONNECTED"})

        usb = []
        if self._available("lsusb"):
            try:
                for index, line in enumerate(self._run(["lsusb"], 6).stdout.splitlines()[:64]):
                    match = re.match(r"Bus\s+(\d+)\s+Device\s+(\d+):\s+ID\s+([0-9a-f:]+)\s*(.*)", line, re.I)
                    if match:
                        bus, device, vendor, name = match.groups()
                        usb.append({"id": f"{bus}:{device}:{vendor}", "name": _text(name or vendor, 120), "state": "CONNECTED", "detail": vendor.upper()})
            except Exception:
                pass
        capabilities = {
            "vpn": nmcli, "hotspot": hotspot["control"], "firewall": firewall["available"],
            "savedNetworks": nmcli, "metered": nmcli, "diagnostics": self._available("ip"),
            "printers": self._available("lpstat"), "scanners": self._available("scanimage"),
            "cameras": bool(cameras), "controllers": bool(controllers), "usb": self._available("lsusb"),
        }
        return connections, saved, hotspot, firewall, printers, scanners, cameras, controllers, usb, capabilities

    def _windows_json(self, script, timeout=12):
        if not self._available("powershell") and not self._available("powershell.exe"):
            return {}
        executable = self.which("powershell.exe") or self.which("powershell") or "powershell"
        result = self._run([executable, "-NoProfile", "-NonInteractive", "-Command", script], timeout)
        if result.returncode != 0:
            return {}
        try:
            return json.loads(result.stdout or "{}")
        except Exception:
            return {}

    def _windows_status(self):
        script = r'''$vpn=@();try{$vpn=@(Get-VpnConnection -ErrorAction Stop|ForEach-Object{[pscustomobject]@{id=$_.Name;name=$_.Name;kind='vpn';active=($_.ConnectionStatus -eq 'Connected');device='';autoconnect=$false;metered='unknown';meteredControl=$false}})}catch{};$fire=@();try{$fire=@(Get-NetFirewallProfile|ForEach-Object{[pscustomobject]@{name=$_.Name;enabled=[bool]$_.Enabled}})}catch{};$printers=@();try{$printers=@(Get-Printer|ForEach-Object{[pscustomobject]@{id=$_.Name;name=$_.Name;state=[string]$_.PrinterStatus;default=$false}})}catch{};$pnp=@();try{$pnp=@(Get-PnpDevice -PresentOnly|Where-Object{$_.Status -eq 'OK'}|Select-Object Class,FriendlyName,InstanceId)}catch{};[pscustomobject]@{vpn=$vpn;firewall=$fire;printers=$printers;pnp=$pnp}|ConvertTo-Json -Depth 6 -Compress'''
        data = self._windows_json(script, 15)
        connections = data.get("vpn", []) if isinstance(data, dict) else []
        connections = [connections] if isinstance(connections, dict) else connections if isinstance(connections, list) else []
        profiles = data.get("firewall", []) if isinstance(data, dict) else []
        profiles = [profiles] if isinstance(profiles, dict) else profiles if isinstance(profiles, list) else []
        firewall = {"available": bool(profiles), "active": bool(profiles) and all(bool(item.get("enabled")) for item in profiles), "provider": "WINDOWS DEFENDER FIREWALL", "profiles": [_text(item.get("name"), 80) for item in profiles if item.get("enabled")], "detail": "Live Windows firewall profile state" if profiles else "Windows firewall status was unavailable"}
        printers = data.get("printers", []) if isinstance(data, dict) else []
        printers = [printers] if isinstance(printers, dict) else printers if isinstance(printers, list) else []
        pnp = data.get("pnp", []) if isinstance(data, dict) else []
        pnp = [pnp] if isinstance(pnp, dict) else pnp if isinstance(pnp, list) else []
        def devices(classes):
            return [{"id": _text(item.get("InstanceId"), 240), "name": _text(item.get("FriendlyName") or item.get("Class"), 120), "state": "CONNECTED"} for item in pnp if _text(item.get("Class"), 40).casefold() in classes]
        cameras = devices({"camera", "image"})
        controllers = devices({"gamecontroller", "hidclass"})
        usb = devices({"usb"})
        scanners = devices({"image"})
        saved = []
        try:
            netsh = self._run(["netsh", "wlan", "show", "profiles"], 8).stdout
            for index, name in enumerate(re.findall(r"(?im)^\s*(?:All User Profile|User Profile)\s*:\s*(.+)$", netsh)[:50]):
                clean = _text(name, 120)
                saved.append({"id": clean, "name": clean, "kind": "wifi", "active": False, "device": "", "autoconnect": True, "metered": "unknown", "meteredControl": False})
        except Exception:
            pass
        hotspot = {"available": False, "active": False, "name": "", "interface": "", "control": False, "reason": "Windows does not expose a stable local command adapter for Mobile Hotspot"}
        capabilities = {"vpn": bool(connections) or bool(self.which("rasdial")), "hotspot": False, "firewall": bool(profiles), "savedNetworks": bool(saved), "metered": False, "diagnostics": bool(self.which("powershell.exe") or self.which("powershell")), "printers": bool(printers), "scanners": bool(scanners), "cameras": bool(cameras), "controllers": bool(controllers), "usb": bool(usb)}
        return connections, saved, hotspot, firewall, printers, scanners, cameras, controllers, usb, capabilities

    def status(self, refresh=False):
        if not refresh and self.cache["value"] and time.time() - self.cache["at"] < 10:
            return self.cache["value"]
        inventory = self._windows_status() if self.platform == "windows" else self._linux_status()
        connections, saved, hotspot, firewall, printers, scanners, cameras, controllers, usb, capabilities = inventory
        try:
            removable = [item for item in self.storage_provider() if item.get("removable")]
        except Exception:
            removable = []
        value = {
            "ok": True, "version": "31.4", "platform": self.platform,
            "capabilities": capabilities,
            "connections": {"vpn": connections, "hotspot": hotspot, "savedNetworks": saved, "firewall": firewall},
            "hardware": {"printers": printers, "scanners": scanners, "cameras": cameras, "controllers": controllers, "usb": usb, "removable": removable},
            "policy": {"removable": self.state["removablePolicy"], "scope": "LCARS mount controls"},
            "diagnostics": dict(self.last_diagnostics),
        }
        self.cache.update(at=time.time(), value=value)
        return value

    def request_description(self, data):
        action = _text(data.get("action"), 32).lower()
        target = _text(data.get("target"), 180)
        parameters = {}
        if action not in PROTECTED_ACTIONS:
            raise ValueError("This connectivity operation does not use protected authorization")
        inventory = self.status(True)
        if action.startswith("vpn-") and target not in {item.get("id") for item in inventory["connections"]["vpn"]}:
            raise ValueError("The selected VPN profile is no longer present")
        if action in {"forget-network", "set-metered"} and target not in {item.get("id") for item in inventory["connections"]["savedNetworks"]}:
            raise ValueError("The selected saved network is no longer present")
        if action == "set-metered":
            metered = _text(data.get("metered"), 12).lower()
            if metered not in {"yes", "no", "unknown"}:
                raise ValueError("Metered policy must be yes, no, or unknown")
            parameters["metered"] = metered
        if action == "hotspot-start":
            ssid, secret = _text(data.get("ssid"), 32), str(data.get("secret") or "")
            if not inventory["connections"]["hotspot"].get("control"):
                raise RuntimeError(inventory["connections"]["hotspot"].get("reason") or "Hotspot control is unavailable")
            if not re.fullmatch(r"[^\x00-\x1f]{1,32}", ssid) or not 8 <= len(secret) <= 63:
                raise ValueError("Hotspot name must be 1–32 characters and its password 8–63 characters")
            parameters["ssid"] = ssid
        return {"subsystem": "connectivity-hardware", "operation": action, "target": target, "parameters": parameters, "label": action.replace("-", " ").upper()}

    def _approved(self, action, target, data, request):
        if not isinstance(request, dict) or request.get("kind") != "authorize" or request.get("decision") != "approved":
            raise PermissionError("Approve this connection request in Portal Center before execution")
        payload = request.get("payload") if isinstance(request.get("payload"), dict) else {}
        if payload.get("subsystem") != "connectivity-hardware" or payload.get("operation") != action or _text(payload.get("target"), 180) != target:
            raise PermissionError("Portal approval does not match this connection operation")
        parameters = payload.get("parameters") if isinstance(payload.get("parameters"), dict) else {}
        if action == "set-metered" and _text(parameters.get("metered"), 12).lower() != _text(data.get("metered"), 12).lower():
            raise PermissionError("Portal approval does not match this metered-network policy")
        if action == "hotspot-start" and _text(parameters.get("ssid"), 32) != _text(data.get("ssid"), 32):
            raise PermissionError("Portal approval does not match this hotspot network")
        ident = _text(request.get("id"), 64)
        if not ident or ident in self.state["consumedApprovals"]:
            raise PermissionError("Portal approval has already been used")
        return ident

    def _run_diagnostics(self):
        started = time.time()
        gateway, dns, internet, detail = "UNAVAILABLE", "UNAVAILABLE", "UNAVAILABLE", []
        if self.platform == "windows":
            data = self._windows_json(r'''$route=Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue|Sort-Object RouteMetric|Select-Object -First 1;$dns=$false;try{Resolve-DnsName example.com -DnsOnly -ErrorAction Stop|Out-Null;$dns=$true}catch{};$net=Test-NetConnection 1.1.1.1 -InformationLevel Detailed -WarningAction SilentlyContinue;[pscustomobject]@{gateway=[string]$route.NextHop;dns=$dns;internet=[bool]$net.PingSucceeded;latency=$null}|ConvertTo-Json -Compress''', 10)
            gateway = _text(data.get("gateway"), 80) or "NONE"
            dns = "READY" if data.get("dns") else "FAILED"
            internet = "REACHABLE" if data.get("internet") else "UNREACHABLE"
        else:
            try:
                output = self._run(["ip", "route", "show", "default"], 4).stdout.split()
                gateway = output[output.index("via") + 1] if "via" in output else "NONE"
            except Exception:
                gateway = "UNAVAILABLE"
            if self._available("getent"):
                try:
                    dns = "READY" if self._run(["getent", "ahosts", "example.com"], 5).returncode == 0 else "FAILED"
                except Exception:
                    dns = "FAILED"
            if self._available("ping"):
                try:
                    result = self._run(["ping", "-c", "1", "-W", "2", "1.1.1.1"], 5)
                    internet = "REACHABLE" if result.returncode == 0 else "UNREACHABLE"
                    match = re.search(r"time[=<]([0-9.]+)\s*ms", result.stdout)
                    latency = round(float(match.group(1))) if match else None
                except Exception:
                    internet, latency = "FAILED", None
            else:
                latency = None
        if self.platform == "windows":
            latency = None
        detail.append("Active route checked locally")
        detail.append("DNS lookup requested" if dns != "UNAVAILABLE" else "DNS adapter unavailable")
        self.last_diagnostics = {"ranAt": int(time.time() * 1000), "gateway": gateway, "dns": dns, "internet": internet, "latencyMs": latency, "detail": " · ".join(detail), "durationMs": round((time.time() - started) * 1000)}
        self.cache["at"] = 0
        return {"ok": True, "message": "Connection diagnostics completed", "diagnostics": dict(self.last_diagnostics)}

    def authorize_removable_mount(self, confirmed=False):
        """Apply the LCARS-local policy before invoking a removable mount adapter."""
        policy = self.state["removablePolicy"]
        if policy == "block":
            raise PermissionError("LCARS removable-device policy blocks mounting")
        if policy == "ask" and not confirmed:
            raise PermissionError("Confirm this removable-device mount in LCARS")
        return True

    def operate(self, data, approval=None):
        operation = _text(data.get("operation"), 32).lower()
        if operation == "diagnostics":
            return self._run_diagnostics()
        if operation == "set-removable-policy":
            policy = _text(data.get("policy"), 12).lower()
            if policy not in POLICIES:
                raise ValueError("Removable policy must be ask, allow, or block")
            if not bool(data.get("confirmed")):
                raise PermissionError("Confirm the removable-device policy change")
            self.state["removablePolicy"] = policy
            self._save()
            self.cache["at"] = 0
            return {"ok": True, "message": f"LCARS removable-device policy set to {policy.upper()}", "status": self.status(True)}
        action = _text(data.get("action"), 32).lower()
        target = _text(data.get("target"), 180)
        if operation != "execute" or action not in PROTECTED_ACTIONS:
            raise ValueError("Unsupported Connectivity and Hardware operation")
        approval_id = self._approved(action, target, data, approval)
        inventory = self.status(True)
        if self.platform == "linux":
            if not self._available("nmcli"):
                raise RuntimeError("NetworkManager command controls are unavailable")
            if action == "vpn-connect":
                command = ["nmcli", "connection", "up", "uuid", target]
            elif action == "vpn-disconnect":
                command = ["nmcli", "connection", "down", "uuid", target]
            elif action == "forget-network":
                command = ["nmcli", "connection", "delete", "uuid", target]
            elif action == "set-metered":
                policy = _text(data.get("metered"), 12).lower()
                if policy not in {"yes", "no", "unknown"}:
                    raise ValueError("Metered policy must be yes, no, or unknown")
                command = ["nmcli", "connection", "modify", "uuid", target, "connection.metered", policy]
            elif action == "hotspot-stop":
                hotspot = inventory["connections"]["hotspot"]
                profile = next((item for item in inventory["connections"]["savedNetworks"] if item.get("active") and item.get("name") == hotspot.get("name")), None)
                if not profile:
                    raise ValueError("An active LCARS-manageable hotspot was not found")
                command = ["nmcli", "connection", "down", "uuid", profile["id"]]
            else:
                hotspot = inventory["connections"]["hotspot"]
                ssid, secret = _text(data.get("ssid"), 32), str(data.get("secret") or "")
                if not re.fullmatch(r"[^\x00-\x1f]{1,32}", ssid) or not 8 <= len(secret) <= 63:
                    raise ValueError("Hotspot name or password is invalid")
                command = ["nmcli", "device", "wifi", "hotspot", "ifname", hotspot["interface"], "con-name", "LCARS-HOTSPOT", "ssid", ssid, "password", secret]
            result = self._run(command, 35)
        else:
            if action not in {"vpn-connect", "vpn-disconnect", "forget-network"}:
                raise RuntimeError("This Windows connection control has no safe command adapter")
            if action == "forget-network":
                result = self._run(["netsh", "wlan", "delete", "profile", f"name={target}"], 15)
            else:
                result = self._run(["rasdial", target, "/disconnect"] if action == "vpn-disconnect" else ["rasdial", target], 30)
        if result.returncode != 0:
            raise RuntimeError(_text(result.stderr or result.stdout or "The platform rejected the connection operation", 300))
        self.state["consumedApprovals"] = [*self.state["consumedApprovals"][-49:], approval_id]
        self._save()
        self.cache["at"] = 0
        return {"ok": True, "message": f"{action.replace('-', ' ').title()} completed", "status": self.status(True)}
