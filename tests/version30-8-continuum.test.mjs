import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { classifyLocalMedia, recommendContinuumRole } from "../app/v30-continuum.ts";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

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

test("Version 30.10 preserves integrated file streaming and all Continuum roles while retiring Browser Station",async()=>{
  const [page,desktop,styles,linux,windows,home,companion,padd,workflow,pkg,gradle]=await Promise.all([
    source("../app/page.tsx"),source("../desktop/main.cjs"),source("../app/globals.css"),source("../local/lcars_bridge.py"),source("../windows/lcars_bridge_windows.py"),source("../mobile/android/app/src/main/java/com/lcars/padd/HomeActivity.java"),source("../mobile/android/app/src/main/java/com/lcars/padd/CompanionDock.java"),source("../shared/lcars_padd.py"),source("../.github/workflows/v30-development.yml"),source("../package.json"),source("../mobile/android/app/build.gradle"),
  ]);
  for(const token of ["openMedia={(file,kind)","/api/media-file","SYSTEM PLAYER"])assert.ok(page.includes(token),token);
  for(const retired of ["function BrowserDock","persist:lcars-browser","CUSTOM EXTERNAL BROWSER","OPEN IN EXTERNAL"])assert.doesNotMatch(page,new RegExp(retired));
  assert.doesNotMatch(desktop,/webviewTag:true|secureEmbeddedBrowser/);
  assert.doesNotMatch(styles,/\.page-browser|\.browser-dock/);
  for(const bridge of [linux,windows]){assert.match(bridge,/def send_media_file/);assert.match(bridge,/Accept-Ranges/);assert.match(bridge,/Content-Range/);}
  for(const role of ["handheld-home","desktop-companion","media-controller","communications-panel","notification-console","system-monitor","presentation-controller","docked-command-station"])assert.ok(home.includes(role),role);
  assert.match(home,/DisplayManager\.DISPLAY_CATEGORY_PRESENTATION/);
  assert.match(home,/Intent\.ACTION_DOCK_EVENT/);
  assert.match(companion,/setContinuumRole/);
  assert.match(padd,/continuumRole/);
  assert.equal(JSON.parse(pkg).version,"30.10.0-dev.1");
  assert.match(gradle,/versionCode 3010001/);
  assert.match(workflow,/gh release (?:view|create) v30\.10/);
  assert.match(workflow,/LCARS-Mobile-Environment-v30\.10-Android\.apk/);
});

test("the hosted renderer imports the Federation emblem without a server-side URL constructor",async()=>{
  const page=await source("../app/page.tsx");
  assert.match(page,/import lcarsEmblem from "\.\.\/desktop\/icons\/512x512\.png"/);
  assert.doesNotMatch(page,/new URL\("\.\.\/desktop\/icons\/512x512\.png", import\.meta\.url\)/);
});
