import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const connected = read("app/v27-connected.tsx");
const css = read("app/v27-2.css");
const updater = read("shared/lcars_updater.py");
const android = read("mobile/android/app/src/main/java/com/lcars/padd/MainActivity.java");
const renderer = read("desktop/renderer.tsx");
const workflow = read(".github/workflows/v27-2-development.yml");

test("Version 27.2.1 uses styled focused Settings and Updates consoles in both renderers", () => {
  assert.match(page, /type SettingsArea = "interface" \| "workspace" \| "connected" \| "system"/);
  assert.match(page, /type UpdateArea = "releases" \| "modules" \| "diagnostics"/);
  assert.match(page, /settingsArea==="interface"/);
  assert.match(page, /settingsArea==="workspace"/);
  assert.match(page, /settingsArea==="connected"/);
  assert.match(page, /settingsArea==="system"/);
  assert.match(page, /area==="releases"/);
  assert.match(page, /area==="modules"/);
  assert.match(page, /area==="diagnostics"/);
  assert.match(css, /\.settings-area-tabs/);
  assert.match(css, /\.update-area-tabs/);
  assert.match(css, /position: sticky/);
  assert.match(css, /border-left: 42px solid var\(--area-accent\)/);
  assert.match(css, /--tab-accent/);
  assert.match(page, /aria-current=\{settingsArea===area\?"page":undefined\}/);
  const connectedCss = renderer.indexOf('import "../app/v27-1.css"');
  const consoleCss = renderer.indexOf('import "../app/v27-2.css"');
  assert.ok(connectedCss >= 0 && consoleCss > connectedCss);
});

test("PADD pairing is guided and Android owns the companion interface", () => {
  assert.match(connected, /01[\s\S]*INSTALL THE STANDALONE APP/);
  assert.match(connected, /02[\s\S]*ARM PAIRING/);
  assert.match(connected, /03[\s\S]*ENTER STATION \+ CODE/);
  assert.match(connected, /LCARS-PADD-Companion-v27\.2\.1-Android\.apk/);
  assert.match(android, /HttpURLConnection/);
  assert.match(android, /api\/padd\/pair/);
  assert.match(android, /api\/padd\/state/);
  assert.match(android, /api\/padd\/action/);
  assert.match(android, /station-token/);
  assert.match(android, /setOnApplyWindowInsetsListener/);
  assert.match(android, /WindowInsets\.Type\.systemBars\(\).*WindowInsets\.Type\.ime\(\)/);
  assert.match(android, /GradientDrawable/);
  assert.match(android, /sans-serif-condensed/);
  assert.doesNotMatch(android, /android\.webkit|WebView/);
});

test("update downloads lock in the renderer and serialize in the bridge", () => {
  assert.match(page, /lcars-update-download-locked-v27/);
  assert.match(page, /operationLock=useRef\(false\)/);
  assert.match(page, /DOWNLOAD LOCKED · RESTART LCARS/);
  assert.match(page, /primaryDisabled=\{downloadBlocked\}/);
  assert.match(updater, /_DOWNLOAD_LOCK = threading\.Lock\(\)/);
  assert.match(updater, /acquire\(blocking=False\)/);
  assert.match(updater, /_DOWNLOAD_CACHE/);
  assert.match(updater, /already downloaded and verified/);
});

test("Version 27.2.1 Development release includes all three platforms", () => {
  assert.match(workflow, /branches: \[27\.1\]/);
  assert.match(workflow, /needs: \[linux, windows, android\]/);
  assert.match(workflow, /gh release (?:view|create) v27\.2\.1/);
  assert.match(workflow, /LCARS-PADD-Companion-v27\.2\.1-Android\.apk/);
});
