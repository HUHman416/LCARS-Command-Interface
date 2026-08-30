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
const android = read("mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java") + read("mobile/android/app/src/main/java/com/lcars/padd/HomeActivity.java") + read("mobile/android/app/src/main/java/com/lcars/padd/CompanionDock.java");
const widget = read("mobile/android/app/src/main/java/com/lcars/padd/PaddWidgetProvider.java");
const manifest = read("mobile/android/app/src/main/AndroidManifest.xml");
const workflow = read(".github/workflows/v28-development.yml");
const stableWorkflow = read(".github/workflows/v28-stable.yml");

test("Version 28 identity and Connected Operations renderer are wired", () => {
  assert.match(read("package.json"), /"version": "(?:29\.3\.0-rc\.1|29\.2\.0-dev\.1|28\.0\.0)"/);
  assert.match(page, /LCARS_VERSION="(?:29\.3\.0-rc\.1|29\.2\.0-dev\.1|28\.0\.0)"/);
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

test("Version 28.3 PADD controls keep navigation, media, communications, and recovery usable", () => {
  assert.match(android, /\{"CMD","command"\}/);
  assert.match(android, /new CompanionDock\(this,stationStore\)/);
  assert.match(android, /setIncludeFontPadding\(false\)/);
  assert.match(android, /mediaValue\(id,"play-pause"\)/);
  assert.match(android, /MEDIA_TARGET/);
  assert.match(android, /addMediaSourceList/);
  assert.match(android, /CONNECTION RECOVERY/);
  assert.match(android, /"notice-dismiss-all"/);
  assert.match(padd, /"notice-dismiss-all": "operator"/);
  assert.match(page, /expiresAt/);
  assert.match(page, /command\.action==="notice-dismiss-all"/);
  const toolbar = page.indexOf('className="media-quick-strip media-command-toolbar"');
  const console = page.indexOf('className="media-console"', toolbar);
  assert.ok(toolbar > 0 && console > toolbar, "media toolbar should be above the console");
  assert.match(read("app/v24-1.css"), /\.media-command-toolbar/);
  assert.match(webPadd, /data-media-target/);
  assert.match(webShell, /compatibility-state/);
});

test("Version 28.3 release candidate waits for all platform validation", () => {
  assert.match(workflow, /branches: \[v28-development\]/);
  assert.match(workflow, /needs: \[linux, windows, android\]/);
  assert.match(workflow, /version28-connected-operations\.test\.mjs/);
  assert.match(workflow, /LCARS-PADD-Companion-v28\.3-Android\.apk/);
  assert.match(workflow, /sha256sum --check SHA256SUMS\.txt/);
  assert.match(workflow, /gh release (?:view|create) v28\.3/);
  assert.match(workflow, /--prerelease/);
});

test("Version 28 Stable publishes a major-only cross-platform release", () => {
  assert.match(stableWorkflow, /branches: \[28-stable\]/);
  assert.match(stableWorkflow, /needs: \[linux, windows, android\]/);
  assert.match(stableWorkflow, /LCARS-PADD-Companion-v28-Android\.apk/);
  assert.match(stableWorkflow, /gh release (?:view|create) v28/);
  assert.match(stableWorkflow, /LCARS Command Interface Version 28/);
  assert.doesNotMatch(stableWorkflow, /v28\.3/);
  assert.doesNotMatch(stableWorkflow, /--prerelease(?:\s|$)/);
});

test("Version 28.3 closes the Connected Operations release-candidate checklist", () => {
  for (const token of ["APPROVAL_TTL", "DEFAULT_NOTIFICATIONS", "PERMISSION_PRESETS", "copy-settings", "client-outdated", "request-expired"]) {
    assert.match(padd, new RegExp(token));
  }
  assert.match(connected, /PERMISSION PRESET/);
  assert.match(connected, /COPY POLICY FROM/);
  assert.match(connected, /NOTIFICATIONS/);
  assert.match(connected, /EXPORT PRIVATE DIAGNOSTICS/);
  assert.match(connected, /CONNECTION RECOVERY/);
  assert.match(connected, /EXPIRES IN/);
});

test("Display Matrix uses six researched structural LCARS families", () => {
  for (const token of ["Enterprise-D", "Voyager", "Enterprise-E", "Picard Starfleet", "Cerritos", "Defiant"]) assert.match(page, new RegExp(token));
  const globals = read("app/globals.css");
  for (const selector of ["theme-voyager", "theme-nemesis", "theme-picard", "theme-lower-decks", "theme-defiant"]) assert.match(globals, new RegExp(`\\.${selector}`));
  assert.match(globals, /researched LCARS families/);
  assert.match(page, /value === "padd" \? "defiant"/);
  assert.doesNotMatch(page, /id:"padd"/);
  assert.match(globals, /\.theme-voyager \.brand,[\s\S]*\.theme-lower-decks \.brand[\s\S]*border-radius: 46px 3px 3px 3px/);
  assert.match(globals, /\.theme-defiant \.shell[\s\S]*grid-template-columns: 166px minmax\(0, 1fr\)/);
  const reference = read("docs/LCARS-THEME-REFERENCE.md");
  assert.match(reference, /Explicit exclusions/);
  assert.match(reference, /La Sirena/);
  assert.match(reference, /Cardassian/);
  assert.match(reference, /Defiant/);
});
