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
const main=read("../mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java");
const home=read("../mobile/android/app/src/main/java/com/lcars/padd/HomeActivity.java");
const workflow=read("../.github/workflows/v29-development.yml");

test("Version 29.2 development identity is explicit and coexists with Stable Version 28",()=>{
  assert.equal(packageJson.version,"29.2.0-dev.1");
  assert.match(page,/LCARS_VERSION="29\.2\.0-dev\.1"/);
  assert.match(page,/29\.2 DEVELOPMENT/);
  assert.match(gradle,/versionCode 29201/);
  assert.match(gradle,/versionName "29\.2"/);
  assert.match(gradle,/applicationIdSuffix "\.dev"/);
  assert.match(gradle,/versionNameSuffix "-development"/);
});

test("Android exposes an optional genuine Home role without replacing the PADD launcher entry",()=>{
  assert.match(manifest,/android:name="\.MainActivity"[\s\S]*android\.intent\.category\.LAUNCHER/);
  assert.match(manifest,/android:name="\.HomeActivity"[\s\S]*android\.intent\.category\.DEFAULT[\s\S]*android\.intent\.category\.HOME/);
  assert.match(manifest,/<queries>[\s\S]*android\.intent\.category\.LAUNCHER/);
  assert.match(home,/RoleManager\.ROLE_HOME/);
  assert.match(home,/createRequestRoleIntent/);
  assert.match(home,/Settings\.ACTION_HOME_SETTINGS/);
  assert.match(main,/VERSION 29\.2 STANDALONE HOME/);
  assert.match(main,/startActivity\(new Intent\(this, HomeActivity\.class\)\)/);
});

test("Version 29.2 Home mirrors the desktop shell and delivers the customization milestone",()=>{
  for(const token of [
    "ANDROID COMMAND INTERFACE","buildSidebar","STATUS","APPS","FAVORITES","DECKS","FOLDERS","WIDGETS","DISPLAYS","SETTINGS","COMPANION",
    "AppWidgetHost","ACTION_APPWIDGET_PICK","LCARS DECKS","CREATE APPLICATION FOLDER","DISPLAY MATRIX","enterprise-d","voyager","nemesis","picard","cerritos","defiant",
    "LAYOUT CUSTOMIZATION","CONFIGURATION BACKUP","ACTION_CREATE_DOCUMENT","ACTION_OPEN_DOCUMENT","lcars-home-backup"
  ])assert.ok(home.includes(token),token);
  assert.match(home,/setInsetAwareContent/);
  assert.match(home,/fittedLabel/);
});

test("native companion masthead remains contained independently of remote font scaling",()=>{
  assert.match(main,/fixedFittedLabel\(eyebrow/);
  assert.match(main,/fixedFittedLabel\("PADD COMPANION"/);
  assert.match(main,/new LinearLayout\.LayoutParams\(0, dp\(72\), 1\)/);
  assert.match(main,/TextView index = fixedFittedLabel\("29"/);
});

test("Home mode provides profile-aware app search, launch, favorites, and offline status",()=>{
  for(const token of ["LauncherApps","getProfiles()","getActivityList(null,profile)","startMainActivity","UNIVERSAL APPLICATION SEARCH","PINNED APPLICATIONS","favorite-components","LOCAL DEVICE OPERATIONS","BATTERY","STORAGE FREE","NETWORK"]){
    assert.ok(home.includes(token),token);
  }
  assert.match(home,/addTextChangedListener/);
  assert.match(home,/toggleFavorite/);
  assert.match(home,/PADD COMPANION/);
});

test("wrapped module edit controls and all desktop popup families retain vertical resizing",()=>{
  assert.match(layout,/import "\.\/v29\.css"/);
  assert.match(renderer,/import "\.\.\/app\/v29\.css"/);
  assert.match(css,/\.overview-editing \.overview-modules \.widget-wrap\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(css,/\.overview-editing \.overview-modules \.widget-wrap > \.overview-widget\s*\{[\s\S]*height:\s*auto/);
  for(const surface of ["speed-dial-page-peek","notice-history","tray-drawer"])assert.ok(css.includes(`.${surface}.resizable-popup-floating`),surface);
  assert.match(css,/max-height:\s*calc\(100vh - 24px\) !important/);
  assert.match(css,/\.tray-drawer\.resizable-popup\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto/);
});

test("Version 29.2 development automation builds and publishes every platform",()=>{
  assert.match(workflow,/branches:\s*\[29-development\]/);
  for(const job of ["linux:","windows:","android:","publish-development-release:"])assert.ok(workflow.includes(job),job);
  for(const asset of [
    "LCARS-Command-Interface-v29.2-x86_64.AppImage",
    "LCARS-Universal-Linux-Desktop-v29.2.zip",
    "LCARS-Linux-Integration-v29.2.sh",
    "LCARS-Windows-Setup-v29.2.exe",
    "LCARS-Mobile-Environment-v29.2-Android.apk",
    "LCARS-Command-Interface-v29.2-Source.zip",
    "SHA256SUMS.txt",
  ])assert.ok(workflow.includes(asset),asset);
  assert.match(workflow,/gh release create v29\.2/);
  assert.match(workflow,/--prerelease/);
});
