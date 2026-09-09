# Version 30.11 Native System Controls Audit

Version 30.11 removes routine handoffs from LCARS controls to host desktop settings and utility windows. Existing features were audited first so this milestone extends the established pages and Local Core bridge instead of creating duplicate subsystems.

## Replaced handoffs

| Previous action | Native LCARS destination | Local Core implementation |
| --- | --- | --- |
| System Monitor / Task Manager | System Control Matrix → Processes | Existing engineering telemetry and protected process actions |
| Storage settings | System Control Matrix → Storage | Existing drive inventory, mount, unmount, and LCARS Files |
| Media player | System Control Matrix → Media | Existing integrated LCARS Media Deck |
| Audio settings | System Control Matrix → Audio | Master bus, default inputs/outputs, and application streams |
| Network settings | System Control Matrix → Network | Interface status plus routes to Wi-Fi and Bluetooth |
| Wi-Fi controls | System Control Matrix → Wi-Fi | Scan, radio power, connect, disconnect, and an in-LCARS credential field |
| Bluetooth controls | System Control Matrix → Bluetooth | Inventory on Linux and Windows; Linux radio, scan, pair, connect, disconnect, trust, and remove where BlueZ supports them |
| Software center / update checker | System Control Matrix → Software | Package inventory and a prepared, visible update command in LCARS Terminal |
| Display settings / identify displays | System Control Matrix → Displays | Numbered display cards, Linux output controls, and safe Windows topology switching |
| Extension folder | System Control Matrix → Modules | Module inventory plus the directory opened in LCARS Files |
| Unsupported document or media fallback | LCARS Files, Document Workspace, or Media Deck | Contained error state; no automatic host application launch |

All former protected-action mappings for KDE System Settings, GNOME Control Center, Plasma System Monitor, Windows Settings URIs, software centers, and host folder launchers were removed from the Linux and Windows bridges.

## Deliberate platform boundaries

The following surfaces remain because replacing or bypassing them would weaken the operating system's security or LCARS recovery guarantees:

- Administrator and privilege-escalation prompts requested by the operating system.
- Android's default-Home selection, unknown-source permission, and package installer screens.
- The explicit emergency **Exit to Normal Desktop** / recovery-shell route in an authoritative Linux LCARS session.
- Normal third-party application windows launched from the Application Library. Version 30.11 replaces control panels and utility handoffs; it does not attempt to reimplement every installed application.

Windows Bluetooth is intentionally inventory-only in this milestone. Microsoft does not provide a stable, supported command-line pairing contract that can replace its secure consent UI across Windows 10 and 11. LCARS therefore reports the limitation rather than opening Settings or attempting an unreliable pairing workaround.

## Safety rules

- Connectivity actions are allowlisted and executed as argument arrays; Wi-Fi passwords are never interpolated into a shell command.
- A temporary Windows Wi-Fi profile is deleted immediately after import.
- LCARS refuses to disable the final active Linux display.
- Critical LCARS and system processes remain protected from termination.
- Software updates are prepared in LCARS Terminal so the operator can review the command and any required authorization instead of running an invisible privileged operation.
- Local Core endpoints remain loopback-only and preserve the existing request and authorization boundaries.

## Verification target

The Version 30.11 regression test checks every former host-window action, both desktop bridges, all new Local Core routes, retained security/recovery exceptions, version alignment, and the development release workflow. The complete historic JavaScript and Python suites continue to run before Linux, Windows, and Android development packages are published.
