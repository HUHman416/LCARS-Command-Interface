# LCARSCI Project Memory

This file is the durable handoff for future development sessions. Read it before proposing or beginning a major milestone.

## Release rules

- Version 30 is the current Stable release.
- Version 31 is the active development line; decimal numbers are development milestones only.
- The active branch is `31-development`.
- Do not duplicate an existing capability. Before every milestone, compare the proposal with the implementation and either skip it or define a real upgrade.
- Keep routine desktop operations inside LCARS. Operating-system security prompts and an emergency recovery route may remain external when the platform requires them.
- Preserve local-first operation, explicit consent, allowlisted actions, bounded history, and truthful platform capability reporting.
- A milestone is not ready for Stable until Linux, Windows, Android, compact, short-height, portrait, landscape, upgrade, and recovery paths relevant to that milestone are checked.

## Version 31 objective

Version 31 closes the remaining gaps between the optional LCARS session and a self-sufficient daily desktop. It should replace fragmented host dialogs with one coherent, operator-controlled workflow while retaining safe fallbacks.

The verified roadmap and existing-feature audit live in [VERSION-31-ROADMAP.md](VERSION-31-ROADMAP.md). Implementation notes are retained for [Version 31.1](VERSION-31.1-PORTAL-BROKER.md), [Version 31.2](VERSION-31.2-FILES-DOCUMENTS.md), [Version 31.3](VERSION-31.3-SOFTWARE-LOGISTICS.md), and [Version 31.4](VERSION-31.4-CONNECTIVITY-HARDWARE.md).

## Active milestone

Version 31.4 Development upgrades the existing Network area into a compact Connectivity and Hardware matrix rather than adding another Systems tab. It inventories real VPN profiles, hotspot capability, firewall state, saved networks, printers, scanners, cameras, game controllers, USB devices, and removable storage through platform-aware adapters; adds explicit route/DNS/reachability diagnostics; applies an LCARS-local removable mount policy; and routes VPN, hotspot, saved-network, camera, screen-sharing, printing, and device requests through the existing Portal Center. Protected connection approvals are exact-match, single-use, and never retain hotspot credentials. Unsupported platform controls remain visibly unavailable. This milestone also isolates Software Logistics controls from older Systems navigation rules, restoring readable numbered buttons and a clear offline manager state. Version 30 remains Stable.
