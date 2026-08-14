# LCARS Windows Command Interface

The Windows edition uses the same LCARS visual interface, themes, modules, profiles, notifications, files, and accessibility features as the Nobara/Fedora edition. Its local core connects the interface to Windows 10 or Windows 11 without Cloudflare or another remote service.

## One-click installation

1. Extract the Windows ZIP completely.
2. Double-click `Install-LCARS-Windows.cmd`.
3. Approve any normal Windows prerequisite installation prompts.

The installer obtains Node.js and Python when needed, installs the local Windows companions, creates a Start Menu shortcut, enables launch at sign-in, and starts LCARS. Nothing listens beyond `127.0.0.1`.

A normal Windows setup executable can be produced by running `windows\installer\build-installer.ps1` on Windows. It creates `windows\installer\output\LCARS-Windows-Setup.exe` using Inno Setup.

## Starting and stopping

- Start: double-click `Start-LCARS-Windows.cmd` or use the Start Menu entry.
- Stop local services: run `stop-windows.ps1` from PowerShell.
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

## Current limitations

The first Windows edition uses global Windows media controls because Windows does not expose every application's full media metadata consistently to ordinary desktop processes. Per-application volume discovery works through Windows Core Audio; changing individual application volumes is reserved for the dedicated Windows audio companion. The Application Bay manages native windows through the Task Rail rather than forcibly embedding every application, since modern Windows applications use several incompatible window technologies.

LCARS immersive mode does not replace `explorer.exe` in this first release. That is intentional: Explorer remains available as a recovery shell while the Windows port is tested on more hardware.
# Optional offline voice commands

Voice control is not required for LCARS. Install a Windows whisper.cpp build and FFmpeg, download a GGML English model (for example `ggml-base.en.bin`), then set the full executable and model paths under **Settings → Offline Voice Control**. Select a microphone and enable push-to-talk. All recognition stays local; missing voice files do not affect the rest of the interface.

