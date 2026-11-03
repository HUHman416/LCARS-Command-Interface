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

## Additional TOS visual direction — character-sheet reference

The operator supplied `Star_Trek_Adventures_1e_TOS_Desktop_V5_Fillable.pdf` as an additional aesthetic reference after 31.5.2. Both pages were reviewed. Carry these cues into future TOS refinements: pure black fields; flat, saturated yellow, green, cyan, and orange-red section bars with black lettering; bold white Roddenberry headings and short white labels; thin white rules; and simple square, rectangular, triangle, and diamond markers. Use color and alignment to group controls, with generous black separation and fewer enclosing card borders.

This is a fan-made design reference, supplementary to the supplied console photographs and graphics. Its gray outer surround does not override the operator's explicit requirement for an entirely black application background. Keep station-key shapes and icon sizing uniform, and preserve the corrected Tasks/Tray/Power area. This direction is implemented in the supplementary 31.5.3 Development update.

## TOS character-sheet style — 31.5.3 Development

The TOS graphics use the additional reference palette: yellow `#ffdd00`, green `#39e639`, cyan `#00bfff`, orange-red `#ff3200`, white, and black. Later operator review explicitly rejected large red/yellow areas ("ketchup and mustard"), broad TNG-like bands, and a movie-era appearance. The subsequently supplied resin-button photographs take priority for physical controls: translucent blue, green, ivory, and amber caps, jelly-bean switches, small domed lamps, and printed legends separate from the cap. Keep station key geometry and numeric legends uniform; use red sparingly for signals and Power.

The final 31.5.3 treatment uses black instrument screens, white Roddenberry headings, thin white rules, and small colored panel-code blocks instead of wide colored bands. Resin caps use original CSS highlights and bevels, with no reference photographs bundled. Selected Settings categories use black labels on light ivory, including High Contrast mode. Tasks, Tray, and Power remain pinned. Compact layouts use the existing mobile control bar and Command Deck rather than an overlapping Speed Dial strip. Functional telemetry, all three fonts, all four recordings, accessibility modes, and the six other families are retained. See [31.5.3 notes](VERSION-31.5.3-TOS-STYLE.md).

## TOS preferred composition — 31.5.4 Development

The operator subsequently supplied a screenshot of 31.5.2 and explicitly said its overall composition was closer for everything except the palette. Treat that screenshot as the structural reference: retain the original smaller typography, two-column rectangular key bank, paired cyan-framed monitors, amber allocation display, restrained panel frames, and normal printed labels. Avoid the enlarged white headings, broad color bands, capsule-shaped station keys, and sparse black radial display explored in 31.5.3; the operator felt those drifted toward the movie era. The character sheet informs palette and label clarity, not a wholesale replacement layout.

31.5.4 restores the 31.5.2 stylesheet and instrument composition, then applies stronger green/blue/ivory/yellow keys, restrained red signals, white heading text, and subtle translucent highlights on consistently shaped rectangular caps. The selected Settings category remains light ivory with explicitly black heading and description text in normal and High Contrast modes. Compact controls retain the existing command/tray routes without an overlapping Speed Dial strip. All sounds, fonts, functions, and other themes remain. See [31.5.4 notes](VERSION-31.5.4-TOS-COMPOSITION.md).

## TOS green restraint — 31.5.5 Development

The operator explicitly rejected the repeated green in 31.5.4 as movie-era styling. Preserve the preferred 31.5.2 layout and fonts, but do not use green as the default control, load-bar, readout, clock-strip, or shortcut color. The supplied physical-key references guide a mixed ivory, blue, amber, and restrained coral palette, with green confined to small indicator lamps. Avoid large red/yellow pairings as previously requested.

31.5.5 removes green from inherited action variables, station/application/mobile keys, notices, numeric readouts, Speed Dial controls, and the allocation ring. Load bars use per-channel ivory/amber/blue colors; high-load end segments remain coral. Green lamps remain small. Settings contrast, all-black console fields, paired cyan-framed monitors, the amber allocation display, rectangular resin geometry, all fonts and sounds, and other themes remain. See [31.5.5 notes](VERSION-31.5.5-TOS-PALETTE.md).

## TOS console housing and rocker switches — 31.5.6 Development

The operator now explicitly requests the character-sheet border and a physical separation between console hardware and screen: header and sidebar should join the border as one seamless console housing, while actual content is the screen. This authorizes the reference’s gray bevel on the housing; screen and button fields remain black. Preserve the preferred 31.5.2 interior composition and 31.5.5 palette, including restrained green lamps.

31.5.6 uses angular light/dark gray bevels, thin blue inner screen trim, small reference-inspired edge accents, and connected header/sidebar framing. The operator also requested a continuous black content screen without internal blue borders: instrument outlines and overview panel boxes are removed, while blue trim is confined to the outer bezel. The operator further requested a solid console-color sidebar without black mounting panels: station keys, Tasks, Tray, and Power now sit directly on the continuous gray housing. A TOS-only ConsoleDisplay wrapper keeps the bezel stationary while content scrolls; other families retain their existing DOM. Speed Dial controls sit on the console footer rather than covering the screen. Compact navigation remains mounted along the lower housing.

The supplied captain’s-chair photograph informs ivory rocker switches for the existing LCARS on/off settings. Their faces tilt and show explicit ON/OFF legends; underlying native checkboxes, labels, keyboard interaction, focus, and state persistence remain. Reduced Motion disables their transitions, and High Contrast retains clear outlines. Selection/checklist checkboxes keep their established semantics. See [31.5.6 notes](VERSION-31.5.6-TOS-HOUSING.md).


## Complete TOS station audit — 31.5.7 Development

The operator now rejects the blue outer screen trim as well as blue screen graphics. The black screen is for information; actual interaction belongs on controls physically joined to the console housing. This supersedes the 31.5.6 blue-bezel direction. Button banks must be organized and labeled. Standard deck keys share a single size based on the former Utility Overview key; banks with one action may use a longer, thinner key. The captain’s-chair rockers must be horizontal, square-edged, and simple.

31.5.7 introduces a TOS-only control host: existing React buttons, labels/fields, selectors, forms, and disclosures move into logical control groups on a connected housing deck. Modal windows own their decks so controls remain within the modal boundary. Existing browser prompts for Workstations, terminal tabs, routines, module permissions, and notices now use owned TOS dialogs with explicit acceptance/cancellation and focus handling; other families retain native dialogs. Information lists retain passive display copies; real controls retain their original handlers and native form ownership. Other families keep their existing DOM and behavior. Screen instruments are read-only, white/ivory/amber on black, with explicit hardware telemetry keys. No blue screen surround remains. Native TOS detached workspaces request frameless windows with drag regions and existing close controls.

Physical number/numpad section navigation and accepted command/mapped shortcuts now use the TOS key player, respecting mute and Interface Sound volume and avoiding repeat-key chatter. The operator supplied `tos_bridge_1_activate.mp3` for startup: the final request is the first **ten seconds**, with a **three-second fade from second seven through ten**, replacing the original startup cue only for TOS. The startup preference and ordinary LCARS-family recording remain. The four earlier TOS cues and three fonts remain.

Audit details and scope limits live in [31.5.7 audit](VERSION-31.5.7-TOS-AUDIT.md). Version 31.6 stays reserved, and Version 30 stays Stable.

Publication authorization: the operator explicitly approved publishing the edited ten-second startup recording together with this update to the public HUHman416/LCARS-Command-Interface repository and Development release. Local validation passed both renderer builds, 207 JavaScript tests, and 69 Python tests.

## Fixed TOS control banks — 31.5.8 Development

The operator explicitly rejects scrolling any physical console deck to find buttons. Use fixed selectable banks and explicit key pages; information glass may still scroll. The supplied additional bridge/helm/resin-key references reinforce mounted hardware inside a continuous housing and do not supersede the earlier palette restrictions or uniform key geometry.

31.5.8 keeps original controls mounted, presents one logical bank at a time, and packs whole fields and keys into bounded pages. Bank selectors and Previous/Next keys replace hardware scrolling, including portrait and short landscape. Forms retain native ownership and values persist across bank changes. The short desktop sidebar fits all eleven station keys. Search and Data Fabric use a continuous gray frame/header/deck and a persistent Close key. TOS Search uses eight passive display records per page and one selected-record action bank with Previous/Next Record keys; other families retain the complete original result list. Fonts, audio, earlier accessibility behavior, horizontal rockers, and existing functions remain. See [31.5.8 notes](VERSION-31.5.8-TOS-CONTROL-BANKS.md). Version 31.6 stays reserved; Version 30 stays Stable.

## TOS information screens and Computer wording — 31.5.9 Development

The operator rejects bank dropdowns: use labeled physical selector buttons, with adjacent-bank keys for further choices and fixed key pages. Search category selection also uses buttons. The operator additionally requests an overhaul of every section as a TOS information screen, informed by the additional bridge/helm/resin-key references. Keep the preferred Status instrument composition, and use compact registers, plain record rows, segmented meters, simple topology/authorization plots, and small geometric status marks elsewhere. The screen stays black and read-only; physical interaction stays on the housing. Use existing state only, explicitly labeling offline/unavailable/demonstration data.

The operator explicitly rejects LCARS terminology in the TOS interface because it belongs to a later era. Use Computer for owned TOS labels, prompts, tooltips, accessible names, and window/recovery titles. Preserve actual record/source contents, form values, callbacks, file names and addresses, protocols, and stored identifiers; other families retain their original terminology. These are display aliases, not renamed data or backend actions. See [31.5.9 notes](VERSION-31.5.9-TOS-INFORMATION-DISPLAYS.md). Fonts, all sounds, the ten-second startup fade, horizontal rockers, Version 30 Stable, and the reserved 31.6 milestone remain.

## Clear cast-resin TOS keys — 31.5.10 Development

The operator explicitly requests the clear, glossy appearance of the original resin-button photographs. Use curved specular highlights, refracted edges, internal reflected light, and optical depth inside existing black sockets. Keep rectangular geometry, uniform sizes and spacing, readable black legends, fixed banks, horizontal rocker tilt, ON/OFF text, focus, and disabled states. Treat physical keys and rocker faces only: information screens and gray housing remain matte, and other console families remain unchanged. Reflections are static. See [31.5.10 notes](VERSION-31.5.10-TOS-RESIN-AMBIANCE.md). The information displays, Computer wording, all fonts/sounds, reserved 31.6, and Version 30 Stable remain.


The operator additionally requests an AMBIANCE key below Computer Operator and confirmed the full original bridge recording, rather than the ten-second excerpt. Manual ON starts at 0:04, fades in over 1.8 seconds, and repeats 0:04–end. OFF fades over 650 ms. Enabled startup plays the full intro at 0:00 without fading out and then loops 0:04–end; disabling startup audio skips the intro and fades directly into the bed. Default OFF; persist `lcars-tos-ambiance`; follow Interface Sound volume and mute. A shared renderer/Electron runtime prevents duplicate playback, cancels stale operations, and suppresses secondary windows/safe mode/recovery. The prior ten-second startup remains when ambiance is OFF. The operator explicitly approved publishing the full original 4:17 recording with the ambiance and glossy-button update to the public HUHman416/LCARS-Command-Interface repository and Development release. Validation passed both renderer builds, 219 JavaScript tests, and 69 Python tests; the seven pre-existing TypeScript diagnostics remain. Desktop, portrait, and short-landscape previews were checked; actual Windows/Android audio-device playback is not locally verified.

## Fixed TOS information screens — 31.5.11 Development

The operator rejects main content scrolling and requests a new set of buttons below the blinking header lamps, joined to the chassis, to select each part of the screen. This supersedes the earlier allowance for scrolling information glass. Named display parts and continuation sheets now occupy a fixed main viewport. The selector rail uses direct physical keys, Previous/Next Display, a sheet count, and keyboard arrow navigation. Boundary planning uses complete records/graphics and actual text lines. Content remains mounted, preserving control portals, forms, handlers, media, and state; nested record panes expand into the same sheets. Other console families retain their original DOM and scrolling.

At 600 pixels high or less, the command bank begins stowed behind the new COMMAND KEYS button to leave useful space for information; taller screens begin with it open. The button remains on the chassis, and all original controls/banks stay mounted and reachable. Resizing and command-bank changes retain the selected named part where possible. This main-station change does not replace native/third-party viewer internals or modal content behavior. See [31.5.11 notes](VERSION-31.5.11-TOS-FIXED-DISPLAYS.md). Version 30 remains Stable; 31.6 stays reserved.

31.5.11 validation passed both renderer builds, 223 JavaScript and 69 Python tests, syntax/whitespace checks, all eleven sections and 34 desktop sheets at 1019×932, all five portrait Status sheets, short landscape with bank stowing/reopening, keyboard selection/cues, and switching to Enterprise-D and back. No clipped graphics or main scrolling were found in the audited sheets. The seven pre-existing TypeScript diagnostics remain.

## TOS prop keycaps — 31.5.12 Development

The operator supplies four additional Star Trek: Bridge Crew Original Series console references and explicitly asks to change button appearance while preserving placement. Use thick tinted resin caps with colored edge transmission, darker cores, small off-center reflections, black sockets, and rectangular/cushioned shapes. The prior broad white bevel was washing out colors and reading as metal. Pale consistent legends keep the darker centers readable. Use the reference images for material/shape only; the earlier restriction on green dominance still applies. Preserve uniform sizes and all fixed display/control-bank placement.

The new finish is in `app/tos-keycaps.css`, loaded last by both renderers. It covers all physical key surfaces, including the new display rail, with deeper blue, restrained amber/ruby, and clear ivory. Captain’s-chair rockers retain painted faces and tilt. Color-safe state outlines, focus, disabled indications, handlers, and other families remain. All 42 visible desktop key bounds matched the previous build exactly at 1280×720. See [31.5.12 notes](VERSION-31.5.12-TOS-PROP-KEYCAPS.md). Version 30 stays Stable; 31.6 remains reserved.


### Operator review after the 31.5.12 local material pass - audit takes priority

The operator said the darker resin finish was much closer, then requested spherical caps and square sidebar caps. A local shape experiment (`app/tos-key-shapes.css`) uses 28 px square sidebar caps, 22 px selector caps, and 26 px action domes with legends beside them. The operator's first impression is that these are much too small and the round buttons feel out of place. They explicitly clarified that those comments were observations and instructed us to stay focused on the requested comparative audit after that change. Do not interpret this as permission to keep chasing visual changes before presenting the audit.

The comparative audit is complete in the surrounding project workspace, `tos-comparative-audit/README.md`, with local current/reference evidence. Main findings: caps lost too much visual scale; domes are isolated prefixes across gray bands rather than seated elements in dense black mounting-plate assemblies; the resin material is improved, but the housing/plate/cap hierarchy is incomplete; some legacy flat blue button backgrounds survive behind domes. Status instruments and the black glass/beveled gray housing are stronger matches than general Settings/Search pages. Recommended order: larger dominant squares, local inset control plates, selectively integrated domes, consistent cap/state treatment, then information-page polish. Preserve the operator's prior palette, no-blue-border, solid-sidebar-body, and fixed-display requirements.

31.5.12 remains an unpublished local candidate. The latest public Development release is still 31.5.11. The first material-only pass had unchanged 42-key bounds; that measurement does not establish acceptance or completion of the later shape experiment. No further restyle was made during the comparative audit.


### Applying the comparative audit — 31.5.12

The operator now explicitly says to go ahead and make the changes. This supersedes the prior audit-only pause and authorizes the recommended order: restore key scale, add local black plates, and integrate domes selectively. The final candidate replaces the tiny experiment with 40-pixel action caps (36 compact), 48/40-pixel sidebar squares, and 34/30-pixel selectors. Square caps dominate; only chosen actions use seated domes. Plates group selectors and actions inside the existing connected gray chassis. Keep the sidebar body gray, information glass black, green restrained, no blue screen surround, and horizontal painted rockers. Sparse banks share their available width; decks below 900 pixels use three-control pages. The command deck begins stowed below 700 pixels high. Telemetry has its own engineering bank. Search/Calendar headings and date controls receive compact TOS treatment. The full bridge recording was already approved and published; this update introduces no audio asset.

Validation passed both renderer builds, 224 JavaScript and 69 Python tests, plus syntax and whitespace checks. Seven prior TypeScript diagnostics remain. Browser checks covered all eleven sections, 55 banks, 70 key pages, and 33 information sheets in the audited bank states at 1280×720; sheet counts adapt to bank height. No overflowing hardware captions or clipped graphics were found. Portrait 390×844, short landscape 800×420, sparse bank expansion, Search, Calendar, horizontal rockers, high contrast, and Enterprise-D/TOS restoration were checked. The older 42-key unchanged-bounds measurement describes only the superseded material-only experiment, not this final larger-cap implementation. See the 31.5.12 notes for scope limits. Version 30 remains Stable; 31.6 stays reserved.
