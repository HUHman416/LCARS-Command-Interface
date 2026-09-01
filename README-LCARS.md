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
- Public GitHub community Module Repository sources with validation, source controls, diagnostics, and a repository-package publisher
- Workstations 3.0 with adaptive display presets, Workstation-specific Speed Dials, preview, rename, duplicate, and individual export
- Operations Automation 2.0 with conditions, delays, retries, failure paths, prompts, step tests, folders, and run history
- Communications Action Center with filters, repeated-message grouping, read/archive state, and safe destination actions
- Native detachable Page Peeks, snap-zone previews, and minimized-window management
- Contained Communications feed and quiet native scrollbars without disabling scrolling
- Version 27 Connected LCARS with a separately paired, role-limited phone/tablet PADD companion
- Directly installable Android PADD Companion APK with a private-station connection guard
- Native context actions for compatible Linux StatusNotifier tray services, including application-provided quit controls
- Version 28 PADD Fleet Command with live device telemetry, granular permissions, per-device layouts, Connected Workstations, identify, proximity profiles, activity history, approvals, and diagnostics
- Native Android Communications, quick actions, current-console handoff, priority notifications, accessibility sync, haptic identify, and a home-screen status widget
- Opt-in text-only clipboard requests that remain disabled by default and require desktop approval unless a trusted-device override is explicitly enabled
- Version 29.1 optional Android Home foundation with application search, favorites, offline device status, and explicit safe launcher switching
- Version 29.2 desktop-style mobile shell with LCARS decks, folders, native Android widgets, Display Matrix themes, layout customization, and portable backup/restore
- Version 29 Connected Station Dock with an embedded Companion page, up to eight encrypted station pairings, priority notifications, credential migration, battery testing, faster unlock/app launching, an LCARS calendar, twenty independent Favorites, and verified one-tap mobile updates
- Resilient native mastheads that remain contained after navigation, accessibility scaling, rotation, and return to Status
- Corrected multi-row Status module edit controls and full-height Page Peek, Communications, and Tray resizing
- Version 30.1 Computer Core with local plain-language plans, dry runs, authority/risk previews, Computer Audit, reversible-plan undo, and expanded Procedures
- Verified bundled whisper.cpp desktop transcription with direct PCM WAV capture, custom model overrides, and optional hashed vocal authorization for protected plans
- Version 30.2 Federation with durable station fingerprints, automatic discovery, signed and encrypted native synchronization, per-device routes, operational handoff, and offline delivery queues
- Optional hands-free offline voice with push-to-talk retained and an independently configurable Computer wake word
- Version 30.3 opt-in immediate voice execution with Voice Authority enforcement, vocal authorization for protected direct actions, a contained masthead indicator, accurate wake-word status, and the stable Module Platform
- Version 30.4 optional Linux login session with Wayland/X11 entries, LCARS decks, Workstations, KWin/X11 placement rules, multi-monitor command stations, crash recovery, safe mode, kiosk mode, and a normal-desktop escape route
- Version 30.4 voice expansion with deterministic playback phrases, Starfleet-style display/status/calendar/hailing commands, Red and Yellow Alerts, protected close-only Self Destruct, correct success/error cues, and readable Communications controls
- Version 30.5 Universal LCARS Search across applications, files, settings, commands, stations, notices, media, contacts, modules, Procedures, and activity, with direct open, route, and attach actions
- Version 30.5 Data Fabric with selective sync policy, encrypted clipboard and small-file handoff, recent-item synchronization, version history, conflict resolution, and opt-in AES-256-GCM private storage
- Version 30.6 Operations Center with a unified chronological timeline, station/operator/subsystem/severity filters, search, acknowledgement, assignment, related-event grouping, explanations, privacy-filtered diagnostic export, safe rerun/reverse actions, and priority Federation propagation
- Version 30.6 explicit, player-aware media pause/resume with compatible-player fallback and exact retry actions
- Version 30.7 operator identities with separate favorites, decks, themes, layouts, commands, station preferences, Guest/Operator/Administrator roles, quick switching, optional PINs, shared and restricted Away Team profiles, encrypted backups, and secure roaming
- Version 30.7 verified named-source Linux media control plus an integrated LCARS audio/video deck with fullscreen playback, fading HUD controls, seeking, volume, speed, keyboard shortcuts, and drag-and-drop
- Version 30.8 optional Browser Station with automatic and custom browser selection, existing-profile preservation, native-window tasking, and a complete offline-disable control
- Version 30.8 direct File Explorer media routing with seekable local streaming, broad format recognition, contained decoder errors, and an explicit system-player fallback
- Version 30.8 Continuum role engine with eight phone/tablet roles, automatic environment recommendations, docking and external-display awareness, and manual overrides
- Green Alert and No Alert voice phrases plus distinct spoken single-command and compact multi-command confirmation cues

## Current stage

Version 30.8.1 is the current Development hotfix for the Version 30.8 milestone and Version 29 remains Stable. The optional Browser Station now contains a sandboxed web session directly inside LCARS while retaining installed browsers as an explicit external-profile fallback; it can be removed for an entirely offline layout. File Explorer routes broad audio/video formats to the built-in LCARS Media Deck through seekable local streaming without automatic OS handoff. Android Continuum supplies eight manually selectable roles plus automatic recommendations for orientation, screen, external display, docking, and paired-station changes. Version 30.7 Operator Workspaces and Media Deck, Version 30.6 Operations Center, Version 30.5 Universal Search and Data Fabric, Version 30.4 LCARS Session, Version 30.3 Module Platform, Version 30.2 Federation, and Version 30.1 Computer Core remain intact. See `docs/MODULE-API-v3.md` for the public module contract.

Version 29 is the current Stable Mobile Command Environment release. It assembles the Version 29.1 Home foundation, Version 29.2 customization milestone, and the final Connected Station Dock, multi-station, notification, credential-migration, battery, performance, calendar, Favorites, and mobile-update work. The Android package begins the persistent Version 29 signing line; older disposable development-signed packages may require a one-time uninstall before Stable can be installed. Only hashed revocable tokens are stored by the desktop core; Android station tokens are encrypted with Android Keystore AES-GCM. Viewer, Operator, Command, granular permission, and explicit sensitive-action approval checks remain enforced, and PADD devices never receive Terminal, file, process, or computer power access.

For one-click Linux installation, open `Install-LCARS-Linux.desktop` or run `Install-LCARS-Linux.run`. Your file manager may ask you to mark the desktop launcher as trusted the first time it is opened. The installer places the standalone application in `~/.local/opt/lcars-command-interface`; Node.js, npm, and an external browser are not required to run it.

The universal installer detects DNF, APT, Pacman, Zypper, APK, or XBPS and installs the appropriate common dependencies. It also detects KDE, GNOME, X11, and Wayland capabilities. When a desktop session prevents a feature, the affected LCARS module displays a compatibility explanation and remedy instead of presenting a control that silently fails.

Supported full-integration target: KDE Plasma 6 on Wayland with KDotool. Generic X11 desktops receive window controls through xdotool. GNOME Wayland and other restricted Wayland compositors retain applications, terminal, files, telemetry, media/audio where available, updates, themes, modules, and profiles, while restricted window/shell controls are clearly identified.

To uninstall, open `Uninstall-LCARS-Linux.desktop` or run `./uninstall-linux.sh`. The uninstaller preserves shared system packages and asks separately before removing LCARS preferences.

Run `./start-local.sh` to start both the interface and its local system bridge. The privileged desktop core listens only on the loopback interface. If the operator explicitly enables PADD Companion Link, a separate limited service listens on local-network port 8766 until it is disabled.

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
