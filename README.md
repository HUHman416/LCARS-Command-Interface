<p align="center">
  <img src="desktop/icons/512x512.png" width="160" alt="LCARS Command Interface emblem">
</p>

<h1 align="center">🖖 LCARS Command Interface- With ChatGPT</h1>

<p align="center">
  <strong>A local-first LCARS-inspired desktop command environment for Linux and Windows made with ChatGPT, using their 5.6 Sol model in a Work chat.</strong><br>
  Launch applications, control media, inspect your system, manage windows, browse files, and use a real terminal—all without opening a web browser.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/stable-v28-ff9866" alt="Stable Version 28">
  <img src="https://img.shields.io/badge/Linux-x86__64-f2c84b" alt="Linux x86-64">
  <img src="https://img.shields.io/badge/Windows-10%20%7C%2011-829af1" alt="Windows 10 and 11">
  <img src="https://img.shields.io/badge/interface-local--first-b69de8" alt="Local-first interface">
</p>

<p align="center">
  <a href="https://github.com/HUHman416/LCARS-Command-Interface/releases/tag/v28"><strong>🚀 Download Version 28</strong></a>
  ·
  <a href="https://github.com/HUHman416/LCARS-Command-Interface/issues">🐞 Report an issue</a>
  ·
  <a href="EXTENSION-API-V2.md">🧩 Build an extension</a>
</p>

> [!IMPORTANT]
> **Version 28 is the current stable release for Linux and Windows, with the Android PADD Companion.** LCARS runs as its own Electron desktop application. It does not require Cloudflare, a hosted website, or an external browser.

> [!NOTE]
> Existing installations can update from **Updates → LCARS Interface**. Decimal releases are development milestones; Stable releases use the major version number.

> [!TIP]
> **Version 28 is the Connected Operations stable release.** It turns paired PADDs into a manageable fleet with granular permissions, live telemetry, approval-gated remote actions, Communications, Workstation handoff, proximity profiles, customizable PADD layouts, Android notifications and a home-screen widget. It also rebuilds the Display Matrix around six structurally distinct, researched on-screen LCARS families.

## 📥 Choose your download

| Platform | Download | Best for |
| --- | --- | --- |
| 🐧 Linux | [Universal Linux package](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/LCARS-Universal-Linux-Desktop-v28.zip) | Recommended installer bundle with desktop launcher, icon, uninstaller, dependencies, and integration tools |
| 🐧 Linux | [Portable AppImage](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/LCARS-Command-Interface-v28-x86_64.AppImage) | Running LCARS directly without a traditional installation |
| 🐧 Linux | [Search and autostart helper](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/LCARS-Linux-Integration-v28.sh) | Registering the portable AppImage in the application menu and optionally starting it at login |
| 🪟 Windows | [One-click Windows setup](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/LCARS-Windows-Setup-v28.exe) | Normal Windows installation, Start Menu search, shortcuts, optional autostart, and clean uninstall |
| 📱 Android | [PADD Companion APK](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/LCARS-PADD-Companion-v28-Android.apk) | Pairing a phone or tablet to LCARS over a trusted private network |
| 💻 Developers | [Version 28 source](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/LCARS-Command-Interface-v28-Source.zip) | Reviewing, extending, or building the project |
| 🔐 Verification | [SHA256SUMS.txt](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v28/SHA256SUMS.txt) | Confirming that a download is complete and authentic |

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
| 🎨 **Personalization** | Choose six visual themes, configure the modular Speed Dial and sidebar destinations, open simultaneous Page Peeks, save complete Workstations, adjust accessibility options, and import or export settings |
| 🔔 **Operator tools** | Build preview-first routines, search with `Ctrl+F`, open the Command Palette with `Ctrl+K`, map keyboard controls, review priority communications and command activity, and use Do Not Disturb |
| 🔒 **Local safeguards** | Use a themed optional-password lock screen, confirmation panels for protected actions, and a power menu for Exit LCARS, Sleep, Restart, or Shut Down |
| 🧩 **Extensions and voice** | Install trusted, checksum-verified declarative modules and configure optional offline push-to-talk commands through `whisper.cpp` |

## ✨ Version 28 Connected Operations

- Adds **PADD Fleet Command** with device renaming, online state, battery, network, latency, client version, connection counts, identify signals, revocation, and a persistent local activity journal.
- Adds granular per-device permissions, configurable PADD widgets, Connected Workstations, optional arrival/departure proximity profiles, and distinct Viewer, Operator, and Command authority.
- Introduces an explicit desktop approval queue for remote routines, application launches, Workstation restores, handoffs, and opt-in text clipboard requests. Trusted-device auto-approval is separate and disabled by default.
- Expands Communications with acknowledgment and archive actions, active routine status, quick actions, current-console handoff, release-channel status, and richer media/telemetry state.
- Upgrades the native Android PADD with phone, tablet, and landscape layouts; priority notifications; haptic identify; accessibility synchronization; a home-screen status widget; live link diagnostics; and customizable panels.
- Adds selectable Android and browser-PADD media sources, connection recovery guidance, per-device notification policies, reusable permission presets, policy copying, two-minute approval expiration, client/station version warnings, and privacy-safe Connected diagnostics exports.
- Rebuilds Enterprise-D, Voyager, Enterprise-E/Nemesis, Picard-era Starfleet LCARS 2.0, Cerritos, and Defiant themes with their own geometry, density, borders, navigation, and panel behavior. Cardassian station controls, La Sirena holograms, and other non-LCARS systems are deliberately excluded.
- Brings the browser PADD fallback to the same Connected Operations protocol, including heartbeat telemetry and safe capability-aware controls.
- Retains all Version 27 safeguards: one-use pairing codes, hashed revocable tokens, private-network address validation, and a hard block on remote Terminal, Files, process control, and computer power actions.

Version 28 is available on the **Stable** update channel. Use the companion only on a network you trust; the local PADD service is not intended for internet exposure.

Version 29 is reserved for an optional standalone Android LCARS experience that can act as a launcher/home-screen replacement as well as a paired companion. That larger mobile mode is documented for the next major development cycle and is not enabled in Version 28.

## 🆕 Version 27.2.1 stable update

- Replaces the Android WebView wrapper with a standalone native **PADD Companion** interface for status, communications, media, audio, page navigation, routines, and approved application commands.
- Adds a guided three-step pairing station under **Settings → Connected**, with direct APK download, one-use code arming, copyable station details, reconnection guidance, device roles, and revocation.
- Reorganizes **Settings** into Interface, Workspace, Connected, and System consoles and **Updates** into Releases, Modules, and Diagnostics so standard-size displays render one useful workspace instead of every panel in one vertical stack.
- Repairs the Electron stylesheet path for those categories and gives them a legible LCARS rail, distinct color coding, active state, hover state, and keyboard focus treatment.
- Refines the native PADD with LCARS elbows, compact segmented navigation, curved controls, condensed typography, denser panels, and proper status-bar, cutout, keyboard, and navigation-bar insets.
- Locks the Download control as soon as a release download begins and keeps it locked until LCARS restarts. The bridge also serializes downloads and reuses the verified artifact instead of replacing it.
- Retains the Version 27.1.1 pairing-arm hotfix, one-use five-minute codes, and native context actions for compatible Linux tray services.
- Stores only hashed device tokens and enforces revocable **Viewer**, **Operator**, and **Command** roles in the local core.
- Shares live LCARS status, communications, media, master volume, pages, routines, and favorite applications according to the assigned role.
- Never exposes Terminal, Files, process controls, or computer power actions to a paired PADD.
- Adds native context actions for compatible Linux StatusNotifier tray services. Right-click a service, press the keyboard menu key, or choose **Actions** to open the application's own menu, including actions such as Discord Quit.

Install the Android APK on the phone or tablet, then open **Settings → Connected** on the desktop and follow the numbered setup. Use the companion only on a network you trust; the local HTTP link is not intended for internet exposure.

## 🆕 Version 26 highlights

- Corrects the remaining visible Version 25 generation labels and identifies exported configuration with the Version 26 schema and exact application version.
- Expands configuration backup and restore to include community GitHub repositories, popup geometry, open Page Peeks, the default Workstation, session restore, and the selected media source.
- Adds a one-time **Welcome to Version 26** orientation with a permanent Settings shortcut for reopening it.
- Ships one verified stable release for Linux and Windows, with clean-install, update, rollback, and Development-to-Stable coverage.

## 🧪 Version 26.2 development update

- Adds **Workstations 3.0** with Workstation-specific Speed Dials, automatic portrait, landscape, desktop, and multi-monitor presets, plus preview, rename, duplicate, and individual export controls.
- Adds **Operations Automation 2.0** with folders, conditional step branches, delays, retries, continue/stop failure paths, operator prompts, individual-step testing, duplication, and local run history. Protected actions remain confirmation-gated.
- Rebuilds Communications as an **Action Center** with priority/source filters, repeated-message grouping, read/archive state, and safe Settings, Updates, or Process destinations.
- Expands Module Repository with operator-added **public GitHub sources**, source diagnostics and lifecycle controls, module update metadata, and a Module Publisher that generates repository-ready catalogs, checksums, folders, and documentation.
- Adds native detachable Page Peeks, snap-zone previews, a live minimized-window manager, and carries forward the post-split Windows-safe vertical-resize and compact-popup behavior.
- Shows the actual development version/channel and adds a clean Development-to-Stable major-release check.

## 🧪 Version 26.1 development update

- Introduces a real LCARS window workspace: open multiple Page Peeks, drag them by their headers, resize from every edge or corner, snap, minimize, focus, auto-arrange, close together, or reset the layout.
- Persists window geometry, z-order, minimized state, snap state, and open Page Peeks; Version 26 Workstations capture and restore that workspace with the rest of the operator profile.
- Adds the touch-first PADD interface with bottom navigation, horizontal Speed Dial access, command sheets, larger targets, and responsive portrait/landscape layouts.
- Rebuilds Communications Center overflow as one contained feed and quiets native scrollbars throughout popup and touch surfaces without disabling scrolling.
- Adds the trusted Module Repository under **Updates → Module API**. Catalog entries are explicit, declarative, size-limited, checksum-verified, and validated again before installation.
- Publishes Linux and Windows Development-channel installers only after the full regression suite, renderer builds, packaging, and combined SHA-256 verification pass.

## 🧪 Version 25.2 development update

- Added width, height, and diagonal resizing from every popup edge and corner, with saved viewport-safe dimensions.
- Made popup layouts respond to their own width so controls stack cleanly instead of overflowing when a window is narrowed.
- Rebuilt inactive Page Peek play glyphs with geometric centering instead of font-dependent spacing.
- Tightened Linux media icon matching so a stream never borrows an icon from a partially matching application name.

## Version 25.1 development update

- Rebuilt the Speed Dial Media Page Peek with current artwork, clear playback controls, master volume/mute, and live per-application audio controls.
- Added viewport-safe resizing and persistent sizes to Page Peeks and the primary popup surfaces.
- Restored plain `1`–`8` page navigation whenever focus is outside an editable control; `Ctrl+1`–`Ctrl+8` remains available while typing in Terminal.
- Publishes signed-by-GitHub Actions cross-platform prerelease packages and SHA-256 checksums for end-to-end Development-channel updater testing.

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

1. Download [`LCARS-Universal-Linux-Desktop-v26.zip`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v26/LCARS-Universal-Linux-Desktop-v26.zip).
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
chmod +x LCARS-Command-Interface-v26-x86_64.AppImage
./LCARS-Command-Interface-v26-x86_64.AppImage
```

To make a portable AppImage searchable from your desktop application menu, place `LCARS-Linux-Integration-v26.sh` beside it and run:

```bash
chmod +x LCARS-Linux-Integration-v26.sh
./LCARS-Linux-Integration-v26.sh --register
```

Use `--enable-autostart` or `--disable-autostart` to control login startup. These per-user integration actions do not require `sudo`.

### Uninstall from Linux

Double-click `Uninstall-LCARS-Linux.desktop`, or run `./uninstall-linux.sh` from the extracted Universal installer folder. The uninstaller asks whether to preserve your preferences, Workstations, and installed extensions.

> [!NOTE]
> KDE Plasma 6 on Wayland with KDotool provides the deepest integration. X11 desktops can use Xdotool. Restricted Wayland compositors still retain applications, terminal, files, telemetry, media, audio, updates, themes, modules, and profiles; unsupported desktop-specific controls explain what is unavailable instead of silently failing.

## 🪟 Windows installation

1. Download [`LCARS-Windows-Setup-v26.exe`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v26/LCARS-Windows-Setup-v26.exe).
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

Download [`SHA256SUMS.txt`](https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v26/SHA256SUMS.txt) from the same release and compare the appropriate file.

```bash
# Linux
sha256sum LCARS-Universal-Linux-Desktop-v26.zip
sha256sum LCARS-Command-Interface-v26-x86_64.AppImage
```

```powershell
# Windows PowerShell
Get-FileHash .\LCARS-Windows-Setup-v26.exe -Algorithm SHA256
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
