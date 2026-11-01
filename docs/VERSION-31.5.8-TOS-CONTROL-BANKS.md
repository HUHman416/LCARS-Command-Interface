# Version 31.5.8 Development — Fixed TOS Control Banks

The operator rejected scrolling the physical console to reach buttons and the detached-looking Search/Data Fabric controls. Additional bridge, helm, and resin-key references reinforce the separation between information glass and controls mounted within a physical frame. The earlier restrictions on green dominance, blue screen trim, uniform keys, and horizontal rockers remain.

## Changes

- The TOS housing now presents a fixed bank selector, one labeled control bank, and explicit previous/next key-bank controls when necessary. Hardware decks do not scroll. The existing information screen can still scroll.
- A selector jumps directly to any logical bank; adjacent-bank keys provide keyboard-accessible navigation. Standard keys retain a common size. Small single-action groups retain their longer, thinner keys.
- Whole labels and fields are packed into bounded pages. Forms retain their original DOM ownership and submission handlers. Inactive controls remain mounted to preserve entered values and native state; hidden banks and keys are excluded from keyboard and accessibility navigation.
- Portrait widths use three control columns; wider windows use six. Calendar keys retain their seven-column matrix, with shorter caps to fit the physical bank. On shorter desktop windows, sidebar spacing keeps all eleven section keys visible; very short windows use the existing compact command bar. Wide 1200×550 and 1200×420 layouts were also checked.
- Search/Data Fabric has a continuous gray header, frame, and control deck. Close remains available on its bank selector. The query and category selector are mounted on the deck, with query autofocus retained.
- TOS Search displays up to eight passive records at a time. Previous/Next Record hardware keys select a record, and one action bank follows that selection. Each operation retains its existing handler, availability, and approval requirements. Other display families retain their existing complete result list and actions.
- Fonts, startup fade, key/update/error sounds, horizontal rockers, and existing functionality remain. Reference images are visual evidence only and are not bundled.

## Validation

Browser checks cover 71 desktop control-bank pages across all eleven main sections, 23 portrait Settings pages, and eight short-landscape Settings pages, with no deck scrolling or clipped controls. Additional checks cover Search filtering, selection, preserved query text, its attached housing, sidebar visibility, and switching display families. Automated checks exercise bounded control packing and TOS versus ordinary Search rendering, alongside the existing regression suite. Both renderer builds passed, as did 209 JavaScript tests, 69 Python tests, desktop syntax checks, Python compilation, shell syntax, and whitespace checks. TypeScript still reports the seven existing image/activity/Cloudflare declaration diagnostics; this change adds no new diagnostics.

This change applies to LCARS-owned controls; external application and operating-system windows remain under their own control. Version 30 remains Stable and 31.6 remains reserved.
