# Version 30.12 Unified Systems Audit

Version 30.12 consolidates the desktop Systems experience after auditing the pre-existing Systems page, Expanded Hardware Matrix, Engineering Console, Storage Matrix, hardware-detail dialogs, and Version 30.11 System Control Matrix.

## What was duplicated

- The old Systems action row and Engineering Console both opened process control that already exists in the Version 30.11 matrix.
- The old Storage Matrix duplicated the matrix's removable-drive inventory and mount controls.
- CPU, memory, GPU, and disk summary meters appeared separately from their detailed hardware views.
- The System Control Matrix opened as an overlay even though Systems already had a dedicated sidebar page.

These duplicate surfaces have been removed from the Systems page.

## What was unique and retained

The former Expanded Hardware Matrix and detail dialogs contained information that Version 30.11 did not expose. Version 30.12 retains it in the new Telemetry station:

- Overall CPU, GPU, memory, and disk utilization
- Logical CPU count, load averages, and individual core utilization
- Total, used, available, and swap memory
- Physical memory-bank capacity, speed, manufacturer, and part information when the platform reports it
- GPU name, vendor, driver, utilization, video-memory totals, temperature, and display mode
- Engineering thermal, power, battery, service, and hardware sensor channels
- Detected storage topology and mount state

## Resulting Systems architecture

Selecting **Systems** now renders one responsive LCARS Systems Command page. Its first station is **Telemetry**, followed by Network, Wi-Fi, Bluetooth, Audio, Displays, Software, Processes, Storage, Modules, and Media. All Version 30.11 system-control entry points navigate to the appropriate station on this page rather than opening a separate LCARS overlay or host utility.

The Telemetry station deliberately keeps monitoring separate from destructive controls. Process termination remains guarded by a two-step confirmation, removable-drive actions remain allowlisted, and platform authorization prompts remain visible when the operating system requires them.

## Explicit exceptions

The Android default-Home selector and package installer, operating-system authorization prompts, third-party applications, and the emergency recovery desktop remain external by design. They are security, application, or recovery boundaries rather than routine system-control windows.

## Verification contract

The Version 30.12 regression checks require the embedded Systems matrix, the complete Telemetry inventory, removal of the old diagnostic overlays, preservation of all Version 30.11 native-control routes, responsive LCARS geometry, aligned Linux/Windows/Android version identities, and complete development-release assets.
