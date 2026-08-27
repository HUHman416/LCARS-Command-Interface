import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/page.tsx");
const core=read("../app/v25-core.ts");
const css=read("../app/v25.css");
const linux=read("../local/lcars_bridge.py");
const windows=read("../windows/lcars_bridge_windows.py");
const updater=read("../shared/lcars_updater.py");
const extensions=read("../shared/lcars_extensions.py");
const renderer=read("../desktop/renderer.tsx");
const pkg=JSON.parse(read("../package.json"));

test("Version 25 exposes editable, guarded Operations Automation",()=>{
  assert.match(core,/export type Routine/);
  assert.match(core,/routineNeedsConfirmation/);
  assert.match(page,/function RoutineCenter/);
  assert.match(page,/function RoutinePreview/);
  assert.match(page,/PROTECTED OPERATOR CONFIRMATION/);
  assert.match(linux,/def routine_command/);
  assert.match(windows,/def routine_command/);
  assert.match(linux,/routine command is not on the LCARS allowlist/);
});

test("Speed Dial pages render pin-capable Page Peeks above ordinary LCARS overlays",()=>{
  assert.match(page,/function SpeedDialPagePeek/);
  assert.match(page,/PINNED PAGE PEEK/);
  assert.match(page,/OPEN FULL PAGE/);
  assert.match(css,/\.speed-dial-page-peek\.pinned\s*\{[^}]*z-index:\s*194/);
  assert.match(css,/\.routine-preview-backdrop\s*\{[^}]*z-index:\s*195/);
});

test("Tray Command Deck mixes configurable commands and named services in one scroll region",()=>{
  assert.match(page,/function TrayCommandDeckEditor/);
  assert.match(page,/tray-scroll-region/);
  assert.match(page,/shortcut\.kind==="app"/);
  assert.match(page,/shortcut\.kind==="page"/);
  assert.match(css,/\.tray-scroll-region\s*\{[^}]*overflow:\s*auto/);
  assert.match(core,/export type TrayShortcut/);
});

test("Engineering is cross-platform and protects elevated or LCARS processes",()=>{
  for(const bridge of [linux,windows]){
    assert.match(bridge,/def engineering_data/);
    assert.match(bridge,/def process_action/);
    assert.match(bridge,/\/api\/engineering/);
    assert.match(bridge,/\/api\/process-action/);
    assert.match(bridge,/current user/);
  }
  assert.match(page,/function EngineeringConsole/);
  assert.match(page,/Unsaved work in that application may be lost/);
});

test("Communications combines notice priorities with persistent command activity",()=>{
  assert.match(page,/COMMUNICATIONS CENTER/);
  assert.match(page,/COMMAND ACTIVITY/);
  assert.match(page,/lcars-activity-log/);
  assert.match(css,/priority-critical/);
  assert.match(core,/export type ActivityEntry/);
});

test("Extension system remains declarative and supports enable, disable, install, and guarded removal",()=>{
  assert.match(page,/function ExtensionHub/);
  assert.match(page,/DECLARATIVE MODULE API/);
  assert.match(page,/MODULE REPOSITORY/);
  assert.match(extensions,/def extension_catalog/);
  assert.match(extensions,/def extension_operation/);
  assert.match(extensions,/bundled extensions can be disabled but not removed/);
  assert.match(linux,/\/api\/extension-catalog/);
  assert.match(windows,/\/api\/extension-catalog/);
});

test("Stable and development update channels are explicit and stay silent in the background",()=>{
  assert.match(updater,/def _release_for_channel/);
  assert.match(updater,/channel == "development"/);
  assert.match(page,/Background checks stay silent when offline/);
  assert.match(page,/api\/lcars-update\?channel=/);
});

test("Version metadata advances for Version 26 while desktop recovery retains Version 25 state",()=>{
  assert.ok(["28.1.0-dev.1","27.2.1-dev.1","27.2.0-dev.1","27.1.1-dev.1","26.3.0-dev.1","26.0.0"].includes(pkg.version));
  assert.match(linux,/LCARS_VERSION="(?:28\.1-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
  assert.match(windows,/LCARS_VERSION="(?:28\.1-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
  assert.match(renderer,/lcars-routines/);
  assert.match(renderer,/lcars-tray-shortcuts/);
});
