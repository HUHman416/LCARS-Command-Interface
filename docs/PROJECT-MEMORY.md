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

The verified roadmap and existing-feature audit live in [VERSION-31-ROADMAP.md](VERSION-31-ROADMAP.md). Implementation notes are retained for [Version 31.1](VERSION-31.1-PORTAL-BROKER.md) and [Version 31.2](VERSION-31.2-FILES-DOCUMENTS.md).

## Active milestone

Version 31.2 Development upgrades the existing Files station and Document Workspace rather than introducing duplicate applications. It adds tabbed and breadcrumb navigation, Recent and Places, sorting, batch commands, conflict decisions, default-application preferences, mounted network shares, cancellable operation jobs, archives, LCARS Trash, and bounded reversible history. Documents add recovery drafts, find/replace, metadata, recent tracking, Save As and Print intents, plus Text, Markdown, and HTML exports. All file roots remain explicitly contained to the operator home or approved mounted Places; archive traversal and links are rejected. Version 31.1 Portal Center remains the trusted route for Open, Save, Select Folder, Open With, Print, and other application intents.
