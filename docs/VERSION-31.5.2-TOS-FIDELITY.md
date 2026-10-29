# Version 31.5.2 Development — TOS Console Fidelity

Operator review of 31.5.1 called for the composition to follow the production consoles more closely. This follow-up retains the black console fields, all three Roddenberry fonts, all four supplied sound recordings, and all existing desktop functionality.

- Station navigation is a two-column bank of consistently shaped illuminated rectangular keys, with small printed labels beneath each key.
- The main instruments use paired cyan-surrounded monitors: current sampled utilization bars and an amber radial memory/storage instrument. The circular graphic uses actual memory and disk percentages; it does not present a fictional course, timeline, or sensor feed.
- Numeric data uses small groups of bright colored blocks. Application shortcuts use physical program-selector keys rather than individually boxed cards.
- Headings and structural divisions are restrained so the black console surface and instruments dominate.
- Tasks, System Tray, and Power remain reachable at the bottom while station keys scroll independently.

The additional references supplied during review informed the proportions and graphical vocabulary. All geometry is original CSS/SVG; no reference screenshots or traced graphics are bundled.

The implementation and audio behavior introduced in [31.5.1](VERSION-31.5.1-TOS-CONSOLE.md) remain. Version 31.6 Security, Recovery, and Accessibility is reserved; Version 30 remains Stable.

Validation: 201 JavaScript regressions and 69 Python tests, both renderer builds, normal syntax checks, and browser layout checks. The baseline TypeScript diagnostics documented in 31.5.1 remain unchanged. Native packaging is gated by the normal Development workflow.
