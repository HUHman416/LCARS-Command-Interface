# LCARS Command Interface

An LCARS-inspired standalone desktop environment for Linux and Windows. It is designed as a local-first interface for launching applications, monitoring the system, controlling media and audio, managing windows and displays, browsing files, and using an embedded terminal.

![Version](https://img.shields.io/badge/version-22.2-ff9866)
![Linux](https://img.shields.io/badge/Linux-Nobara%20%7C%20Fedora%20%7C%20Universal-f2c84b)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-829af1)

## Download Version 22.2

Open the repository's **Releases** page and select **Version 22.2**.

- `LCARS-Universal-Linux-Desktop-v22.2.zip` — universal Linux installer package
- `LCARS-Windows-Setup-v22.2.exe` — standalone Windows setup program
- `LCARS-Command-Interface-v22.2-Source.zip` — archived source snapshot

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

## 🐧 Linux — Install & Uninstall

### 📥 Install

1. Download `LCARS-Universal-Linux-Desktop-v22.2.zip` from **Releases**.
2. Extract the ZIP to a normal folder.
3. Double-click `Install-LCARS-Linux.desktop` and choose **Execute**.
4. If your file manager will not execute it, open the extracted folder in Terminal and run: `chmod +x Install-LCARS-Linux.run && ./Install-LCARS-Linux.run`
5. Launch **LCARS Command Interface** from your application menu. The installer detects your package manager and offers supported dependencies.

### 🗑️ Uninstall

Double-click `Uninstall-LCARS-Linux.desktop`, or run `./uninstall-linux.sh` from the extracted installer folder. Choose whether to keep your LCARS settings when prompted.

> 🖖 Linux integration is strongest on KDE Plasma Wayland and X11. Unsupported desktop-specific controls are clearly marked inside LCARS.

## 🪟 Windows — Install & Uninstall

### 📥 Install

1. Download `LCARS-Windows-Setup-v22.2.exe` from **Releases**.
2. Double-click the setup file.
3. Follow the installer and choose the installation folder and shortcuts.
4. Launch **LCARS Command Interface** from the Start menu or desktop shortcut.

### 🗑️ Uninstall

Open **Settings → Apps → Installed apps**, select **LCARS Command Interface**, and choose **Uninstall**. You may also use its uninstaller from the Start menu. Choose whether to remove saved settings if offered.

> 🛡️ Windows may show a SmartScreen warning because this community build is not commercially code-signed. Verify `SHA256SUMS.txt` before running it.

## 🔐 Verify your download

Download `SHA256SUMS.txt` from the same release, then compare the appropriate file:

```bash
# Linux
sha256sum LCARS-Universal-Linux-Desktop-v22.2.zip
```

```powershell
# Windows PowerShell
Get-FileHash .\LCARS-Windows-Setup-v22.2.exe -Algorithm SHA256
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

## Version 22.2 notes

- Fixed Plasma 6 ANSI-formatted KScreen output parsing.
- Stabilized Settings toggles that could black out or displace the fullscreen surface.
- Reduced Motion now affects animations without changing layout.
- Color-safe Indicators no longer insert layout-shifting content.
- High Contrast no longer filters the entire Electron surface.
- The pinned Task Rail is isolated as its own scrolling overlay.
- Removed unreliable experimental Shell Mode and startup-console toggles.

## Project status

This is an independent fan-made interface inspired by Star Trek LCARS. It is not affiliated with or endorsed by CBS Studios, Paramount, or the Star Trek rights holders.

Use GitHub Issues for reproducible bugs and feature requests. For Linux integration problems, include the OS, desktop environment, display server, and LCARS version.
