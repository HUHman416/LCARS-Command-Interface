import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Systems sections occupy one horizontal control deck",async()=>{
  const [matrix,css]=await Promise.all([source("../app/v30-system-control.tsx"),source("../app/v30.css")]);
  assert.match(matrix,/className="system-control-tab-deck"/);
  assert.match(matrix,/className="system-control-tabs"/);
  assert.match(css,/grid-template-columns:repeat\(11,minmax\(52px,1fr\)\)/);
  assert.match(css,/overflow-x:auto/);
  const current=css.split("/* Version 30.13 · horizontal Systems navigation")[1].split("/* Version 30.14 · complete Systems layout and fit audit")[0];
  assert.doesNotMatch(current,/system-control-tabs\{[^}]*grid-template-columns:repeat\(6/);
});

test("every section remains reachable without relying on a hidden scrollbar",async()=>{
  const matrix=await source("../app/v30-system-control.tsx");
  assert.match(matrix,/aria-label="Previous Systems section"/);
  assert.match(matrix,/aria-label="Next Systems section"/);
  assert.match(matrix,/event\.key==="ArrowLeft"/);
  assert.match(matrix,/event\.key==="ArrowRight"/);
  assert.match(matrix,/scrollIntoView\(\{behavior:"smooth",block:"nearest",inline:"nearest"\}\)/);
  assert.match(matrix,/aria-current=\{area===id\?"page":undefined\}/);
});

test("compact widths abbreviate instead of stacking navigation vertically",async()=>{
  const css=await source("../app/v30.css");
  assert.match(css,/@media\(max-width:1250px\)[\s\S]*system-control-tabs button b\{display:none\}/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*grid-auto-flow:column/);
  assert.match(css,/scrollbar-width:thin/);
  assert.match(css,/system-control-tab-step:focus-visible/);
});

test("Telemetry uses horizontal space before increasing page height",async()=>{
  const css=await source("../app/v30.css");
  assert.match(css,/telemetry-module-list,[^\n]*grid-template-columns:repeat\(auto-fit,minmax\(235px,1fr\)\)/);
  assert.match(css,/telemetry-core-grid\{grid-template-columns:repeat\(auto-fit,minmax\(175px,1fr\)\)\}/);
  assert.match(css,/@media\(max-width:1250px\)[\s\S]*telemetry-detail-grid\{grid-template-columns:1fr 1fr\}/);
  assert.match(css,/@media\(max-width:900px\)[\s\S]*telemetry-detail-grid\{grid-template-columns:1fr\}/);
});

test("Version 30.14 development packages use a new updater-visible identity",async()=>{
  const [pkg,gradle,workflow,page,padd]=await Promise.all([source("../package.json"),source("../mobile/android/app/build.gradle"),source("../.github/workflows/v30-development.yml"),source("../app/page.tsx"),source("../padd/app.js")]);
  assert.equal(JSON.parse(pkg).version,"30.14.0-dev.1");
  assert.match(gradle,/versionCode 3014001/);
  assert.match(gradle,/versionName "30\.14\.0"/);
  assert.match(page,/const LCARS_VERSION="30\.14"/);
  assert.match(padd,/VERSION 30\.14 DEVELOPMENT/);
  assert.match(workflow,/Version 30\.14 Systems Layout Audit Development/);
  for(const asset of ["LCARS-Command-Interface-v30.14-x86_64.AppImage","LCARS-Universal-Linux-Desktop-v30.14.zip","LCARS-Linux-Integration-v30.14.sh","LCARS-Windows-Setup-v30.14.exe","LCARS-Mobile-Environment-v30.14-Android.apk","LCARS-Command-Interface-v30.14-Source.zip"]){
    assert.ok(workflow.includes(asset),asset);
  }
  assert.match(workflow,/gh release (?:view|create) v30\.14/);
});
