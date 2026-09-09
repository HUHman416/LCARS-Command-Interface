# Version 30.10 Authoritative Session Audit

This audit was completed before implementation so Version 30.10 extends the existing LCARS environment instead of creating parallel systems.

## Already implemented and retained

| Capability | Existing implementation | Version 30.10 decision |
| --- | --- | --- |
| Selectable Linux session | Explicitly installed Wayland and X11 display-manager entries | Retain unchanged |
| Base desktop and compositor | Plasma, GNOME, Cinnamon, XFCE, or LXQt starts beneath LCARS | Retain as the compatibility and recovery layer |
| Application launching | Allowlisted desktop applications launch through the Local Core | Reuse |
| Window tasking | Task Rail enumerates, focuses, minimizes, closes, and moves supported windows between displays | Extend with deck routing |
| Virtual desktops | Existing virtual desktops are exposed as numbered LCARS decks | Reuse |
| Saved arrangements | Workstations capture LCARS layout, applications, displays, audio, widgets, and Page Peeks | Reuse |
| Multi-monitor stations | Display detection, LCARS movement, and detached terminal stations already exist | Reuse |
| Lock and power | LCARS lock, logout, suspend, restart, shutdown, and exit controls already exist | Reuse |
| Recovery | Bounded crash restart, safe mode, last-known-good settings, and a normal-desktop fallback already exist | Correct exit/crash semantics |
| Session registration safety | Login entries require explicit PolicyKit authorization and are removable | Retain unchanged |

## Confirmed gaps addressed in 30.10

1. The former dedicated-terminal option stopped Plasma panels, but it was not presented or managed as an authoritative session contract.
2. The documented Meta+Shift+Escape route was not registered by the desktop process.
3. Dedicated mode exited the recovery loop after any LCARS termination, so an unexpected failure did not receive the normal bounded restart behavior.
4. A deliberate normal exit was not distinguished from a failure in ordinary session mode.
5. Placement rules ran only after LCARS-launched applications or a manual request; they did not cover later windows continuously.
6. The Task Rail could move windows between monitors but not directly between numbered decks.

Version 30.10 addresses all six gaps while preserving an explicit opt-in default.

## Intentionally not claimed as complete

These are genuine future integration areas, not missing copies of existing LCARS features:

- A FreeDesktop notification service that captures notifications from every host application.
- LCARS-native PolicyKit, Secret Service/keyring, file-picker, screen-sharing, microphone, and removable-device portals.
- Complete in-LCARS network, Bluetooth, VPN, printer, locale, accessibility, default-application, and operating-system package management.
- Full file-manager operations such as trash, rename, properties, permissions, archives, network shares, and configurable Open With.
- Calendar events, alarms, clipboard history, screenshot/recording workflows, and unified transfer queues.

Those systems should be implemented as later Version 30 milestones by replacing the remaining visible host interactions one category at a time. They should reuse the existing File Explorer, System, Network, Updates, Calendar, Data Fabric, Operations Center, and authorization infrastructure.

## Safety boundary

Authoritative mode does not replace the Linux kernel, drivers, compositor, audio server, networking services, or application toolkit. It owns the visible command environment while those services continue underneath. If LCARS exits deliberately, receives the emergency shortcut, or exhausts its crash-recovery budget, the preserved normal desktop is restored rather than leaving the operator stranded.
