#!/usr/bin/env python3
"""Local, encrypted state and bounded file discovery for LCARS Data Fabric."""
from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import time
import uuid
from pathlib import Path

from lcars_federation_crypto import open_json, seal_json

MAX_RECENT = 120
MAX_HISTORY = 240
MAX_CONFLICTS = 60
MAX_VAULT_ITEMS = 80
MAX_VAULT_BYTES = 2_097_152
MAX_VERSIONS = 20

DEFAULT_CATEGORIES = {
    "applications": True,
    "files": True,
    "recentItems": True,
    "settings": True,
    "commands": True,
    "stations": True,
    "notifications": True,
    "media": True,
    "contacts": True,
    "modules": True,
    "procedures": True,
    "activity": False,
    "clipboard": False,
    "smallFiles": False,
    "privateStorage": False,
}


def _clean(value, limit=120):
    return " ".join(str(value or "").replace("\x00", "").split())[:limit]


class DataFabric:
    """Persist non-secret policy separately from AES-GCM protected private data."""

    def __init__(self, config_dir: Path, platform: str):
        self.config_dir = Path(config_dir)
        self.platform = platform
        self.config_file = self.config_dir / "data-fabric.json"
        self.key_file = self.config_dir / "data-fabric.key"
        self.vault_file = self.config_dir / "data-fabric-private.json"

    def _defaults(self):
        return {
            "schema": 1,
            "categories": dict(DEFAULT_CATEGORIES),
            "conflictPolicy": "ask",
            "recent": [],
            "history": [],
            "conflicts": [],
            "versions": {},
        }

    def _load(self):
        value = self._defaults()
        try:
            stored = json.loads(self.config_file.read_text(encoding="utf-8"))
            if isinstance(stored, dict):
                categories = stored.get("categories", {}) if isinstance(stored.get("categories"), dict) else {}
                value["categories"] = {name: bool(categories.get(name, default)) for name, default in DEFAULT_CATEGORIES.items()}
                if stored.get("conflictPolicy") in {"ask", "newest", "local"}:
                    value["conflictPolicy"] = stored["conflictPolicy"]
                for name, limit in (("recent", MAX_RECENT), ("history", MAX_HISTORY), ("conflicts", MAX_CONFLICTS)):
                    items = stored.get(name, []) if isinstance(stored.get(name), list) else []
                    value[name] = [item for item in items[-limit:] if isinstance(item, dict)]
                versions = stored.get("versions", {}) if isinstance(stored.get("versions"), dict) else {}
                value["versions"] = {str(key)[:180]: [item for item in rows[-MAX_VERSIONS:] if isinstance(item, dict)] for key, rows in list(versions.items())[:240] if isinstance(rows, list)}
        except Exception:
            pass
        return value

    def _save(self, value):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.config_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
        temporary.replace(self.config_file)

    def _key(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        try:
            key = self.key_file.read_bytes()
            if len(key) == 32:
                return key
        except Exception:
            pass
        key = os.urandom(32)
        temporary = self.key_file.with_suffix(".tmp")
        temporary.write_bytes(key)
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        temporary.replace(self.key_file)
        return key

    def _load_vault(self):
        try:
            envelope = json.loads(self.vault_file.read_text(encoding="utf-8"))
            value = open_json(self._key(), envelope, "lcars-data-fabric-private-v1")
            if isinstance(value, dict) and isinstance(value.get("items"), list):
                return {"schema": 1, "items": [item for item in value["items"][-MAX_VAULT_ITEMS:] if isinstance(item, dict)]}
        except Exception:
            pass
        return {"schema": 1, "items": []}

    def _save_vault(self, value):
        payload = json.dumps(value, separators=(",", ":")).encode("utf-8")
        if len(payload) > MAX_VAULT_BYTES:
            raise ValueError("Private storage is limited to 2 MiB on this station")
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.vault_file.with_suffix(".tmp")
        temporary.write_text(json.dumps(seal_json(self._key(), value, "lcars-data-fabric-private-v1")), encoding="utf-8")
        try:
            os.chmod(temporary, 0o600)
        except OSError:
            pass
        temporary.replace(self.vault_file)

    @staticmethod
    def _history(value, action, category, detail, status="complete", station="LOCAL CORE"):
        value["history"] = [*value.get("history", [])[-(MAX_HISTORY - 1):], {
            "id": uuid.uuid4().hex,
            "action": _clean(action, 64),
            "category": _clean(category, 32),
            "detail": _clean(detail, 180),
            "status": _clean(status, 24),
            "station": _clean(station, 64),
            "createdAt": int(time.time()),
        }]

    def status(self):
        value = self._load()
        vault = self._load_vault()
        return {
            "ok": True,
            "platform": self.platform,
            "transport": "AES-256-GCM",
            "storage": "AES-256-GCM · LOCAL KEY",
            "categories": value["categories"],
            "conflictPolicy": value["conflictPolicy"],
            "recent": list(reversed(value["recent"][-40:])),
            "history": list(reversed(value["history"][-80:])),
            "conflicts": list(reversed([item for item in value["conflicts"][-MAX_CONFLICTS:] if not item.get("resolvedAt")])),
            "privateItems": [{key: item.get(key) for key in ("id", "name", "updatedAt", "versionCount")} for item in reversed(vault["items"])],
            "diagnostics": {
                "recentItems": len(value["recent"]),
                "historyEntries": len(value["history"]),
                "openConflicts": sum(1 for item in value["conflicts"] if not item.get("resolvedAt")),
                "privateItems": len(vault["items"]),
                "versionedRecords": len(value["versions"]),
            },
        }

    def record_recent(self, category, ident, name, detail="", station="LOCAL CORE"):
        value = self._load()
        if not value["categories"].get("recentItems", True):
            return self.status()
        category, ident, name = _clean(category, 32), _clean(ident, 240), _clean(name, 120)
        if not ident or not name:
            raise ValueError("Recent item identity and name are required")
        item = {"id": ident, "category": category, "name": name, "detail": _clean(detail, 180), "station": _clean(station, 64), "updatedAt": int(time.time())}
        value["recent"] = [candidate for candidate in value["recent"] if not (candidate.get("category") == category and candidate.get("id") == ident)][-(MAX_RECENT - 1):] + [item]
        self._history(value, "recent-item", category, name, station=station)
        self._save(value)
        return self.status()

    def merge_version(self, category, ident, name, payload, modified, station):
        value = self._load()
        category, ident = _clean(category, 32), _clean(ident, 180)
        key = f"{category}:{ident}"
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":"))
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        versions = value["versions"].get(key, [])
        current = versions[-1] if versions else None
        incoming = {"id": uuid.uuid4().hex, "hash": digest, "name": _clean(name, 120), "station": _clean(station, 64), "modified": int(modified or time.time()), "createdAt": int(time.time()), "payload": payload}
        if current and current.get("hash") != digest and current.get("station") != incoming["station"]:
            conflict = {"id": uuid.uuid4().hex, "key": key, "category": category, "name": incoming["name"], "localVersion": current.get("id"), "incomingVersion": incoming["id"], "localStation": current.get("station"), "incomingStation": incoming["station"], "createdAt": int(time.time())}
            policy = value["conflictPolicy"]
            if policy == "ask":
                value["conflicts"] = [*value["conflicts"][-(MAX_CONFLICTS - 1):], conflict]
                self._history(value, "sync-conflict", category, incoming["name"], "attention", station)
            elif policy == "local":
                self._history(value, "incoming-version-skipped", category, incoming["name"], "resolved", station)
                self._save(value)
                return self.status()
            elif incoming["modified"] < int(current.get("modified", 0)):
                self._history(value, "older-version-skipped", category, incoming["name"], "resolved", station)
                self._save(value)
                return self.status()
        if not current or current.get("hash") != digest:
            value["versions"][key] = [*versions[-(MAX_VERSIONS - 1):], incoming]
        self._history(value, "version-merged", category, incoming["name"], station=station)
        self._save(value)
        return self.status()

    def operate(self, data):
        operation = str(data.get("operation", "status"))
        if operation == "status":
            return self.status()
        if operation == "recent":
            return self.record_recent(data.get("category"), data.get("id"), data.get("name"), data.get("detail"), data.get("station"))
        if operation == "merge-version":
            return self.merge_version(data.get("category"), data.get("id"), data.get("name"), data.get("payload"), data.get("modified"), data.get("station"))
        value = self._load()
        if operation == "policy":
            categories = data.get("categories", {}) if isinstance(data.get("categories"), dict) else {}
            value["categories"] = {name: bool(categories.get(name, current)) for name, current in value["categories"].items()}
            requested = str(data.get("conflictPolicy", value["conflictPolicy"]))
            value["conflictPolicy"] = requested if requested in {"ask", "newest", "local"} else value["conflictPolicy"]
            self._history(value, "policy-updated", "fabric", "Selective synchronization controls changed")
            self._save(value)
            return self.status()
        if operation == "resolve-conflict":
            ident, resolution = _clean(data.get("id"), 64), str(data.get("resolution", "local"))
            target = next((item for item in value["conflicts"] if item.get("id") == ident and not item.get("resolvedAt")), None)
            if not target:
                raise ValueError("Data Fabric conflict was not found")
            target["resolution"] = resolution if resolution in {"local", "incoming", "both"} else "local"
            target["resolvedAt"] = int(time.time())
            self._history(value, "conflict-resolved", target.get("category", "fabric"), f"{target.get('name', 'Record')} · {target['resolution']}", "resolved")
            self._save(value)
            return self.status()
        if operation == "clear-history":
            value["history"] = []
            self._save(value)
            return self.status()
        if operation in {"vault-put", "vault-delete", "vault-get"}:
            if not value["categories"].get("privateStorage", False):
                raise PermissionError("Encrypted private storage is disabled")
            vault = self._load_vault()
            ident = _clean(data.get("id"), 64)
            if operation == "vault-get":
                target = next((item for item in vault["items"] if item.get("id") == ident), None)
                if not target:
                    raise ValueError("Private record was not found")
                return {"ok": True, "item": target}
            if operation == "vault-delete":
                vault["items"] = [item for item in vault["items"] if item.get("id") != ident]
                self._save_vault(vault)
                self._history(value, "private-record-deleted", "privateStorage", ident or "record")
                self._save(value)
                return self.status()
            name, content = _clean(data.get("name"), 100), str(data.get("content") or "").replace("\x00", "")[:32_768]
            if not name or not content:
                raise ValueError("Private record name and content are required")
            target = next((item for item in vault["items"] if item.get("id") == ident), None)
            now = int(time.time())
            version = {"id": uuid.uuid4().hex, "createdAt": now, "content": content}
            if target:
                target.update({"name": name, "content": content, "updatedAt": now, "versions": [*target.get("versions", [])[-(MAX_VERSIONS - 1):], version]})
                target["versionCount"] = len(target["versions"])
            else:
                target = {"id": ident or uuid.uuid4().hex, "name": name, "content": content, "updatedAt": now, "versions": [version], "versionCount": 1}
                vault["items"] = [*vault["items"][-(MAX_VAULT_ITEMS - 1):], target]
            self._save_vault(vault)
            self._history(value, "private-record-saved", "privateStorage", name)
            self._save(value)
            return self.status()
        raise ValueError("Unknown Data Fabric operation")

    def search_files(self, query, limit=24):
        value = self._load()
        if not value["categories"].get("files", True):
            return {"ok": True, "results": [], "disabled": True}
        needle = _clean(query, 80).lower()
        if len(needle) < 2:
            return {"ok": True, "results": []}
        home = Path.home().resolve()
        roots = [home / name for name in ("Documents", "Downloads", "Desktop")]
        roots.append(home)
        results, seen, inspected = [], set(), 0
        for root in roots:
            if not root.exists() or not root.is_dir():
                continue
            for current, directories, files in os.walk(root):
                current_path = Path(current)
                try:
                    relative = current_path.relative_to(home)
                except ValueError:
                    directories[:] = []
                    continue
                directories[:] = [name for name in directories if not name.startswith(".") and name not in {"node_modules", ".git", "Cache", "cache"}]
                if len(relative.parts) > 4:
                    directories[:] = []
                for name in files:
                    inspected += 1
                    if inspected > 5000:
                        break
                    if name.startswith(".") or needle not in name.lower():
                        continue
                    path = (current_path / name)
                    try:
                        resolved, stat = path.resolve(), path.stat()
                        resolved.relative_to(home)
                    except (OSError, ValueError):
                        continue
                    key = str(resolved)
                    if key in seen:
                        continue
                    seen.add(key)
                    mime = mimetypes.guess_type(name)[0] or "application/octet-stream"
                    results.append({"id": key, "name": name[:180], "path": key, "detail": str(resolved.parent.relative_to(home)) or "HOME", "modified": int(stat.st_mtime), "size": int(stat.st_size), "mime": mime})
                if inspected > 5000:
                    break
            if inspected > 5000:
                break
        results.sort(key=lambda item: (-int(needle == item["name"].lower()), -item["modified"], item["name"].lower()))
        return {"ok": True, "results": results[:max(1, min(40, int(limit or 24)))], "inspected": inspected}
