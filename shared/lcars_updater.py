"""Cross-platform, release-only updater used by both local LCARS bridges."""
from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import shlex
import stat
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

REPOSITORY = "HUHman416/LCARS-Command-Interface"
API_URL = f"https://api.github.com/repos/{REPOSITORY}/releases/latest"
RELEASES_URL = f"https://api.github.com/repos/{REPOSITORY}/releases?per_page=30"
USER_AGENT = "LCARS-Command-Interface-Updater/25"


def _request(url: str, binary: bool = False, timeout: int = 12):
    request = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = response.read()
    return body if binary else body.decode("utf-8", "replace")


def _version(value: str):
    parts = re.findall(r"\d+", value.lstrip("vV").split("-", 1)[0])[:3]
    return tuple(int(part) for part in parts + ["0"] * (3 - len(parts)))


def _platform_asset(assets: list[dict], system: str):
    if system == "windows":
        candidates = [asset for asset in assets if str(asset.get("name", "")).lower().endswith(".exe")]
    else:
        candidates = [asset for asset in assets if str(asset.get("name", "")).lower().endswith(".appimage")]
    candidates = [asset for asset in candidates if "arm" not in str(asset.get("name", "")).lower()]
    return candidates[0] if candidates else None


def _release_for_channel(channel: str):
    channel = "development" if channel == "development" else "stable"
    if channel == "stable":
        candidates = json.loads(_request(RELEASES_URL))
        if not isinstance(candidates, list):
            candidates = []
        whole = []
        for release in candidates:
            tag = str(release.get("tag_name", ""))
            parts = _version(tag)
            if not release.get("draft") and not release.get("prerelease") and parts[1:] == (0, 0):
                whole.append(release)
        if whole:
            return max(whole, key=lambda item: _version(str(item.get("tag_name", ""))))
        return json.loads(_request(API_URL))
    candidates = json.loads(_request(RELEASES_URL))
    if not isinstance(candidates, list):
        candidates = []
    candidates = [item for item in candidates if not item.get("draft")]
    if not candidates:
        return json.loads(_request(API_URL))
    return max(candidates, key=lambda item: _version(str(item.get("tag_name", ""))))


def check_update(current_version: str, system: str | None = None, channel: str = "stable"):
    system = (system or platform.system()).lower()
    channel = "development" if channel == "development" else "stable"
    release = _release_for_channel(channel)
    tag = str(release.get("tag_name", "")).strip()
    assets = release.get("assets") if isinstance(release.get("assets"), list) else []
    asset = _platform_asset(assets, system)
    checksums = next((item for item in assets if str(item.get("name", "")).lower() in {"sha256sums.txt", "checksums-sha256.txt"}), None)
    available = bool(tag and _version(tag) > _version(current_version))
    return {
        "ok": True,
        "channel": channel,
        "available": available,
        "current": current_version,
        "version": tag.lstrip("vV"),
        "releaseUrl": release.get("html_url", ""),
        "notes": str(release.get("body", ""))[:4000],
        "asset": {"name": asset.get("name"), "url": asset.get("browser_download_url")} if asset else None,
        "checksumsUrl": checksums.get("browser_download_url") if checksums else "",
    }


def _expected_hash(checksums_url: str, asset_name: str):
    if not checksums_url:
        return ""
    text = _request(checksums_url)
    for line in text.splitlines():
        match = re.match(r"^([a-fA-F0-9]{64})\s+\*?(.+?)\s*$", line)
        if match and Path(match.group(2)).name == asset_name:
            return match.group(1).lower()
    return ""


def download_update(current_version: str, system: str, update_dir: Path, channel: str = "stable"):
    info = check_update(current_version, system, channel)
    if not info["available"]:
        return {**info, "message": "LCARS is already on the newest public release"}
    asset = info.get("asset")
    if not asset:
        raise RuntimeError(f"Release {info['version']} has no compatible {system.title()} installer")
    update_dir.mkdir(parents=True, exist_ok=True)
    destination = update_dir / Path(asset["name"]).name
    temporary = destination.with_suffix(destination.suffix + ".part")
    digest = hashlib.sha256()
    request = urllib.request.Request(asset["url"], headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=45) as response, temporary.open("wb") as output:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            output.write(chunk)
    actual = digest.hexdigest()
    expected = _expected_hash(info.get("checksumsUrl", ""), asset["name"])
    if not expected:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("The release does not publish a SHA-256 checksum for this installer")
    if actual != expected:
        temporary.unlink(missing_ok=True)
        raise RuntimeError("Downloaded installer failed SHA-256 verification")
    temporary.replace(destination)
    if system == "linux":
        destination.chmod(destination.stat().st_mode | stat.S_IXUSR)
    return {**info, "downloaded": True, "path": str(destination), "sha256": actual, "message": f"Version {info['version']} downloaded and verified"}


def _sha256(path: Path):
    digest=hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda:handle.read(1024*1024),b""):digest.update(chunk)
    return digest.hexdigest()


def rollback_status(system: str, executable: str = "", archive_dir: Path | None = None):
    if system=="windows":
        return {"available":False,"message":"Windows rollback uses the previous verified setup file; reinstall the desired GitHub release or rerun Setup to repair the current release"}
    target=Path(executable).resolve() if executable else None
    directory=Path(archive_dir) if archive_dir else (target.parent/"previous-release" if target else None)
    previous=directory/(target.name+".previous") if directory and target else None
    available=bool(previous and previous.is_file() and previous.stat().st_size>1024*1024)
    return {"available":available,"path":str(previous) if available else "","sha256":_sha256(previous) if available else "","message":"Previous verified Linux AppImage is ready" if available else "No previous Linux release has been archived yet"}


def schedule_install(path: str, system: str, parent_pid: int, executable: str = "", archive_dir: Path | None = None):
    installer = Path(path).resolve()
    if not installer.is_file():
        raise RuntimeError("The verified update installer is no longer available")
    if system == "windows":
        escaped = str(installer).replace("'", "''")
        command = f"Wait-Process -Id {int(parent_pid)} -ErrorAction SilentlyContinue; Start-Process -FilePath '{escaped}'"
        subprocess.Popen(["powershell.exe", "-NoLogo", "-NoProfile", "-WindowStyle", "Hidden", "-Command", command], creationflags=0x00000008 | 0x00000200, close_fds=True)
        return {"ok": True, "message": "Verified Windows installer will open after LCARS closes", "closeApp": True}
    target = Path(executable).resolve() if executable else None
    if target and target.is_file() and os.access(target, os.W_OK):
        helper = Path(tempfile.gettempdir()) / f"lcars-update-{int(time.time())}.sh"
        previous_dir=Path(archive_dir) if archive_dir else target.parent/"previous-release";previous=previous_dir/(target.name+".previous")
        source_arg=shlex.quote(str(installer));target_arg=shlex.quote(str(target));previous_dir_arg=shlex.quote(str(previous_dir));previous_arg=shlex.quote(str(previous))
        helper.write_text(f'''#!/bin/sh\nset -eu\nwhile kill -0 {int(parent_pid)} 2>/dev/null; do sleep 1; done\nmkdir -p {previous_dir_arg}\ncp {target_arg} {previous_arg}.part\nmv {previous_arg}.part {previous_arg}\ncp {source_arg} {target_arg}\nchmod +x {target_arg}\nexec {target_arg}\n''', encoding="utf-8")
        helper.chmod(0o700)
        subprocess.Popen([str(helper)], start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return {"ok": True, "message": "Verified Linux update will replace and restart LCARS after it closes", "closeApp": True}
    subprocess.Popen([str(installer)], start_new_session=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return {"ok": True, "message": "Verified Linux installer opened; close LCARS when prompted", "closeApp": False}


def schedule_rollback(system: str, parent_pid: int, executable: str = "", archive_dir: Path | None = None):
    status=rollback_status(system,executable,archive_dir)
    if not status["available"]:raise RuntimeError(status["message"])
    target=Path(executable).resolve();previous=Path(status["path"]);helper=Path(tempfile.gettempdir())/f"lcars-rollback-{int(time.time())}.sh"
    target_arg=shlex.quote(str(target));previous_arg=shlex.quote(str(previous));swap_arg=shlex.quote(str(previous.with_suffix(".swap")))
    helper.write_text(f'''#!/bin/sh\nset -eu\nwhile kill -0 {int(parent_pid)} 2>/dev/null; do sleep 1; done\ncp {target_arg} {swap_arg}\ncp {previous_arg} {target_arg}\nchmod +x {target_arg}\nmv {swap_arg} {previous_arg}\nexec {target_arg}\n''',encoding="utf-8");helper.chmod(0o700)
    subprocess.Popen([str(helper)],start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    return {"ok":True,"message":"LCARS will restore the previous Linux release and restart","closeApp":True}
