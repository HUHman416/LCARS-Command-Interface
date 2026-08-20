<p align="center">
  <img src="desktop/icons/512x512.png" width="160" alt="LCARS Command Interface emblem">
</p>

<h1 align="center">🖖 LCARS Command Interface</h1>

<p align="center">
  <strong>A local-first LCARS-inspired desktop command environment for Linux and Windows.</strong><br>
  Launch applications, control media, inspect your system, manage windows, browse files, and use a real terminal—all without opening a web browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/stable-v24-ff9866" alt="Stable version 24">
  <img src="https://img.shields.io/badge/Linux-x86__64-f2c84b" alt="Linux x86-64">
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-829af1" alt="Windows 10 and 11">
  <img src="https://img.shields.io/badge/interface-local--first-b69de8" alt="Local-first interface">
</p>

<p align="center">
  <a href="https://github.com/HUHman416/LCARS-Command-Interface/releases/tag/v24"><strong>🚀 Download Version 24</strong></a>
  ·
  <a href="https://github.com/HUHman416/LCARS-Command-Interface/issues">🐞 Report an issue</a>
  ·
  <a href="EXTENSION-API-V2.md">🧩 Build an extension</a>
</p>

> [!IMPORTANT]
> **Version 24 is the current stable public release.** LCARS runs as its own Electron desktop application. It does not require Cloudflare, a hosted website, or an external browser.

## 📥 Choose your download

| Platform | Download | Best for |
| --- | --- | --- |
| 🐧 Linux | [Universal Linux package](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Universal-Linux-Desktop-v24.zip) | Recommended installer bundle with desktop launcher, icon, uninstaller, dependencies, and integration tools |
| 🐧 Linux | [Portable AppImage](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Command-Interface-v24-x86_64.AppImage) | Running LCARS directly without a traditional installation |
| 🐧 Linux | [Search and autostart helper](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Linux-Integration-v24.sh) | Registering the portable AppImage in the application menu and optionally starting it at login |
| 🪟 Windows | [One-click Windows setup](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Windows-Setup-v24.exe) | Normal Windows installation, Start Menu search, shortcuts, optional autostart, and clean uninstall |
| 💻 Developers | [Version 24 source](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Command-Interface-v24-Source.zip) | Reviewing, extending, or building the project |
| 🔐 Verification | [SHA256SUMS.txt](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/SHA256SUMS.txt) | Confirming that a download is complete and authentic |

The Universal Linux download contains **Linux files only**. Windows is distributed separately through the setup executable.

## ✨ What LCARS can do

| System | Capabilities |
| --- | --- |
| 🖥️ **Desktop command center** | Launch installed applications, manage up to 20 favorites, switch open windows through the Task Rail, access named system-tray services, and route supported windows between displays |
| 📊 **Live telemetry** | Inspect overall and per-core CPU use, RAM, graphics hardware, GPU memory and temperature where available, disks, removable storage, networking, and platform compatibility |
| 🧱 **Modular Overview** | Add, remove, resize, and reorder modules in Compact, Standard, or Wide layouts; use one global density or save different sizes per page |
| 📁 **Files and documents** | Browse local files, mount or unmount supported removable drives, preview common formats, and open text, document, and PDF workspaces in LCARS or detached windows |
| ⌨️ **Embedded terminal** | Use isolated local shell tabs directly inside LCARS, configure terminal behavior, open another native terminal window on a selected display, and middle-click tabs to close them |
| 🎵 **Media and audio** | Control compatible players, pin media sources, adjust master and per-application volume, and select output devices and microphones where the OS exposes them |
| 🎨 **Personalization** | Choose six visual themes, configure the modular Speed Dial and sidebar destinations, save Workstations, adjust accessibility options, and import or export settings |
| 🔔 **Operator tools** | Search the interface with `Ctrl+F`, open the Command Palette with `Ctrl+K`, navigate pages with number keys `1–8`, review notices, and use Do Not Disturb |
| 🔒 **Local safeguards** | Use a themed optional-password lock screen, confirmation panels for protected actions, and a power menu for Exit LCARS, Sleep, Restart, or Shut Down |
| 🧩 **Extensions and voice** | Install declarative local modules and configure optional offline push-to-talk commands through `whisper.cpp` |

## 🆕 Version 24 highlights

- Added global or per-page **Compact, Standard, and Wide** content layouts without shifting the outer LCARS frame.
- Added a configurable **two-to-six item Speed Dial** for pages, modules, extensions, Do Not Disturb, displays, tasks, notices, and the system tray.
- Added custom sidebar destinations backed by installed applications, Overview modules, and compatible extensions.
- Added immersive LCARS workspaces for compatible applications while keeping native-window launching available; `Shift`+click always requests a native window.
- Expanded graphics, RAM, CPU-core, storage, and removable-media telemetry on Linux and Windows.
- Rebuilt Linux system-tray discovery so entries prefer recognizable application labels and icons instead of numeric D-Bus identifiers.
- Corrected packaged startup-audio loading and kept the startup system check visible but nonblocking.
- Added confirmed whole-computer **Sleep** alongside Exit LCARS, Restart, and Shut Down.
- Added opt-in application-menu registration and login startup support on both platforms.
- Added GitHub release updates with platform-specific downloads and SHA-256 verification. Background connection failures remain silent; manual checks explain errors.

## 🐧 Linux installation

### Recommended: Universal installer

1. Download [`LCARS-Universal-Linux-Desktop-v24.zip`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Universal-Linux-Desktop-v24.zip).
2. Extract the ZIP into a normal folder.
3. Double-click `Install-LCARS-Linux.desktop` and choose **Execute**.
4. Launch **LCARS Command Interface** from your application menu.

If your file manager will not execute the launcher, open the extracted folder in a terminal and run:

```bash
chmod +x Install-LCARS-Linux.run
./Install-LCARS-Linux.run
```

The installer detects DNF, APT, Pacman, Zypper, APK, or XBPS and installs the matching integration dependencies. It installs LCARS for the current user under `~/.local/opt/lcars-command-interface` and registers its proper application icon. Administrator access is requested only when the operating system needs to install system packages.

### Portable AppImage

```bash
chmod +x LCARS-Command-Interface-v24-x86_64.AppImage
./LCARS-Command-Interface-v24-x86_64.AppImage
```

To make a portable AppImage searchable from your desktop application menu, place `LCARS-Linux-Integration-v24.sh` beside it and run:

```bash
chmod +x LCARS-Linux-Integration-v24.sh
./LCARS-Linux-Integration-v24.sh --register
```

Use `--enable-autostart` or `--disable-autostart` to control login startup. These per-user integration actions do not require `sudo`.

### Uninstall from Linux

Double-click `Uninstall-LCARS-Linux.desktop`, or run `./uninstall-linux.sh` from the extracted Universal installer folder. The uninstaller asks whether to preserve your preferences, Workstations, and installed extensions.

> [!NOTE]
> KDE Plasma 6 on Wayland with KDotool provides the deepest integration. X11 desktops can use Xdotool. Restricted Wayland compositors still retain applications, terminal, files, telemetry, media, audio, updates, themes, modules, and profiles; unsupported desktop-specific controls explain what is unavailable instead of silently failing.

## 🪟 Windows installation

1. Download [`LCARS-Windows-Setup-v24.exe`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/LCARS-Windows-Setup-v24.exe).
2. Open the setup executable and follow the installer.
3. Optionally enable **Start LCARS Command Interface when I sign in**.
4. Launch LCARS from its desktop shortcut, Start Menu entry, or Windows taskbar search.

The installer can optionally reset old LCARS preferences, profiles, and extensions. Leave that option unchecked to preserve them during an update.

### Uninstall from Windows

Open **Settings → Apps → Installed apps**, select **LCARS Command Interface**, and choose **Uninstall**. You can also use the Start Menu uninstaller. Choose whether to remove saved settings when prompted.

> [!WARNING]
> Windows may display a SmartScreen warning because this community build is not commercially code-signed. Verify the published SHA-256 value before running it. Windows Package Manager (`winget`) is used to install missing local bridge dependencies.

## 🔄 Built-in updates

Open **Updates → LCARS Interface** to check the latest public GitHub Release. LCARS downloads the correct AppImage or Windows installer, compares it against the release's SHA-256 checksum, and only offers installation after successful verification.

- Automatic background checks stay quiet when GitHub or the internet is unavailable.
- Manual checks display useful connection or verification errors in the Updates page.
- A writable Linux AppImage can be replaced and restarted automatically; otherwise LCARS opens the verified downloaded AppImage.
- Windows opens the verified setup program after LCARS closes.

## 🎙️ Optional offline voice commands

LCARS works normally without voice control. Voice processing remains on the computer and is disabled until you configure it.

1. Install a `whisper.cpp` command-line build (`whisper-cli`).
2. Download a compatible GGML model such as `ggml-base.en.bin`.
3. Open **Settings → Offline Voice Control**.
4. Enable push-to-talk, select a microphone, and enter the full executable and model paths.

The Linux installer attempts a non-destructive FFmpeg installation but will never replace a working Fedora/Nobara multimedia provider or fail the main installation if voice dependencies are unavailable. The Windows installer uses `winget` for missing FFmpeg and Python components. Protected power and removable-storage voice commands still require manual confirmation.

## 🔐 Verify a download

Download [`SHA256SUMS.txt`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v24/SHA256SUMS.txt) from the same release and compare the appropriate file.

```bash
# Linux
sha256sum LCARS-Universal-Linux-Desktop-v24.zip
sha256sum LCARS-Command-Interface-v24-x86_64.AppImage
```

```powershell
# Windows PowerShell
Get-FileHash .\LCARS-Windows-Setup-v24.exe -Algorithm SHA256
```

The displayed value must exactly match the filename's line in `SHA256SUMS.txt`.

<details>
<summary><strong>Version 24 published SHA-256 values</strong></summary>

```text
765846a9f8076b109c76d3150ce0843e1c0212ee5b504bd874222807cb55d966  LCARS-Command-Interface-v24-x86_64.AppImage
e2becb034462b9addd1e6107c45c2f19252abc43518459aee1fd2edb08359eba  LCARS-Universal-Linux-Desktop-v24.zip
73576b5db76727297310f51a0cd8a3711739fd4fc890f34908266f5b86675f9a  LCARS-Linux-Integration-v24.sh
09904824738f63152c823f24ba1a03bcce96a87315b568cc234db06bf5362f1d  LCARS-Windows-Setup-v24.exe
562aa17b2d02d3e56e634c1cda447e7a988c5a228396865e31063402669896f4  LCARS-Command-Interface-v24-Source.zip
```

</details>

## 🧩 Extensions

LCARS supports declarative local extensions with reusable placements, settings, permissions, isolated persistent state, and allowlisted voice navigation. Version 1 Mission Checklist modules remain compatible.

See the [Extension API v2 guide](EXTENSION-API-V2.md) and the bundled examples under [`extensions/`](extensions/).

## 🛠️ Build from source

Requirements: Node.js 22.13 or newer, npm, and Python 3 for the local system bridge.

```bash
npm ci
npm run desktop:build
```

Create a desktop package on its matching host platform:

```bash
# Linux AppImage
npm run desktop:package:linux

# Windows NSIS installer
npm run desktop:package:windows
```

Cross-platform packaging may require additional native packaging tools. The release workflow runs the locked regression suite before publishing either installer.

<details>
<summary><strong>📚 Earlier release foundations</strong></summary>

### Version 23.2

- Added verified GitHub release updates, Extension API v2, native document workspaces, improved terminal tabs, a shorter onboarding sequence, and renderer recovery.

### Version 23.1

- Added unified LCARS framing, live network telemetry, the tray drawer, nonblocking startup checks, optional voice components, and the themed Workstation lock screen.

### Version 23

- Added offline voice-command infrastructure, native application artwork, 20 favorites, expanded system meters, removable-media controls, native Remote Terminal windows, universal search, and numeric page shortcuts.

</details>

## 📡 Project status

LCARS Command Interface is an independent fan-made project inspired by Star Trek LCARS. It is not affiliated with or endorsed by CBS Studios, Paramount, or the Star Trek rights holders.

The interface and installers were created collaboratively with ChatGPT, including the GPT-5.6 Sol Work Model. Use [GitHub Issues](https://github.com/HUHman416/LCARS-Command-Interface/issues) for reproducible bugs and feature requests. For Linux integration problems, include your distribution, desktop environment, display server, and LCARS version.
