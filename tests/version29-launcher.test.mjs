import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const packageJson=JSON.parse(read("../package.json"));
const page=read("../app/page.tsx");
const layout=read("../app/layout.tsx");
const renderer=read("../desktop/renderer.tsx");
const css=read("../app/v29.css");
const manifest=read("../mobile/android/app/src/main/AndroidManifest.xml");
const gradle=read("../mobile/android/app/build.gradle");
const gradleProperties=read("../mobile/android/gradle.properties");
const main=read("../mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java");
const home=read("../mobile/android/app/src/main/java/com/lcars/padd/HomeActivity.java");
const companion=read("../mobile/android/app/src/main/java/com/lcars/padd/CompanionDock.java");
const credentials=read("../mobile/android/app/src/main/java/com/lcars/padd/SecureStationStore.java");
const updater=read("../mobile/android/app/src/main/java/com/lcars/padd/MobileUpdateManager.java");
const battery=read("../mobile/android/app/src/main/java/com/lcars/padd/BatteryStatus.java");
const workflow=read("../.github/workflows/v29-development.yml");
const stableWorkflow=read("../.github/workflows/v29-stable.yml");

test("current development identity advances without changing the Android package",()=>{
  assert.equal(packageJson.version,"30.8.1-dev.1");
  assert.match(page,/LCARS_VERSION="30\.8\.1"/);
  assert.match(page,/30\.8\.1 DEV/);
  assert.match(gradle,/versionCode 308002/);
  assert.match(gradle,/versionName "30\.8\.1"/);
  assert.match(gradle,/applicationIdSuffix "\.dev"/);
  assert.match(gradle,/versionNameSuffix "-development"/);
  assert.match(gradle,/signingConfig signingConfigs\.release/);
});

test("Android keeps the genuine Home role and routes Companion into the unified shell",()=>{
  assert.match(manifest,/android:name="\.MainActivity"[\s\S]*android\.intent\.category\.LAUNCHER/);
  assert.match(manifest,/android:name="\.HomeActivity"[\s\S]*android\.intent\.category\.DEFAULT[\s\S]*android\.intent\.category\.HOME/);
  assert.match(manifest,/android:alwaysRetainTaskState="true"/);
  assert.match(manifest,/android:stateNotNeeded="false"/);
  assert.match(home,/RoleManager\.ROLE_HOME/);
  assert.match(home,/new CompanionDock\(this,stationStore\)/);
  assert.match(main,/putExtra\("open-page", "companion"\)/);
  assert.doesNotMatch(main,/setContentView|HttpURLConnection|WebView/);
});

test("Home fixes compact titles, unlock latency, and application launch latency",()=>{
  assert.match(home,/containedLabel\("ANDROID COMMAND INTERFACE"[\s\S]*,2\)/);
  assert.match(home,/setMaxLines\(lines\)/);
  assert.match(home,/setIncludeFontPadding\(false\)/);
  assert.match(home,/ExecutorService appLoader/);
  assert.match(home,/appLoader\.execute/);
  assert.match(home,/Intent\.makeMainActivity/);
  assert.match(home,/visibleAppLimit=60/);
  const resume=home.match(/@Override protected void onResume\(\)\{([^\n]+)\}/)?.[1]||"";
  assert.doesNotMatch(resume,/reloadApps|buildHome|renderPage/);
});

test("Applications expose twenty folder-independent Favorites before folders",()=>{
  const applications=home.indexOf("private void renderApplicationsPage");
  const favorites=home.indexOf("FAVORITE APPLICATIONS",applications);
  const folders=home.indexOf("APPLICATION FOLDERS",applications);
  assert.ok(applications>=0&&favorites>applications&&folders>favorites);
  assert.match(home,/favorites\.size\(\)\+" \/ 20"/);
  assert.match(home,/values\.size\(\)>=20/);
  assert.match(home,/FAVORITES FULL/);
});

test("Version 29.3 supplies calendar, multi-station Dock, notifications, and battery policy",()=>{
  for(const token of ["TEMPORAL OPERATIONS","renderCalendarPage","SELECTED STARDATE","setOnClickListener(v->switchPage(\"calendar\"))"])assert.ok(home.includes(token),token);
  for(const token of ["CONNECTED STATION DOCK","SAVED STATIONS","STATUS","MEDIA","COMMS","CMD","NOTIFICATION CENTER","DISMISS ALL","api/padd/heartbeat"])assert.ok(companion.includes(token),token);
  assert.match(companion,/stations\.all\(\)\.size\(\)\+"\/8"/);
  assert.match(companion,/BatteryStatus\.classify/);
  assert.match(battery,/CRITICAL|CHARGING|READY/);
});

test("Pairing credentials migrate into Android Keystore encryption",()=>{
  for(const token of ["AndroidKeyStore","AES/GCM/NoPadding","GCMParameterSpec","migrateLegacy","last-station","station-token"])assert.ok(credentials.includes(token),token);
  assert.match(credentials,/MAX_STATIONS\s*=\s*8/);
  assert.match(credentials,/legacy\.edit\(\)\.remove\(LEGACY_TOKEN\)\.remove\(LEGACY_STATION\)/);
  assert.match(credentials,/clearCredential/);
});

test("one-tap mobile updates use a verified APK and Android's installer",()=>{
  assert.match(gradleProperties,/android\.useAndroidX=true/);
  assert.match(manifest,/REQUEST_INSTALL_PACKAGES/);
  assert.match(manifest,/androidx\.core\.content\.FileProvider/);
  for(const token of ["SHA256SUMS.txt","MessageDigest.getInstance(\"SHA-256\")","ACTION_MANAGE_UNKNOWN_APP_SOURCES","application/vnd.android.package-archive","FLAG_GRANT_READ_URI_PERMISSION"])assert.ok(updater.includes(token),token);
  assert.match(home,/CHECK \+ INSTALL MOBILE UPDATE/);
});

test("wrapped module controls and desktop popup families retain vertical resizing",()=>{
  assert.match(layout,/import "\.\/v29\.css"/);
  assert.match(renderer,/import "\.\.\/app\/v29\.css"/);
  assert.match(css,/\.overview-editing \.overview-modules \.widget-wrap\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  for(const surface of ["speed-dial-page-peek","notice-history","tray-drawer"])assert.ok(css.includes(`.${surface}.resizable-popup-floating`),surface);
  assert.match(css,/max-height:\s*calc\(100vh - 24px\) !important/);
});

test("Version 29.3 RC automation remains available for historical development builds",()=>{
  assert.match(workflow,/branches:\s*\[29-development\]/);
  assert.match(workflow,/BatteryStatusSelfTest/);
  for(const job of ["linux:","windows:","android:","publish-development-release:"])assert.ok(workflow.includes(job),job);
  for(const asset of [
    "LCARS-Command-Interface-v29.3-x86_64.AppImage",
    "LCARS-Universal-Linux-Desktop-v29.3.zip",
    "LCARS-Linux-Integration-v29.3.sh",
    "LCARS-Windows-Setup-v29.3.exe",
    "LCARS-Mobile-Environment-v29.3-Android.apk",
    "LCARS-Command-Interface-v29.3-Source.zip",
    "SHA256SUMS.txt",
  ])assert.ok(workflow.includes(asset),asset);
  assert.match(workflow,/gh release create v29\.3/);
  assert.match(workflow,/Version 29\.3 RC 1/);
  assert.match(workflow,/--prerelease/);
});

test("Version 29 Stable automation signs and publishes every platform",()=>{
  assert.match(stableWorkflow,/branches:\s*\[29-stable\]/);
  assert.match(stableWorkflow,/BatteryStatusSelfTest/);
  for(const job of ["linux:","windows:","android:","publish-stable-release:"])assert.ok(stableWorkflow.includes(job),job);
  for(const secret of ["ANDROID_SIGNING_KEY_BASE64","ANDROID_SIGNING_STORE_PASSWORD","ANDROID_SIGNING_KEY_ALIAS","ANDROID_SIGNING_KEY_PASSWORD"])assert.ok(stableWorkflow.includes(secret),secret);
  for(const asset of [
    "LCARS-Command-Interface-v29-x86_64.AppImage",
    "LCARS-Universal-Linux-Desktop-v29.zip",
    "LCARS-Linux-Integration-v29.sh",
    "LCARS-Windows-Setup-v29.exe",
    "LCARS-Mobile-Environment-v29-Android.apk",
    "LCARS-Command-Interface-v29-Source.zip",
    "SHA256SUMS.txt",
  ])assert.ok(stableWorkflow.includes(asset),asset);
  assert.match(stableWorkflow,/:app:assembleRelease/);
  assert.match(stableWorkflow,/apksigner[\s\S]*verify/);
  assert.match(stableWorkflow,/gh release create v29/);
  assert.match(stableWorkflow,/LCARS Command Interface Version 29/);
  assert.match(stableWorkflow,/--latest/);
  assert.doesNotMatch(stableWorkflow,/--prerelease(?:\s|$)/);
});
