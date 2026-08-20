import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(path)=>readFileSync(new URL(path,import.meta.url),"utf8");
const page=read("../app/page.tsx");
const css=read("../app/v25.css");
const linux=read("../local/lcars_bridge.py");
const workflow=read("../.github/workflows/v25-test.yml");
const pkg=JSON.parse(read("../package.json"));

test("Speed Dial Media Page Peek has artwork and live master and application audio controls",()=>{
  assert.match(page,/function SpeedDialMediaPeek/);
  assert.match(page,/className="peek-media-art"/);
  assert.match(page,/MASTER AUDIO/);
  assert.match(page,/APPLICATION AUDIO/);
  assert.match(page,/setMasterVolume=\{setVolume\}/);
  assert.match(page,/setStreamVolume=\{streamVolume\}/);
  assert.match(css,/\.peek-media-now\s*\{/);
  assert.match(css,/\.peek-app-audio\s*\{/);
  assert.match(linux,/def media_art_source/);
  assert.match(linux,/\/api\/media-art/);
});

test("Popup surfaces expose persistent viewport-safe resizing",()=>{
  assert.match(page,/function ResizablePopup/);
  assert.match(page,/lcars-popup-sizes/);
  assert.match(page,/popupKey="speed-dial-page-peek"/);
  assert.match(page,/popupKey="application-drawer"/);
  assert.match(css,/\.resizable-popup\s*\{[^}]*resize:\s*both/);
  assert.match(css,/\.popup-resize-grip\s*\{/);
});

test("Plain number keys navigate unless the operator is typing",()=>{
  assert.match(page,/function shortcutTargetIsEditable|const shortcutTargetIsEditable/);
  assert.match(page,/\(e\.ctrlKey\|\|!shortcutTargetIsEditable\(e\.target\)\)/);
  assert.match(page,/\^\(\?:Digit\|Numpad\)\(\[1-8\]\)\$/);
  assert.match(page,/Press the number shown on a sidebar control/);
});

test("Version 25.1 development builds publish an updater-visible prerelease",()=>{
  assert.equal(pkg.version,"25.1.0");
  assert.match(workflow,/branches:\s*\[agent\/v25-development\]/);
  assert.match(workflow,/LCARS-Command-Interface-v25\.1-x86_64\.AppImage/);
  assert.match(workflow,/LCARS-Windows-Setup-v25\.1\.exe/);
  assert.match(workflow,/gh release (?:create|upload) v25\.1/);
  assert.match(workflow,/--prerelease/);
});
