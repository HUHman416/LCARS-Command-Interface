import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const layout = read("app/layout.tsx");
const renderer = read("desktop/renderer.tsx");
const packageJson = JSON.parse(read("package.json"));
const linux = read("local/lcars_bridge.py");
const windows = read("windows/lcars_bridge_windows.py");
const developmentWorkflow = read(".github/workflows/v26-3-test.yml");
const stableWorkflow = read(".github/workflows/v26-stable.yml");

test("26.3 RC and Version 26 stable identities remain explicit", () => {
  assert.ok(["28.1.0-dev.1", "27.2.1-dev.1", "27.2.0-dev.1", "27.1.1-dev.1", "26.3.0-dev.1", "26.0.0"].includes(packageJson.version));
  assert.match(page, /const LCARS_VERSION="(?:28\.1-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
  assert.match(linux, /LCARS_VERSION="(?:28\.1-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
  assert.match(windows, /LCARS_VERSION="(?:28\.1-dev\.1|27\.(?:2\.[01]|1\.1)-dev\.1|26\.(?:3\.0-dev\.1|0\.0))"/);
  assert.doesNotMatch(page, /VERSION 25 ENGINEERING OPERATIONS|AUTO-25|ENG-25|COM-25|LOG-25/);
});

test("configuration backup covers workspace and community repository state", () => {
  assert.match(page, /schema:\s*(?:28|27|26)/);
  assert.match(page, /version:\s*LCARS_VERSION/);
  for (const field of ["defaultWorkstation", "selectedPlayer", "popupLayout", "pagePeeks", "moduleSources"]) assert.match(page, new RegExp(`${field}:`));
  assert.match(page, /restoreModuleSources/);
  assert.match(page, /operation:\"add\"/);
  assert.match(page, /command:\"restore\",layouts:importedLayouts/);
});

test("upgraded operators receive a one-time current-version orientation", () => {
  assert.match(page, /lcars-whats-new-v28/);
  assert.match(page, /WELCOME TO VERSION 28/);
  assert.match(page, /WHAT'S NEW IN VERSION 28/);
  assert.match(page, /PADD FLEET COMMAND/);
  assert.match(page, /SAFE REMOTE OPERATIONS/);
});

test("Version 26.3 styling is the final renderer layer", () => {
  assert.match(layout, /v26-2\.css[\s\S]*v26-3\.css/);
  assert.match(renderer, /v26-2\.css[\s\S]*v26-3\.css/);
});

test("development and stable workflows package both operating systems with checksums", () => {
  assert.match(developmentWorkflow, /branches:\s*\[26\.3\]/);
  assert.match(developmentWorkflow, /gh release create v26\.3/);
  assert.match(developmentWorkflow, /--prerelease/);
  assert.match(stableWorkflow, /branches:\s*\[26-stable\]/);
  assert.match(stableWorkflow, /LCARS-Windows-Setup-v26\.exe/);
  assert.match(stableWorkflow, /LCARS-Command-Interface-v26-x86_64\.AppImage/);
  assert.match(stableWorkflow, /sha256sum --check SHA256SUMS\.txt/);
  assert.match(stableWorkflow, /gh release create v26/);
  assert.doesNotMatch(stableWorkflow, /--prerelease/);
});
