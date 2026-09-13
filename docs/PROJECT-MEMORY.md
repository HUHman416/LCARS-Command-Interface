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

The verified roadmap and existing-feature audit live in [VERSION-31-ROADMAP.md](VERSION-31-ROADMAP.md). Implementation notes are retained for [Version 31.1](VERSION-31.1-PORTAL-BROKER.md), [Version 31.2](VERSION-31.2-FILES-DOCUMENTS.md), and [Version 31.3](VERSION-31.3-SOFTWARE-LOGISTICS.md).

## Active milestone

Version 31.3 Development upgrades the existing System Control Matrix software area rather than adding a duplicate store. It replaces the Terminal handoff with capability-aware catalog search, package details, short-lived reviewed install/remove/update plans, manager-provided previews, signature-policy reporting, storage and restart assessment, live jobs, safe cancellation where supported, source inventory, explicitly confirmed user-manageable source changes, bounded history, and truthful rollback guidance. Commands are passed as validated argument arrays, never shell text. Native distribution sources remain read-only unless an adapter can guarantee safe modification. The Files 2.0 result grid is also corrected to compact fixed-height rows with bounded icons and horizontal control rails. Version 30 remains Stable.
