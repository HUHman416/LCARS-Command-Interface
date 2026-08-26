# Standalone LCARS PADD Companion for Android

This installable Android companion contains its own native, touch-first LCARS interface. It talks directly to the guarded Version 27 PADD JSON API on private IPv4 networks and port `8766`; it no longer wraps or downloads the browser companion interface from the desktop. It does not contain the privileged LCARS desktop bridge.

First launch is a guided three-step setup: open **Settings → Connected** on the desktop, arm a one-use code, then enter the displayed private station address and code. The app stores the station and revocable PADD token locally and reconnects automatically. Viewer, Operator, and Command capabilities are still enforced by the desktop.

The Version 27.2.1 GitHub workflow publishes a debug-signed APK for direct Development-channel testing. Android may ask for permission to install an app downloaded outside Google Play. Future store or Stable distribution requires a persistent release-signing identity.

Build locally with Android SDK 35, Java 17, and Gradle 8.9:

```bash
gradle -p mobile/android :app:assembleDebug
```
