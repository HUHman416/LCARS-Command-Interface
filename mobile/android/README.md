# Standalone LCARS PADD Companion for Android

This installable Android companion contains its own native, touch-first LCARS interface. It talks directly to the guarded Version 28 PADD JSON API on private IPv4 networks and port `8766`; it does not wrap or download the browser companion interface from the desktop and does not contain the privileged LCARS desktop bridge.

First launch is a guided setup: open **Settings → Connected** on the desktop, arm a one-use code, then enter the displayed private station address and code. The app stores the station and revocable PADD token locally and reconnects automatically. Viewer, Operator, granular per-device permissions, and Command approvals are enforced by the desktop.

Version 28 includes phone, tablet, and landscape layouts; Communications; quick actions; current-console handoff; Connected Workstations; live battery/network/latency heartbeat; policy-aware notifications; haptic identify; accessibility synchronization; customizable panels; text-only approval requests; release status; and a home-screen status widget.

Version 28 also keeps the connection badge and tab layout stable while switching views, fits long status labels to their cards, lets the operator select a media source, adds a one-tap **Dismiss All** control to Communications, warns about client/station version mismatches, and provides a guided recovery panel.

## Version 29 direction

Version 29 is planned to add an optional standalone Android LCARS mode that can operate independently as a launcher/home-screen replacement while retaining the paired PADD Companion features. It is intentionally not part of Version 28.

The Version 28 GitHub workflow publishes a debug-signed APK after desktop, Android, and regression validation succeeds. Android may ask for notification permission and permission to install an app downloaded outside Google Play. A future store distribution will require a persistent release-signing identity.

Build locally with Android SDK 35, Java 17, and Gradle 8.9:

```bash
gradle -p mobile/android :app:assembleDebug
```
