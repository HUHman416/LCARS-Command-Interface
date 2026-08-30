import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const core=fs.readFileSync(new URL("../app/v25-core.ts",import.meta.url),"utf8");
const extensions=fs.readFileSync(new URL("../shared/lcars_extensions.py",import.meta.url),"utf8");
const updater=fs.readFileSync(new URL("../shared/lcars_updater.py",import.meta.url),"utf8");
const renderer=fs.readFileSync(new URL("../desktop/renderer.tsx",import.meta.url),"utf8");
const packageJson=JSON.parse(fs.readFileSync(new URL("../package.json",import.meta.url),"utf8"));

test("Version 26.2 carries the Windows-safe resize anchoring into the native workspace engine",()=>{
  assert.match(page,/dataset\.lcarsResizing="1"/);
  assert.match(page,/startTop\+start\.height-rendered\.height/);
  assert.match(page,/startLeft\+start\.width-rendered\.width/);
  assert.match(page,/ResizeObserver\(\(\)=>\{if\(element\.dataset\.lcarsResizing!=="1"\)persist\(\);\}\)/);
  assert.match(page,/lcarsSnapPreview/);
});

test("Workstations 3.0 preserve Speed Dial and provide adaptive presets and lifecycle controls",()=>{
  for(const token of ["speedDial?: SpeedDialItem[]","layoutPreset?:","PORTRAIT PADD","LANDSCAPE PADD","MULTI-MONITOR","PREVIEW","RENAME","DUPLICATE","EXPORT"])assert.ok(page.includes(token),token);
  assert.match(page,/profile\.speedDial/);
});

test("Operations Automation 2.0 supports conditions, prompts, delays, retries, failure paths, history, and step tests",()=>{
  for(const token of ['| "prompt"','condition?: RoutineCondition','delayMs?: number','retries?: number','onFailure?: "stop" | "continue"'])assert.ok(core.includes(token),token);
  for(const token of ["RUN HISTORY","BRANCH / TIMING / FAILURE","TEST","Operator declined the routine prompt","step.onFailure!==\"continue\""])assert.ok(page.includes(token),token);
});

test("Communications Action Center groups repeated messages and exposes safe stateful actions",()=>{
  for(const token of ["COMMUNICATIONS ACTION CENTER","SHOW ARCHIVED","MARK UNREAD","VIEW PROCESS","OPEN UPDATES","repeats:(match.repeats||1)+1"])assert.ok(page.includes(token),token);
});

test("Module Repository 2.0 accepts constrained public GitHub sources and generates publisher packages",()=>{
  for(const token of ["repository_source_operation","prepare_module_publication","public https://github.com/OWNER/REPOSITORY","sourceId","SHA256SUMS.txt","never executes repository code"])assert.ok((extensions+page).includes(token),token);
  assert.doesNotMatch(extensions,/github\.com.*token/i);
});

test("Version 26 release candidates can explicitly transition to the stable major release",()=>{
  assert.ok(["29.3.0-rc.1","29.2.0-dev.1","28.0.0","28.3.0-rc.1","28.2.0-dev.1","27.2.1-dev.1","27.2.0-dev.1","27.1.1-dev.1","26.3.0-dev.1","26.0.0"].includes(packageJson.version));
  assert.match(page,/CHECK LATEST STABLE RELEASE|CHECK FOR VERSION (?:27|26) STABLE/);
  assert.match(updater,/stableTransition/);
  assert.match(updater,/channel=="stable-release"/);
  assert.match(renderer,/v26-3\.css/);
});

test("supported Page Peeks detach through the guarded native Electron route",()=>{
  assert.match(page,/tool=page-peek/);
  assert.match(page,/NATIVE DETACHED PAGE PEEK/);
  assert.match(page,/DETACH ↗/);
});
