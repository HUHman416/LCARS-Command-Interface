import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const renderer=readFileSync("desktop/renderer.tsx","utf8");
const css=readFileSync("app/v25-hotfix-v2.css","utf8");

test("V25 hotfix v2 intercepts native popup resize handles before the old handler",()=>{
  assert.match(renderer,/beginPopupResizeHotfix/);
  assert.match(renderer,/window\.addEventListener\("pointerdown",beginPopupResizeHotfix,true\)/);
  assert.match(renderer,/event\.stopImmediatePropagation\(\)/);
  for(const direction of ["n","e","s","w","nw","ne","sw","se"])assert.match(renderer,new RegExp(`return "${direction}"`));
});

test("vertical popup resizing anchors the opposite edge and stays inside the viewport",()=>{
  assert.match(renderer,/north\?start\.bottom-8:south\?window\.innerHeight-start\.top-8/);
  assert.match(renderer,/requestedHeight=north\?start\.height-dy:south\?start\.height\+dy:start\.height/);
  assert.match(renderer,/if\(floating&&north\)popup\.style\.top=`\$\{startTop\+start\.height-height\}px`/);
  assert.match(renderer,/popup\.style\.bottom="auto"/);
});

test("hotfix keeps known popup minimums and usable top and bottom hit targets",()=>{
  assert.match(css,/\.speed-dial-page-peek\s*\{[^}]*--lcars-popup-min-height:\s*300px/);
  assert.match(css,/\.notice-history\s*\{[^}]*--lcars-popup-min-height:\s*360px/);
  assert.match(css,/\.popup-resize-edge-n,\s*\.popup-resize-edge-s\s*\{[^}]*height:\s*14px\s*!important/);
  assert.match(css,/\.popup-resize-edge-s\s*\{\s*bottom:\s*0\s*!important/);
});
