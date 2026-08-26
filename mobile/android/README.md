# LCARS PADD Companion for Android

This installable Android companion connects only to the Version 27 PADD service on private IPv4 networks and port `8766`. It does not contain the privileged LCARS desktop bridge.

The Version 27.1 GitHub workflow publishes a debug-signed APK for direct Development-channel testing. Android may ask for permission to install an app downloaded outside Google Play. Future store or Stable distribution requires a persistent release-signing identity.

Build locally with Android SDK 35, Java 17, and Gradle 8.9:

```bash
gradle -p mobile/android :app:assembleDebug
```
