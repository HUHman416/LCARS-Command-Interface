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


## TOS console addition — 31.5.1 Development

The optional `tos` Display Matrix family adds uniformly black console surfaces, consistent square sidebar keys, warm amber/red/ivory controls with restrained green, cyan-framed current-load instruments, and illuminated switch banks, a restrained decorative indicator bank, and user-supplied Roddenberry regular/bold/bold-italic fonts. Body and document text stay readable in standard fonts. All six existing families remain. Both renderer entrypoints load `app/tos.css`; detached document and Page Peek windows inherit theme, alert, and accessibility classes. This supplementary release does not consume 31.6 or displace its planned Security, Recovery, and Accessibility milestone. Version 30 stays Stable. See [TOS notes](VERSION-31.5.1-TOS-CONSOLE.md).

The TOS addition also bundles the operator-provided `tos_keypress1.mp3` and `tos_cancel_keypress.mp3`. Capture-phase key feedback respects the existing sound toggle and Interface Sound volume; cancel/dismiss/Escape use the cancel recording, and the old beeps are suppressed only for TOS to prevent duplicate cues. `app/tos-audio.ts` keeps one active playback channel.

The additional supplied `tos_datareceived_ep.mp3` announces explicit built-in updater activity (and manual discovery of a release), while `tos_unabletocomply.mp3` handles TOS errors, transfer failures, and failed updates. Quiet background update polling remains silent. These clips follow the same existing sound toggle and volume.

## TOS production-console fidelity — 31.5.2 Development

Following operator review of the 31.5.1 build, the TOS composition now uses two paired cyan-surrounded graphic monitors, an original amber radial memory/storage instrument, smaller technical panel labels, and a two-column bank of consistently shaped illuminated station keys. The screen surface remains black throughout. Large dashboard-style headings and individually boxed application cards are reduced in favor of physical program-selector keys. Roddenberry fonts and all four supplied key/updater/failure recordings remain. Version 31.6 is still reserved, and Version 30 stays Stable.
