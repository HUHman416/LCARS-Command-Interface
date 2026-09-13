"""Bounded, local-only intent and permission broker for LCARS Portal Center."""
from __future__ import annotations

import json
import os
import shutil
import threading
import time
import uuid
from pathlib import Path


INTENT_KINDS = (
    "open-file", "save-file", "open-folder", "open-with", "authorize",
    "notification", "microphone", "camera", "screen-share", "print", "share",
)
PROTECTED_KINDS = {"authorize", "microphone", "camera", "screen-share", "print", "share"}
DECISIONS = {"waiting", "approved", "denied", "cancelled", "expired"}
POLICIES = {"ask", "allow", "deny"}


def _text(value, limit=240):
    return str(value or "").strip()[:limit]


class IntentBroker:
    """Persist portal policies and a privacy-bounded request history."""

    def __init__(self, config_dir, platform="linux", now=None):
        self.config_dir = Path(config_dir)
        self.path = self.config_dir / "portal-broker.json"
        self.platform = "windows" if str(platform).lower().startswith("win") else "linux"
        self.now = now or time.time
        self.lock = threading.RLock()
        self.state = self._load()

    def _defaults(self):
        return {
            "schema": 1,
            "standardPortalEnabled": False,
            "policies": {kind: "ask" for kind in INTENT_KINDS},
            "requests": [],
        }

    def _load(self):
        state = self._defaults()
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                state["standardPortalEnabled"] = bool(raw.get("standardPortalEnabled"))
                policies = raw.get("policies", {})
                if isinstance(policies, dict):
                    for kind in INTENT_KINDS:
                        policy = _text(policies.get(kind, "ask"), 12).lower()
                        state["policies"][kind] = "ask" if kind in PROTECTED_KINDS and policy == "allow" else policy if policy in POLICIES else "ask"
                requests = raw.get("requests", [])
                if isinstance(requests, list):
                    state["requests"] = [item for item in requests[-150:] if isinstance(item, dict)]
        except Exception:
            pass
        return state

    def _save(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        os.replace(temporary, self.path)

    def _expire(self):
        current = int(self.now() * 1000)
        changed = False
        for request in self.state["requests"]:
            if request.get("decision") == "waiting" and int(request.get("expiresAt", 0)) <= current:
                request.update(decision="expired", resolvedAt=current, reason="Request expired without operator approval")
                changed = True
        if changed:
            self._save()

    def _adapter_status(self):
        if self.platform == "windows":
            return [
                {"id": "lcars-native", "name": "LCARS NATIVE ROUTE", "available": True, "active": True, "detail": "Local Core intent API is ready"},
                {"id": "windows-permissions", "name": "WINDOWS PERMISSION ROUTE", "available": True, "active": True, "detail": "Electron device permissions use operator review"},
                {"id": "xdg-desktop-portal", "name": "XDG DESKTOP PORTAL", "available": False, "active": False, "detail": "Not applicable on Windows"},
            ]
        xdg = bool(shutil.which("gdbus") and os.environ.get("XDG_CURRENT_DESKTOP"))
        return [
            {"id": "lcars-native", "name": "LCARS NATIVE ROUTE", "available": True, "active": True, "detail": "Local Core intent API is ready"},
            {"id": "electron-permissions", "name": "DEVICE PERMISSION ROUTE", "available": True, "active": True, "detail": "Microphone, camera, and sharing requests require operator review"},
            {"id": "xdg-desktop-portal", "name": "XDG DESKTOP PORTAL FOUNDATION", "available": xdg, "active": False, "detail": "Foundation armed; system-wide backend registration is not installed yet" if xdg and self.state["standardPortalEnabled"] else "Compatible desktop detected; foundation is opt-in" if xdg else "No compatible desktop portal session detected"},
        ]

    def status(self):
        with self.lock:
            self._expire()
            requests = list(reversed(self.state["requests"]))
            pending = sum(item.get("decision") == "waiting" for item in requests)
            return {
                "ok": True,
                "version": "31.4",
                "platform": self.platform,
                "pending": pending,
                "standardPortalEnabled": self.state["standardPortalEnabled"],
                "policies": dict(self.state["policies"]),
                "requests": requests[:100],
                "adapters": self._adapter_status(),
                "limits": {"history": 150, "requestSeconds": 120, "payloadBytes": 8192},
            }

    def request(self, ident):
        with self.lock:
            self._expire()
            return next((dict(item) for item in self.state["requests"] if item.get("id") == ident), None)

    def _safe_result(self, kind, result):
        value = result if isinstance(result, dict) else {}
        clean = {}
        if kind in {"open-file", "save-file", "open-folder"} and value.get("path"):
            path = Path(os.path.expandvars(os.path.expanduser(_text(value.get("path"), 2048)))).resolve()
            try:
                path.relative_to(Path.home().resolve())
            except ValueError as exc:
                raise PermissionError("Portal file choices must remain inside the operator home directory") from exc
            clean["path"] = str(path)
        if kind == "open-with" and value.get("applicationId"):
            clean["applicationId"] = _text(value.get("applicationId"), 240)
        if value.get("remember"):
            clean["remember"] = True
        return clean

    def operate(self, data):
        operation = _text(data.get("operation", "status"), 32).lower()
        with self.lock:
            self._expire()
            if operation == "status":
                return self.status()
            if operation == "submit":
                kind = _text(data.get("kind"), 32).lower()
                if kind not in INTENT_KINDS:
                    raise ValueError("Unsupported portal intent")
                payload = data.get("payload", {})
                if not isinstance(payload, dict) or len(json.dumps(payload, ensure_ascii=False).encode("utf-8")) > 8192:
                    raise ValueError("Portal payload is invalid or exceeds 8 KiB")
                current = int(self.now() * 1000)
                policy = self.state["policies"].get(kind, "ask")
                decision = "denied" if policy == "deny" else "approved" if policy == "allow" and kind not in PROTECTED_KINDS else "waiting"
                request = {
                    "id": uuid.uuid4().hex,
                    "kind": kind,
                    "client": _text(data.get("client") or "LCARS APPLICATION", 80),
                    "title": _text(data.get("title") or kind.replace("-", " ").title(), 120),
                    "detail": _text(data.get("detail"), 500),
                    "payload": payload,
                    "decision": decision,
                    "createdAt": current,
                    "expiresAt": current + 120000,
                    "resolvedAt": current if decision != "waiting" else None,
                    "operator": "POLICY" if decision != "waiting" else "",
                    "reason": f"Policy set to {policy}" if decision != "waiting" else "",
                    "result": {},
                }
                self.state["requests"].append(request)
                self.state["requests"] = self.state["requests"][-150:]
                self._save()
                return {"ok": True, "request": dict(request)}
            if operation == "resolve":
                ident = _text(data.get("id"), 64)
                decision = _text(data.get("decision"), 16).lower()
                if decision not in {"approved", "denied"}:
                    raise ValueError("Portal decision must be approved or denied")
                request = next((item for item in self.state["requests"] if item.get("id") == ident), None)
                if not request:
                    raise KeyError("Portal request was not found")
                if request.get("decision") != "waiting":
                    raise ValueError("Portal request is no longer awaiting review")
                request.update(
                    decision=decision,
                    resolvedAt=int(self.now() * 1000),
                    operator=_text(data.get("operator") or "LCARS OPERATOR", 80),
                    reason=_text(data.get("reason") or ("Operator approved" if decision == "approved" else "Operator denied"), 240),
                    result=self._safe_result(request["kind"], data.get("result", {})) if decision == "approved" else {},
                )
                self._save()
                return {"ok": True, "request": dict(request)}
            if operation == "cancel":
                request = next((item for item in self.state["requests"] if item.get("id") == _text(data.get("id"), 64)), None)
                if not request:
                    raise KeyError("Portal request was not found")
                if request.get("decision") == "waiting":
                    request.update(decision="cancelled", resolvedAt=int(self.now() * 1000), reason="Client cancelled request")
                    self._save()
                return {"ok": True, "request": dict(request)}
            if operation == "policy":
                kind = _text(data.get("kind"), 32).lower()
                policy = _text(data.get("policy"), 12).lower()
                if kind not in INTENT_KINDS or policy not in POLICIES:
                    raise ValueError("Unsupported portal policy")
                if kind in PROTECTED_KINDS and policy == "allow":
                    raise PermissionError("Sensitive portal routes cannot be silently allowed")
                self.state["policies"][kind] = policy
                self._save()
                return self.status()
            if operation == "registration":
                self.state["standardPortalEnabled"] = bool(data.get("enabled"))
                self._save()
                return self.status()
            if operation == "clear-resolved":
                self.state["requests"] = [item for item in self.state["requests"] if item.get("decision") == "waiting"]
                self._save()
                return self.status()
            raise ValueError("Unknown portal operation")
