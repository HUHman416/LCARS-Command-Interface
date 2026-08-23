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
  assert.match(patcher,/nextLeft=west\?startLeft\+start\.width-width:startLeft/);
  assert.match(patcher,/nextTop=north\?startTop\+start\.height-height:startTop/);
});

test("centered dialogs are frozen before resize instead of being re-centered",()=>{
  assert.match(patcher,/if\(!floating\)/);
  assert.match(patcher,/element\.style\.position="fixed"/);
  assert.match(patcher,/element\.style\.right="auto"/);
  assert.match(patcher,/element\.style\.bottom="auto"/);
});

test("hotfix keeps usable top and bottom resize targets",()=>{
  assert.match(css,/\.popup-resize-edge-n,\s*\.popup-resize-edge-s\s*\{[^}]*height:\s*14px\s*!important/);
  assert.match(css,/\.popup-resize-edge-s\s*\{\s*bottom:\s*0\s*!important/);
});
