import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { interpretComputerCommand } from "../app/v30-core.ts";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Commissioning models required attention separately from optional operator choices",async()=>{
  const commissioning=await source("../app/v30-commissioning.tsx");
  assert.match(commissioning,/export type CommissioningState = "ready" \| "optional" \| "attention"/);
  assert.match(commissioning,/commissioningSummary/);
  assert.match(commissioning,/context\.voiceEnabled \? context\.voiceHealthy \? "ready" : "attention" : "optional"/);
  assert.match(commissioning,/!context\.pairedStations \? "optional"/);
});

test("offline command help is searchable and the Computer can open it",async()=>{
  const commissioning=await source("../app/v30-commissioning.tsx");
  assert.match(commissioning,/Computer, resume Spotify/);
  assert.match(commissioning,/Computer, self destruct/);
  assert.match(commissioning,/filterCommandReference/);
  const plan=interpretComputerCommand("Computer, what can I say?",{pages:[{id:"commissioning",name:"Commissioning"}],apps:[],procedures:[],workstations:[],themes:[]});
  assert.equal(plan.valid,true);
  assert.equal(plan.steps[0].target,"commissioning");
});

test("Version 31.1 keeps Browser Station retired and continuously numbers the expanded desktop rail",async()=>{
  const [page,desktop,styles,continuum]=await Promise.all([source("../app/page.tsx"),source("../desktop/main.cjs"),source("../app/globals.css"),source("../app/v30-continuum.ts")]);
  assert.match(page,/\["portals", "09", "PORTALS"\]/);
  assert.match(page,/\["commissioning", "11", "COMMISSION"\]/);
  assert.match(page,/taskRailNumber=String\(visibleNav\.length\+customPages\.length\+1\)/);
  assert.match(page,/powerNumber=String\(visibleNav\.length\+customPages\.length\+2\)/);
  assert.match(page,/visibleNav\.length\+index\+1/);
  assert.match(page,/<i aria-hidden="true">\{taskRailNumber\}<\/i>/);
  for(const retired of ["function BrowserDock","LCARS BROWSER STATION","persist:lcars-browser","CUSTOM EXTERNAL BROWSER"])assert.doesNotMatch(page,new RegExp(retired));
  assert.doesNotMatch(desktop,/webviewTag:true|secureEmbeddedBrowser/);
  assert.doesNotMatch(styles,/\.page-browser|\.browser-dock/);
  assert.doesNotMatch(continuum,/detectBrowserApplications|isBrowserApplication/);
});

test("Commissioning integrates trust, diagnostics, bounded retention, and resume recovery",async()=>{
  const [page,commissioning,styles]=await Promise.all([source("../app/page.tsx"),source("../app/v30-commissioning.tsx"),source("../app/v30.css")]);
  for(const token of ["COMMISSIONING & TRUST CENTER","RUN FULL CHECK","OFFLINE COMMAND SEARCH","TRUST + PRIVACY","LONG-RUN STABILITY LIMITS"])assert.ok(commissioning.includes(token),token);
  assert.equal((commissioning.match(/name: "(?:OPERATIONS LOG|COMMAND ACTIVITY|NOTIFICATION HISTORY|COMPUTER AUDIT|RECOVERY SNAPSHOTS|PRIVATE RECORDS)"/g)||[]).length,6);
  assert.match(page,/api\/diagnostics-export/);
  assert.match(page,/visibilitychange/);
  assert.match(page,/pageshow/);
  assert.match(page,/window\.addEventListener\("online",refreshAfterResume\)/);
  assert.match(page,/setInterval\(whileVisible\(getSystem\), 2000\)/);
  assert.match(styles,/\.commissioning-center/);
});

test("development history and the Version 30 Stable workflow remain separately signed",async()=>{
  const [development,stable,pkg,gradle]=await Promise.all([source("../.github/workflows/v30-development.yml"),source("../.github/workflows/v30-stable.yml"),source("../package.json"),source("../mobile/android/app/build.gradle")]);
  assert.equal(JSON.parse(pkg).version,"31.5.0");
  assert.match(gradle,/versionCode 3105000/);
  assert.match(development,/gh release (?:view|create) v30\.14/);
  assert.match(development,/--prerelease/);
  assert.match(stable,/branches: \[30-stable\]/);
  assert.match(stable,/:app:assembleRelease/);
  assert.match(stable,/gh release (?:view|create) v30/);
  assert.doesNotMatch(stable,/gh release (?:view|create) v30\./);
});
