# LCARS Command Interface Version 23 — Local Draft

This worktree is the unpublished Version 23 development pass. The public GitHub release remains Version 22.2 until the project owner explicitly approves publishing.

## Version 23 systems

- Offline, loopback-only push-to-talk infrastructure for whisper.cpp, with an optional “Computer” wake phrase, configurable command authority, a visible listening state, command history, and manual confirmation for protected actions.
- Extension manifests may register declarative voice phrases that navigate to allowlisted LCARS pages. Extensions cannot execute arbitrary voice-command code.
- Task Rail scrolling uses one stable scroll owner. Search appears at five windows, KDE tray services appear in a dedicated tray area, monitor grouping remains available, and native application icons replace initials when the platform supplies artwork.
- Favorites support up to 20 responsive launchers; dense layouts progressively emphasize artwork.
- Systems meters open expanded telemetry. CPU includes per-core readings; Storage lists physical and removable volumes and permits guarded UDisks2/Windows removable-media actions.
- Remote Terminal now opens as a second native Electron LCARS window on the selected display rather than a browser app.
- Ctrl+F finds settings, modules, applications, pages, and commands. Ctrl+K remains Command Palette. Number-row and numeric-keypad keys 1–8 open the matching sidebar page unless an editable control has focus.
- Display Matrix number badges and media transport glyphs use scale-resistant centering from 85% through 140% interface scale.

## Offline voice prerequisites

FFmpeg is installed by the updated runtime installers. The operator supplies a whisper.cpp CLI executable and a compatible local GGML model in Settings. Voice stays disabled until enabled by the operator; recordings are posted only to the loopback bridge and are deleted after transcription.

## Platform notes

KDE tray inventory uses StatusNotifierWatcher. Windows has no supported API to re-host every third-party notification icon, so Windows reports that limitation and keeps native LCARS quick controls available. Mount/unmount controls are limited to volumes identified by the operating system as removable.
