import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Systems is a complete scroll region and clears the command tray",async()=>{
  const css=await source("../app/globals.css");
  assert.match(css,/\.page-media,\s*\.page-settings,\s*\.page-system\s*\{[^}]*overflow-y:\s*auto\s*!important/);
  assert.match(css,/\.page-system\s*\{[^}]*padding-bottom:\s*72px/);
  assert.match(css,/overscroll-behavior-y:\s*contain/);
});

test("the eleven-section rail uses one label and deliberate LCARS end caps",async()=>{
  const [matrix,css]=await Promise.all([source("../app/v30-system-control.tsx"),source("../app/v30.css")]);
  assert.equal((matrix.match(/\["(?:telemetry|network|wifi|bluetooth|audio|displays|software|processes|storage|modules|media)"/g)||[]).length,11);
  const current=css.split("/* Version 30 stable · complete Systems layout and fit audit */")[1].split("/* Version 30.6 · Universal")[0];
  assert.match(current,/embedded \.system-control-tabs button small\{display:none\}/);
  assert.match(current,/@media\(max-width:1320px\)[\s\S]*button small\{display:block/);
  assert.match(current,/@media\(max-width:1320px\)[\s\S]*button b\{display:none\}/);
  assert.match(current,/system-control-tab-step\{[^}]*border-radius:22px 4px 4px 22px/);
  assert.match(current,/system-control-tab-step\.next\{border-radius:4px 22px 22px 4px/);
  assert.match(current,/embedded>header\{[^}]*border-radius:0/);
});

test("every dense Systems panel uses responsive horizontal space",async()=>{
  const css=await source("../app/v30.css");
  for(const selector of [".wireless-list",".bluetooth-list",".audio-device-list",".audio-stream-list",".control-displays>div",".control-processes>div",".control-storage>div",".control-modules>div"]){
    assert.ok(css.includes(selector),selector);
  }
  assert.match(css,/control-software\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/telemetry-core-grid\{grid-template-columns:repeat\(auto-fit,minmax\(118px,1fr\)\)/);
  assert.match(css,/control-processes>div article\{grid-template-columns:48px minmax\(0,1fr\) auto\}/);
  assert.match(css,/control-storage>div article,[^\n]*grid-template-columns:48px minmax\(0,1fr\) auto/);
});

test("Version 30 Stable packages are updater-visible on every platform",async()=>{
  const [pkg,gradle,workflow,page,padd]=await Promise.all([source("../package.json"),source("../mobile/android/app/build.gradle"),source("../.github/workflows/v30-stable.yml"),source("../app/page.tsx"),source("../padd/app.js")]);
  assert.equal(JSON.parse(pkg).version,"30.0.0");
  assert.match(gradle,/versionCode 3099001/);
  assert.match(gradle,/versionName "30\.0\.0"/);
  assert.match(page,/const LCARS_VERSION="30"/);
  assert.match(padd,/VERSION 30 STABLE/);
  assert.match(workflow,/Version 30 Stable/);
  for(const asset of ["LCARS-Command-Interface-v30-x86_64.AppImage","LCARS-Universal-Linux-Desktop-v30.zip","LCARS-Linux-Integration-v30.sh","LCARS-Windows-Setup-v30.exe","LCARS-Mobile-Environment-v30-Android.apk","LCARS-Command-Interface-v30-Source.zip"]){
    assert.ok(workflow.includes(asset),asset);
  }
  assert.match(workflow,/gh release (?:view|create) v30/);
  assert.doesNotMatch(workflow,/--prerelease(?:\s|$)/);
});
