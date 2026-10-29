# Version 31.5.1 Development — TOS Console

Select **Enterprise · The Original Series** in Settings → Display Matrix. The `tos` family uses original CSS console geometry: uniformly black console surfaces with a restrained red structural rail, black instrument wells, rectangular illuminated switch banks, amber readouts, segmented meters, speaker-grille texture, and asynchronous indicator lights. The decorative lights are explicitly hidden from assistive technology and never imply live telemetry.

The three operator-supplied Roddenberry TTF files are bundled locally in `public/assets/fonts/`. Regular and bold label the fascia and headings; bold italic labels the instrument bank. Body text, editable documents, and terminal output use readable system fonts. There is no network font dependency.

The two operator-supplied key recordings are bundled in `public/assets/sounds/`. TOS console buttons, toggles, and selects use `tos_keypress1.mp3`; Close, Cancel, Back, Later, and Escape use `tos_cancel_keypress.mp3`. The existing sound toggle and Interface Sound volume apply. Playback is lazy, reuses the two clips, and stops the previous key sound before another starts. The original LCARS beeps remain for other themes.

`tos_datareceived_ep.mp3` announces the beginning of an explicit updater download/install/rollback and a manual check that finds an available release. It does not sound during quiet background checks or on every progress refresh. `tos_unabletocomply.mp3` replaces TOS error and failed-transfer cues, including updater failures. Event clips reuse a separate single playback channel so a failure interrupts updater audio; both channels stop when interface sound is disabled or the theme changes.

Both `app/layout.tsx` and `desktop/renderer.tsx` load `app/tos.css` last. Styling is scoped to `theme-tos`; existing six theme families remain available. Normalization and existing import/export, operator workspace, Workstation, routine, and Computer Core routes use the theme registry. Detached document and Page Peek surfaces carry the saved font scale, contrast, color-safe, reduced-motion, and alert settings.

Reduced Motion (app preference or operating system preference) stops decorative indicators. Alert banners remain labeled and distinct; red/yellow alerts suppress decorative lights. Active navigation has an explicit arrow/outline, and focus has a visible outline. Desktop station keys scroll independently above pinned Tasks, System Tray, and Power keys; the task list has its own bounded scroll region. Compact layouts retain the existing five-key PADD navigation with TOS colors and rectangular controls. Short-height layouts suppress the decorative strip.

The Overview load monitor is an original SVG instrument using actual current CPU/GPU/memory/disk percentages, a 0–100 scale, segmented green/yellow/red bars, and matching numeric blocks. Its cyan monitor surround reflects the additional bridge references. It does not invent a historical trace or ship traced artwork.

## Reference research

All eight supplied images were inspected as visual references only; no screenshots or traced artwork are shipped. Production/restoration authority:

- [Official helm/navigation restoration](https://www.startrek.com/news/restored-tos-navigation-helm-console-ready-for-spaceflight): preserved console shell, resin button panels, vintage switches, and separately wired reconstructed indicator modules.
- [Official Original Series Set Tour](https://www.startrek.com/news/visiting-the-original-series-set-tour): production-era set recreation, interactive switches, and illuminated bridge controls.

31.5.1 is a supplementary Development release. 31.6 Security, Recovery, and Accessibility and 31.7 whole-environment validation retain their assignments. Version 30 remains Stable. The normal development workflow gates publication on Linux, Windows, and signed Android jobs; the Android companion only receives the matching version identity.

## Validation record

- Complete JavaScript regression suite: 200 passing, including seven TOS regressions.
- Complete Python suite: 69 passing.
- Hosted renderer and Electron renderer builds: passing.
- Python compilation, desktop-process JavaScript syntax, shell syntax, and whitespace checks: passing.
- Browser checks: theme selection, local font rendering, current-load graphics, pinned Tasks/Tray/Power controls, opened task rail, detached Page Peek with saved accessibility flags, and high-contrast/color-safe/reduced-motion settings.
- Additional TypeScript check still reports the same eight errors as the unmodified `be1747d` baseline (image/Cloudflare type declarations, existing IDENTITY notice types, and an existing dragging reference); no new type error was introduced by this skin.
- Native Linux/Windows packaging and signed Android packaging run through the Development workflow before publication. Native hardware, operating-system dialogs, multi-monitor behavior, and upgrade/recovery still need the planned whole-environment test gate.
