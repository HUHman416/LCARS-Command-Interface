# Version 31.4 Development — Connectivity and Hardware

Version 31.4 upgrades the existing System Control Matrix instead of adding duplicate applications. The former Network area becomes a compact Connectivity and Hardware station while the established Wi-Fi, Bluetooth, Storage, and Portal surfaces remain in place.

## Connection command

- Inventories real VPN and WireGuard profiles, saved wireless profiles, NetworkManager hotspot state, and the active firewall provider.
- Connects or disconnects stored VPN profiles, starts or stops supported Linux hotspots, forgets saved networks, and changes supported metered policy only after an exact Portal approval.
- Treats every approval as single-use and confirms that its subsystem, operation, target, and non-secret policy parameters still match before executing.
- Never stores a hotspot password. The operator must enter it again if the view is left while a request awaits approval.
- Reports Windows Mobile Hotspot and metered controls as unavailable when Windows offers no stable local command adapter; it does not send the operator to a host Settings window.

## Hardware matrix

- Uses CUPS, SANE, video/input device nodes, USB inventory, and removable-volume data on Linux when those adapters exist.
- Uses Windows printer and Plug-and-Play inventory for available printers, scanners, cameras, controller-class devices, and USB hardware.
- Routes camera, screen-sharing, printing, scanner, controller, and USB access requests through Portal Center for explicit review.
- Adds an Ask, Allow, or Block removable-device policy for LCARS mount controls. The interface states clearly that this is not an operating-system-wide device-security policy.

## Diagnostics and truthful capability reporting

- Runs route, DNS, and reachability diagnostics only when the operator requests them.
- Displays the real adapter status and keeps missing capabilities visible instead of substituting simulated success.
- Passes commands as fixed argument arrays, resolves mutable targets from a fresh inventory, and rejects arbitrary identifiers.

## Software Logistics correction

The Software Logistics command rail is now explicitly isolated from older generic Systems navigation styles. Its numbered mode buttons have fixed internal geometry, the inventory command remains separate, and the package-manager selector shows a clear unavailable state when Local Core or a supported manager is absent.
