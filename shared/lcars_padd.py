#!/usr/bin/env python3
"""Guarded local-network PADD companion service for LCARS Version 27."""
from __future__ import annotations

import hashlib
import hmac
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
}


class ReusableThreadingHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


def _clean_text(value, limit=80):
    return " ".join(str(value or "").split())[:limit]


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
            "updatedAt": 0,
        }
        self.server = None
        self.server_error = ""

    def _load(self):
        try:
            value = json.loads(self.device_file.read_text(encoding="utf-8"))
            devices = value.get("devices", []) if isinstance(value, dict) else []
            clean = []
            for device in devices[:24]:
                if not isinstance(device, dict) or not str(device.get("tokenHash", "")):
                    continue
                role = str(device.get("role", "viewer"))
                clean.append({
                    "id": _clean_text(device.get("id"), 64),
                    "name": _clean_text(device.get("name") or "PADD", 48),
                    "role": role if role in ROLES else "viewer",
                    "tokenHash": str(device.get("tokenHash")),
                    "createdAt": int(device.get("createdAt", 0) or 0),
                    "lastSeen": int(device.get("lastSeen", 0) or 0),
                })
            return {"enabled": bool(value.get("enabled", False)), "devices": clean}
        except Exception:
            return {"enabled": False, "devices": []}

    def _save(self, value):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.device_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
        temporary.replace(self.device_file)

    def _addresses(self):
        found = set()
        try:
            for row in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                address = row[4][0]
                if address and not address.startswith("127.") and not address.startswith("169.254."):
                    found.add(address)
        except Exception:
            pass
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
                probe.connect(("8.8.8.8", 80))
                address = probe.getsockname()[0]
            if address and not address.startswith("127."):
                found.add(address)
        except Exception:
            pass
        return [f"http://{address}:{PADD_PORT}" for address in sorted(found)]

    @staticmethod
    def _public_device(device):
        return {key: device.get(key) for key in ("id", "name", "role", "createdAt", "lastSeen")}

    def status(self, include_pairing=False):
        with self.lock:
            record = self._load()
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
                record["devices"] = [item for item in record["devices"] if item["id"] != ident]
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
                self._save(record)
                return {**self.status(True), "message": f"PADD role changed to {role.upper()}"}
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
            }
            record["devices"] = [*record["devices"][-23:], device]
            self.pairing = None
            self._save(record)
            return {"ok": True, "token": token, "device": self._public_device(device), "version": self.version, "message": "PADD paired"}

    def authenticate(self, token):
        digest = hashlib.sha256(str(token or "").encode()).hexdigest()
        with self.lock:
            record = self._load()
            if not record["enabled"]:
                return None
            for device in record["devices"]:
                if hmac.compare_digest(device["tokenHash"], digest):
                    now = int(time.time())
                    if now - device["lastSeen"] > 60:
                        device["lastSeen"] = now
                        self._save(record)
                    return self._public_device(device)
        return None

    def mobile_status(self):
        status = self.status(False)
        return {key: status[key] for key in ("enabled", "online", "version", "platform")}

    def state_for(self, device):
        with self.lock:
            state = json.loads(json.dumps(self.shared_state))
        if device["role"] != "command":
            state["apps"] = []
        return {"ok": True, "device": device, "capabilities": {name: ROLES[device["role"]] >= ROLES[role] for name, role in ACTION_ROLES.items()}, "state": state}

    def queue_action(self, device, data):
        action = str(data.get("action", ""))
        required = ACTION_ROLES.get(action)
        if not required or ROLES[device["role"]] < ROLES[required]:
            raise PermissionError("This PADD role cannot perform that action")
        value = data.get("value")
        if action == "navigate":
            value = _clean_text(value, 48)
            if value not in {"overview", "system", "media", "network", "updates", "settings"}:
                raise ValueError("Unknown LCARS page")
        elif action == "media":
            value = _clean_text(value, 24)
            if value not in {"previous", "play-pause", "play", "pause", "next"}:
                raise ValueError("Unknown media command")
        elif action == "volume":
            value = max(0, min(100, int(value)))
        elif action == "dnd":
            value = value if isinstance(value, bool) else str(value).strip().lower() in {"1", "true", "yes", "on"}
        else:
            value = _clean_text(value, 96)
            if not value:
                raise ValueError("A command target is required")
        command = {"id": uuid.uuid4().hex, "action": action, "value": value, "device": device["id"], "deviceName": device["name"], "createdAt": int(time.time())}
        with self.lock:
            self.commands.append(command)
        return {"ok": True, "message": "Command transmitted to LCARS", "commandId": command["id"]}

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
                return controller.authenticate(token)

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
