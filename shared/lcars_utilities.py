"""Local-first daily utilities for LCARS Version 31.5."""
from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import threading
import time
import uuid
from pathlib import Path


def _text(value, limit=32768):
    return str(value or "").replace("\x00", "").strip()[:limit]


class DailyUtilities:
    """Clipboard, capture storage, and print-job controls with bounded state."""

    def __init__(self, config_dir, platform="linux", home=None, runner=None, which=None, now=None):
        self.config_dir = Path(config_dir)
        self.home = Path(home or Path.home()).resolve()
        self.platform = "windows" if str(platform).lower().startswith("win") else "linux"
        self.path = self.config_dir / "daily-utilities.json"
        self.run = runner or subprocess.run
        self.which = which or shutil.which
        self.now = now or time.time
        self.lock = threading.RLock()
        self.state = self._load()

    def _defaults(self):
        return {"schema": 1, "clipboard": {"historyEnabled": False, "privateMode": False, "limit": 20, "history": []}, "consumedApprovals": []}

    def _load(self):
        state = self._defaults()
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            clipboard = raw.get("clipboard", {}) if isinstance(raw, dict) else {}
            state["clipboard"].update(
                historyEnabled=bool(clipboard.get("historyEnabled")),
                privateMode=bool(clipboard.get("privateMode")),
                limit=max(5, min(50, int(clipboard.get("limit", 20)))),
                history=[item for item in clipboard.get("history", [])[-50:] if isinstance(item, dict)],
            )
            state["consumedApprovals"] = [_text(item, 64) for item in raw.get("consumedApprovals", [])[-50:] if _text(item, 64)]
        except Exception:
            pass
        return state

    def _save(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        os.replace(temporary, self.path)

    def _powershell(self):
        return self.which("powershell.exe") or self.which("powershell") or ""

    def _clipboard_adapter(self, write=False):
        if self.platform == "windows":
            return self._powershell()
        candidates = (("wl-copy", "wl-paste"), ("xclip", "xclip"), ("xsel", "xsel"))
        return next((writer if write else reader for writer, reader in candidates if self.which(writer if write else reader)), "")

    def _read_clipboard(self):
        adapter = self._clipboard_adapter(False)
        if not adapter:
            raise RuntimeError("No supported clipboard adapter is installed")
        if self.platform == "windows":
            command = [adapter, "-NoProfile", "-NonInteractive", "-Command", "Get-Clipboard -Raw"]
        elif Path(adapter).name == "wl-paste":
            command = [adapter, "--no-newline"]
        elif Path(adapter).name == "xclip":
            command = [adapter, "-selection", "clipboard", "-o"]
        else:
            command = [adapter, "--clipboard", "--output"]
        result = self.run(command, capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            raise RuntimeError(_text(result.stderr or result.stdout or "Clipboard read failed", 240))
        return _text(result.stdout)

    def _write_clipboard(self, value):
        adapter = self._clipboard_adapter(True)
        if not adapter:
            raise RuntimeError("No supported clipboard adapter is installed")
        if self.platform == "windows":
            command = [adapter, "-NoProfile", "-NonInteractive", "-Command", "$input | Set-Clipboard"]
        elif Path(adapter).name == "wl-copy":
            command = [adapter]
        elif Path(adapter).name == "xclip":
            command = [adapter, "-selection", "clipboard"]
        else:
            command = [adapter, "--clipboard", "--input"]
        result = self.run(command, input=value, capture_output=True, text=True, timeout=5)
        if result.returncode != 0:
            raise RuntimeError(_text(result.stderr or result.stdout or "Clipboard write failed", 240))

    def _remember_clipboard(self, value):
        clipboard = self.state["clipboard"]
        if not value or not clipboard["historyEnabled"] or clipboard["privateMode"]:
            return
        history = [item for item in clipboard["history"] if item.get("text") != value]
        history.append({"id": uuid.uuid4().hex, "text": value, "createdAt": int(self.now() * 1000), "pinned": False})
        pinned = [item for item in history if item.get("pinned")]
        regular = [item for item in history if not item.get("pinned")]
        clipboard["history"] = (pinned + regular[-clipboard["limit"]:])[-50:]
        self._save()

    def _print_inventory(self):
        printers, jobs = [], []
        if self.platform == "windows":
            shell = self._powershell()
            if shell:
                script = "$p=@(Get-Printer -ErrorAction SilentlyContinue|ForEach-Object{[pscustomobject]@{id=$_.Name;name=$_.Name;state=[string]$_.PrinterStatus;default=$false}});$j=@(Get-Printer -ErrorAction SilentlyContinue|ForEach-Object{$n=$_.Name;Get-PrintJob -PrinterName $n -ErrorAction SilentlyContinue|ForEach-Object{[pscustomobject]@{id=($n+'|'+$_.ID);printer=$n;name=$_.DocumentName;owner=$_.UserName;state=[string]$_.JobStatus;size=[int64]$_.Size;submitted=[string]$_.SubmittedTime}}});[pscustomobject]@{printers=$p;jobs=$j}|ConvertTo-Json -Depth 5 -Compress"
                try:
                    result = self.run([shell, "-NoProfile", "-NonInteractive", "-Command", script], capture_output=True, text=True, timeout=10)
                    data = json.loads(result.stdout or "{}")
                    printers = data.get("printers", []) or []
                    jobs = data.get("jobs", []) or []
                    printers = [printers] if isinstance(printers, dict) else printers
                    jobs = [jobs] if isinstance(jobs, dict) else jobs
                except Exception:
                    pass
        elif self.which("lpstat"):
            try:
                output = self.run(["lpstat", "-p", "-d", "-o"], capture_output=True, text=True, timeout=8).stdout
                default = ""
                for line in output.splitlines():
                    default_match = re.match(r"system default destination:\s*(.+)", line, re.I)
                    printer_match = re.match(r"printer\s+(\S+)\s+(.+)", line, re.I)
                    job_match = re.match(r"(\S+-\d+)\s+(\S+)\s+(\d+)\s+(.+)", line)
                    if default_match:
                        default = default_match.group(1).strip()
                    elif printer_match:
                        name, state = printer_match.groups(); printers.append({"id": name, "name": name, "state": _text(state, 100), "default": False})
                    elif job_match:
                        ident, owner, size, submitted = job_match.groups(); jobs.append({"id": ident, "printer": ident.rsplit("-", 1)[0], "name": ident, "owner": owner, "state": "QUEUED", "size": int(size), "submitted": submitted})
                for printer in printers:
                    printer["default"] = printer["id"] == default
            except Exception:
                pass
        return printers[:50], jobs[:100]

    def status(self):
        with self.lock:
            printers, jobs = self._print_inventory()
            clipboard = self.state["clipboard"]
            return {
                "ok": True,
                "version": "31.5",
                "platform": self.platform,
                "capabilities": {
                    "clipboardRead": bool(self._clipboard_adapter(False)),
                    "clipboardWrite": bool(self._clipboard_adapter(True)),
                    "captureStorage": True,
                    "printManagement": bool(self._powershell()) if self.platform == "windows" else bool(self.which("lpstat")),
                    "printCancel": bool(self._powershell()) if self.platform == "windows" else bool(self.which("cancel")),
                    "notificationService": True,
                },
                "clipboard": {"historyEnabled": clipboard["historyEnabled"], "privateMode": clipboard["privateMode"], "limit": clipboard["limit"], "history": list(reversed(clipboard["history"]))},
                "capture": {"imageDirectory": str(self.home / "Pictures" / "LCARS Captures"), "videoDirectory": str(self.home / "Videos" / "LCARS Captures"), "limitBytes": 67_108_864},
                "printing": {"printers": printers, "jobs": jobs},
            }

    def request_description(self, data):
        action, target = _text(data.get("action"), 32).lower(), _text(data.get("target"), 180)
        if action != "cancel-print" or not target:
            raise ValueError("This utility operation does not use protected authorization")
        _, jobs = self._print_inventory()
        if target not in {str(item.get("id")) for item in jobs}:
            raise ValueError("The selected print job is no longer present")
        return {"subsystem": "daily-utilities", "operation": action, "target": target, "label": "CANCEL PRINT JOB"}

    def _approve(self, action, target, request):
        if not isinstance(request, dict) or request.get("kind") != "print" or request.get("decision") != "approved":
            raise PermissionError("Approve this print request in Portal Center before execution")
        payload = request.get("payload") if isinstance(request.get("payload"), dict) else {}
        if payload.get("subsystem") != "daily-utilities" or payload.get("operation") != action or _text(payload.get("target"), 180) != target:
            raise PermissionError("Portal approval does not match this print operation")
        ident = _text(request.get("id"), 64)
        if not ident or ident in self.state["consumedApprovals"]:
            raise PermissionError("Portal approval has already been used")
        return ident

    def _cancel_print(self, target):
        if self.platform == "windows":
            if "|" not in target:
                raise ValueError("Print job identity is invalid")
            printer, job = target.rsplit("|", 1)
            if not job.isdigit():
                raise ValueError("Print job identity is invalid")
            shell = self._powershell()
            if not shell:
                raise RuntimeError("Windows print management is unavailable")
            escaped = printer.replace("'", "''")
            command = [shell, "-NoProfile", "-NonInteractive", "-Command", f"Remove-PrintJob -PrinterName '{escaped}' -ID {int(job)} -ErrorAction Stop"]
        else:
            adapter = self.which("cancel")
            if not adapter or not re.fullmatch(r"[^/\s]+-\d+", target):
                raise RuntimeError("CUPS print cancellation is unavailable")
            command = [adapter, target]
        result = self.run(command, capture_output=True, text=True, timeout=12)
        if result.returncode != 0:
            raise RuntimeError(_text(result.stderr or result.stdout or "Print job cancellation failed", 240))

    def _save_capture(self, data):
        kind = _text(data.get("kind"), 16).lower()
        encoded = str(data.get("data") or "")
        expected = {"screenshot": ("image/png", b"\x89PNG\r\n\x1a\n", ".png"), "recording": ("video/webm", b"\x1aE\xdf\xa3", ".webm")}
        if kind not in expected:
            raise ValueError("Unsupported capture type")
        mime, signature, suffix = expected[kind]
        if not encoded.startswith(f"data:{mime};base64,"):
            raise ValueError("Capture encoding does not match its type")
        raw = base64.b64decode(encoded.split(",", 1)[1], validate=True)
        if not raw or len(raw) > 67_108_864 or not raw.startswith(signature):
            raise ValueError("Capture is empty, invalid, or exceeds 64 MiB")
        folder = self.home / ("Pictures" if kind == "screenshot" else "Videos") / "LCARS Captures"
        folder.mkdir(parents=True, exist_ok=True)
        stamp = time.strftime("%Y-%m-%d_%H-%M-%S", time.localtime(self.now()))
        path = folder / f"LCARS_{'Screenshot' if kind == 'screenshot' else 'Recording'}_{stamp}_{uuid.uuid4().hex[:6]}{suffix}"
        path.write_bytes(raw)
        return {"ok": True, "message": f"{kind.title()} saved inside LCARS Captures", "path": str(path), "size": len(raw)}

    def operate(self, data, approval=None):
        operation = _text(data.get("operation"), 32).lower()
        with self.lock:
            if operation == "policy":
                clipboard = self.state["clipboard"]
                if "historyEnabled" in data:
                    clipboard["historyEnabled"] = bool(data.get("historyEnabled"))
                if "privateMode" in data:
                    clipboard["privateMode"] = bool(data.get("privateMode"))
                if "limit" in data:
                    clipboard["limit"] = max(5, min(50, int(data.get("limit"))))
                if clipboard["privateMode"]:
                    clipboard["history"] = []
                else:
                    clipboard["history"] = clipboard["history"][-clipboard["limit"]:]
                self._save(); return self.status()
            if operation == "clipboard-read":
                value = self._read_clipboard(); self._remember_clipboard(value)
                return {"ok": True, "value": value, "status": self.status()}
            if operation == "clipboard-write":
                ident = _text(data.get("id"), 64)
                item = next((entry for entry in self.state["clipboard"]["history"] if entry.get("id") == ident), None)
                value = _text(item.get("text") if item else data.get("text"))
                if not value: raise ValueError("Clipboard text is empty")
                self._write_clipboard(value); return {"ok": True, "message": "Clipboard entry restored"}
            if operation == "clipboard-pin":
                ident = _text(data.get("id"), 64); found = False
                for item in self.state["clipboard"]["history"]:
                    if item.get("id") == ident: item["pinned"] = not bool(item.get("pinned")); found = True
                if not found: raise KeyError("Clipboard entry was not found")
                self._save(); return self.status()
            if operation == "clipboard-delete":
                ident = _text(data.get("id"), 64)
                self.state["clipboard"]["history"] = [item for item in self.state["clipboard"]["history"] if item.get("id") != ident]
                self._save(); return self.status()
            if operation == "clipboard-clear":
                self.state["clipboard"]["history"] = []; self._save(); return self.status()
            if operation == "save-capture":
                return self._save_capture(data)
            if operation == "cancel-print":
                target = _text(data.get("target"), 180); approval_id = self._approve(operation, target, approval)
                self._cancel_print(target)
                self.state["consumedApprovals"] = [*self.state["consumedApprovals"][-49:], approval_id]; self._save()
                return {"ok": True, "message": "Print job cancelled", "status": self.status()}
            raise ValueError("Unknown Daily Utilities operation")
