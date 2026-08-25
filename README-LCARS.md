# LCARS Command Interface

An LCARS-inspired, completely local desktop application for modern Linux distributions. Cloudflare and an external web browser are not required.

LCARS now runs in its own Electron application window. The private system bridge starts and stops automatically with LCARS, so users do not need to launch a local web server or keep Firefox, Chrome, or another browser open.

Windows is distributed separately and is not included in the Universal Linux installer.

## Included

- Classic, Voyager, Nemesis Blue, Picard, Lower Decks, and PADD themes
- Persistent theme selection
- Responsive desktop, tablet, portrait, and landscape PADD layouts
- LCARS interface sounds with an audio toggle
- System telemetry display
- Searchable inventory of applications installed on the system
- Customizable favorites stored locally for each user
- Allowlisted application launching through the local system bridge
- Real local CPU, GPU, memory, and disk telemetry
- Embedded multi-tab terminal with direct local shell sessions
- KDE/Wayland-compatible Application Bay with switch, minimize, close, full-screen, and return controls
- Modular System Overview with addable, removable, reorderable built-in and local extension modules
- Safe Module API v1 support with the Mission Checklist test extension
- Responsive three-zone Media console with a detailed selected player, compact secondary sources, master audio, output/microphone switching, and an application mixer
- Grouped per-application audio volume, mute, expandable stream details, icons where available, and platform-aware routing controls
- Terminal shell, directory, font, cursor, scrollback, history, and display routing settings
- Direct multi-tab terminal sessions inside the LCARS console
- Drag-and-drop modules with Compact, Standard, and Wide sizes
- Passive action notifications with a persistent event log
- Pinned media-source ordering and adaptive empty states
- Confirmation surfaces for operating-system actions
- Safe standalone full-screen mode without experimental Shell Mode or startup-console toggles
- Retractable, hover-activated KWin task rail grouped by connected monitor
- Global display routing and one-press terminal launch on another monitor
- LCARS Shell Mode, system tray, first-run checks, and emergency Plasma recovery
- Universal Ctrl+K command palette for pages, applications, and system actions
- Saveable workspace profiles for layouts, themes, module sizes, and favorites
- Session restoration, searchable notification history, and Do Not Disturb
- Importable/exportable JSON configuration backups
- Interface scaling, high contrast, reduced motion, color-safe indicators, and independent cue volume
- Local operator lock screen with Ctrl+Shift+L shortcut
- Guided eight-step desktop tour
- LCARS power panel with separate Exit LCARS, Sleep Computer, Shut Down Computer, and Restart Computer controls; system power actions require confirmation
- Configurable Speed Dial, per-page sizing, custom sidebar destinations, and rich graphics/RAM telemetry
- Protected extension rendering with automatic quarantine after repeated module failures
- Diagnostics Center with guided remedies and a privacy-scrubbed support-report export
- Safe Startup, last-known-good recovery, and five automatic configuration snapshots
- Verified GitHub updates with release notes and automatic previous-AppImage archiving for Linux rollback
- Non-destructive installation repair for Linux desktop registration and Windows application search
- Version 25 Operations Automation with editable, preview-first routines and guarded system steps
- Version 26 Workstation profiles that also restore open Page Peeks, window geometry, z-order, minimized state, and snapping
- Engineering Console with cross-platform sensors and protected current-user process controls
- Communications Center with priority notices and persistent command activity
- Extension Hub with declarative catalog, enable/disable controls, and guarded local removal
- Configurable Tray Command Deck for applications, routines, LCARS pages, and desktop tray services
- Simultaneous Speed Dial Page Peeks with dragging, eight-direction resizing, snapping, minimizing, auto-arrange, reset, and persistent placement
- Stable and development update channels with quiet background checks
- Version 25.1 Speed Dial media controls with artwork, master audio, and per-application audio
- Resizable popup surfaces with persistent, viewport-safe sizes
- Plain number-key page navigation outside Terminal and other editable controls
- Touch-first PADD navigation with bottom command sheets and larger controls
- Trusted, checksum-verified declarative Module Repository under Updates → Module API
- Contained Communications feed and quiet native scrollbars without disabling scrolling

## Current stage

Version 26.1 is the current development-channel candidate. It introduces the LCARS multi-window workspace, complete Workstation restoration, touch-first PADD navigation, contained overflow behavior, and the trusted declarative Module Repository. Version 25 remains the stable line and provides the Operations Automation, Engineering, Communications, Extension Hub, media, audio, and updater foundations carried forward here. Protected commands, process termination, and computer power steps remain confirmation-gated.

For one-click Linux installation, open `Install-LCARS-Linux.desktop` or run `Install-LCARS-Linux.run`. Your file manager may ask you to mark the desktop launcher as trusted the first time it is opened. The installer places the standalone application in `~/.local/opt/lcars-command-interface`; Node.js, npm, and an external browser are not required to run it.

The universal installer detects DNF, APT, Pacman, Zypper, APK, or XBPS and installs the appropriate common dependencies. It also detects KDE, GNOME, X11, and Wayland capabilities. When a desktop session prevents a feature, the affected LCARS module displays a compatibility explanation and remedy instead of presenting a control that silently fails.

Supported full-integration target: KDE Plasma 6 on Wayland with KDotool. Generic X11 desktops receive window controls through xdotool. GNOME Wayland and other restricted Wayland compositors retain applications, terminal, files, telemetry, media/audio where available, updates, themes, modules, and profiles, while restricted window/shell controls are clearly identified.

To uninstall, open `Uninstall-LCARS-Linux.desktop` or run `./uninstall-linux.sh`. The uninstaller preserves shared system packages and asks separately before removing LCARS preferences.

Run `./start-local.sh` to start both the interface and its local system bridge. It listens only on the loopback interface and does not expose the dashboard to other devices.

Run `./install-autostart.sh --register` to add a portable AppImage to application/taskbar search. Use `./install-autostart.sh --enable-autostart` to launch it at login or `--disable-autostart` to turn that behavior off. These per-user operations do not require sudo and do not replace or remove KDE.

Media integration uses `playerctl` for MPRIS playback sources and `wpctl` for PipeWire volume control. Install `playerctl` through DNF if the Media screen does not detect compatible players.

The Terminal page creates local shell sessions through the loopback-only core. Commands typed there are sent only to the local shell process. Each tab is isolated, Ctrl+C is available, and closing a session can warn when its running processes will be terminated. Settings control the shell, starting directory, font, cursor, scrollback, history persistence, and whether a new terminal opens on the current or another display. No external AppImage integration is required.

## Application Bay

Modern KDE Wayland does not allow one application to reparent another application's window. The Application Bay therefore uses a shell-managed KWin window region: the LCARS frame remains visible around an aligned external application, while native modules can render directly in the bay. The included interface provides Full Screen, Return to Bay, Minimize, Close, and Switch Application controls. KWin-specific placement is an experimental integration and falls back to a normal application window when the required window-control facility is unavailable.

## Planned Linux connections

| Interface control | Linux connection |
| --- | --- |
| CPU, RAM, storage and uptime | /proc, /sys and udisks2 |
| NVIDIA telemetry | NVML or nvidia-smi adapter |
| Audio | PipeWire through wpctl |
| Network | NetworkManager over D-Bus |
| Bluetooth | BlueZ over D-Bus |
| Updates | PackageKit/DNF |
| Application launchers | Desktop entry IDs through GIO |
| Power actions | logind over D-Bus with confirmation |

The bridge should expose only fixed, validated actions. It should never accept arbitrary shell commands from the interface.

## Development

Install the locked dependencies and run the included development script. A production build can be created with the project's build script.

The source LCARS sounds and Antonio fonts were retained from the supplied LCARS-26 template.
