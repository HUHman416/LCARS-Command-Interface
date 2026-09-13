"""Safe, recoverable file operations shared by the LCARS desktop bridges."""
from __future__ import annotations

import json
import mimetypes
import os
import shutil
import tarfile
import threading
import time
import uuid
import zipfile
from pathlib import Path


ARCHIVE_SUFFIXES = (".zip", ".tar", ".tar.gz", ".tgz")


def _clean_name(value, fallback=""):
    name = str(value or fallback).strip()
    if not name or name in {".", ".."} or Path(name).name != name or "\0" in name:
        raise ValueError("A valid single file name is required")
    return name[:240]


class FileOperations:
    """Own the allowlisted file roots, trash, defaults, jobs, and bounded history."""

    def __init__(self, config_dir, platform="linux", home=None, now=None):
        self.config_dir = Path(config_dir)
        self.home = Path(home or Path.home()).expanduser().resolve()
        self.platform = "windows" if str(platform).lower().startswith("win") else "linux"
        self.path = self.config_dir / "file-operations.json"
        self.trash_dir = self.config_dir / "file-trash"
        self.now = now or time.time
        self.lock = threading.RLock()
        self.operation_lock = threading.RLock()
        self.jobs = {}
        self.state = self._load()

    def _defaults(self):
        return {"schema": 2, "shares": [], "defaults": {}, "recent": [], "trash": [], "history": []}

    def _load(self):
        state = self._defaults()
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(raw, dict):
                for key in state:
                    if key in raw and isinstance(raw[key], type(state[key])):
                        state[key] = raw[key]
        except Exception:
            pass
        state["shares"] = [item for item in state["shares"][-20:] if isinstance(item, dict)]
        state["recent"] = [item for item in state["recent"][-60:] if isinstance(item, dict)]
        state["trash"] = [item for item in state["trash"][-200:] if isinstance(item, dict)]
        state["history"] = [item for item in state["history"][-120:] if isinstance(item, dict)]
        return state

    def _save(self):
        self.config_dir.mkdir(parents=True, exist_ok=True)
        temporary = self.path.with_suffix(".tmp")
        temporary.write_text(json.dumps(self.state, indent=2), encoding="utf-8")
        os.replace(temporary, self.path)

    def _roots(self):
        roots = [self.home]
        for share in self.state["shares"]:
            try:
                root = Path(share.get("path", "")).expanduser().resolve()
                if root.is_dir():
                    roots.append(root)
            except Exception:
                pass
        return roots

    def safe_path(self, value="~", must_exist=True):
        raw = str(value or "~")
        candidate = self.home if raw == "~" else Path(os.path.expandvars(raw)).expanduser().resolve()
        if not any(candidate == root or root in candidate.parents for root in self._roots()):
            raise PermissionError("Path is outside the operator home and approved Places")
        if must_exist and not candidate.exists():
            raise FileNotFoundError("The selected file or folder is unavailable")
        return candidate

    def _trash_path(self, record):
        target = Path(record.get("trashPath", "")).resolve()
        root = self.trash_dir.resolve()
        if target == root or root not in target.parents:
            raise PermissionError("Trash record points outside the LCARS Trash")
        return target

    def _public_history(self, item):
        return {key: value for key, value in item.items() if not key.startswith("_")}

    def _record(self, operation, summary, paths=None, undo=None, status="completed"):
        entry = {
            "id": uuid.uuid4().hex,
            "operation": operation,
            "summary": str(summary)[:240],
            "paths": [str(value) for value in (paths or [])][:24],
            "status": status,
            "createdAt": int(self.now() * 1000),
            "undoable": bool(undo),
        }
        if undo:
            entry["_undo"] = undo
        self.state["history"].append(entry)
        self.state["history"] = self.state["history"][-120:]
        self._save()
        return self._public_history(entry)

    def _entry(self, path):
        stat = path.stat()
        return {
            "name": path.name,
            "path": str(path),
            "directory": path.is_dir(),
            "size": stat.st_size,
            "modified": int(stat.st_mtime),
            "hidden": path.name.startswith("."),
            "mime": "inode/directory" if path.is_dir() else mimetypes.guess_type(path.name)[0] or "application/octet-stream",
        }

    def _places(self):
        names = (("HOME", self.home), ("DOCUMENTS", self.home / "Documents"), ("DOWNLOADS", self.home / "Downloads"), ("DESKTOP", self.home / "Desktop"))
        places = [{"id": name.lower(), "name": name, "path": str(path), "kind": "local"} for name, path in names if path.is_dir()]
        places.extend({"id": item.get("id", ""), "name": item.get("name", "NETWORK SHARE"), "path": item.get("path", ""), "kind": "network"} for item in self.state["shares"])
        return places

    def list_directory(self, value="~", sort="name", order="asc", include_hidden=True):
        folder = self.safe_path(value)
        if not folder.is_dir():
            raise NotADirectoryError("The selected location is not a folder")
        items = []
        for child in folder.iterdir():
            try:
                item = self._entry(child)
                if include_hidden or not item["hidden"]:
                    items.append(item)
            except OSError:
                pass
        key = {
            "name": lambda item: item["name"].casefold(),
            "modified": lambda item: item["modified"],
            "size": lambda item: item["size"],
            "type": lambda item: (item["directory"], item["mime"], item["name"].casefold()),
        }.get(str(sort), lambda item: item["name"].casefold())
        items.sort(key=key, reverse=str(order).lower() == "desc")
        breadcrumbs = []
        active_root = next(root for root in self._roots() if folder == root or root in folder.parents)
        current = active_root
        breadcrumbs.append({"name": next((place["name"] for place in self._places() if Path(place["path"]) == active_root), active_root.name or "HOME"), "path": str(active_root)})
        for part in folder.relative_to(active_root).parts:
            current /= part
            breadcrumbs.append({"name": part, "path": str(current)})
        parent = str(folder.parent) if folder != active_root else ""
        return {"ok": True, "path": str(folder), "parent": parent, "items": items, "breadcrumbs": breadcrumbs, "sort": str(sort), "order": str(order)}

    def status(self):
        with self.lock:
            trash = []
            for item in self.state["trash"]:
                try:
                    actual = self._trash_path(item)
                except (OSError, PermissionError):
                    continue
                if actual.exists():
                    public = {key: value for key, value in item.items() if key != "trashPath"}
                    public["path"] = str(actual)
                    trash.append(public)
            return {
                "ok": True,
                "version": "31.2",
                "platform": self.platform,
                "places": self._places(),
                "recent": list(reversed(self.state["recent"][-40:])),
                "trash": list(reversed(trash)),
                "defaults": dict(self.state["defaults"]),
                "history": [self._public_history(item) for item in reversed(self.state["history"][-80:])],
                "jobs": [dict(item) for item in self.jobs.values()][-20:],
                "archiveFormats": list(ARCHIVE_SUFFIXES),
                "limits": {"history": 120, "recent": 60, "trash": 200, "archiveEntries": 5000, "archiveBytes": 2147483648},
            }

    def properties(self, value):
        path = self.safe_path(value)
        item = self._entry(path)
        item.update({
            "created": int(path.stat().st_ctime),
            "readable": os.access(path, os.R_OK),
            "writable": os.access(path, os.W_OK),
            "executable": os.access(path, os.X_OK),
            "extension": path.suffix.lower(),
        })
        return {"ok": True, "properties": item, "defaultApplication": self.state["defaults"].get(path.suffix.lower(), "")}

    def _target(self, destination, name, conflict="ask"):
        folder = self.safe_path(destination)
        if not folder.is_dir():
            raise NotADirectoryError("The destination is not a folder")
        target = folder / _clean_name(name)
        if not target.exists():
            return target
        if conflict == "skip":
            return None
        if conflict == "rename":
            stem, suffix, number = target.stem, target.suffix, 2
            while target.exists():
                target = folder / f"{stem} ({number}){suffix}"
                number += 1
            return target
        if conflict == "replace":
            if target.is_dir():
                shutil.rmtree(target)
            else:
                target.unlink()
            return target
        raise FileExistsError(json.dumps({"conflict": True, "name": target.name, "path": str(target), "choices": ["rename", "replace", "skip"]}))

    def _copy(self, source, target, cancel=None):
        if source.is_symlink():
            raise PermissionError("Symbolic links are not copied by LCARS file operations")
        try:
            if source.is_dir():
                target.mkdir()
                for child in source.iterdir():
                    if cancel and cancel():
                        raise InterruptedError("File operation cancelled")
                    self._copy(child, target / child.name, cancel)
                shutil.copystat(source, target, follow_symlinks=False)
                return
            target.parent.mkdir(parents=True, exist_ok=True)
            with source.open("rb") as reader, target.open("wb") as writer:
                while True:
                    if cancel and cancel():
                        raise InterruptedError("File operation cancelled")
                    block = reader.read(1024 * 1024)
                    if not block:
                        break
                    writer.write(block)
            shutil.copystat(source, target, follow_symlinks=False)
        except Exception:
            if target.exists():
                shutil.rmtree(target, ignore_errors=True) if target.is_dir() else target.unlink(missing_ok=True)
            raise

    def _recent(self, path, activity="opened"):
        value = {"id": str(path), "name": path.name, "path": str(path), "directory": path.is_dir(), "activity": activity, "at": int(self.now() * 1000)}
        self.state["recent"] = [item for item in self.state["recent"] if item.get("path") != str(path)]
        self.state["recent"].append(value)
        self.state["recent"] = self.state["recent"][-60:]
        self._save()
        return value

    def operate(self, data, cancel=None):
        operation = str(data.get("operation", "status")).strip().lower()
        with self.operation_lock:
            if operation == "status":
                return self.status()
            if operation == "properties":
                return self.properties(data.get("path", ""))
            if operation == "recent":
                return {"ok": True, "recent": self._recent(self.safe_path(data.get("path", "")), str(data.get("activity", "opened"))[:24])}
            if operation == "set-default-app":
                extension = str(data.get("extension", "")).strip().lower()
                if extension and not extension.startswith("."):
                    extension = "." + extension
                if not extension or len(extension) > 24:
                    raise ValueError("A valid file extension is required")
                application = str(data.get("applicationId", "")).strip()[:240]
                if application:
                    self.state["defaults"][extension] = application
                else:
                    self.state["defaults"].pop(extension, None)
                self._save()
                return {"ok": True, "defaults": dict(self.state["defaults"]), "message": "Default application choice saved" if application else "Default application choice cleared"}
            if operation == "create-folder":
                parent = self.safe_path(data.get("destination", "~"))
                target = self._target(parent, data.get("name", "New Folder"), data.get("conflict", "ask"))
                if target is None:
                    return {"ok": True, "skipped": True, "message": "Existing folder kept"}
                target.mkdir()
                history = self._record(operation, f"Created {target.name}", [target], {"operation": "remove-created", "path": str(target)})
                return {"ok": True, "path": str(target), "history": history, "message": "Folder created"}
            if operation == "rename":
                source = self.safe_path(data.get("path", ""))
                name = _clean_name(data.get("name"))
                if name == source.name:
                    return {"ok": True, "path": str(source), "message": "Item name is unchanged"}
                target = self._target(source.parent, name, data.get("conflict", "ask"))
                if target is None:
                    return {"ok": True, "skipped": True, "message": "Existing item kept"}
                old = str(source)
                source.rename(target)
                history = self._record(operation, f"Renamed {Path(old).name} to {target.name}", [old, target], {"operation": "move", "source": str(target), "destination": old})
                return {"ok": True, "path": str(target), "history": history, "message": "Item renamed"}
            if operation in {"duplicate", "transfer"}:
                values = data.get("paths") or ([data.get("path")] if data.get("path") else [])
                sources = [self.safe_path(value) for value in values[:100]]
                if not sources:
                    raise ValueError("Select at least one item")
                destination = self.safe_path(data.get("destination", sources[0].parent))
                move = operation == "transfer" and bool(data.get("move"))
                created, undo = [], []
                try:
                    for index, source in enumerate(sources):
                        if cancel and cancel():
                            raise InterruptedError("File operation cancelled")
                        desired = source.name if operation == "transfer" else f"{source.stem} copy{source.suffix}"
                        if operation == "transfer" and destination == source.parent and bool(data.get("move")):
                            continue
                        if operation == "transfer" and destination == source.parent and data.get("conflict") == "replace":
                            raise ValueError("A source item cannot replace itself")
                        target = self._target(destination, desired, data.get("conflict", "ask"))
                        if target is None:
                            continue
                        old = str(source)
                        if move:
                            shutil.move(str(source), str(target))
                            undo.append({"operation": "move", "source": str(target), "destination": old})
                        else:
                            self._copy(source, target, cancel)
                            undo.append({"operation": "remove-created", "path": str(target)})
                        created.append(str(target))
                        if cancel:
                            cancel(progress=int((index + 1) * 100 / len(sources)))
                except Exception:
                    for item in reversed(undo):
                        try:
                            self._apply_undo(item)
                        except Exception:
                            pass
                    raise
                verb = "Moved" if move else "Duplicated" if operation == "duplicate" else "Copied"
                history = self._record(operation, f"{verb} {len(created)} item(s)", created, {"operation": "batch", "items": undo} if created else None)
                return {"ok": True, "paths": created, "history": history, "message": f"{verb} {len(created)} item(s)"}
            if operation == "trash":
                values = data.get("paths") or ([data.get("path")] if data.get("path") else [])
                if len(self.state["trash"]) + len(values[:100]) > 200:
                    raise OverflowError("LCARS Trash is full; restore items or explicitly empty it first")
                self.trash_dir.mkdir(parents=True, exist_ok=True)
                records = []
                for value in values[:100]:
                    source = self.safe_path(value)
                    ident = uuid.uuid4().hex
                    target = self.trash_dir / f"{ident}-{source.name}"
                    shutil.move(str(source), str(target))
                    record = {"id": ident, "name": source.name, "originalPath": str(source), "trashPath": str(target), "directory": target.is_dir(), "deletedAt": int(self.now() * 1000)}
                    self.state["trash"].append(record)
                    records.append(record)
                history = self._record(operation, f"Moved {len(records)} item(s) to Trash", [item["originalPath"] for item in records], {"operation": "restore-many", "ids": [item["id"] for item in records]})
                return {"ok": True, "trash": [{key: value for key, value in item.items() if key != "trashPath"} for item in records], "history": history, "message": "Items moved to LCARS Trash"}
            if operation == "restore":
                ident = str(data.get("id", ""))
                record = next((item for item in self.state["trash"] if item.get("id") == ident), None)
                if not record:
                    raise FileNotFoundError("Trash item was not found")
                source = self._trash_path(record)
                if not source.exists():
                    raise FileNotFoundError("The Trash payload is unavailable")
                original = Path(record["originalPath"])
                self.safe_path(original.parent)
                target = self._target(original.parent, original.name, data.get("conflict", "ask"))
                if target is None:
                    return {"ok": True, "skipped": True, "message": "Existing item kept in place"}
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(source), str(target))
                self.state["trash"].remove(record)
                history = self._record(operation, f"Restored {target.name}", [target], {"operation": "trash-path", "path": str(target)})
                return {"ok": True, "path": str(target), "history": history, "message": "Trash item restored"}
            if operation == "empty-trash":
                if not bool(data.get("confirmed")):
                    raise PermissionError("Empty Trash requires explicit confirmation")
                count = 0
                failed = []
                for record in list(self.state["trash"]):
                    try:
                        target = self._trash_path(record)
                        shutil.rmtree(target) if target.is_dir() else target.unlink(missing_ok=True)
                        count += 1
                    except (OSError, PermissionError):
                        failed.append(record)
                self.state["trash"] = failed
                history = self._record(operation, f"Permanently removed {count} Trash item(s)", status="irreversible")
                return {"ok": True, "history": history, "message": f"Emptied {count} Trash item(s)"}
            if operation == "archive-create":
                sources = [self.safe_path(value) for value in (data.get("paths") or [])[:100]]
                if not sources:
                    raise ValueError("Select at least one item for the archive")
                destination = self.safe_path(data.get("destination", sources[0].parent))
                name = _clean_name(data.get("name", "LCARS Archive.zip"))
                if not name.lower().endswith(".zip"):
                    name += ".zip"
                if destination / name in sources and data.get("conflict") == "replace":
                    raise ValueError("An archive cannot replace one of its own source items")
                target = self._target(destination, name, data.get("conflict", "ask"))
                if target is None:
                    return {"ok": True, "skipped": True, "message": "Existing archive kept"}
                try:
                    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
                        for index, source in enumerate(sources):
                            entries = [source] if source.is_file() else [source, *source.rglob("*")]
                            for entry in entries:
                                if cancel and cancel():
                                    raise InterruptedError("Archive creation cancelled")
                                if entry.is_symlink():
                                    raise PermissionError("Symbolic links are not added to LCARS archives")
                                archive.write(entry, Path(source.name) / entry.relative_to(source) if entry != source else source.name)
                            if cancel:
                                cancel(progress=int((index + 1) * 100 / len(sources)))
                except Exception:
                    target.unlink(missing_ok=True)
                    raise
                history = self._record(operation, f"Created archive {target.name}", [target], {"operation": "remove-created", "path": str(target)})
                return {"ok": True, "path": str(target), "history": history, "message": "Archive created"}
            if operation == "archive-extract":
                source = self.safe_path(data.get("path", ""))
                destination = self.safe_path(data.get("destination", source.parent))
                target = self._target(destination, data.get("name", source.name.split(".tar")[0].removesuffix(".zip") or "Extracted"), data.get("conflict", "ask"))
                if target is None:
                    return {"ok": True, "skipped": True, "message": "Existing extracted folder kept"}
                target.mkdir()
                try:
                    archive = zipfile.ZipFile(source) if zipfile.is_zipfile(source) else tarfile.open(source, "r:*")
                    try:
                        members = archive.infolist() if isinstance(archive, zipfile.ZipFile) else archive.getmembers()
                        if len(members) > 5000:
                            raise ValueError("Archive exceeds the 5,000-entry safety limit")
                        total = sum(getattr(item, "file_size", getattr(item, "size", 0)) for item in members)
                        if total > 2 * 1024 * 1024 * 1024:
                            raise ValueError("Archive exceeds the 2 GB extraction safety limit")
                        for index, member in enumerate(members):
                            name = member.filename if isinstance(archive, zipfile.ZipFile) else member.name
                            if isinstance(archive, tarfile.TarFile) and (member.issym() or member.islnk()):
                                raise PermissionError("Archive links are not extracted by LCARS")
                            if isinstance(archive, tarfile.TarFile) and not (member.isfile() or member.isdir()):
                                raise PermissionError("Archive special files are not extracted by LCARS")
                            if isinstance(archive, zipfile.ZipFile) and (member.external_attr >> 16) & 0o170000 == 0o120000:
                                raise PermissionError("Archive links are not extracted by LCARS")
                            resolved = (target / name).resolve()
                            if resolved != target and target not in resolved.parents:
                                raise PermissionError("Archive contains an unsafe path")
                            if cancel and cancel():
                                raise InterruptedError("Archive extraction cancelled")
                            archive.extract(member, target)
                            if cancel and index % 20 == 0:
                                cancel(progress=int((index + 1) * 100 / max(1, len(members))))
                    finally:
                        archive.close()
                except Exception:
                    shutil.rmtree(target, ignore_errors=True)
                    raise
                history = self._record(operation, f"Extracted {source.name}", [target], {"operation": "remove-created", "path": str(target)})
                return {"ok": True, "path": str(target), "history": history, "message": "Archive extracted"}
            if operation == "add-share":
                value = Path(os.path.expandvars(str(data.get("path", "")))).expanduser().resolve()
                if not value.is_dir():
                    raise NotADirectoryError("The network share or mounted location is unavailable")
                allowed_prefixes = [Path("/mnt"), Path("/media"), Path("/run/user"), Path("/Volumes"), self.home]
                if self.platform != "windows" and not value.is_mount() and not any(value == root or root in value.parents for root in allowed_prefixes):
                    raise PermissionError("Only mounted storage and network-share paths can be added")
                record = {"id": uuid.uuid4().hex, "name": str(data.get("name") or value.name or "NETWORK SHARE")[:80], "path": str(value)}
                self.state["shares"] = [item for item in self.state["shares"] if item.get("path") != str(value)] + [record]
                self.state["shares"] = self.state["shares"][-20:]
                self._save()
                return {"ok": True, "share": record, "message": "Place added"}
            if operation == "remove-share":
                ident = str(data.get("id", ""))
                self.state["shares"] = [item for item in self.state["shares"] if item.get("id") != ident]
                self._save()
                return {"ok": True, "message": "Place removed"}
            if operation == "undo":
                entry = next((item for item in self.state["history"] if item.get("id") == str(data.get("id", ""))), None)
                if not entry or not entry.get("_undo") or entry.get("undoneAt"):
                    raise ValueError("This file operation cannot be reversed")
                self._apply_undo(entry["_undo"])
                entry.update(undoneAt=int(self.now() * 1000), undoable=False, status="reversed")
                self._save()
                return {"ok": True, "history": self._public_history(entry), "message": "File operation reversed"}
            raise ValueError("Unknown LCARS file operation")

    def _apply_undo(self, undo):
        operation = undo.get("operation")
        if operation == "batch":
            for item in reversed(undo.get("items", [])):
                self._apply_undo(item)
            return
        if operation == "move":
            source = self.safe_path(undo.get("source", ""))
            destination = self.safe_path(Path(undo.get("destination", "")).parent)
            target = destination / Path(undo["destination"]).name
            if target.exists():
                raise FileExistsError("The original location is occupied")
            shutil.move(str(source), str(target))
            return
        if operation == "remove-created":
            target = self.safe_path(undo.get("path", ""))
            shutil.rmtree(target) if target.is_dir() else target.unlink()
            return
        if operation == "restore-many":
            for ident in undo.get("ids", []):
                self.operate({"operation": "restore", "id": ident, "conflict": "rename"})
            return
        if operation == "trash-path":
            self.operate({"operation": "trash", "path": undo.get("path")})
            return
        raise ValueError("The reverse operation is unavailable")

    def start(self, data):
        ident = uuid.uuid4().hex
        job = {"id": ident, "operation": str(data.get("operation", "")), "status": "queued", "progress": 0, "message": "Queued", "createdAt": int(self.now() * 1000), "cancelRequested": False}
        with self.lock:
            self.jobs[ident] = job
            self.jobs = dict(list(self.jobs.items())[-30:])

        def cancelled(progress=None):
            with self.lock:
                if progress is not None:
                    job["progress"] = max(0, min(100, int(progress)))
                return bool(job["cancelRequested"])

        def run():
            with self.lock:
                job.update(status="running", message="Processing")
            try:
                result = self.operate(data, cancelled)
                with self.lock:
                    job.update(status="completed", progress=100, message=result.get("message", "Complete"), result=result)
            except InterruptedError as exc:
                with self.lock:
                    job.update(status="cancelled", message=str(exc))
            except FileExistsError as exc:
                try:
                    conflict = json.loads(str(exc))
                except Exception:
                    conflict = {"conflict": True, "message": str(exc)}
                with self.lock:
                    job.update(status="conflict", message="Operator choice required", conflict=conflict)
            except Exception as exc:
                with self.lock:
                    job.update(status="failed", message=str(exc)[:300])

        threading.Thread(target=run, daemon=True, name=f"lcars-file-{ident[:8]}").start()
        return {"ok": True, "job": dict(job)}

    def job(self, ident=""):
        with self.lock:
            return dict(self.jobs.get(str(ident), {}))

    def cancel(self, ident):
        with self.lock:
            job = self.jobs.get(str(ident))
            if not job:
                raise KeyError("File-operation job was not found")
            if job["status"] in {"queued", "running"}:
                job["cancelRequested"] = True
                job["message"] = "Cancelling"
            return {"ok": True, "job": dict(job)}
