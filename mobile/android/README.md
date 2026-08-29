# LCARS Mobile Command Environment for Android

This installable Android application contains the native, touch-first PADD Companion and the optional Version 29 standalone LCARS Home environment. The companion talks directly to the guarded PADD JSON API on private IPv4 networks and port `8766`; it does not contain the privileged LCARS desktop bridge.

First launch is a guided setup: open **Settings → Connected** on the desktop, arm a one-use code, then enter the displayed private station address and code. The app stores the station and revocable PADD token locally and reconnects automatically. Viewer, Operator, granular per-device permissions, and Command approvals are enforced by the desktop.

Version 28 includes phone, tablet, and landscape layouts; Communications; quick actions; current-console handoff; Connected Workstations; live battery/network/latency heartbeat; policy-aware notifications; haptic identify; accessibility synchronization; customizable panels; text-only approval requests; release status; and a home-screen status widget.

Version 28 also keeps the connection badge and tab layout stable while switching views, fits long status labels to their cards, lets the operator select a media source, adds a one-tap **Dismiss All** control to Communications, warns about client/station version mismatches, and provides a guided recovery panel.

## Version 29.1 Development

Version 29.1 adds the first optional standalone Android Home surface. It can be opened as an ordinary preview before Android is asked to make it the current Home application. It provides:

- A profile-aware application library through Android's launcher service.
- Search, favorites, local battery/network/storage status, and direct application launching.
- Explicit controls to open the PADD Companion, request the Android Home role, or reopen system Home settings.
- Independent operation when no desktop is paired or reachable.
- A separate Development package identity so Version 28 Stable can remain installed.

Version 29.2 is planned for LCARS decks, folders, widgets, layouts, and mobile Display Matrix support. Version 29.3 is planned for Connected Station Dock, multi-station behavior, notification integration, security hardening, and release-candidate testing.

The Version 29.1 GitHub workflow publishes a separately installable, debug-signed Development APK after desktop, Android, and regression validation succeeds. Android may ask for notification permission, permission to install an app downloaded outside Google Play, and explicit confirmation before making LCARS the Home application. Stable Version 29 will require a persistent release-signing identity.

Build locally with Android SDK 35, Java 17, and Gradle 8.9:

```bash
gradle -p mobile/android :app:assembleDebug
```
