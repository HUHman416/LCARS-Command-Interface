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

The verified roadmap and existing-feature audit live in [VERSION-31-ROADMAP.md](VERSION-31-ROADMAP.md). Version 31.1 implementation notes live in [VERSION-31.1-PORTAL-BROKER.md](VERSION-31.1-PORTAL-BROKER.md).

## Active milestone

Version 31.1 Development builds the LCARS Portal and Intent Broker: one bounded local service for file choices, device permissions, protected requests, notifications, printing, sharing, and future application-to-LCARS intents. Sensitive routes always require an operator decision, and only the trusted LCARS window receives the random per-launch authority used for approvals and policy changes. A standard XDG portal adapter remains explicit and opt-in.
