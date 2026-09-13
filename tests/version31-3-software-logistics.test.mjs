import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/page.tsx"),systems=read("../app/v30-system-control.tsx"),software=read("../app/v31-software.tsx"),css=read("../app/v31-3.css"),linux=read("../local/lcars_bridge.py"),windows=read("../windows/lcars_bridge_windows.py"),service=read("../shared/lcars_software.py"),builder=read("../electron-builder.yml"),memory=read("../docs/PROJECT-MEMORY.md");

test("Version 31.3 upgrades the existing Systems software area",()=>{
  assert.match(systems,/area==="software"&&<SoftwareLogistics/);
  assert.doesNotMatch(systems,/PREPARE UPDATE IN LCARS TERMINAL/);
  for(const phrase of ["SOFTWARE LOGISTICS","SEARCH AVAILABLE SOFTWARE","REVIEW INSTALL","REVIEW UPDATE","REVIEW REMOVE","CHANGE PREVIEW","SIGNATURE","TRANSACTION","VERIFIED SOURCES"])assert.match(software,new RegExp(phrase));
  assert.match(page,/VERSION 31\.3 SOFTWARE LOGISTICS/);
});

test("package operations are capability-aware, reviewed, and shell-free",()=>{
  for(const token of ["LINUX_MANAGERS","signaturePolicy","previewAvailable","storageImpact","restartRequired","rollbackGuidance","confirmed","expires","sourceControl"])assert.match(service,new RegExp(token));
  assert.match(service,/self\.runner\(list\(argv\)/);
  assert.doesNotMatch(service,/shell\s*=\s*True/);
  assert.match(service,/Another software transaction is already active/);
  assert.match(service,/cannot be cancelled safely/);
  assert.match(service,/System package sources are read-only in LCARS/);
});

test("Linux and Windows expose the shared Software Logistics API",()=>{
  for(const source of [linux,windows])for(const token of ["SoftwareLogistics","/api/software-logistics","SOFTWARE.search","SOFTWARE.details","SOFTWARE.plan","SOFTWARE.start","SOFTWARE.cancel","SOFTWARE.source_action"])assert.match(source,new RegExp(token.replace("/","\\/")));
  assert.equal((builder.match(/shared\/lcars_software\.py/g)||[]).length,4);
});

test("Files 2.0 uses compact bounded rows and horizontal controls",()=>{
  for(const token of ["grid-auto-rows:64px","height:64px","width:42px","max-width:27px","flex-wrap:nowrap","overflow-x:auto"])assert.match(css,new RegExp(token.replaceAll("*","\\*")));
  assert.match(css,/@media\(max-height:780px\)/);
  assert.match(css,/@media\(max-width:680px\)/);
});

test("31.3 identity and roadmap memory are current",()=>{
  assert.equal(JSON.parse(read("../package.json")).version,"31.3.0");
  assert.match(read("../mobile/android/app/build.gradle"),/versionCode 3103000/);
  assert.match(memory,/Version 31\.3 Development upgrades the existing System Control Matrix software area/);
});
