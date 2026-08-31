import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { rankUniversalResults } from "../app/v30-search-core.ts";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/page.tsx"),search=read("../app/v30-search.tsx"),fabric=read("../shared/lcars_data_fabric.py"),linux=read("../local/lcars_bridge.py"),windows=read("../windows/lcars_bridge_windows.py"),workflow=read("../.github/workflows/v30-development.yml"),builder=read("../electron-builder.yml");

test("Universal Search ranks every planned category and exposes actionable file routes",()=>{
  const entries=[
    {id:"one",category:"applications",title:"Stellar Cartography",detail:"Science application"},
    {id:"two",category:"files",title:"mission-report.pdf",detail:"Documents"},
  ];
  assert.equal(rankUniversalResults("mission report",entries)[0].id,"two");
  for(const category of ["applications","files","settings","commands","stations","notifications","media","contacts","modules","procedures","activity"])assert.ok(search.includes(`id:"${category}"`),category);
  for(const action of ["OPEN HERE","OPEN ON PADD","SEND TO STATION","ATTACH TO PROCEDURE"])assert.ok(search.includes(action),action);
  assert.match(page,/rankUniversalResults/);
  assert.match(page,/requestedFile=\{fileSearchTarget\}/);
  assert.match(page,/attachments:\[/);
  assert.match(page,/fabric\?\.recent\|\|\[\]/);
  assert.match(page,/recentItems:fabric\?\.categories\.recentItems/);
});

test("Data Fabric is local-first, encrypted, selective, versioned, and cross-platform",()=>{
  for(const token of ["privateStorage","smallFiles","clipboard","conflictPolicy","resolve-conflict","vault-put","merge-version","MAX_VERSIONS"])assert.ok(fabric.includes(token),token);
  assert.match(fabric,/seal_json\(self\._key\(\), value, "lcars-data-fabric-private-v1"\)/);
  assert.match(fabric,/os\.chmod\(temporary, 0o600\)/);
  for(const bridge of [linux,windows]){assert.match(bridge,/api\/data-fabric/);assert.match(bridge,/api\/universal-search/);assert.match(bridge,/deliver-file/);assert.match(bridge,/524288/);}
  assert.equal((builder.match(/from: shared\/lcars_data_fabric\.py/g)||[]).length,2);
  assert.match(search,/AES-256-GCM/);
  assert.match(search,/PER-CATEGORY SYNCHRONIZATION/);
});

test("voice alerts and confirmation distinguish one command from a sequence",()=>{
  const core=read("../app/v30-core.ts");
  for(const phrase of ["green alert","no alert"])assert.match(core,new RegExp(phrase));
  assert.match(page,/voice-affirmative\.mp3/);
  assert.match(page,/input-ok\.mp3/);
  assert.match(page,/result\.steps>1/);
  assert.match(page,/lastConfirmationAt\.current<15000/);
  assert.match(page,/SpeechSynthesisUtterance\("Affirmative"\)/);
  assert.doesNotMatch(page,/PRESS TO STAND DOWN/);
  assert.ok(statSync(new URL("../public/assets/sounds/input-ok.mp3",import.meta.url)).size>1000);
});

test("Version 30.5 release workflow publishes all development platforms",()=>{
  assert.match(workflow,/Version 30\.5 Universal Search and Data Fabric Development/);
  assert.match(workflow,/LCARS-Command-Interface-v30\.5-x86_64\.AppImage/);
  assert.match(workflow,/LCARS-Windows-Setup-v30\.5\.exe/);
  assert.match(workflow,/LCARS-Mobile-Environment-v30\.5-Android\.apk/);
  assert.match(workflow,/gh release (?:view|create) v30\.5/);
});
