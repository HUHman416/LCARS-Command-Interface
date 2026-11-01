# Version 31.5.9 Development — TOS Information Displays

The operator rejected the temporary bank dropdown, requested an overhaul of every section as a TOS information screen, and specified Computer terminology for the TOS interface. These directions supplement the supplied bridge, resin-key, helm, and captain’s-chair references. The black glass, mounted hardware, uniform key geometry, limited green, horizontal rockers, and existing font/audio choices remain.

## Physical controls

- Labeled physical buttons replace the bank dropdown. Adjacent-bank keys expose further banks without scrolling; compact widths show two selector keys and wider decks show four.
- Search categories use physical buttons on their own bank. The query, selected-record actions, and persistent Close key remain on the housing.
- Fields remain mounted across bank changes, forms retain their ownership, and hidden banks stay outside keyboard navigation. Fixed key pages and the compact command bar remain.

## Information glass

- Status retains the preferred paired instruments and identifies demonstration samples explicitly.
- Terminal uses command-source, operator, host, and core-link registers above the actual terminal output.
- Files uses library-record and authority registers, compact catalog rows, line-drawn file symbols, and plain metadata columns. Empty toolbar housings no longer float in the screen.
- Systems uses sampled engineering registers and segmented load meters alongside the existing detailed telemetry, storage, connectivity, and software inventory.
- Media uses source, output-level, mute, and core-link registers; source pictures and actual document/media contents remain intact. Demonstration levels are labeled.
- Network uses reported station counts, a core/station topology plot, compact address/counter records, and connection diagnostics. Unavailable links are explicitly shown; the old modulo-byte decorative flow bar is hidden.
- Updates uses revision/channel/module registers and plain numbered update records rather than large filled status badges.
- Settings uses configuration registers for scale, sound, contrast, motion, and color-safe state, with compact explanatory records.
- Portals uses pending-authority and role registers plus an authorization-sequence plot. Offline operation is explicit.
- Utilities uses operations registers and compact clipboard/capture/notice/print records.
- Commissioning uses core/module/session registers and line-separated readiness checks, command references, trust, and resilience records.
- Secondary Search/Data Fabric screens use the same information typography. Screens remain black and read-only; interaction remains on the housing.

Registers use existing state only. Offline, unavailable, and demonstration data are distinguished. Diagram lines explain existing topology/workflow; no fictitious traffic, history, or successful operations are generated.

## Terminology and data

TOS-owned interface labels, control captions, accessible names, prompts, recovery text, and window titles use Computer wording. The rendering boundary preserves form values, callbacks, literal resource addresses, file names, marked record text, document contents, and terminal source output. Other console families retain their original LCARS terminology. No stored identifiers, routes, protocols, approval requirements, or files are renamed.

## Validation and scope

Automated checks cover conditional terminology, preserved fields/handlers/source material, all eleven passive information displays, honest sample/offline labels, and the existing bounded-bank and Search behavior. Both renderers, all main sections, physical bank selection, compact layouts, and representative secondary windows are checked before publication. Native hardware operations still require their real platform services; preview inspection does not claim those operations succeeded.

Version 30 remains Stable; 31.6 remains reserved.

Validation results: both renderer builds passed, with 211 JavaScript and 69 Python tests. Syntax, Python compilation, shell, and whitespace checks passed. TypeScript retains seven existing image/activity/Cloudflare declaration diagnostics; no new diagnostics were introduced. Browser checks cover all eleven black read-only primary screens, 71 desktop bank pages, 23 portrait Settings bank pages, short landscape sizing, button-only selectors, Search categories, startup and Power terminology, and switching to the original TNG layout/terminology and back.
