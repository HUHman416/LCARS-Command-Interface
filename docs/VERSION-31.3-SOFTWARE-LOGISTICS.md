# Version 31.3 Development — Software Logistics

Version 31.3 upgrades the existing System Control Matrix software area. It removes the old “prepare update in Terminal” handoff and keeps Version 30 Stable untouched while this milestone is tested on `31-development`.

## Graphical package workflow

- Detects the package capabilities actually present on the station: DNF, APT, Pacman, Zypper, APK, XBPS, Flatpak, or WinGet.
- Searches real manager catalogs and displays manager-supplied package details, installed state, versions, license, source, homepage, and download size when reported.
- Supports reviewed install, remove, and individual update operations without constructing a shell command.
- Uses argument arrays rather than a shell, validates every package and source identifier, and never accepts arbitrary command text.
- Routes Linux system-manager authorization through PolicyKit. User Flatpak operations stay unprivileged; WinGet uses its own installer authority.

## Review and observability

- Generates a short-lived, single-use plan before any package transaction.
- Displays the manager's dry-run output when one is safely available, along with storage impact, signature policy, restart assessment, authorization class, and cancellation capability.
- Tracks one active transaction at a time with progress, bounded output, completion state, and a persistent 100-entry history.
- Offers cancellation only where the adapter can do so safely. It does not label a package transaction reversible when the manager cannot provide a guaranteed rollback.
- Gives explicit rollback guidance based on package-manager history or distribution snapshot tooling instead of pretending a universal rollback exists.

## Source controls

- Shows configured sources for all detected managers.
- Treats native distribution sources as read-only because changing them safely is distribution-specific.
- Allows confirmed user-level Flatpak remote changes and custom WinGet source changes.
- Requires HTTPS for new sources and protects built-in WinGet sources.

## Files 2.0 density correction

File and folder results now use compact fixed-height rows with bounded icons and text. The view, route, and command controls stay on horizontal rails, including reduced-height and handheld layouts, preventing legacy tile styles from stretching entries to fill the page.

## Truthful limits

The interface reports missing managers, unsupported previews, unknown sizes, unavailable cancellation, and possible restart requirements as such. Hosted preview mode cannot manage the host system and displays the Local Core requirement. Version 31.3 does not claim universal package formats, automatic downgrade support, or mutable native repositories where the platform adapter cannot guarantee them.
