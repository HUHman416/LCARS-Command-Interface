# Version 30 Stable

Version 30 turns LCARSCI from a desktop-shaped application into a local-first command environment spanning the workstation, trusted stations, and Android PADD devices.

## Major systems

- Computer Core with bundled offline whisper.cpp voice recognition, optional wake word, configurable vocal authorization, direct-execution mode, expanded media and Starfleet-style commands, and distinct success/error acknowledgement.
- Secure Federation discovery and trust, encrypted station links, bounded offline queues, cross-station page handoff, selective synchronization, clipboard and small-file transfer, private storage, conflict handling, and version history.
- Signed declarative Module Platform with explicit capabilities, health isolation, rollback, portable packages, multiple repositories, and Module Forge.
- Optional Linux LCARS login session with application and window tasking, LCARS decks, multi-monitor Workstations, placement rules, session recovery, safe mode, kiosk mode, and a normal-desktop escape route.
- Universal Search across applications, files, settings, commands, stations, notifications, media, contacts, modules, Procedures, and activity, with actions for opening, routing, and attaching results.
- One chronological Operations Center for notices, station events, commands, Procedures, media, security prompts, and failures, including acknowledgement, assignment, explanations, diagnostic export, safe reruns/reversal, and priority propagation.
- Operator Workspaces with Guest, Operator, Administrator, and restricted Away Team roles; separate favorites, decks, Display Matrix choices, layouts, commands, station preferences, encrypted backup, and trusted roaming.
- Integrated LCARS audio and video playback with broad local-file routing, seek, volume, speed, keyboard control, fullscreen playback, and a fading HUD.
- Android Continuum with Home, Companion, media, communications, notifications, monitoring, presentation, and docked-station roles plus verified one-tap updates.
- A native System Control Matrix for telemetry, networking, Wi-Fi, Bluetooth, audio, displays, software, processes, storage, modules, and media without routine host control-panel handoffs.

## Stable fit and accessibility pass

- Replaces fixed viewport-height estimates with a shell that measures the actual masthead, alert banners, page area, and command rails.
- Keeps Terminal output, input, and session actions inside the live desktop viewport, including the short-window size reported during release testing.
- Resets page scroll position when navigation changes so a long previous page cannot leave the next masthead clipped.
- Keeps every numbered sidebar destination, including Tasks and Power, reachable on short desktop windows.
- Gives each long page and pop-out one explicit scroll owner so content remains reachable without nested or invisible cutoff regions.
- Audits every numbered page, all eleven Systems sections, Calendar, Universal Search, Operations Center, Display Routing, System Tray, Power, Applications, Procedure Builder, Computer Core, Operator Identities, and Page Peeks.
- Adds dedicated phone portrait and short-landscape handling for the Operations Center and PADD command rails.

## Packages

The release workflow produces signed Linux AppImage and portable packages, a Windows installer, a persistently signed Android APK, a source archive, and `SHA256SUMS.txt`. Android Version 30 uses a version code higher than every Version 30 development build, and the in-app updater recognizes the whole-number Stable release as an upgrade from decimal development milestones.
