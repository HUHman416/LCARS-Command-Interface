import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css=readFileSync("app/v25-b-compact.css","utf8");
const patcher=readFileSync("scripts/apply-v25-b-compact.mjs","utf8");
const renderer=readFileSync("desktop/renderer.tsx","utf8");
const pkg=JSON.parse(readFileSync("package.json","utf8"));

test("Version 25-B compact layer loads after the proven hotfix",()=>{
  assert.match(renderer,/v25-hotfix-v2\.css";\s*import "\.\.\/app\/v25-b-compact\.css";/s);
  assert.equal(pkg.scripts["predesktop:build"],"node scripts/apply-v25-hotfix-v2.mjs");
  assert.equal(pkg.scripts["desktop:build"],"node scripts/apply-v25-b-compact.mjs && vite build --config desktop/vite.config.ts");
});

test("default opening height is no longer the resize floor",()=>{
  assert.match(css,/\.resizable-popup\s*\{[^}]*--lcars-popup-min-height:\s*96px[^}]*min-height:\s*0\s*!important/s);
  assert.match(css,/\.speed-dial-page-peek\s*\{[^}]*--lcars-popup-min-height:\s*96px/s);
  assert.match(css,/\.notice-history\s*\{[^}]*--lcars-popup-min-height:\s*120px/s);
  assert.match(css,/\.tray-drawer\s*\{[^}]*--lcars-popup-min-height:\s*112px/s);
  assert.match(css,/\.display-menu\s*\{[^}]*--lcars-popup-min-height:\s*112px/s);
});

test("stored and dragged heights use the CSS minimum instead of component default minHeight",()=>{
  assert.match(patcher,/fitSize=\(width:number,height:number\)/);
  assert.match(patcher,/getPropertyValue\("--lcars-popup-min-height"\)/);
  assert.match(patcher,/Math\.min\(effectiveMinHeight,maxHeight\),height/);
  assert.match(patcher,/const resizeOriginal = '    const effectiveMinHeight=Math\.max\(minHeight,cssMinHeight\);'/);
  assert.match(patcher,/const resizePatched = '    const effectiveMinHeight=Number\.isFinite\(computedCssMinHeight\)\?computedCssMinHeight:minHeight;'/);
  assert.match(patcher,/source\.replace\(resizeOriginal, resizePatched\)/);
});

test("compact content regions can yield vertical space to the shell",()=>{
  assert.match(css,/\.speed-dial-page-peek > main,[\s\S]*\.tray-scroll-region\s*\{[^}]*min-height:\s*0\s*!important/s);
});

test("Version 25-B is the public runtime label without invalidating package semver",()=>{
  assert.equal(pkg.version,"25.2.0");
  assert.match(patcher,/LCARS_VERSION=\"25\.2\.0\"/);
  assert.match(patcher,/LCARS_VERSION=\"25-B\"/);
  assert.match(patcher,/local\/lcars_bridge\.py/);
  assert.match(patcher,/windows\/lcars_bridge_windows\.py/);
});
