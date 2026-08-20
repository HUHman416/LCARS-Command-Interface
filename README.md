<p align="center">
  <img src="desktop/icons/512x512.png" width="160" alt="LCARS Command Interface emblem">
</p>

<h1 align="center">🖖 LCARS Command Interface</h1>

<p align="center">
  <strong>A local-first LCARS-inspired desktop command environment for Linux and Windows.</strong><br>
  Launch applications, control media, inspect your system, manage windows, browse files, and use a real terminal—all without opening a web browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/stable-v25-ff9866" alt="Stable version 25">
  <img src="https://img.shields.io/badge/Linux-x86__64-f2c84b" alt="Linux x86-64">
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-829af1" alt="Windows 10 and 11">
  <img src="https://img.shields.io/badge/interface-local--first-b69de8" alt="Local-first interface">
</p>

<p align="center">
  <a href="https://github.com/HUHman416/LCARS-Command-Interface/releases/tag/v25"><strong>🚀 Download Version 25</strong></a>
  ·
  <a href="https://github.com/HUHman416/LCARS-Command-Interface/issues">🐞 Report an issue</a>
  ·
  <a href="EXTENSION-API-V2.md">🧩 Build an extension</a>
</p>

> [!IMPORTANT]
> **Version 25 is the current release prepared by this branch.** LCARS runs as its own Electron desktop application. It does not require Cloudflare, a hosted website, or an external browser.

## 📥 Choose your download

| Platform | Download | Best for |
| --- | --- | --- |
| 🐧 Linux | [Universal Linux package](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Universal-Linux-Desktop-v25.zip) | Recommended installer bundle with desktop launcher, icon, uninstaller, dependencies, and integration tools |
| 🐧 Linux | [Portable AppImage](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Command-Interface-v25-x86_64.AppImage) | Running LCARS directly without a traditional installation |
| 🐧 Linux | [Search and autostart helper](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Linux-Integration-v25.sh) | Registering the portable AppImage in the application menu and optionally starting it at login |
| 🪟 Windows | [One-click Windows setup](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Windows-Setup-v25.exe) | Normal Windows installation, Start Menu search, shortcuts, optional autostart, and clean uninstall |
| 💻 Developers | [Version 25 source](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Command-Interface-v25-Source.zip) | Reviewing, extending, or building the project |
| 🔐 Verification | [SHA256SUMS.txt](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/SHA256SUMS.txt) | Confirming that a download is complete and authentic |

The Universal Linux download contains **Linux files only**. Windows is distributed separately through the setup executable.

## ✨ What LCARS can do

| System | Capabilities |
| --- | --- |
| 🖥️ **Desktop command center** | Launch installed applications, manage up to 20 favorites, switch open windows through the Task Rail, mix named tray services with configurable command buttons, and route supported windows between displays |
| 📊 **Live telemetry** | Inspect overall and per-core CPU use, RAM, graphics hardware, GPU memory and temperature where available, disks, removable storage, networking, and platform compatibility |
| 🧱 **Modular Overview** | Add, remove, resize, and reorder modules in Compact, Standard, or Wide layouts; use one global density or save different sizes per page |
| 📁 **Files and documents** | Browse local files, mount or unmount supported removable drives, preview common formats, and open text, document, and PDF workspaces in LCARS or detached windows |
| ⌨️ **Embedded terminal** | Use isolated local shell tabs directly inside LCARS, configure terminal behavior, open another native terminal window on a selected display, and middle-click tabs to close them |
| 🎵 **Media and audio** | Control compatible players, pin media sources, adjust master and per-application volume, and select output devices and microphones where the OS exposes them |
| 🎨 **Personalization** | Choose six visual themes, configure the modular Speed Dial and sidebar destinations, pin compact Page Peeks, save richer Workstations, adjust accessibility options, and import or export settings |
| 🔔 **Operator tools** | Build preview-first routines, search with `Ctrl+F`, open the Command Palette with `Ctrl+K`, map keyboard controls, review priority communications and command activity, and use Do Not Disturb |
| 🔒 **Local safeguards** | Use a themed optional-password lock screen, confirmation panels for protected actions, and a power menu for Exit LCARS, Sleep, Restart, or Shut Down |
| 🧩 **Extensions and voice** | Install declarative local modules and configure optional offline push-to-talk commands through `whisper.cpp` |

## 🆕 Version 25 highlights

- Added **Operations Automation** for editable multi-step routines with manual, startup, time, application, and device triggers.
- Every routine opens a readable execution preview; approved commands and computer power steps require explicit operator confirmation and never run unattended.
- Expanded **Workstations** to restore pages, theme, modules, favorites, audio devices, volume, applications, and supported display destinations.
- Added an **Engineering Console** with local sensor telemetry and protected controls for current-user processes.
- Added a unified **Communications Center** for priority notices, Do Not Disturb, and a persistent local command-activity record.
- Added a declarative **Extension Hub** with catalog search, enable/disable controls, and guarded removal of non-bundled local extensions.
- Rebuilt the system tray as a scrollable **Tray Command Deck** that mixes desktop services with operator-defined application, routine, and LCARS-page buttons.
- Sidebar destinations on the modular Speed Dial now open compact **Page Peeks**; pinning keeps a Peek above other LCARS pages until released.
- Added configurable keyboard/control mappings and voice-command access to routines.
- Added explicit Stable and Development update channels. Automatic checks remain silent when offline; manual checks report useful errors.
- Corrected scaled media-control alignment and retained the fixed three-zone Version 24.1 Media console.

## 🐧 Linux installation

### Recommended: Universal installer

1. Download [`LCARS-Universal-Linux-Desktop-v25.zip`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Universal-Linux-Desktop-v25.zip).
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
chmod +x LCARS-Command-Interface-v25-x86_64.AppImage
./LCARS-Command-Interface-v25-x86_64.AppImage
```

To make a portable AppImage searchable from your desktop application menu, place `LCARS-Linux-Integration-v25.sh` beside it and run:

```bash
chmod +x LCARS-Linux-Integration-v25.sh
./LCARS-Linux-Integration-v25.sh --register
```

Use `--enable-autostart` or `--disable-autostart` to control login startup. These per-user integration actions do not require `sudo`.

### Uninstall from Linux

Double-click `Uninstall-LCARS-Linux.desktop`, or run `./uninstall-linux.sh` from the extracted Universal installer folder. The uninstaller asks whether to preserve your preferences, Workstations, and installed extensions.

> [!NOTE]
> KDE Plasma 6 on Wayland with KDotool provides the deepest integration. X11 desktops can use Xdotool. Restricted Wayland compositors still retain applications, terminal, files, telemetry, media, audio, updates, themes, modules, and profiles; unsupported desktop-specific controls explain what is unavailable instead of silently failing.

## 🪟 Windows installation

1. Download [`LCARS-Windows-Setup-v25.exe`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/LCARS-Windows-Setup-v25.exe).
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

Download [`SHA256SUMS.txt`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v25/SHA256SUMS.txt) from the same release and compare the appropriate file.

```bash
# Linux
sha256sum LCARS-Universal-Linux-Desktop-v25.zip
sha256sum LCARS-Command-Interface-v25-x86_64.AppImage
```

```powershell
# Windows PowerShell
Get-FileHash .\LCARS-Windows-Setup-v25.exe -Algorithm SHA256
```

The displayed value must exactly match the filename's line in `SHA256SUMS.txt`.

Release checksums are generated from the final Linux, Windows, and source artifacts in the publishing workflow. Treat the release's `SHA256SUMS.txt` as authoritative; development-build hashes are not interchangeable with public release hashes.

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

### Version 24.1

- Rebuilt Media into a fixed three-zone operations console and added recovery, repair, diagnostics, and rollback surfaces.

### Version 24

- Added page density, richer GPU/RAM telemetry, modular Speed Dial controls, custom sidebar pages, application destinations, whole-computer sleep, and opt-in login startup.

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
