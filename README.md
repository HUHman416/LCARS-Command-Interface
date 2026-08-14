# LCARS Command Interface - Created by ChatGPT

An LCARS-inspired standalone desktop environment for Linux and Windows created by ChatGPT (5.6 Sol Work Model). It is designed as a local-first interface for launching applications, monitoring the system, controlling media and audio, managing windows and displays, browsing files, and using an embedded terminal.

![Version](https://img.shields.io/badge/version-23.1-ff9866)
![Linux](https://img.shields.io/badge/Linux-Nobara%20%7C%20Fedora%20%7C%20Universal-f2c84b)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-829af1)

## Download Version 23.1

Open the repository's **Releases** page and select **Version 23.1**.

- `LCARS-Universal-Linux-Desktop-v23.1.zip` — universal Linux installer package
- `LCARS-Windows-Setup-v23.1.exe` — standalone Windows setup program
- `LCARS-Command-Interface-v23.1-Source.zip` — archived source snapshot

Always compare a downloaded file against the `SHA256SUMS.txt` attached to that release. The release checksum file is generated from the exact public downloads.

## Highlights

- Standalone Electron application; no browser or Cloudflare connection required
- Modular System Overview and local extensions
- Embedded multi-tab terminal and file explorer
- Searchable application launcher and favorites
- Media controls, per-application volume, and audio-device selection
- Task Rail for open desktop applications
- KDE Plasma/Wayland display and window controls
- Multiple themes, accessibility settings, notifications, and sounds
- Separate Linux and Windows installers
- Offline whisper.cpp voice-command infrastructure with selectable microphone and protected-command safeguards
- Up to 20 responsive favorites with native application artwork where supported
- Expanded CPU and storage telemetry with guarded removable-media controls
- Ctrl+F universal search and number-row/keypad page navigation

## 🐧 Linux — Install & Uninstall

### 📥 Install

1. Download `LCARS-Universal-Linux-Desktop-v23.1.zip` from **Releases**.
2. Extract the ZIP to a normal folder.
3. Double-click `Install-LCARS-Linux.desktop` and choose **Execute**.
4. If your file manager will not execute it, open the extracted folder in Terminal and run: `chmod +x Install-LCARS-Linux.run && ./Install-LCARS-Linux.run`
5. Launch **LCARS Command Interface** from your application menu. The installer detects your package manager and offers supported dependencies.

### 🗑️ Uninstall

Double-click `Uninstall-LCARS-Linux.desktop`, or run `./uninstall-linux.sh` from the extracted installer folder. Choose whether to keep your LCARS settings when prompted.

> 🖖 Linux integration is strongest on KDE Plasma Wayland and X11. Unsupported desktop-specific controls are clearly marked inside LCARS.

### 🎙️ Optional offline voice setup (Linux)

LCARS itself installs and runs without voice control. To enable it, install a `whisper.cpp` CLI (`whisper-cli`) and FFmpeg using your distribution's normal packages, then download a GGML English model such as `ggml-base.en.bin`. In **Settings → Offline Voice Control**, select **Enable push-to-talk**, enter the full `whisper-cli` and model paths, choose a microphone, and save. On Fedora/Nobara, keep the FFmpeg provider already selected by the OS; do not replace `ffmpeg-free` with a conflicting package. Settings reports any missing component without disabling LCARS.

## 🪟 Windows — Install & Uninstall

### 📥 Install

1. Download `LCARS-Windows-Setup-v23.1.exe` from **Releases**.
2. Double-click the setup file.
3. Follow the installer and choose the installation folder and shortcuts.
4. Launch **LCARS Command Interface** from the Start menu or desktop shortcut.

### 🗑️ Uninstall

Open **Settings → Apps → Installed apps**, select **LCARS Command Interface**, and choose **Uninstall**. You may also use its uninstaller from the Start menu. Choose whether to remove saved settings if offered.

> 🛡️ Windows may show a SmartScreen warning because this community build is not commercially code-signed. Verify `SHA256SUMS.txt` before running it.

### 🎙️ Optional offline voice setup (Windows)

LCARS works normally when voice is skipped. To enable it, install a Windows `whisper.cpp` build and FFmpeg, download a GGML English model such as `ggml-base.en.bin`, then open **Settings → Offline Voice Control**. Enable push-to-talk, enter the full paths to `whisper-cli.exe` and the model, select the microphone, and save. The model stays on the PC and microphone audio is sent only to the local loopback bridge.

## 🔐 Verify your download

Download `SHA256SUMS.txt` from the same release, then compare the appropriate file:

```bash
# Linux
sha256sum LCARS-Universal-Linux-Desktop-v23.1.zip
```

```powershell
# Windows PowerShell
Get-FileHash .\LCARS-Windows-Setup-v23.1.exe -Algorithm SHA256
```

The displayed hash must exactly match the corresponding line in `SHA256SUMS.txt`.

## Building from source

Requires Node.js 22+, npm, and Python 3 for the local bridge.

```bash
npm install
npm run desktop:build
```

Package it with:

```bash
npm run desktop:package:linux
npm run desktop:package:windows
```

Cross-platform packaging may require the relevant host OS or additional packaging tools.

## Version 23.1 notes

- Added unified LCARS framing for Overview, Network, Media, and File Browser panels.
- Added live cached network telemetry, safe local file previews, and the narrow System Tray drawer.
- Added interface-density and nonblocking startup-sequence controls.
- Added voice-command acknowledgement audio and an Optional Components bay.
- Added a theme-aware Workstation lock screen with optional salted PBKDF2 password protection.
- Added default Workstations, startup locking, and passwordless quick-boot controls.
- Corrected favorite icon clipping and ensured current-version CSS loads after historical compatibility rules.

### Version 23 foundation

- Added local whisper.cpp push-to-talk infrastructure, microphone selection, wake phrase support, command authority levels, and declarative extension voice commands.
- Restored Task Rail scrolling, added five-window search, KDE tray-service access, display grouping, and native application icons where supported.
- Expanded favorites to 20 responsive launchers.
- Added clickable system meters, per-core CPU details, physical-drive inventory, and guarded removable-media mount controls.
- Remote Terminal now opens as a second native Electron window on the selected display instead of a browser app.
- Added Ctrl+F universal LCARS search plus number-row and numeric-keypad shortcuts 1–8.
- Corrected Display Matrix and media-control alignment at enlarged interface scales.
- Prevented Fedora/Nobara FFmpeg package conflicts; optional voice dependencies can no longer abort the main installation.

## Project status

This is an independent fan-made interface inspired by Star Trek LCARS. It is not affiliated with or endorsed by CBS Studios, Paramount, or the Star Trek rights holders.

Use GitHub Issues for reproducible bugs and feature requests. For Linux integration problems, include the OS, desktop environment, display server, and LCARS version.
