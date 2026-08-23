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
  assert.match(patcher,/nextTop=north\?baseTop\+start\.height-height:baseTop/);
});

test("vertical resizing uses viewport coordinates for fixed dialogs and pauses observer clamping",()=>{
  assert.match(patcher,/baseLeft=floating\?startLeft:start\.left,baseTop=floating\?startTop:start\.top/);
  assert.match(patcher,/element\.dataset\.lcarsResizing="1"/);
  assert.match(patcher,/element\.dataset\.lcarsResizing!=="1"/);
  assert.match(patcher,/delete element\.dataset\.lcarsResizing/);
});

test("vertical resize math and CSS share the same effective maximum height",()=>{
  assert.match(css,/\.resizable-popup\s*\{[^}]*max-height:\s*calc\(100vh - 16px\)\s*!important/s);
  assert.match(patcher,/computedMaxHeight=Number\.parseFloat\(getComputedStyle\(element\)\.maxHeight\)/);
  assert.match(patcher,/cssMaxHeight=Number\.isFinite\(computedMaxHeight\)\?computedMaxHeight:window\.innerHeight-16/);
  assert.match(patcher,/Math\.min\(window\.innerHeight-16,availableHeight,cssMaxHeight\)/);
});

test("centered dialogs are frozen before resize instead of being re-centered",()=>{
  assert.match(patcher,/if\(!floating\)element\.style\.position="fixed"/);
  assert.match(patcher,/element\.style\.right="auto"/);
  assert.match(patcher,/element\.style\.bottom="auto"/);
});

test("hotfix keeps usable top and bottom resize targets",()=>{
  assert.match(css,/\.popup-resize-edge-n,\s*\.popup-resize-edge-s\s*\{[^}]*height:\s*14px\s*!important/);
  assert.match(css,/\.popup-resize-edge-s\s*\{\s*bottom:\s*0\s*!important/);
});
