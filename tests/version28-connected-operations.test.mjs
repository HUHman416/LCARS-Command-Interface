import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const connected = read("app/v28-connected.tsx");
const css = read("app/v28.css");
const padd = read("shared/lcars_padd.py");
const webPadd = read("padd/app.js");
const webShell = read("padd/index.html");
const android = read("mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java");
const widget = read("mobile/android/app/src/main/java/com/lcars/padd/PaddWidgetProvider.java");
const manifest = read("mobile/android/app/src/main/AndroidManifest.xml");
const workflow = read(".github/workflows/v28-development.yml");

test("Version 28 identity and Connected Operations renderer are wired", () => {
  assert.match(read("package.json"), /"version": "28\.2\.0-dev\.1"/);
  assert.match(page, /LCARS_VERSION="28\.2-dev\.1"/);
  assert.match(page, /ConnectedOperationsPanel/);
  assert.match(page, /api\/padd-events/);
  assert.match(page, /activeWorkstation:activeProfile/);
  assert.match(page, /quickActions/);
  assert.match(page, /handoff/);
  assert.match(connected, /PADD FLEET COMMAND/);
  assert.match(connected, /PADD FLEET.*APPROVALS.*ACTIVITY.*DIAGNOSTICS/s);
  assert.match(css, /\.connected-operations-panel/);
  assert.match(read("desktop/renderer.tsx"), /v28\.css/);
});

test("PADD fleet uses revocable per-device policy and explicit approvals", () => {
  for (const token of ["PERMISSION_NAMES", "APPROVAL_ACTIONS", "DEFAULT_WIDGETS", "heartbeat", "mobile_preferences", "pop_events", "clipboardEnabled", "autoApprove", "proximity", "identify"]) {
    assert.match(padd, new RegExp(token));
  }
  assert.match(padd, /approval-requested/);
  assert.match(padd, /Text clipboard sharing is disabled/);
  assert.match(padd, /value = _clean_clipboard\(value\)/);
  assert.match(connected, /TEXT CLIPBOARD/);
  assert.match(connected, /AUTO-APPROVE/);
  assert.match(connected, /PROXIMITY PROFILE/);
  assert.match(connected, /CONNECTED WORKSTATION/);
  assert.match(connected, /IDENTIFY/);
});

test("native and browser PADDs expose the Connected Operations surfaces", () => {
  assert.match(android, /STATUS.*MEDIA.*COMMS.*CMD.*MORE/s);
  assert.match(android, /api\/padd\/heartbeat/);
  assert.match(android, /api\/padd\/preferences/);
  assert.match(android, /POST_NOTIFICATIONS/);
  assert.match(android, /VibratorManager/);
  assert.match(android, /PaddWidgetProvider\.updateAll/);
  assert.match(widget, /AppWidgetProvider/);
  assert.match(manifest, /PaddWidgetProvider/);
  assert.match(manifest, /POST_NOTIFICATIONS/);
  assert.match(webPadd, /lcars-padd-token-v28/);
  assert.match(webPadd, /api\/padd\/heartbeat/);
  assert.match(webPadd, /clipboard-request/);
  assert.match(webShell, /COMMUNICATIONS/);
  assert.match(webShell, /QUICK ACTIONS/);
  assert.match(webShell, /dismiss-all-communications/);
  assert.match(webPadd, /player:mediaTarget,command:button\.dataset\.value/);
  assert.doesNotMatch(webShell, /data-value="(?:terminal|files|shutdown|restart)"/);
});

test("Version 28.2 device-testing fixes keep navigation, media, and communications usable", () => {
  assert.match(android, /tabButton\("CMD"/);
  assert.match(android, /showConsole\(false\)/);
  assert.match(android, /linkBadge\.setBackground\(shape\(linkColor/);
  assert.match(android, /fittedLabel\(value/);
  assert.match(android, /mediaRequest\(playerId, "play-pause"\)/);
  assert.match(android, /"notice-dismiss-all"/);
  assert.match(padd, /"notice-dismiss-all": "operator"/);
  assert.match(page, /expiresAt/);
  assert.match(page, /command\.action==="notice-dismiss-all"/);
  const toolbar = page.indexOf('className="media-quick-strip media-command-toolbar"');
  const console = page.indexOf('className="media-console"', toolbar);
  assert.ok(toolbar > 0 && console > toolbar, "media toolbar should be above the console");
  assert.match(read("app/v24-1.css"), /\.media-command-toolbar/);
});

test("Version 28.2 prerelease waits for all platform validation", () => {
  assert.match(workflow, /branches: \[v28-development\]/);
  assert.match(workflow, /needs: \[linux, windows, android\]/);
  assert.match(workflow, /version28-connected-operations\.test\.mjs/);
  assert.match(workflow, /LCARS-PADD-Companion-v28\.2-Android\.apk/);
  assert.match(workflow, /sha256sum --check SHA256SUMS\.txt/);
  assert.match(workflow, /gh release (?:view|create) v28\.2/);
  assert.match(workflow, /--prerelease/);
});
