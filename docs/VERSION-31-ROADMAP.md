# Version 31 Roadmap — Self-Sufficient LCARS

This roadmap was checked against the Version 30 implementation before work began. It does not re-plan features that already exist.

Version 30 is the current Stable release while this roadmap is in development.

## Existing foundation retained from Version 30

LCARS already includes application discovery and launch, a Task Rail, virtual decks, Workstations, an optional authoritative Linux session, file browsing and previews, text editing, PDF and office-document reading, integrated audio/video playback, removable-storage mount controls, Wi-Fi, Bluetooth, audio and display controls, package-update discovery, process controls, Operator identities, PINs and roles, Federation, Universal Search, Data Fabric, Communications, offline voice, recovery, accessibility, one-tap verified updates, and Android Continuum.

Those capabilities should be upgraded only where the milestones below identify a concrete limitation.

## 31.1 Development — LCARS Portal and Intent Broker

- One local intent queue for open/save/folder/application choices, protected authorization, notifications, microphone, camera, screen sharing, printing, and sharing.
- Explicit per-route Ask, Allow, and Deny policy; sensitive routes may never be silently allowed.
- Bounded request history, automatic expiration, home-directory containment for file choices, and truthful adapter status.
- Electron device-permission routing and an application-facing local client.
- Opt-in XDG desktop portal adapter foundation without claiming to replace the system portal before external registration is complete.

## 31.2 Development — Files and Documents 2.0

- Reuse the broker for native LCARS Open, Save, Select Folder, and Open With workflows.
- Add default-application choices, Recent and Places views, breadcrumbs, tabs, sorting, batch selection, rename, duplicate, move, copy, properties, and safe conflict handling.
- Add Trash with restore/empty controls, archive create/extract, network shares, progress and cancellation, and recoverable file-operation history.
- Upgrade the document workspace with find/replace, autosave recovery, recent documents, metadata, and print/export routes.

## 31.3 Development — Software Logistics

- Upgrade package discovery from a Terminal handoff into graphical search, details, install, remove, update, source, Flatpak, and progress workflows.
- Add verified signatures, change previews, storage-impact estimates, restart requirements, transaction history, cancellation where supported, and rollback guidance.
- Keep distribution differences capability-aware and never synthesize an unsupported transaction.

## 31.4 Development — Connectivity and Hardware

- Add LCARS-native VPN, hotspot, firewall status, saved-network management, metered-network policy, and connection diagnostics.
- Add printers, scanners, cameras, game controllers, USB devices, and removable-device policy to the System Control Matrix.
- Reuse Portal Center for camera, screen-sharing, device, printing, and protected connection requests.

## 31.5 Development — Daily Utilities

- Add clipboard history with privacy controls, screenshots, screen recording, notifications-as-a-service, and print management.
- Add LCARS-native quick settings and consistent status surfaces for the utilities that still depend on host pop-ups.
- Integrate the existing calendar, Communications, Search, Data Fabric, and Operations timeline instead of creating duplicate applications.

## 31.6 Development — Security, Recovery, and Accessibility

- Add PolicyKit and secret/keyring mediation with clear operator identity and reason displays.
- Add session-wide permission history, revocation, temporary grants, private-mode controls, and security review.
- Harden crash recovery, backups, upgrade migration, safe mode, emergency desktop escape, keyboard-only access, screen-reader labels, focus order, and reduced-motion behavior.

## 31.7 Release Candidate — Whole-Environment Validation

- Audit every page, pop-out, portal request, task, short-height layout, display matrix, and failure fallback.
- Test Linux Wayland/X11, Windows 10/11, Android phone/tablet, portrait/landscape, multi-monitor, offline, upgrade, rollback, and crash recovery where applicable.
- Verify signed installers, checksums, migration, permissions, battery behavior, no-clipping guarantees, and Stable release notes.

## Stable gate

The final release is named **Version 31**, with no decimal. Version 30 remains Stable until all applicable Version 31 milestones and the Release Candidate gate pass.
