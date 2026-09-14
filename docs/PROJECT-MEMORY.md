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

The verified roadmap and existing-feature audit live in [VERSION-31-ROADMAP.md](VERSION-31-ROADMAP.md). Implementation notes are retained for [Version 31.1](VERSION-31.1-PORTAL-BROKER.md), [Version 31.2](VERSION-31.2-FILES-DOCUMENTS.md), [Version 31.3](VERSION-31.3-SOFTWARE-LOGISTICS.md), [Version 31.4](VERSION-31.4-CONNECTIVITY-HARDWARE.md), and [Version 31.5](VERSION-31.5-DAILY-UTILITIES.md).

## Active milestone

Version 31.5 Development adds a numbered Daily Utilities page without duplicating the calendar, Communications, Universal Search, Data Fabric, Files, or Operations systems. Clipboard history is local, bounded, opt-in, clearable, and disabled by Private Mode. Screenshots and WebM recordings require Portal-approved display access and save to fixed local LCARS Captures folders. Printer and queue inventory is platform-aware; cancellation needs a matching, single-use Portal approval. Approved application notifications flow into the existing Communications and Operations timeline. The Electron permission path now trusts the active `lcars://` frame when Chromium omits a microphone request origin, and Voice Control prevents overlapping unmute attempts. Version 30 remains Stable.
