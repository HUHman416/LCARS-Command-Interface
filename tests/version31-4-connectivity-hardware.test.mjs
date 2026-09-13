import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/page.tsx"),systems=read("../app/v30-system-control.tsx"),component=read("../app/v31-connectivity.tsx"),css=read("../app/v31-4.css"),renderer=read("../desktop/renderer.tsx"),linux=read("../local/lcars_bridge.py"),windows=read("../windows/lcars_bridge_windows.py"),service=read("../shared/lcars_connectivity.py"),builder=read("../electron-builder.yml"),memory=read("../docs/PROJECT-MEMORY.md");

test("Version 31.4 upgrades the existing Network area without adding another Systems rail tab",()=>{
  assert.match(systems,/area==="network"&&<ConnectivityHardware/);
  assert.match(systems,/\["network","NET","NETWORK"\]/);
  assert.equal((systems.match(/\["(?:telemetry|network|wifi|bluetooth|audio|displays|software|processes|storage|modules|media)"/g)||[]).length,11);
  for(const phrase of ["STATION LINK MATRIX","VPN PROFILES","HOTSPOT CONTROL","SAVED NETWORKS","CONNECTION DIAGNOSTICS","REMOVABLE DEVICE POLICY","USB DEVICES","GAME CONTROLLERS"])assert.match(component,new RegExp(phrase));
  assert.match(page,/VERSION 31\.4 CONNECTIVITY AND HARDWARE/);
});

test("protected connections use matching single-use Portal authorization",()=>{
  for(const token of ["PROTECTED_ACTIONS","request_description","_approved","consumedApprovals","authorize_removable_mount","shell text"])assert.match(service,new RegExp(token.replace("shell text","list\\(argv\\)")));
  assert.doesNotMatch(service,/shell\s*=\s*True/);
  assert.match(component,/lcars-connectivity-approval/);
  assert.match(component,/\/api\/portal-request/);
  assert.match(component,/\/api\/portal-operation/);
  assert.match(component,/CHECK APPROVAL \+ EXECUTE/);
  for(const source of [linux,windows])for(const token of ["ConnectivityHardware","/api/connectivity-hardware","request_description","INTENT_BROKER.request","CONNECTIVITY_HARDWARE.operate"])assert.match(source,new RegExp(token.replaceAll("/","\\/")));
});

test("Software Logistics button geometry is isolated from legacy Systems nav rules",()=>{
  assert.match(css,/\.system-control-body \.software-logistics nav\.software-modes/);
  assert.match(css,/grid-template-columns:repeat\(4,minmax\(112px,1fr\)\)/);
  assert.match(css,/grid-template-columns:30px minmax\(0,1fr\)/);
  assert.match(css,/software-inventory-command/);
  assert.match(css,/\.software-catalog>form/);
  assert.match(renderer,/v31-4\.css/);
  assert.match(read("../app/v31-software.tsx"),/NO MANAGER/);
});

test("both packages include the connectivity service and current 31.4 identity",()=>{
  assert.equal((builder.match(/shared\/lcars_connectivity\.py/g)||[]).length,4);
  assert.equal(JSON.parse(read("../package.json")).version,"31.4.0");
  assert.match(read("../mobile/android/app/build.gradle"),/versionCode 3104000/);
  assert.match(read("../mobile/android/app/build.gradle"),/versionName "31\.4\.0"/);
  assert.match(memory,/Version 31\.4 Development/);
});
