import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("../app/page.tsx");
const center = read("../app/v31-portal.tsx");
const core = read("../app/v31-portal-core.ts");
const css = read("../app/v31.css");
const linux = read("../local/lcars_bridge.py");
const windows = read("../windows/lcars_bridge_windows.py");
const broker = read("../shared/lcars_intents.py");
const desktop = read("../desktop/main.cjs");
const builder = read("../electron-builder.yml");
const roadmap = read("../docs/VERSION-31-ROADMAP.md");
const memory = read("../docs/PROJECT-MEMORY.md");

test("Version 31.1 exposes a continuously numbered Portal Center", () => {
  assert.match(page, /const LCARS_VERSION="31\.3"/);
  assert.match(page, /\["portals", "09", "PORTALS"\]/);
  assert.match(page, /\["commissioning", "10", "COMMISSION"\]/);
  assert.match(page, /section === "portals" && <PortalCenter/);
  assert.match(page, /PORTALS <b>\{portalPending\}<\/b>/);
});

test("Portal Center covers request review, routes, validators, and contained layouts", () => {
  for (const phrase of ["INTENT QUEUE", "PLATFORM ADAPTERS", "ROUTING POLICY", "ROUTE VALIDATOR", "APPROVE", "DENY", "CHOOSE CURRENT FOLDER"]) assert.match(center, new RegExp(phrase));
  for (const kind of ["open-file", "save-file", "open-folder", "open-with", "authorize", "notification", "microphone", "camera", "screen-share", "print", "share"]) assert.match(core, new RegExp(`"${kind}"`));
  assert.match(css, /overflow:auto/);
  assert.match(css, /@media\(max-height:760px\)/);
  assert.match(css, /@media\(max-width:900px\)/);
});

test("both local bridges expose the shared bounded broker", () => {
  for (const source of [linux, windows]) {
    assert.match(source, /from lcars_intents import IntentBroker/);
    assert.match(source, /\/api\/portal-status/);
    assert.match(source, /\/api\/portal-request/);
    assert.match(source, /\/api\/portal-operation/);
    assert.match(source, /LCARS_VERSION="31\.3"/);
    assert.match(source, /LCARS_PORTAL_OPERATOR_TOKEN/);
    assert.match(source, /Operator authority is required for Portal Center changes/);
    assert.match(source, /Open With must use an installed LCARS application identity/);
  }
  assert.match(broker, /PROTECTED_KINDS/);
  assert.match(broker, /Portal file choices must remain inside/);
  assert.match(broker, /requestSeconds.*120/);
  assert.match(builder, /shared\/lcars_intents\.py/g);
});

test("Electron device access is routed through operator decisions", () => {
  assert.match(desktop, /requestPortalDecision/);
  assert.match(desktop, /setPermissionRequestHandler/);
  assert.match(desktop, /setDisplayMediaRequestHandler/);
  assert.match(desktop, /"screen-share"/);
  assert.match(desktop, /randomBytes\(32\)/);
  assert.match(desktop, /LCARS_PORTAL_OPERATOR_TOKEN:portalAuthority/);
  assert.match(desktop, /query\.set\("portalAuthority",portalAuthority\)/);
  assert.match(center, /authority = ""/);
  assert.doesNotMatch(desktop, /callback\(permission==="media"/);
});

test("the durable project memory preserves the deduplicated Version 31 sequence", () => {
  for (const milestone of ["31.1 Development", "31.2 Development", "31.3 Development", "31.4 Development", "31.5 Development", "31.6 Development", "31.7 Release Candidate"]) assert.match(roadmap, new RegExp(milestone.replace(".", "\\.")));
  assert.match(memory, /Read it before proposing or beginning a major milestone/);
  assert.match(memory, /Do not duplicate an existing capability/);
  assert.match(roadmap, /Version 30 is the current Stable release/);
});
