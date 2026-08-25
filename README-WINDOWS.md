# LCARS Windows Command Interface

The Windows edition uses the same LCARS visual interface, themes, modules, profiles, notifications, files, and accessibility features as the Nobara/Fedora edition. Its local core connects the interface to Windows 10 or Windows 11 without Cloudflare or another remote service.

## One-click installation

1. Download `LCARS-Windows-Setup-v26.exe` from the Version 26 stable release (or use the in-app Stable update channel).
2. Double-click the setup executable and choose the installation folder.
3. Optionally tick **Start LCARS Command Interface when I sign in**.

The installer obtains the local Python runtime components when needed, creates a searchable Start Menu shortcut, and starts the standalone LCARS app. Login startup is opt-in. Nothing listens beyond `127.0.0.1`, and an external browser is not used.

A Windows setup executable can be produced from source by running `windows\installer\build-installer.ps1` on Windows. It invokes the same Electron/NSIS packaging path used by GitHub Releases.

## Starting and stopping

- Start: search for **LCARS Command Interface** in the Start menu/taskbar.
- Stop: choose **Exit LCARS** from its power menu or close the native window.
- Recovery: Settings → Recovery Control starts Windows Explorer again.

## Windows integrations

- Start Menu application discovery and launching
- Win32 task enumeration, focusing, minimizing, closing, and monitor movement
- Windows display detection
- PowerShell terminal sessions inside LCARS
- CPU, memory, disk, and NVIDIA telemetry
- Windows Core Audio master volume and application stream discovery
- Audio output/input discovery and switching through AudioDeviceCmdlets
- Global Windows media-key playback controls
- Local file browsing, opening, folder creation, copy, and move
- Windows Update, Microsoft Store, network, Bluetooth, audio, display, Task Manager, and Explorer shortcuts
- Start Menu and login-startup integration
- Confirmed whole-computer sleep, restart, and shutdown controls
- Operations Automation, richer Workstation restore, Engineering, Communications, and Extension Hub surfaces
- Configurable Tray Command Deck controls and pin-capable Speed Dial Page Peeks

## Current limitations

The first Windows edition uses global Windows media controls because Windows does not expose every application's full media metadata consistently to ordinary desktop processes. Per-application volume discovery works through Windows Core Audio; changing individual application volumes is reserved for the dedicated Windows audio companion. The Application Bay manages native windows through the Task Rail rather than forcibly embedding every application, since modern Windows applications use several incompatible window technologies.

LCARS immersive mode does not replace `explorer.exe` in this first release. That is intentional: Explorer remains available as a recovery shell while the Windows port is tested on more hardware.
# Optional offline voice commands

Voice control is not required for LCARS. Install a Windows whisper.cpp build and FFmpeg, download a GGML English model (for example `ggml-base.en.bin`), then set the full executable and model paths under **Settings → Offline Voice Control**. Select a microphone and enable push-to-talk. All recognition stays local; missing voice files do not affect the rest of the interface.
