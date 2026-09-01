import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("app/page.tsx", "utf8");
const core = readFileSync("app/v26-core.ts", "utf8");
const css = readFileSync("app/v26.css", "utf8")+readFileSync("app/v30.css", "utf8");
const renderer = readFileSync("desktop/renderer.tsx", "utf8");
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

test("Version 26 popup workspace persists full window geometry", () => {
  assert.match(core, /lcars-popup-layouts-v26/);
  assert.match(core, /left\?: number/);
  assert.match(core, /top\?: number/);
  assert.match(core, /minimized\?: boolean/);
  assert.match(core, /snapPopupGeometry/);
  assert.match(core, /arrangePopupWindows/);
  assert.match(page, /workspace-window-controls/);
  assert.match(page, /beginDrag/);
  assert.match(page, /direction\.includes\("n"\)/);
  assert.match(page, /direction\.includes\("s"\)/);
});

test("Version 26 supports multiple independently pinned Page Peeks", () => {
  assert.match(page, /speedDialPages\.map/);
  assert.match(page, /popupKey=\{`speed-dial-page-peek:\$\{peek\.id\}`\}/);
  assert.match(page, /savePagePeeks/);
  assert.match(page, /pagePeeks\?: PagePeekState\[\]/);
  assert.match(page, /popupLayout\?: PopupLayoutMap/);
});

test("Workstations capture and restore the popup workspace", () => {
  assert.match(page, /pagePeeks:speedDialPages\.map/);
  assert.match(page, /popupLayout:readPopupLayouts\(\)/);
  assert.match(page, /profile\.popupLayout/);
  assert.match(page, /command:"restore"/);
});

test("PADD navigation is touch-first in portrait and landscape", () => {
  assert.match(page, /PADD navigation/);
  assert.match(page, /mobile-command-sheet/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /@media \(pointer: coarse\)/);
  assert.match(css, /orientation: landscape/);
  assert.match(css, /\.mobile-command-bar/);
  assert.match(css, /\.system-tray\.speed-dial/);
});

test("Operations uses one quiet accessible scrolling feed", () => {
  assert.match(page, /className="operations-feed" tabIndex=\{0\}/);
  assert.match(css, /\.operations-feed\{[^}]*overflow:auto/s);
  assert.match(css, /scrollbar-width: none/);
  assert.match(css, /::-webkit-scrollbar/);
});

test("Version 26.3 styling loads last on desktop", () => {
  assert.ok(["30.8.1-dev.1","30.7.0-dev.1","30.6.0-dev.1","30.4.0-dev.1","30.3.0-dev.1","30.2.0-dev.1","30.1.0-dev.2","29.0.0","29.3.0-rc.1","29.2.0-dev.1","28.0.0","28.3.0-rc.1","28.2.0-dev.1","27.2.1-dev.1","27.2.0-dev.1","27.1.1-dev.1","26.3.0-dev.1","26.0.0"].includes(packageJson.version));
  const repository = renderer.indexOf('import "../app/v26-1.css"');
  const workspace = renderer.indexOf('import "../app/v26.css"');
  const current = renderer.indexOf('import "../app/v26-3.css"');
  assert.ok(repository >= 0 && workspace > repository && current > workspace);
});
