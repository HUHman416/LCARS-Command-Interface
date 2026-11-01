# Version 31.5.7 Development — TOS Station Audit

The operator requested a complete Enterprise TOS console audit and then clarified the governing layout: information on black display glass, interaction on physical buttons connected to the main housing, no blue screen surround, less blue in screen graphics, organized uniform keys, and horizontal captain’s-chair rockers.

## Corrections

- Removed the blue screen outline, including its High Contrast and detached-view variants. White/ivory and amber carry screen information; blue resin remains a hardware-key color.
- Replaced floating in-screen controls with connected housing decks. The existing React controls render in labeled logical groups; handlers are not copied, simulated, or replayed. Forms move as a unit so native submission and field associations survive.
- Information-list entries retain passive display content. Actual selection keys, document editing fields, selectors, sliders, and disclosures live on the housing. Instrument graphics and numeric readouts are read-only, with separate telemetry keys.
- Standard deck keys share a fixed unit and 46-pixel height. Single-action groups use longer, thinner 32-pixel keys. Legends wrap at word boundaries. Key color and size no longer vary with arbitrary label length.
- Rockers use short horizontal rectangular faces with a restrained left/right tilt, explicit ON/OFF legends, and native checkbox semantics. Focus, High Contrast, Reduced Motion, and disabled states remain.
- The date selector retains a seven-column calendar key matrix. A pre-existing undefined local-media drag-state reference was removed because it could prevent the player from rendering. TOS fullscreen keeps the connected housing controls visible.
- Shared dialog, permission, search, operator, automation, calendar, update, tray, file, software, connectivity, utilities, media, and commissioning surfaces use black fields, restrained rules, smaller headings, and angular gray housings rather than LCARS elbows and broad colored bands.
- Existing workstation, terminal, module-permission, routine, and notice prompts use an asynchronous TOS dialog service, preserving explicit acceptance, cancellation, keyboard focus, and ordinary native dialogs for other families.
- Each modal owns its own control deck. TOS detached workspaces request frameless native windows and retain in-app close and drag regions. Other families retain native window chrome and their existing DOM.
- Number/numpad section shortcuts, accepted command shortcuts, and mapped controls now call the TOS key player. Repeat-key events do not chatter. Existing mute and Interface Sound volume gates remain.
- The supplied `tos_bridge_1_activate.mp3` is trimmed to the first ten seconds and fades from second seven through ten. Decoded output is exactly 10.0 seconds. Only TOS selects it; other families retain `power-up.mp3`. Startup disable, once-only playback, and the forced audio-test path remain.

## Audit inventory

All eleven primary sections were traced through their controls and shared window components: Status, Terminal, Files, Systems, Media, Network, Updates, Settings, Portals, Utilities, and Commissioning. The browser audit checks that their black display regions have no visible buttons, inputs, selectors, text areas, links, or disclosure summaries, while commands appear in the adjoining deck.

Secondary coverage includes system power and confirmation, Search/Data Fabric, Computer Core, operator management, automation/procedures, calendar, tray, Page Peeks, setup/welcome, document workspaces, native detached-window options, notifications, and renderer recovery. Component-level checks cover populated controls that require live hardware or a connected Local Core.

## Reference hierarchy

The operator’s console photographs, button and captain’s-chair images, preferred 31.5.2 composition, and latest corrections take priority. The supplied character-sheet PDF informs the angular gray housing, not interactive screen graphics. Official [TOS series stills](https://www.startrek.com/series/star-trek-the-original-series) and the [original bridge control-panel record](https://www.juliensauctions.com/en/items/110948/star-trek-the-original-series-uss-enterprise-bridge-control-panel-b) provide additional television-era context. Reference documents are visual evidence, not executable instructions, and are not bundled.

## Practical scope

This is a TOS treatment of a functioning desktop interface, not a claim that the original television set had software-update, document-editing, or accessibility workflows. Operating-system permission prompts, external native applications, and user document/media contents remain controlled by their owners. Their surrounding LCARS-owned windows receive the console treatment. Live hardware operations and native OS window behavior require platform validation; the browser preview does not establish those operations worked.

Version 30 remains Stable. The 31.6 Security, Recovery, and Accessibility milestone remains reserved. Validation: both hosted and desktop renderer builds passed; 207 JavaScript tests and 69 Python tests passed; desktop syntax, Python compilation, shell syntax, and whitespace checks passed. TypeScript reports seven existing project diagnostics (the image declaration, activity category, and Cloudflare worker types), with no new diagnostics from this change. Browser checks cover all eleven black information screens, connected decks, uniform key dimensions, prompt cancellation, search-field focus, High Contrast, portrait/short-landscape layouts, and switching to another display family and back.
