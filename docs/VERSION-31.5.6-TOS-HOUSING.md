# Version 31.5.6 Development — TOS Console Housing

The header, sidebar, and display surround now form one connected physical console housing. Angular gray bevels, blue inner screen trim, and small edge accents follow the supplied character-sheet border. Actual screen content is one continuous black display, without internal cyan instrument outlines or overview panel boxes. Blue trim is confined to the outer bezel. The sidebar is one solid console-color piece, with keys and legends placed directly on the housing rather than black mounting panels. The preferred compact labels, paired instruments, amber allocation display, and restrained ivory/blue/amber/coral palette remain.

A TOS-only display wrapper separates the stationary bezel from scrolling content. Other display families retain their existing DOM. Tasks, Tray, and Power remain pinned; Speed Dial keys occupy a console footer rather than covering screen content. Compact navigation follows the same lower housing.

Existing LCARS on/off settings use ivory rocker switches informed by the supplied captain’s-chair photograph. The face changes tilt, with explicit ON/OFF legends. Native checkbox semantics, labels, keyboard activation, focus, and setting persistence remain. Reduced Motion disables the transition; High Contrast strengthens the frame and switch outlines. Checklist/selection controls retain their existing semantics.

Reference material is not bundled or treated as instructions. All three supplied fonts, four console recordings, actual telemetry, detached views, and existing desktop functions remain. Version 31.6 is still reserved for Security, Recovery, and Accessibility; Version 30 remains Stable.

Validation: 201 JavaScript tests and 69 Python tests pass. Hosted and desktop builds pass. Browser checks cover the black overview and Settings panels, keyboard-operated rocker states, High Contrast, the unchanged DOM in another display family, portrait navigation, and short landscape navigation. Native packages are gated by the standard Development workflow. The repository’s eight pre-existing TypeScript diagnostics remain outside this visual change.
