import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Version 30.10 extends the existing session instead of duplicating it",async()=>{
  const audit=await source("../docs/VERSION-30.10-SESSION-AUDIT.md");
  for(const existing of ["Selectable Linux session","Application launching","Window tasking","Virtual desktops","Saved arrangements","Lock and power","Recovery"])assert.ok(audit.includes(existing),existing);
  for(const gap of ["Meta+Shift+Escape","deliberate normal exit","continuously","directly between numbered decks"])assert.ok(audit.includes(gap),gap);
  assert.match(audit,/notification service/);
  assert.match(audit,/PolicyKit, Secret Service\/keyring, file-picker/);
});

test("authoritative session startup has bounded crash recovery and clean-exit semantics",async()=>{
  const [wrapper,desktop]=await Promise.all([source("../session/lcars-session"),source("../desktop/main.cjs")]);
  assert.match(wrapper,/read_setting authoritative/);
  assert.match(wrapper,/LCARS_SESSION_AUTHORITATIVE/);
  assert.match(wrapper,/--lcars-authoritative/);
  assert.match(wrapper,/lcars_status=\$\?/);
  assert.match(wrapper,/\[\[ "\$lcars_status" == 0 \]\] && break/);
  assert.doesNotMatch(wrapper,/\[\[ "\$kiosk" == 1 \]\] && break/);
  assert.match(wrapper,/trap restore_shell EXIT/);
  assert.match(desktop,/globalShortcut\.register\("Super\+Shift\+Escape",requestSessionEscape\)/);
  assert.match(desktop,/GlobalShortcutsPortal/);
  assert.match(desktop,/operation:\s*"escape"/);
  assert.match(desktop,/authoritativeMode.*win\.reload/s);
});

test("session authority, continuous placement, and deck task routing are exposed end to end",async()=>{
  const [bridge,page,styles]=await Promise.all([source("../local/lcars_bridge.py"),source("../app/page.tsx"),source("../app/v30.css")]);
  assert.match(bridge,/"authoritative":False/);
  assert.match(bridge,/"continuousPlacement":True/);
  assert.match(bridge,/def window_rule_watch_loop/);
  assert.match(bridge,/action=="move-deck"/);
  assert.match(bridge,/"deckTaskRouting"/);
  assert.match(page,/Authoritative LCARS session/);
  assert.match(page,/Continuously enforce placement/);
  assert.match(page,/action\(t\.id,"move-deck",String\(deck\.id\)\)/);
  assert.match(page,/EMERGENCY ESCAPE: META\+SHIFT\+ESCAPE/);
  assert.match(styles,/\.session-authority-card/);
  assert.match(styles,/\.task-context-decks/);
});

test("Version 30.14 development package and release workflow align",async()=>{
  const [pkg,gradle,workflow]=await Promise.all([source("../package.json"),source("../mobile/android/app/build.gradle"),source("../.github/workflows/v30-development.yml")]);
  assert.equal(JSON.parse(pkg).version,"31.4.0");
  assert.match(gradle,/versionCode 3104000/);
  assert.match(gradle,/versionName "31\.4\.0"/);
  assert.match(workflow,/gh release (?:view|create) v30\.14/);
  assert.match(workflow,/Version 30\.14 Systems Layout Audit Development/);
  assert.match(workflow,/--prerelease/);
});
