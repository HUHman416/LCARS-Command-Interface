import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page=fs.readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const css=fs.readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
const main=fs.readFileSync(new URL("../desktop/main.cjs",import.meta.url),"utf8");
const linux=fs.readFileSync(new URL("../local/lcars_bridge.py",import.meta.url),"utf8");

test("number row and keypad navigate only outside editable controls",()=>{
  assert.match(page,/\(\?:Digit\|Numpad\)\(\[1-8\]\)/);
  assert.match(page,/target\.isContentEditable/);
});

test("Ctrl+F searches settings, modules, applications and pages",()=>{
  assert.match(page,/key\.toLowerCase\(\) === "f"/);
  assert.match(page,/FIND A SETTING, MODULE, APPLICATION OR PAGE/);
  assert.match(page,/Voice Control settings/);
});

test("task rail owns scrolling and exposes tray inventory",()=>{
  assert.match(css,/\.task-zone \.task-rail[\s\S]*overflow-y: auto !important/);
  assert.match(page,/className="rail-system-tray"/);
});

test("remote terminal launches a native second Electron window",()=>{
  assert.match(main,/--lcars-terminal/);
  assert.match(main,/\?section=terminal/);
  assert.doesNotMatch(linux,/chromium.*section=terminal/);
});

test("local voice and guarded removable storage endpoints exist",()=>{
  assert.match(linux,/\/api\/voice-transcribe/);
  assert.match(linux,/whisper-cli/);
  assert.match(linux,/Only detected removable volumes can be mounted/);
});
