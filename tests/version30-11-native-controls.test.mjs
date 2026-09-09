import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("every former host control-panel action routes to the LCARS System Control Matrix",async()=>{
  const [page,matrix]=await Promise.all([source("../app/page.tsx"),source("../app/v30-system-control.tsx")]);
  for(const action of ["system-monitor","storage","processes","media-player","audio-settings","network-settings","wifi","bluetooth","software-center","check-updates","display-settings","identify-displays","extension-folder"]){
    assert.ok(page.includes(`\"${action}\"`),action);
  }
  assert.match(page,/Record<string,SystemControlArea>/);
  assert.match(page,/setSystemControlArea\(lcarsControl\[action\]\)/);
  assert.match(page,/<SystemControlCenter/);
  for(const area of ["NETWORK","WI-FI","BLUETOOTH","AUDIO","DISPLAYS","SOFTWARE","PROCESSES","STORAGE","MODULES","MEDIA"]){
    assert.ok(matrix.includes(`\"${area}\"`),area);
  }
  for(const endpoint of ["/api/connectivity","/api/connectivity-action","/api/displays","/api/display-config","/api/audio-devices","/api/audio","/api/media","/api/engineering","/api/process-action","/api/storage","/api/storage-action","/api/software","/api/extensions","/api/system-locations"]){
    assert.ok(matrix.includes(endpoint),endpoint);
  }
});

test("routine file, document, and media errors remain inside LCARS",async()=>{
  const page=await source("../app/page.tsx");
  assert.doesNotMatch(page,/fetch\([^\n]*\/api\/file-open/);
  assert.doesNotMatch(page,/OPEN WITH SYSTEM DEFAULT/);
  assert.doesNotMatch(page,/SYSTEM PLAYER/);
  assert.match(page,/Select audio or video from LCARS Files/);
  assert.match(page,/READ-ONLY LCARS VIEW/);
});

test("Linux and Windows bridges expose native controls without desktop-settings launch mappings",async()=>{
  const [linux,windows,audit]=await Promise.all([source("../local/lcars_bridge.py"),source("../windows/lcars_bridge_windows.py"),source("../docs/VERSION-30.11-NATIVE-CONTROLS-AUDIT.md")]);
  for(const bridge of [linux,windows]){
    assert.match(bridge,/def connectivity_data\(/);
    assert.match(bridge,/def connectivity_action\(/);
    assert.match(bridge,/def software_data\(/);
    assert.match(bridge,/def display_config_action\(/);
    assert.match(bridge,/\/api\/connectivity-action/);
    assert.match(bridge,/\/api\/display-config/);
    assert.match(bridge,/LCARS System Control Matrix/);
  }
  for(const removed of ["ms-settings:","pavucontrol","systemsettings","gnome-control-center","plasma-systemmonitor"]){
    assert.ok(!linux.slice(linux.indexOf("def protected_action"),linux.indexOf("class Handler")).includes(removed),`Linux protected action: ${removed}`);
    assert.ok(!windows.slice(windows.indexOf("def protected_action"),windows.indexOf("def application_icon_for")).includes(removed),`Windows protected action: ${removed}`);
  }
  assert.match(audit,/Android's default-Home selection/);
  assert.match(audit,/emergency.*recovery-shell route/i);
  assert.match(audit,/Windows Bluetooth is intentionally inventory-only/);
});

test("Version 30.14 development identities retain Version 30.11 native controls",async()=>{
  const [pkg,gradle,workflow,padd]=await Promise.all([source("../package.json"),source("../mobile/android/app/build.gradle"),source("../.github/workflows/v30-development.yml"),source("../padd/app.js")]);
  assert.equal(JSON.parse(pkg).version,"30.0.0");
  assert.match(gradle,/versionCode 3099001/);
  assert.match(gradle,/versionName "30\.0\.0"/);
  assert.match(workflow,/v30\.14/);
  assert.match(workflow,/Systems Layout Audit Development/);
  assert.match(padd,/VERSION 30 STABLE/);
});
