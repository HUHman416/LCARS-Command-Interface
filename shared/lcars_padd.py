#!/usr/bin/env python3
"""Guarded local-network PADD and mobile Home service for LCARS Version 29."""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import mimetypes
import secrets
import socket
import threading
import time
import uuid
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PADD_PORT = 8766
MAX_BODY = 65_536
ROLES = {"viewer": 0, "operator": 1, "command": 2}
ACTION_ROLES = {
    "navigate": "operator",
    "media": "operator",
    "volume": "operator",
    "dnd": "command",
    "routine": "command",
    "app": "command",
    "workstation": "command",
    "notice-read": "operator",
    "notice-archive": "operator",
    "notice-dismiss-all": "operator",
    "quick": "operator",
    "handoff": "operator",
    "clipboard": "command",
}
PERMISSION_NAMES = tuple(ACTION_ROLES) + ("autoApprove", "communications", "telemetry")
APPROVAL_ACTIONS = {"routine", "app", "workstation", "handoff", "clipboard"}
APPROVAL_TTL = 120
DEFAULT_WIDGETS = ["status", "media", "communications", "telemetry", "quick-actions"]
DEFAULT_NOTIFICATIONS = {"priorityOnly": True, "connectionEvents": True, "routineResults": True}
PERMISSION_PRESETS = {
    "viewer": {"role": "viewer", "permissions": {"communications": True, "telemetry": True}},
    "operator": {"role": "operator", "permissions": {
        "navigate": True, "media": True, "volume": True, "quick": True,
        "communications": True, "telemetry": True, "notice-read": True,
        "notice-archive": True, "notice-dismiss-all": True, "handoff": True,
    }},
    "command": {"role": "command", "permissions": {
        "navigate": True, "media": True, "volume": True, "quick": True,
        "communications": True, "telemetry": True, "notice-read": True,
        "notice-archive": True, "notice-dismiss-all": True, "handoff": True,
        "dnd": True, "routine": True, "app": True, "workstation": True,
        "clipboard": True, "autoApprove": False,
    }},
}


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _clean_text(value, limit=80):
    return " ".join(str(value or "").split())[:limit]


def _bounded_int(value, minimum, maximum, fallback=0):
    try:
        return max(minimum, min(maximum, int(value)))
    except (TypeError, ValueError):
        return fallback


def _clean_clipboard(value, limit=4000):
    return str(value or "").replace("\x00", "")[:limit]


class PaddController:
    """Own pairing, role enforcement, shared state, and the PADD HTTP server."""

    def __init__(self, config_dir: Path, asset_dir: Path, version: str, platform: str, listen: bool = True):
        self.config_dir = Path(config_dir)
        self.asset_dir = Path(asset_dir)
        self.version = version
        self.platform = platform
        self.listen = listen
        self.device_file = self.config_dir / "padd-devices.json"
        self.lock = threading.RLock()
        self.pairing = None
        self.failed_attempts = {}
        self.commands = deque(maxlen=100)
        self.approvals = deque(maxlen=100)
        self.events = deque(maxlen=100)
        self.signals = {}
        self.presence = {}
        self.shared_state = {
            "page": "overview",
            "theme": "classic",
            "volume": 0,
            "muted": False,
            "media": [],
            "meters": [],
            "routines": [],
            "apps": [],
            "notices": [],
            "doNotDisturb": False,
            "activeWorkstation": "",
            "workstations": [],
            "quickActions": [],
            "routineStatus": [],
            "handoff": None,
            "accessibility": {},
            "release": {},
            "updatedAt": 0,
        }
        self.server = None
        self.server_error = ""

    def _load(self):
        try:
            value = json.loads(self.device_file.read_text(encoding="utf-8"))
            value = value if isinstance(value, dict) else {}
            devices = value.get("devices", [])
            clean = []
            for device in devices[:24]:
                if not isinstance(device, dict) or not str(device.get("tokenHash", "")):
                    continue
                role = str(device.get("role", "viewer"))
                permissions = device.get("permissions", {}) if isinstance(device.get("permissions"), dict) else {}
                notifications = device.get("notifications", {}) if isinstance(device.get("notifications"), dict) else {}
                clean.append({
                    "id": _clean_text(device.get("id"), 64),
                    "name": _clean_text(device.get("name") or "PADD", 48),
                    "role": role if role in ROLES else "viewer",
                    "tokenHash": str(device.get("tokenHash")),
                    "createdAt": int(device.get("createdAt", 0) or 0),
                    "lastSeen": int(device.get("lastSeen", 0) or 0),
                    "lastAddress": _clean_text(device.get("lastAddress"), 64),
                    "connectionCount": max(0, int(device.get("connectionCount", 0) or 0)),
                    "battery": _bounded_int(device.get("battery", -1), -1, 100, -1),
                    "network": _clean_text(device.get("network"), 32),
                    "latencyMs": max(0, min(60_000, int(device.get("latencyMs", 0) or 0))),
                    "clientVersion": _clean_text(device.get("clientVersion"), 32),
                    "permissions": {name: bool(permissions[name]) for name in PERMISSION_NAMES if name in permissions},
                    "widgets": [str(item) for item in device.get("widgets", DEFAULT_WIDGETS) if str(item) in DEFAULT_WIDGETS][:8] or list(DEFAULT_WIDGETS),
                    "workstation": _clean_text(device.get("workstation"), 64),
                    "proximity": bool(device.get("proximity", False)),
                    "notifications": {name: bool(notifications.get(name, default)) for name, default in DEFAULT_NOTIFICATIONS.items()},
                })
            activity = value.get("activity", []) if isinstance(value.get("activity"), list) else []
            activity = [item for item in activity[-200:] if isinstance(item, dict)]
            return {
                "schema": 3,
                "enabled": bool(value.get("enabled", False)),
                "clipboardEnabled": bool(value.get("clipboardEnabled", False)),
                "devices": clean,
                "activity": activity,
            }
        except Exception:
            return {"schema": 3, "enabled": False, "clipboardEnabled": False, "devices": [], "activity": []}

    def _save(self, value):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.device_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
        temporary.replace(self.device_file)

    def _addresses(self):
        found = set()
        def private(address):
            try:
                value = ipaddress.ip_address(address)
                return value.version == 4 and value.is_private and not value.is_loopback and not value.is_link_local
            except ValueError:
                return False
        try:
            for row in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                address = row[4][0]
                if private(address):
                    found.add(address)
        except Exception:
            pass
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
                probe.connect(("8.8.8.8", 80))
                address = probe.getsockname()[0]
            if private(address):
                found.add(address)
        except Exception:
            pass
        return [f"http://{address}:{PADD_PORT}" for address in sorted(found)]

    @staticmethod
    def _version_tuple(value):
        pieces = []
        for part in str(value or "").replace("v", "", 1).split(".")[:2]:
            digits = "".join(character for character in part if character.isdigit())
            if not digits:
                break
            pieces.append(int(digits))
        return tuple(pieces) if len(pieces) == 2 else None

    def _compatibility(self, client_version):
        client = self._version_tuple(client_version)
        station = self._version_tuple(self.version)
        if not client or not station:
            return "unknown"
        # Decimal identifiers are development milestones, not separate protocol
        # generations. Devices remain compatible within the same major LCARS
        # release and warn only across major versions.
        if client[0] == station[0]:
            return "compatible"
        return "client-outdated" if client[0] < station[0] else "station-outdated"

    def _public_device(self, device):
        result = {key: device.get(key) for key in (
            "id", "name", "role", "createdAt", "lastSeen", "lastAddress", "connectionCount",
            "battery", "network", "latencyMs", "clientVersion", "permissions", "widgets",
            "workstation", "proximity", "notifications",
        )}
        result["online"] = bool(device.get("lastSeen") and int(time.time()) - int(device["lastSeen"]) <= 20)
        result["compatibility"] = self._compatibility(device.get("clientVersion"))
        return result

    @staticmethod
    def _append_activity(record, action, device=None, status="complete", detail=""):
        item = {
            "id": uuid.uuid4().hex,
            "action": _clean_text(action, 64),
            "device": _clean_text((device or {}).get("id"), 64),
            "deviceName": _clean_text((device or {}).get("name") or "LCARS CORE", 48),
            "status": _clean_text(status, 24),
            "detail": _clean_text(detail, 160),
            "createdAt": int(time.time()),
        }
        record["activity"] = [*record.get("activity", [])[-199:], item]
        return item

    def _refresh_presence(self, record):
        changed = False
        now = int(time.time())
        for device in record["devices"]:
            online = bool(device.get("lastSeen") and now - int(device["lastSeen"]) <= 20)
            previous = self.presence.get(device["id"])
            self.presence[device["id"]] = online
            if previous is None or previous == online:
                continue
            event = {
                "id": uuid.uuid4().hex,
                "type": "device-connected" if online else "device-disconnected",
                "device": device["id"],
                "deviceName": device["name"],
                "workstation": device.get("workstation", ""),
                "proximity": bool(device.get("proximity", False)),
                "createdAt": now,
            }
            self.events.append(event)
            self._append_activity(record, event["type"], device, detail=device.get("network", ""))
            changed = True
        return changed

    def _expire_approvals(self, record):
        now = int(time.time())
        active = deque(maxlen=100)
        changed = False
        for item in self.approvals:
            if int(item.get("expiresAt", int(item.get("createdAt", now)) + APPROVAL_TTL)) > now:
                active.append(item)
                continue
            device = next((candidate for candidate in record["devices"] if candidate["id"] == item.get("device")), None)
            self._append_activity(record, "request-expired", device, status="expired", detail=item.get("action", "request"))
            changed = True
        self.approvals = active
        return changed

    @staticmethod
    def _capability(device, action):
        required = ACTION_ROLES.get(action)
        if not required or ROLES.get(device.get("role", "viewer"), 0) < ROLES[required]:
            return False
        override = (device.get("permissions") or {}).get(action)
        return bool(override) if override is not None else True

    def status(self, include_pairing=False):
        with self.lock:
            record = self._load()
            expired = self._expire_approvals(record)
            if self._refresh_presence(record):
                self._save(record)
            elif expired:
                self._save(record)
            active = self.pairing if self.pairing and self.pairing["expiresAt"] > time.time() else None
            if not active:
                self.pairing = None
            result = {
                "ok": True,
                "enabled": record["enabled"],
                "online": self.server is not None and not self.server_error,
                "error": self.server_error,
                "port": PADD_PORT,
                "version": self.version,
                "platform": self.platform,
                "addresses": self._addresses(),
                "devices": [self._public_device(item) for item in record["devices"]],
                "clipboardEnabled": record["clipboardEnabled"],
                "activity": list(reversed(record["activity"][-60:])),
                "approvals": [{key: item.get(key) for key in ("id", "action", "value", "device", "deviceName", "createdAt", "expiresAt")} for item in self.approvals],
                "diagnostics": {
                    "connected": sum(1 for item in record["devices"] if self._public_device(item)["online"]),
                    "paired": len(record["devices"]),
                    "pendingApprovals": len(self.approvals),
                    "queuedCommands": len(self.commands),
                    "eventBacklog": len(self.events),
                },
                "pairing": None,
            }
            if active:
                result["pairing"] = {"expiresAt": active["expiresAt"]}
                if include_pairing:
                    result["pairing"]["code"] = active["code"]
            return result

    def manage(self, data):
        operation = str(data.get("operation", "status"))
        with self.lock:
            record = self._load()
            if self._expire_approvals(record):
                self._save(record)
            if operation in ("enable", "start"):
                record["enabled"] = True
                code = f"{secrets.randbelow(1_000_000):06d}"
                self.pairing = {"code": code, "digest": hashlib.sha256(code.encode()).hexdigest(), "expiresAt": int(time.time()) + 300}
                self._save(record)
                if self.listen:
                    self.start(force=True)
                return {**self.status(True), "message": "One-use PADD pairing code armed for five minutes"}
            if operation == "disable":
                record["enabled"] = False
                self.pairing = None
                self._save(record)
                self.stop()
                return {**self.status(True), "message": "PADD companion link disabled"}
            if operation == "revoke":
                ident = _clean_text(data.get("id"), 64)
                target = next((item for item in record["devices"] if item["id"] == ident), None)
                record["devices"] = [item for item in record["devices"] if item["id"] != ident]
                self.approvals = deque((item for item in self.approvals if item["device"] != ident), maxlen=100)
                self._append_activity(record, "device-revoked", target, detail="Access token revoked")
                self._save(record)
                return {**self.status(True), "message": "Paired PADD access revoked"}
            if operation == "role":
                ident, role = _clean_text(data.get("id"), 64), str(data.get("role", "viewer"))
                if role not in ROLES:
                    raise ValueError("Unknown PADD role")
                matched = False
                for item in record["devices"]:
                    if item["id"] == ident:
                        item["role"] = role
                        matched = True
                if not matched:
                    raise ValueError("Paired PADD was not found")
                self._append_activity(record, "role-changed", next(item for item in record["devices"] if item["id"] == ident), detail=role)
                self._save(record)
                return {**self.status(True), "message": f"PADD role changed to {role.upper()}"}
            if operation in {"rename", "permissions", "profile", "layout", "proximity", "identify", "notifications", "preset", "copy-settings"}:
                ident = _clean_text(data.get("id"), 64)
                device = next((item for item in record["devices"] if item["id"] == ident), None)
                if not device:
                    raise ValueError("Paired PADD was not found")
                if operation == "rename":
                    device["name"] = _clean_text(data.get("value") or data.get("name") or "PADD", 48)
                elif operation == "permissions":
                    values = data.get("permissions", {}) if isinstance(data.get("permissions"), dict) else {}
                    device["permissions"] = {name: bool(values[name]) for name in PERMISSION_NAMES if name in values}
                elif operation == "profile":
                    device["workstation"] = _clean_text(data.get("value") or data.get("workstation"), 64)
                elif operation == "layout":
                    values = data.get("widgets", []) if isinstance(data.get("widgets"), list) else []
                    device["widgets"] = [str(item) for item in values if str(item) in DEFAULT_WIDGETS][:8] or list(DEFAULT_WIDGETS)
                elif operation == "proximity":
                    device["proximity"] = bool(data.get("enabled", data.get("value", False)))
                elif operation == "notifications":
                    values = data.get("notifications", {}) if isinstance(data.get("notifications"), dict) else {}
                    device["notifications"] = {name: bool(values.get(name, device.get("notifications", DEFAULT_NOTIFICATIONS).get(name, default))) for name, default in DEFAULT_NOTIFICATIONS.items()}
                elif operation == "preset":
                    preset_name = str(data.get("preset", data.get("value", ""))).lower()
                    preset = PERMISSION_PRESETS.get(preset_name)
                    if not preset:
                        raise ValueError("Unknown permission preset")
                    device["role"] = preset["role"]
                    device["permissions"] = dict(preset["permissions"])
                elif operation == "copy-settings":
                    source_id = _clean_text(data.get("sourceId"), 64)
                    source = next((item for item in record["devices"] if item["id"] == source_id and item["id"] != ident), None)
                    if not source:
                        raise ValueError("Source PADD was not found")
                    for name in ("role", "permissions", "widgets", "notifications"):
                        device[name] = json.loads(json.dumps(source.get(name, {} if name in {"permissions", "notifications"} else [])))
                else:
                    self.signals[ident] = {"id": uuid.uuid4().hex, "type": "identify", "createdAt": int(time.time())}
                self._append_activity(record, operation, device, detail=_clean_text(data.get("value"), 96))
                self._save(record)
                return {**self.status(True), "message": f"PADD {operation} updated"}
            if operation == "clipboard":
                record["clipboardEnabled"] = bool(data.get("enabled", data.get("value", False)))
                self._append_activity(record, "clipboard-sharing", detail="enabled" if record["clipboardEnabled"] else "disabled")
                self._save(record)
                return {**self.status(True), "message": f"Text clipboard sharing {'enabled' if record['clipboardEnabled'] else 'disabled'}"}
            if operation in {"approve", "deny"}:
                ident = _clean_text(data.get("approvalId") or data.get("id"), 64)
                pending = next((item for item in self.approvals if item["id"] == ident), None)
                if not pending:
                    raise ValueError("Approval request was not found")
                self.approvals = deque((item for item in self.approvals if item["id"] != ident), maxlen=100)
                if operation == "approve":
                    pending["approvedAt"] = int(time.time())
                    self.commands.append(pending)
                device = next((item for item in record["devices"] if item["id"] == pending["device"]), None)
                outcome = "approved" if operation == "approve" else "denied"
                self._append_activity(record, f"request-{outcome}", device, status=outcome, detail=pending["action"])
                self._save(record)
                return {**self.status(True), "message": f"PADD request {outcome}"}
            return self.status(True)

    def pair(self, code, name, address):
        with self.lock:
            record = self._load()
            now = time.time()
            attempts = [stamp for stamp in self.failed_attempts.get(address, []) if now - stamp < 600]
            self.failed_attempts[address] = attempts
            if len(attempts) >= 8:
                raise PermissionError("Too many pairing attempts; wait ten minutes")
            active = self.pairing if self.pairing and self.pairing["expiresAt"] > now else None
            digest = hashlib.sha256(_clean_text(code, 12).encode()).hexdigest()
            if not record["enabled"] or not active or not hmac.compare_digest(active["digest"], digest):
                attempts.append(now)
                raise PermissionError("Pairing code is invalid or expired")
            token = secrets.token_urlsafe(36)
            device = {
                "id": "padd-" + uuid.uuid4().hex[:16],
                "name": _clean_text(name or "Personal PADD", 48),
                "role": "operator",
                "tokenHash": hashlib.sha256(token.encode()).hexdigest(),
                "createdAt": int(now),
                "lastSeen": int(now),
                "lastAddress": _clean_text(address, 64),
                "connectionCount": 1,
                "battery": -1,
                "network": "local-network",
                "latencyMs": 0,
                "clientVersion": "",
                "permissions": {},
                "widgets": list(DEFAULT_WIDGETS),
                "workstation": "",
                "proximity": False,
                "notifications": dict(DEFAULT_NOTIFICATIONS),
            }
            record["devices"] = [*record["devices"][-23:], device]
            self._append_activity(record, "device-paired", device, detail=address)
            self.pairing = None
            self._save(record)
            return {"ok": True, "token": token, "device": self._public_device(device), "version": self.version, "message": "PADD paired"}

    def authenticate(self, token, address=""):
        digest = hashlib.sha256(str(token or "").encode()).hexdigest()
        with self.lock:
            record = self._load()
            if not record["enabled"]:
                return None
            for device in record["devices"]:
                if hmac.compare_digest(device["tokenHash"], digest):
                    now = int(time.time())
                    was_online = bool(device.get("lastSeen") and now - int(device["lastSeen"]) <= 20)
                    if now - device["lastSeen"] > 5 or (address and address != device.get("lastAddress")):
                        device["lastSeen"] = now
                        if address:
                            device["lastAddress"] = _clean_text(address, 64)
                        if not was_online:
                            device["connectionCount"] = int(device.get("connectionCount", 0)) + 1
                        self._save(record)
                    return self._public_device(device)
        return None

    def heartbeat(self, device, data, address=""):
        with self.lock:
            record = self._load()
            target = next((item for item in record["devices"] if item["id"] == device["id"]), None)
            if not target:
                raise PermissionError("PADD authorization required")
            target["lastSeen"] = int(time.time())
            target["lastAddress"] = _clean_text(address or target.get("lastAddress"), 64)
            target["battery"] = _bounded_int(data.get("battery", -1), -1, 100, -1)
            target["network"] = _clean_text(data.get("network") or "local-network", 32)
            target["latencyMs"] = max(0, min(60_000, int(data.get("latencyMs", 0) or 0)))
            target["clientVersion"] = _clean_text(data.get("version"), 32)
            self._refresh_presence(record)
            self._save(record)
            return {"ok": True, "device": self._public_device(target)}

    def mobile_preferences(self, device, data):
        with self.lock:
            record = self._load()
            target = next((item for item in record["devices"] if item["id"] == device["id"]), None)
            if not target:
                raise PermissionError("PADD authorization required")
            widgets = data.get("widgets", []) if isinstance(data.get("widgets"), list) else []
            target["widgets"] = [str(item) for item in widgets if str(item) in DEFAULT_WIDGETS][:8] or list(DEFAULT_WIDGETS)
            self._append_activity(record, "padd-layout", target, detail=", ".join(target["widgets"]))
            self._save(record)
            return {"ok": True, "device": self._public_device(target), "message": "PADD layout saved"}

    def mobile_status(self):
        status = self.status(False)
        return {key: status[key] for key in ("enabled", "online", "version", "platform")}

    def state_for(self, device):
        with self.lock:
            state = json.loads(json.dumps(self.shared_state))
            signal = self.signals.get(device["id"])
            clipboard_enabled = self._load()["clipboardEnabled"]
        if not self._capability(device, "app"):
            state["apps"] = []
        if not (device.get("permissions") or {}).get("communications", True):
            state["notices"] = []
        if not (device.get("permissions") or {}).get("telemetry", True):
            state["meters"] = []
        state["widgets"] = device.get("widgets") or list(DEFAULT_WIDGETS)
        capabilities = {name: self._capability(device, name) for name in ACTION_ROLES}
        capabilities["clipboard"] = capabilities["clipboard"] and clipboard_enabled
        return {
            "ok": True,
            "device": device,
            "stationVersion": self.version,
            "compatibility": self._compatibility(device.get("clientVersion")),
            "capabilities": capabilities,
            "approvalRequired": {name: name in APPROVAL_ACTIONS and not bool((device.get("permissions") or {}).get("autoApprove", False)) for name in ACTION_ROLES},
            "signal": signal,
            "state": state,
        }

    def queue_action(self, device, data):
        action = str(data.get("action", ""))
        required = ACTION_ROLES.get(action)
        if not required or not self._capability(device, action):
            raise PermissionError("This PADD role cannot perform that action")
        value = data.get("value")
        if action == "navigate":
            value = _clean_text(value, 48)
            if value not in {"overview", "system", "media", "network", "updates", "settings"}:
                raise ValueError("Unknown LCARS page")
        elif action == "media":
            if isinstance(value, dict):
                player = _clean_text(value.get("player"), 160)
                command = _clean_text(value.get("command"), 24)
            else:
                player = ""
                command = _clean_text(value, 24)
            if command not in {"previous", "play-pause", "play", "pause", "next"}:
                raise ValueError("Unknown media command")
            value = {"player": player, "command": command} if player else command
        elif action == "volume":
            value = max(0, min(100, int(value)))
        elif action == "dnd":
            value = value if isinstance(value, bool) else str(value).strip().lower() in {"1", "true", "yes", "on"}
        elif action == "clipboard":
            if not self._load()["clipboardEnabled"]:
                raise PermissionError("Text clipboard sharing is disabled on the desktop")
            value = _clean_clipboard(value)
            if not value:
                raise ValueError("Clipboard text is empty")
        elif action == "notice-dismiss-all":
            value = "all"
        else:
            value = _clean_text(value, 96)
            if not value:
                raise ValueError("A command target is required")
        created_at = int(time.time())
        command = {"id": uuid.uuid4().hex, "action": action, "value": value, "device": device["id"], "deviceName": device["name"], "createdAt": created_at, "expiresAt": created_at + APPROVAL_TTL}
        with self.lock:
            record = self._load()
            requires_approval = action in APPROVAL_ACTIONS and not bool((device.get("permissions") or {}).get("autoApprove", False))
            if requires_approval:
                self.approvals.append(command)
                self._append_activity(record, "approval-requested", device, status="pending", detail=action)
                message = "Request waiting for desktop approval"
            else:
                self.commands.append(command)
                self._append_activity(record, "command-queued", device, detail=action)
                message = "Command transmitted to LCARS"
            self._save(record)
        return {"ok": True, "message": message, "commandId": command["id"], "approvalRequired": requires_approval}

    def sync(self, value):
        if not isinstance(value, dict):
            raise ValueError("PADD state must be an object")
        clean = {
            "page": _clean_text(value.get("page"), 48),
            "theme": _clean_text(value.get("theme"), 32),
            "volume": max(0, min(100, int(value.get("volume", 0) or 0))),
            "muted": bool(value.get("muted", False)),
            "doNotDisturb": bool(value.get("doNotDisturb", False)),
            "media": value.get("media", [])[:8] if isinstance(value.get("media"), list) else [],
            "meters": value.get("meters", [])[:12] if isinstance(value.get("meters"), list) else [],
            "routines": value.get("routines", [])[:48] if isinstance(value.get("routines"), list) else [],
            "apps": value.get("apps", [])[:48] if isinstance(value.get("apps"), list) else [],
            "notices": value.get("notices", [])[:24] if isinstance(value.get("notices"), list) else [],
            "activeWorkstation": _clean_text(value.get("activeWorkstation"), 64),
            "workstations": value.get("workstations", [])[:32] if isinstance(value.get("workstations"), list) else [],
            "quickActions": value.get("quickActions", [])[:16] if isinstance(value.get("quickActions"), list) else [],
            "routineStatus": value.get("routineStatus", [])[:24] if isinstance(value.get("routineStatus"), list) else [],
            "handoff": value.get("handoff") if isinstance(value.get("handoff"), dict) else None,
            "accessibility": value.get("accessibility", {}) if isinstance(value.get("accessibility"), dict) else {},
            "release": value.get("release", {}) if isinstance(value.get("release"), dict) else {},
            "updatedAt": int(time.time()),
        }
        payload = json.dumps(clean)
        if len(payload) > 131_072:
            raise ValueError("PADD state exceeds the local sharing limit")
        with self.lock:
            self.shared_state = json.loads(payload)
        return {"ok": True}

    def pop_commands(self):
        with self.lock:
            values = list(self.commands)
            self.commands.clear()
        return values

    def pop_events(self):
        with self.lock:
            record = self._load()
            self._refresh_presence(record)
            self._save(record)
            values = list(self.events)
            self.events.clear()
        return values

    def start(self, force=False):
        if not self.listen or self.server:
            return
        if not force and not self._load()["enabled"]:
            return
        controller = self

        class Handler(BaseHTTPRequestHandler):
            def send_headers(self, status, content_type, length):
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(length))
                self.send_header("Cache-Control", "no-store" if content_type.startswith("application/json") else "public, max-age=300")
                self.send_header("X-Content-Type-Options", "nosniff")
                self.send_header("X-Frame-Options", "DENY")
                self.send_header("Referrer-Policy", "no-referrer")
                self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
                self.end_headers()

            def send_json(self, value, status=200):
                body = json.dumps(value).encode()
                self.send_headers(status, "application/json; charset=utf-8", len(body))
                self.wfile.write(body)

            def body_json(self):
                length = int(self.headers.get("Content-Length", "0") or 0)
                if length < 0 or length > MAX_BODY:
                    raise ValueError("Request exceeds the PADD limit")
                return json.loads(self.rfile.read(length) or b"{}")

            def device(self):
                header = self.headers.get("Authorization", "")
                token = header[7:] if header.startswith("Bearer ") else ""
                return controller.authenticate(token, self.client_address[0])

            def do_GET(self):
                route = urlparse(self.path).path
                if route == "/api/padd/status":
                    return self.send_json(controller.mobile_status())
                if route == "/api/padd/state":
                    device = self.device()
                    return self.send_json(controller.state_for(device), 200) if device else self.send_json({"ok": False, "error": "PADD authorization required"}, 401)
                names = {"/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/styles.css": "styles.css", "/manifest.webmanifest": "manifest.webmanifest", "/sw.js": "sw.js", "/icon.png": "icon.png"}
                name = names.get(route)
                path = controller.asset_dir / name if name else None
                if not path or not path.is_file():
                    return self.send_json({"error": "not found"}, 404)
                body = path.read_bytes()
                mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
                self.send_headers(200, mime + ("; charset=utf-8" if mime.startswith("text/") or mime in {"application/javascript", "application/manifest+json"} else ""), len(body))
                self.wfile.write(body)

            def do_POST(self):
                route = urlparse(self.path).path
                try:
                    data = self.body_json()
                    if route == "/api/padd/pair":
                        return self.send_json(controller.pair(data.get("code"), data.get("name"), self.client_address[0]))
                    if route == "/api/padd/action":
                        device = self.device()
                        if not device:
                            return self.send_json({"ok": False, "error": "PADD authorization required"}, 401)
                        return self.send_json(controller.queue_action(device, data))
                    if route == "/api/padd/heartbeat":
                        device = self.device()
                        if not device:
                            return self.send_json({"ok": False, "error": "PADD authorization required"}, 401)
                        return self.send_json(controller.heartbeat(device, data, self.client_address[0]))
                    if route == "/api/padd/preferences":
                        device = self.device()
                        if not device:
                            return self.send_json({"ok": False, "error": "PADD authorization required"}, 401)
                        return self.send_json(controller.mobile_preferences(device, data))
                    return self.send_json({"error": "not found"}, 404)
                except PermissionError as exc:
                    return self.send_json({"ok": False, "error": str(exc)}, 403)
                except Exception as exc:
                    return self.send_json({"ok": False, "error": str(exc)}, 400)

            def log_message(self, _format, *_args):
                pass

        try:
            self.server_error = ""
            self.server = ReusableThreadingHTTPServer(("0.0.0.0", PADD_PORT), Handler)
            threading.Thread(target=self.server.serve_forever, name="lcars-padd", daemon=True).start()
        except Exception as exc:
            self.server = None
            self.server_error = str(exc)

    def stop(self):
        server, self.server = self.server, None
        if not server:
            return
        try:
            server.shutdown()
            server.server_close()
        except Exception:
            pass
