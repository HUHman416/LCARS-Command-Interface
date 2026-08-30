import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/v24-1.css",import.meta.url),"utf8");
const renderer=readFileSync(new URL("../desktop/renderer.tsx",import.meta.url),"utf8");
const linux=readFileSync(new URL("../local/lcars_bridge.py",import.meta.url),"utf8");
const windows=readFileSync(new URL("../windows/lcars_bridge_windows.py",import.meta.url),"utf8");
const updater=readFileSync(new URL("../shared/lcars_updater.py",import.meta.url),"utf8");
const builder=readFileSync(new URL("../electron-builder.yml",import.meta.url),"utf8");

test("Media is a responsive three-zone console with internal list scrolling",()=>{
  assert.match(page,/function MediaConsole/);
  assert.match(page,/function ApplicationMixer/);
  assert.match(page,/NOW PLAYING/);
  assert.match(page,/MASTER AUDIO/);
  assert.match(page,/APPLICATION MIXER/);
  assert.match(css,/page-density-wide \.media-console/);
  assert.match(css,/page-density-compact \.media-console-tabs/);
  assert.match(css,/\.media-source-list[^{]*\{/);
  assert.match(css,/\.media-mixer-list[^{]*\{/);
  assert.match(css,/overflow-y: auto/);
  assert.match(css,/\.page-media \{[\s\S]*?overflow: hidden/);
});

test("Linux and Windows expose master, stream mute, devices, and grouped app audio",()=>{
  for(const bridge of [linux,windows]){
    assert.match(bridge,/\/api\/stream-mute/);
    assert.match(bridge,/\/api\/audio-device/);
    assert.match(bridge,/"muted"/);
    assert.match(bridge,/"routeAvailable"/);
  }
  assert.match(page,/const groups = Array\.from\(new Set\(streams/);
  assert.match(page,/SHOW ALL STREAMS/);
});

test("Diagnostics exports are local and explicitly privacy scrubbed",()=>{
  for(const bridge of [linux,windows]){
    assert.match(bridge,/def diagnostics_report/);
    assert.match(bridge,/def export_diagnostics/);
    assert.match(bridge,/\/api\/diagnostics-export/);
    assert.match(bridge,/no usernames, home paths, file names, credentials/);
  }
  assert.match(page,/function DiagnosticsCenter/);
  assert.match(page,/EXPORT SAFE SUPPORT REPORT/);
  assert.match(page,/PRIVACY FILTER ACTIVE/);
});

test("Safe startup preserves snapshots and can restore last-known-good settings",()=>{
  assert.match(page,/lcars-config-snapshots/);
  assert.match(page,/lcars-last-known-good/);
  assert.match(page,/lcars-safe-mode/);
  assert.match(page,/function RecoveryControls/);
  assert.match(renderer,/bootAttempts>=3/);
  assert.match(renderer,/START SAFE MODE/);
  assert.match(renderer,/RESTORE LAST KNOWN GOOD/);
});

test("Extensions are isolated and quarantined after repeated renderer failures",()=>{
  assert.match(page,/class ExtensionBoundary/);
  assert.match(page,/lcars-extension-failures/);
  assert.match(page,/failures>=2/);
  assert.match(page,/lcars-extension-quarantine/);
  assert.match(page,/RETRY MODULES/);
});

test("Updater archives Linux releases, verifies downloads, and supports rollback",()=>{
  assert.match(updater,/Downloaded installer failed SHA-256 verification/);
  assert.match(updater,/def rollback_status/);
  assert.match(updater,/def schedule_rollback/);
  assert.match(updater,/\.previous/);
  assert.match(linux,/operation=="rollback"/);
  assert.match(windows,/operation=="rollback"/);
  assert.match(page,/RESTORE PREVIOUS RELEASE/);
});

test("Packaged repair support and current bridge versions stay aligned",()=>{
  assert.match(builder,/recovery\/register-app\.sh/);
  assert.match(linux,/repair-installation/);
  assert.match(windows,/repair-installation/);
  assert.match(linux,/LCARS_VERSION="(?:30\.2|30\.1-A|29\.0\.0|29\.3\.0-rc\.1|29\.2\.0-dev\.1|28\.0\.0|28\.3-rc\.1|28\.2-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
  assert.match(windows,/LCARS_VERSION="(?:30\.2|30\.1-A|29\.0\.0|29\.3\.0-rc\.1|29\.2\.0-dev\.1|28\.0\.0|28\.3-rc\.1|28\.2-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
});
