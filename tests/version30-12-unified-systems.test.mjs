import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Systems renders the control matrix as its page instead of a separate overlay",async()=>{
  const [page,matrix]=await Promise.all([source("../app/page.tsx"),source("../app/v30-system-control.tsx")]);
  assert.match(page,/section === "system"[\s\S]*<SystemControlCenter/);
  assert.match(page,/<SystemControlCenter[^>]*embedded/);
  assert.doesNotMatch(page,/systemControlArea&&<SystemControlCenter/);
  assert.match(matrix,/embedded\?"system-control-page":"system-control-backdrop"/);
  assert.match(matrix,/role=\{embedded\?"region":"dialog"\}/);
  assert.match(page,/setSystemControlArea\(lcarsControl\[action\]\);setSection\("system"\)/);
});

test("Telemetry consolidates every unique hardware and engineering detail",async()=>{
  const matrix=await source("../app/v30-system-control.tsx");
  for(const label of ["TELEMETRY","PROCESSOR MATRIX","MEMORY ARCHITECTURE","GRAPHICS MATRIX","ENGINEERING SENSOR ARRAY","STORAGE TOPOLOGY"]){
    assert.ok(matrix.includes(label),label);
  }
  for(const detail of ["LOGICAL CORES","PHYSICAL MODULES","DRIVER","VRAM","TEMP N/A","DISPLAY MODE","DETECTED VOLUMES"]){
    assert.ok(matrix.includes(detail),detail);
  }
  assert.match(matrix,/get\("\/api\/system"\)/);
  assert.match(matrix,/get\("\/api\/system-details"\)/);
  assert.match(matrix,/get\("\/api\/engineering"\)/);
});

test("legacy Systems duplicates and telemetry pop-ups are retired",async()=>{
  const page=await source("../app/page.tsx");
  for(const retired of ["SYSTEMS DIAGNOSTIC","EXPANDED HARDWARE MATRIX","EXPANDED TELEMETRY","PHYSICAL STORAGE MATRIX","VERSION 29 ENGINEERING OPERATIONS"]){
    assert.ok(!page.includes(retired),retired);
  }
  assert.doesNotMatch(page,/function HardwareTelemetry/);
  assert.doesNotMatch(page,/function SystemDetail/);
  assert.doesNotMatch(page,/function StorageMatrix/);
  assert.doesNotMatch(page,/function EngineeringConsole/);
});

test("unified Systems geometry is responsive and distinctly LCARS",async()=>{
  const css=await source("../app/v30.css");
  for(const selector of [".system-control-center.embedded",".control-telemetry",".telemetry-meter-grid",".telemetry-detail-grid",".telemetry-core-grid",".memory-summary"]){
    assert.ok(css.includes(selector),selector);
  }
  assert.match(css,/@media\(max-width:1250px\)/);
  assert.match(css,/@media\(max-width:720px\)/);
});

test("Version 30.12 identities and development assets align",async()=>{
  const [pkg,gradle,workflow,page,padd]=await Promise.all([source("../package.json"),source("../mobile/android/app/build.gradle"),source("../.github/workflows/v30-development.yml"),source("../app/page.tsx"),source("../padd/app.js")]);
  assert.equal(JSON.parse(pkg).version,"30.12.0-dev.1");
  assert.match(gradle,/versionCode 3012001/);
  assert.match(gradle,/versionName "30\.12\.0"/);
  assert.match(page,/const LCARS_VERSION="30\.12"/);
  assert.match(padd,/VERSION 30\.12 DEVELOPMENT/);
  assert.match(workflow,/Version 30\.12 Unified Systems Command Development/);
  for(const asset of ["LCARS-Command-Interface-v30.12-x86_64.AppImage","LCARS-Universal-Linux-Desktop-v30.12.zip","LCARS-Linux-Integration-v30.12.sh","LCARS-Windows-Setup-v30.12.exe","LCARS-Mobile-Environment-v30.12-Android.apk","LCARS-Command-Interface-v30.12-Source.zip"]){
    assert.ok(workflow.includes(asset),asset);
  }
  assert.match(workflow,/gh release (?:view|create) v30\.12/);
});
