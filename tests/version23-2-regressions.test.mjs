import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
const renderer = fs.readFileSync(new URL("../desktop/renderer.tsx", import.meta.url), "utf8");
const windows = fs.readFileSync(new URL("../windows/lcars_bridge_windows.py", import.meta.url), "utf8");
const linux = fs.readFileSync(new URL("../local/lcars_bridge.py", import.meta.url), "utf8");
const updater = fs.readFileSync(new URL("../shared/lcars_updater.py", import.meta.url), "utf8");
const extensionHost = fs.readFileSync(new URL("../shared/lcars_extensions.py", import.meta.url), "utf8");
const documents = fs.readFileSync(new URL("../shared/lcars_documents.py", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../desktop/main.cjs", import.meta.url), "utf8");

test("a missing Windows compatibility endpoint cannot black-screen the renderer", () => {
  assert.match(renderer, /compatFallback/);
  assert.match(renderer, /restrictions:\s*\[\]/);
  assert.match(renderer, /api\/compat/);
});

test("document workspace embeds safe formats and detaches into a native window", () => {
  assert.match(page, /function DocumentWorkspace/);
  assert.match(page, /DETACH ↗/);
  assert.match(page, /OPEN WITH SYSTEM DEFAULT/);
  assert.match(documents, /\.docx/);
  assert.match(documents, /\.odt/);
  assert.match(documents, /application\/pdf/);
  assert.match(documents, /temporary\.replace\(path\)/);
  assert.match(main, /LCARS Detached Workspace/);
  assert.match(main, /nodeIntegration:false/);
});

test("packaged startup audio is bootstrapped by Electron and remains testable", () => {
  assert.match(main, /startupAudioBootstrap/);
  assert.match(main, /new URL\('assets\/sounds\/power-up\.mp3'/);
  assert.match(main, /autoplay-policy/);
  assert.match(page, /TEST POWER-UP AUDIO/);
  assert.match(page, /lcars-startup-audio-result/);
});

test("Extension API v3 is declarative, permissioned, namespaced, and backward compatible with v2", () => {
  assert.match(extensionHost, /API_VERSION=3/);
  assert.match(extensionHost, /SUPPORTED_API_VERSIONS=\{2,3\}/);
  assert.match(extensionHost, /PLACEMENTS=/);
  assert.match(extensionHost, /PRIMITIVES=/);
  assert.match(extensionHost, /CAPABILITIES=/);
  assert.match(extensionHost, /extension_state/);
  assert.match(extensionHost, /data\.get\("schema"\)==1/);
  assert.match(page, /function DeclarativeExtension/);
  assert.match(page, /api\/extension-state/);
});

test("Ctrl+Number is captured before terminal input while plain numbers navigate outside editors", () => {
  assert.match(page, /e\.ctrlKey\|\|!shortcutTargetIsEditable\(e\.target\)/);
  assert.match(page, /addEventListener\("keydown", key, true\)/);
  assert.match(page, /input, textarea, select/);
});

test("background update failures are silent while manual checks report errors", () => {
  assert.match(page, /api\/lcars-update/);
  assert.match(page, /\.catch\(\(\) => \{\}\)/);
  assert.match(page, /GitHub update service could not be reached/);
  for (const bridge of [linux, windows]) {
    assert.match(bridge, /"silent":True/);
    assert.match(bridge, /download_update/);
    assert.match(bridge, /schedule_install/);
  }
  assert.match(updater, /SHA-256 checksum/);
  assert.match(updater, /_platform_asset/);
  assert.match(updater, /\.appimage/);
  assert.match(updater, /\.exe/);
});

test("system telemetry refreshes and ignores malformed meter payloads", () => {
  assert.match(page, /const getSystem/);
  assert.match(page, /Array\.isArray\(d\.meters\)/);
  assert.match(page, /setInterval\(getSystem,\s*2000\)/);
  assert.match(page, /clearInterval\(systemTimer\)/);
});

test("Windows telemetry has native fallbacks when psutil or vendor tools are absent", () => {
  assert.match(windows, /def windows_system_fallback/);
  assert.match(windows, /Get-CimInstance Win32_Processor/);
  assert.match(windows, /TotalVisibleMemorySize/);
  assert.match(windows, /Win32_LogicalDisk/);
  assert.match(windows, /GPU Engine\(\*\)/);
  assert.match(windows, /max\(0,min\(100/);
  assert.match(windows, /if psutil else int\(fallback\.get\("cpu"\)/);
});
