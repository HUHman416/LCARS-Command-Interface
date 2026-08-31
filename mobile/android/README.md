# LCARS Mobile Command Environment for Android

This installable Android application contains the native, touch-first PADD Companion and the optional Version 29 standalone LCARS Home environment. The companion talks directly to the guarded PADD JSON API on private IPv4 networks and port `8766`; it does not contain the privileged LCARS desktop bridge.

First launch is a guided setup: open **Settings → Connected** on the desktop, arm a one-use code, then scan the local network or enter the displayed private station address and code. The app stores the station and revocable PADD token locally and reconnects automatically. Viewer, Operator, granular per-device permissions, and Command approvals are enforced by the desktop.

Version 28 includes phone, tablet, and landscape layouts; Communications; quick actions; current-console handoff; Connected Workstations; live battery/network/latency heartbeat; policy-aware notifications; haptic identify; accessibility synchronization; customizable panels; text-only approval requests; release status; and a home-screen status widget.

Version 28 also keeps the connection badge and tab layout stable while switching views, fits long status labels to their cards, lets the operator select a media source, adds a one-tap **Dismiss All** control to Communications, warns about client/station version mismatches, and provides a guided recovery panel.

## Version 29.1 Development

Version 29.1 adds the first optional standalone Android Home surface. It can be opened as an ordinary preview before Android is asked to make it the current Home application. It provides:

- A profile-aware application library through Android's launcher service.
- Search, favorites, local battery/network/storage status, and direct application launching.
- Explicit controls to open the PADD Companion, request the Android Home role, or reopen system Home settings.
- Independent operation when no desktop is paired or reachable.
- A separate Development package identity so Version 28 Stable can remain installed.

## Version 29.2 Development

Version 29.2 expands the Home foundation into a customizable LCARS mobile environment:

- A desktop-style masthead, numbered left sidebar, and focused Status, Apps, Favorites, Decks, Folders, Widgets, Displays, Settings, and Companion pages.
- User-created launch decks and application folders that remain independent of Favorites.
- Native Android widget selection, configuration, hosting, and removal through `AppWidgetHost`.
- Six mobile Display Matrix families with different palette, corner geometry, borders, navigation, and density—not palette swaps alone.
- Standard or compact sidebar and density modes plus automatic or fixed application-grid columns.
- JSON backup and restore for portable Home settings, with device-bound widget IDs intentionally excluded.
- Fixed-size, auto-fitting masthead text in both native Android surfaces so navigation and accessibility scaling cannot push titles outside their panels.

These Version 29.2 capabilities remain included in Version 29 Stable.

## Version 29 Stable

Version 29 completes the planned Mobile Command Environment:

- Embeds Companion as a first-class Home page and adds a Connected Station Dock with up to eight saved stations.
- Migrates legacy pairing data and encrypts revocable credentials using Android Keystore AES-GCM.
- Adds priority station notifications, charging-aware battery heartbeats, revocation recovery, and battery boundary tests.
- Keeps long and compact headers inside their panels, retains Home across unlock, discovers apps in the background, and uses a direct current-profile launch path.
- Opens an LCARS calendar from the clock and places up to twenty independent Favorites above application folders.
- Adds a Mobile Update Console that downloads the newest published APK, verifies it against `SHA256SUMS.txt`, and hands it to Android's installer with one tap. Android still requires the operator's installation confirmation.

The Version 29 Stable workflow builds Linux and Windows packages plus a persistently signed Android release APK, runs regression and battery checks, verifies the APK signature, publishes combined checksums, and marks Version 29 as the latest Stable GitHub release. Version 28 and Version 29 development packages used disposable or separate development identities, so Android may require their one-time removal before the Stable package can be installed; Version 29 then establishes the signing identity used by future in-place mobile updates.

## Version 30.2 Development

Version 30.2 adds the native Federation transport while retaining the complete Version 29 Home environment:

- Discovers explicitly enabled LCARS stations over the trusted local network.
- Stores the station identity and readable fingerprint beside the existing Keystore-protected credential.
- Signs requests and encrypts native request and response bodies with AES-256-GCM after pairing, including timestamp and replay protection.
- Receives page handoff, priority notices, clipboard text, and opt-in files up to 512 KiB, and acknowledges queued deliveries after handling them.
- Preserves multi-station switching and migrates existing Version 29 pairings to the secure Federation protocol on their first successful refresh.

## Version 30.4 Development

Version 30.4 retains the signed Version 29 Android identity and the complete Federation Home environment. The Module Platform itself runs on the trusted desktop host: Android receives only the host-rendered station surfaces and never downloads or executes module code. This preserves the same explicit station permissions, encrypted transport, one-tap mobile update path, and safe offline Home behavior while desktop modules remain isolated inside LCARSCI.

Build locally with Android SDK 35, Java 17, and Gradle 8.9:

```bash
gradle -p mobile/android :app:assembleRelease
```
