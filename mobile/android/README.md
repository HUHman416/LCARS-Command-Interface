# Standalone LCARS PADD Companion for Android

This installable Android companion contains its own native, touch-first LCARS interface. It talks directly to the guarded Version 28 PADD JSON API on private IPv4 networks and port `8766`; it does not wrap or download the browser companion interface from the desktop and does not contain the privileged LCARS desktop bridge.

First launch is a guided setup: open **Settings → Connected** on the desktop, arm a one-use code, then enter the displayed private station address and code. The app stores the station and revocable PADD token locally and reconnects automatically. Viewer, Operator, granular per-device permissions, and Command approvals are enforced by the desktop.

Version 28.1 adds phone, tablet, and landscape layouts; Communications; quick actions; current-console handoff; Connected Workstations; live battery/network/latency heartbeat; priority notifications; haptic identify; accessibility synchronization; customizable panels; text-only approval requests; release status; and a home-screen status widget.

The Version 28.1 GitHub workflow publishes a debug-signed APK for direct Development-channel testing after desktop, Android, and regression validation succeeds. Android may ask for notification permission and permission to install an app downloaded outside Google Play. Future store or Stable distribution requires a persistent release-signing identity.

Build locally with Android SDK 35, Java 17, and Gradle 8.9:

```bash
gradle -p mobile/android :app:assembleDebug
```
