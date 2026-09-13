import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Version 30 Stable owns the live desktop viewport without clipping Terminal",async()=>{
  const [page,css]=await Promise.all([source("../app/page.tsx"),source("../app/v30.css")]);
  assert.match(css,/Version 30 stable · viewport-fit audit/);
  assert.match(css,/\.lcars\s*\{[\s\S]*?height:100dvh;[\s\S]*?overflow:clip/);
  assert.match(css,/\.lcars > \.shell\s*\{[\s\S]*?flex:1 1 auto;[\s\S]*?min-height:0;[\s\S]*?overflow:hidden/);
  assert.match(css,/\.page-terminal > \.embedded-terminal,[\s\S]*?height:auto;[\s\S]*?min-height:0/);
  assert.match(css,/max-height:calc\(100dvh - 24px\)/);
  assert.match(page,/document\.querySelector<HTMLElement>\("\.content"\)\?\.scrollTo\(0,0\)/);
  assert.match(page,/\},\[section\]\);/);
});

test("short desktop and handheld layouts preserve navigation and Operations Center fit",async()=>{
  const [v26,css]=await Promise.all([source("../app/v26.css"),source("../app/v30.css")]);
  assert.match(css,/@media \(min-width:681px\) and \(max-height:900px\)/);
  assert.match(css,/\.shell > aside \.nav-gap \{ height:24px; \}/);
  assert.match(v26,/@media \(max-width: 760px\), \(max-width: 900px\) and \(orientation: landscape\) and \(max-height: 520px\)/);
  assert.match(css,/\.operations-center\.notice-history\s*\{[\s\S]*?grid-template-columns:minmax\(0,1fr\) !important;[\s\S]*?height:calc\(100dvh - 124px\) !important/);
  assert.match(css,/\.operations-center > \.workspace-window-controls\s*\{\s*display:none !important/);
  assert.match(css,/@media \(min-width:681px\) and \(max-width:900px\) and \(orientation:landscape\) and \(max-height:520px\)/);
  assert.match(css,/\.system-tray\.speed-dial\s*\{\s*display:none !important/);
});

test("Version 31.3 development identity preserves the Version 30 stable release assets",async()=>{
  const [pkg,gradle,page,padd,linux,windows,workflow,updateManager]=await Promise.all([
    source("../package.json"),source("../mobile/android/app/build.gradle"),source("../app/page.tsx"),source("../padd/app.js"),source("../local/lcars_bridge.py"),source("../windows/lcars_bridge_windows.py"),source("../.github/workflows/v30-stable.yml"),source("../mobile/android/app/src/main/java/com/lcars/padd/MobileUpdateManager.java"),
  ]);
  assert.equal(JSON.parse(pkg).version,"31.3.0");
  assert.match(gradle,/versionCode 3103000/);
  assert.match(gradle,/versionName "31\.3\.0"/);
  assert.match(page,/const LCARS_VERSION="31\.3"/);
  assert.match(padd,/VERSION 31\.3 DEVELOPMENT/);
  assert.match(linux,/LCARS_VERSION="31\.3"/);
  assert.match(windows,/LCARS_VERSION="31\.3"/);
  assert.match(updateManager,/installed\[1\]>0/);
  for(const asset of ["LCARS-Command-Interface-v30-x86_64.AppImage","LCARS-Universal-Linux-Desktop-v30.zip","LCARS-Linux-Integration-v30.sh","LCARS-Windows-Setup-v30.exe","LCARS-Mobile-Environment-v30-Android.apk","LCARS-Command-Interface-v30-Source.zip","SHA256SUMS.txt"]){
    assert.ok(workflow.includes(asset),asset);
  }
  assert.match(workflow,/:app:assembleRelease/);
  assert.match(workflow,/--latest/);
  assert.doesNotMatch(workflow,/--prerelease(?:\s|$)/);
});
