# Version 31.5 Development — Daily Utilities

Version 31.5 closes the everyday utility gap without creating alternate copies of systems LCARSCI already has.

## Utility Command

- Adds a continuously numbered `10 UTILITIES` destination; Commissioning, Tasks, and Power continue from 11 through 13.
- Keeps its four working areas horizontal and compact: Overview, Clipboard, Capture, and Printing.
- Links to the existing LCARS Calendar, Communications/Operations Center, Universal Search/Data Fabric, Files, and Settings.

## Clipboard privacy

- Reads and writes through detected Windows, Wayland, or X11 adapters and reports unsupported hosts truthfully.
- History storage is opt-in, local, bounded from 5–50 entries, de-duplicated, individually removable, pinnable, and clearable.
- Read Once works without enabling history. Private Mode immediately clears stored entries and prevents new persistence.
- Clipboard contents are excluded from diagnostic and activity exports and never synchronize automatically.

## Capture

- Screenshots and WebM screen recordings request display access through the existing Electron/Portal route.
- Captures save directly under `Pictures/LCARS Captures` or `Videos/LCARS Captures`; no host file manager is required.
- Recording has an automatic five-minute ceiling, ends when display sharing stops, and has a 64 MiB storage limit.
- The Local Core validates the declared media type and file signature before writing.

## Notifications and printing

- Local applications can continue submitting `notification` intents to Portal Center. Approved requests are delivered once into the existing Communications history and chronological Operations timeline.
- The utility page shows actual printer and print-job inventory when Windows Print Management or CUPS is available.
- Cancelling a queued job requires an exact job match and a single-use `print` approval. Unsupported adapters remain visibly disabled.

## Voice Control repair

- Electron now accepts a microphone permission request from the active trusted `lcars://` web contents when Chromium leaves `requestingUrl` blank.
- Requests from non-LCARS pages remain denied, and the Portal decision is still required.
- A startup guard prevents concurrent `getUserMedia` calls from one unmute and replaces raw `Permission denied` notices with a useful recovery message.

## Compatibility note

Platform-mandated screen or microphone consent may still appear. LCARSCI does not claim to bypass operating-system security policy. Version 30 remains the Stable channel while Version 31.5 is in development.
