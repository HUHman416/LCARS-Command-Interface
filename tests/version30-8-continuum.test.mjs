import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyLocalMedia, detectBrowserApplications, recommendContinuumRole } from "../app/v30-continuum.ts";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("browser discovery finds known browsers without confusing ordinary applications",()=>{
  const apps=[
    {id:"org.mozilla.firefox.desktop",name:"Firefox",comment:"Web Browser"},
    {id:"com.opera.Opera.desktop",name:"Opera GX",comment:"Browser"},
    {id:"org.kde.dolphin.desktop",name:"Files",comment:"File Manager"},
  ];
  assert.deepEqual(detectBrowserApplications(apps).map((app)=>app.name),["Firefox","Opera GX"]);
});

test("local media classifier covers common and extended operating-system formats",()=>{
  assert.equal(classifyLocalMedia("mission.mp3"),"audio");
  assert.equal(classifyLocalMedia("mission.flac"),"audio");
  assert.equal(classifyLocalMedia("briefing.mp4"),"video");
  assert.equal(classifyLocalMedia("briefing.mkv"),"video");
  assert.equal(classifyLocalMedia("unknown.bin"),null);
  assert.equal(classifyLocalMedia("stream","video/quicktime"),"video");
});

test("Continuum recommendations react to station, orientation, display, and dock state",()=>{
  assert.equal(recommendContinuumRole({}),"handheld-home");
  assert.equal(recommendContinuumRole({stationConnected:true,landscape:true}),"desktop-companion");
  assert.equal(recommendContinuumRole({stationConnected:true,externalDisplay:true}),"system-monitor");
  assert.equal(recommendContinuumRole({externalDisplay:true,docked:true,largeScreen:true}),"docked-command-station");
  assert.equal(recommendContinuumRole({presenting:true,stationConnected:true}),"presentation-controller");
});

test("Version 30.8.1 connects Browser Station, integrated file streaming, all Continuum roles, and release packaging",async()=>{
  const [page,desktop,styles,linux,windows,home,companion,padd,workflow,pkg,gradle]=await Promise.all([
    source("../app/page.tsx"),source("../desktop/main.cjs"),source("../app/globals.css"),source("../local/lcars_bridge.py"),source("../windows/lcars_bridge_windows.py"),source("../mobile/android/app/src/main/java/com/lcars/padd/HomeActivity.java"),source("../mobile/android/app/src/main/java/com/lcars/padd/CompanionDock.java"),source("../shared/lcars_padd.py"),source("../.github/workflows/v30-development.yml"),source("../package.json"),source("../mobile/android/app/build.gradle"),
  ]);
  for(const token of ["BROWSER STATION","browserSidebarEnabled","preferredBrowserId","CUSTOM EXTERNAL BROWSER","persist:lcars-browser","OPEN IN EXTERNAL","openMedia={(file,kind)","/api/media-file","SYSTEM PLAYER"])assert.ok(page.includes(token),token);
  assert.match(desktop,/webviewTag:true/);
  assert.match(desktop,/secureEmbeddedBrowser/);
  assert.match(styles,/\.page-browser\{overflow-y:auto/);
  assert.doesNotMatch(page,/\? "◆"\s*:\s*"09"/);
  for(const bridge of [linux,windows]){assert.match(bridge,/def send_media_file/);assert.match(bridge,/Accept-Ranges/);assert.match(bridge,/Content-Range/);}
  for(const role of ["handheld-home","desktop-companion","media-controller","communications-panel","notification-console","system-monitor","presentation-controller","docked-command-station"])assert.ok(home.includes(role),role);
  assert.match(home,/DisplayManager\.DISPLAY_CATEGORY_PRESENTATION/);
  assert.match(home,/Intent\.ACTION_DOCK_EVENT/);
  assert.match(companion,/setContinuumRole/);
  assert.match(padd,/continuumRole/);
  assert.equal(JSON.parse(pkg).version,"30.8.1-dev.1");
  assert.match(gradle,/versionCode 308002/);
  assert.match(workflow,/gh release (?:view|create) v30\.8\.1/);
  assert.match(workflow,/LCARS-Mobile-Environment-v30\.8\.1-Android\.apk/);
});

test("the hosted renderer imports the Federation emblem without a server-side URL constructor",async()=>{
  const page=await source("../app/page.tsx");
  assert.match(page,/import lcarsEmblem from "\.\.\/desktop\/icons\/512x512\.png"/);
  assert.doesNotMatch(page,/new URL\("\.\.\/desktop\/icons\/512x512\.png", import\.meta\.url\)/);
});
