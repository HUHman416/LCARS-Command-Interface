import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer=readFileSync("desktop/renderer.tsx","utf8");
const css=readFileSync("app/v25-hotfix-v2.css","utf8");
const patcher=readFileSync("scripts/apply-v25-hotfix-v2.mjs","utf8");
const pkg=JSON.parse(readFileSync("package.json","utf8"));

test("V25 hotfix v2 patches ResizablePopup before every desktop build",()=>{
  assert.equal(pkg.scripts["predesktop:build"],"node scripts/apply-v25-hotfix-v2.mjs");
  assert.match(patcher,/V25 ResizablePopup resize handler was not found/);
  assert.doesNotMatch(renderer,/beginPopupResizeHotfix/);
});

test("each popup edge has independent source-level resize geometry",()=>{
  assert.match(patcher,/requestedWidth=west\?start\.width-dx:east\?start\.width\+dx:start\.width/);
  assert.match(patcher,/requestedHeight=north\?start\.height-dy:south\?start\.height\+dy:start\.height/);
  assert.match(patcher,/availableWidth=west\?start\.right-8:east\?window\.innerWidth-start\.left-8/);
  assert.match(patcher,/availableHeight=north\?start\.bottom-8:south\?window\.innerHeight-start\.top-8/);
  assert.match(patcher,/nextLeft=west\?baseLeft\+start\.width-width:baseLeft/);
});

test("north and south resize anchor to the opposite vertical edge",()=>{
  assert.match(patcher,/verticalBottom=wasFixed\?window\.innerHeight-start\.bottom/);
  assert.match(patcher,/if\(north\)\{/);
  assert.match(patcher,/element\.style\.top="auto"/);
  assert.match(patcher,/element\.style\.bottom=`\$\{verticalBottom\}px`/);
  assert.match(patcher,/element\.style\.top=`\$\{baseTop\}px`/);
  assert.doesNotMatch(patcher,/nextTop=north/);
  assert.match(patcher,/const finalTop=wasFixed\?finalRect\.top/);
  assert.match(patcher,/element\.style\.bottom="auto"/);
});

test("vertical resizing pauses observer clamping",()=>{
  assert.match(patcher,/element\.dataset\.lcarsResizing="1"/);
  assert.match(patcher,/element\.dataset\.lcarsResizing!=="1"/);
  assert.match(patcher,/delete element\.dataset\.lcarsResizing/);
});

test("vertical resize math and CSS share effective height limits",()=>{
  assert.match(css,/\.resizable-popup\s*\{[^}]*max-height:\s*calc\(100vh - 16px\)\s*!important/s);
  assert.match(css,/\.speed-dial-page-peek\s*\{[^}]*--lcars-popup-min-height:\s*300px/s);
  assert.match(patcher,/computedMaxHeight=Number\.parseFloat\(computedStyle\.maxHeight\)/);
  assert.match(patcher,/computedCssMinHeight=Number\.parseFloat\(computedStyle\.getPropertyValue\("--lcars-popup-min-height"\)\)/);
  assert.match(patcher,/effectiveMinHeight=Math\.max\(minHeight,cssMinHeight\)/);
  assert.match(patcher,/Math\.min\(window\.innerHeight-16,availableHeight,cssMaxHeight\)/);
  assert.match(patcher,/Math\.min\(effectiveMinHeight,maxHeight\)/);
});

test("centered dialogs are frozen before resize instead of being re-centered",()=>{
  assert.match(patcher,/if\(!floating\)element\.style\.position="fixed"/);
  assert.match(patcher,/element\.style\.right="auto"/);
});

test("hotfix keeps usable top and bottom resize targets",()=>{
  assert.match(css,/\.popup-resize-edge-n,\s*\.popup-resize-edge-s\s*\{[^}]*height:\s*14px\s*!important/);
  assert.match(css,/\.popup-resize-edge-s\s*\{\s*bottom:\s*0\s*!important/);
});
