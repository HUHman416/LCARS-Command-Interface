import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("app/page.tsx");
const connected = read("app/v28-connected.tsx");
const css = read("app/v28.css");
const legacyCss = read("app/v27-1.css");
const linux = read("local/lcars_bridge.py");
const windows = read("windows/lcars_bridge_windows.py");
const padd = read("shared/lcars_padd.py");
const builder = read("electron-builder.yml");
const companion = read("padd/app.js");
const manifest = read("padd/manifest.webmanifest");

test("Connected settings remain explicit through the Version 28 migration", () => {
  assert.match(page, /LCARS_VERSION="28\.1-dev\.1"/);
  assert.match(page, /28\.1 DEV/);
  assert.match(page, /ConnectedOperationsPanel/);
  assert.match(connected, /PADD FLEET COMMAND/);
  assert.match(connected, /VIEWER.*OPERATOR.*COMMAND/s);
  assert.match(css, /\.connected-operations-panel/);
});

test("PADD pairing is separate, role-gated, revocable, and packaged", () => {
  for (const token of ["secrets.token_urlsafe", "tokenHash", "hmac.compare_digest", "expiresAt", "revoke", "ACTION_ROLES", "0.0.0.0"]) assert.match(padd, new RegExp(token.replaceAll(".", "\\.")));
  assert.match(padd, /terminal, file, process, or power|ACTION_ROLES/);
  assert.match(linux, /PADD\.start\(\)/);
  assert.match(windows, /PADD\.start\(\)/);
  assert.match(builder, /shared\/lcars_padd\.py[\s\S]*from: padd/);
  assert.match(manifest, /"display": "standalone"/);
  assert.match(companion, /lcars-padd-token-v28/);
  assert.doesNotMatch(read("padd/index.html"), /data-value="(?:terminal|files)"/);
});

test("pairing can be armed while the disabled-by-default listener is offline", () => {
  assert.match(connected, /disabled=\{busy==="start"\}/);
  assert.doesNotMatch(connected, /busy==="start"\|\|!status\?\.online/);
  assert.match(padd, /self\.start\(force=True\)/);
});

test("desktop and companion exchange only queued allowlisted commands", () => {
  assert.match(page, /api\/padd-sync/);
  assert.match(page, /api\/padd-commands/);
  assert.match(page, /command\.action==="routine"/);
  assert.match(padd, /Unknown LCARS page/);
  assert.match(padd, /Unknown media command/);
});

test("Linux tray exposes native StatusNotifier context actions", () => {
  assert.match(linux, /org\.kde\.StatusNotifierItem\.\{method\}/);
  assert.match(linux, /"context":"ContextMenu"/);
  assert.match(linux, /menu_path=property_value\(service,path,"Menu"\)/);
  assert.match(page, /onContextMenu=/);
  assert.match(page, /RIGHT-CLICK FOR APP ACTIONS/);
  assert.match(page, /Open \$\{item\.name\} context actions/);
  assert.match(legacyCss, /\.tray-service-context/);
});
