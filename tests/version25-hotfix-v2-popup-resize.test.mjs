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

test("north resize anchors from actual rendered height",()=>{
  assert.match(patcher,/renderedHeight=element\.getBoundingClientRect\(\)\.height/);
  assert.match(patcher,/nextTop=north\?baseTop\+start\.height-renderedHeight:baseTop/);
  assert.doesNotMatch(patcher,/nextTop=north\?baseTop\+start\.height-height:baseTop/);
});

test("vertical resizing uses viewport coordinates for fixed dialogs and pauses observer clamping",()=>{
  assert.match(patcher,/baseLeft=floating\?startLeft:start\.left,baseTop=floating\?startTop:start\.top/);
  assert.match(patcher,/element\.dataset\.lcarsResizing="1"/);
  assert.match(patcher,/element\.dataset\.lcarsResizing!=="1"/);
  assert.match(patcher,/delete element\.dataset\.lcarsResizing/);
});

test("popouts use lower synchronized vertical minimums",()=>{
  assert.match(css,/\.resizable-popup\s*\{[^}]*--lcars-popup-min-height:\s*140px/s);
  assert.match(css,/\.speed-dial-page-peek\s*\{[^}]*--lcars-popup-min-height:\s*120px/s);
  assert.match(css,/\.tray-drawer\s*\{[^}]*--lcars-popup-min-height:\s*160px/s);
  assert.match(css,/\.notice-history\s*\{[^}]*--lcars-popup-min-height:\s*150px/s);
  assert.match(css,/\.display-menu\s*\{[^}]*--lcars-popup-min-height:\s*160px/s);
  assert.match(css,/\.drawer\s*\{[^}]*--lcars-popup-min-height:\s*180px/s);
  assert.match(css,/\.command-palette\s*\{[^}]*--lcars-popup-min-height:\s*150px/s);
  assert.match(css,/\.compat-center\s*\{[^}]*--lcars-popup-min-height:\s*180px/s);
  assert.match(css,/\.first-run\s*\{[^}]*--lcars-popup-min-height:\s*200px/s);
  assert.match(css,/\.power-dialog\s*\{[^}]*--lcars-popup-min-height:\s*180px/s);
  assert.match(css,/\.power-dialog\.confirm\s*\{[^}]*--lcars-popup-min-height:\s*140px/s);
  assert.match(patcher,/floating=false,minWidth=320,minHeight=140,role="dialog"/);
  assert.match(patcher,/floating minWidth=\{360\} minHeight=\{120\} ariaModal=\{false\}/);
  assert.match(patcher,/floating minWidth=\{380\} minHeight=\{150\} ariaModal=\{false\}/);
  assert.match(patcher,/className="drawer" minWidth=\{520\} minHeight=\{180\}/);
  assert.match(patcher,/className="command-palette" minWidth=\{440\} minHeight=\{150\}/);
});

test("Page Peek body no longer imposes the old 110px internal floor",()=>{
  assert.match(css,/\.speed-dial-page-peek > main\s*\{[^}]*min-height:\s*0\s*!important/s);
  assert.match(css,/\.speed-dial-page-peek > main\s*\{[^}]*overflow:\s*auto/s);
});

test("Communications Center does not keep an important fixed width",()=>{
  assert.match(patcher,/communicationsWidthOriginal = '\.notice-history \{ width: min\(660px,94vw\) !important;/);
  assert.match(patcher,/communicationsWidthPatched = '\.notice-history \{ width: min\(660px,94vw\); max-height:/);
  assert.match(patcher,/V25 Communications Center width override was not found/);
});

test("Communications Center keeps resize handles outside the scrolling history",()=>{
  assert.match(patcher,/communicationsScrollMarker = 'className="communications-scroll"'/);
  assert.match(patcher,/aria-label="Search communications history"/);
  assert.match(css,/\.notice-history\.resizable-popup\s*\{[^}]*overflow:\s*hidden\s*!important/s);
  assert.match(css,/\.notice-history > \.communications-scroll\s*\{[^}]*overflow:\s*auto/s);
  assert.match(css,/\.notice-history > \.popup-resize-edge-s\s*\{[^}]*height:\s*24px\s*!important/s);
  assert.match(css,/\.notice-history > \.popup-resize-edge-s\s*\{[^}]*z-index:\s*80\s*!important/s);
});

test("Communications source patch is Windows CRLF safe",()=>{
  assert.ok(patcher.includes('const communicationsContentPattern = /          <input\\r?\\n            aria-label="Search communications history"/;'));
  assert.ok(patcher.includes('const eol = source.includes("\\r\\n") ? "\\r\\n" : "\\n";'));
});

test("narrow Communications controls wrap and scale instead of clipping",()=>{
  assert.match(css,/@container \(max-width: 520px\)[\s\S]*\.communications-tabs\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)\s*!important/s);
  assert.match(css,/@container \(max-width: 520px\)[\s\S]*\.communications-tabs button\s*\{[^}]*white-space|@container \(max-width: 520px\)[\s\S]*\.resizable-popup button\s*\{[^}]*white-space:\s*normal\s*!important/s);
  assert.match(css,/\.communications-tabs button\s*\{[^}]*font-size:\s*9px\s*!important/s);
  assert.match(css,/\.communication-entry span b,[\s\S]*\.communication-entry span em\s*\{[^}]*white-space:\s*normal\s*!important/s);
  assert.match(css,/\.communication-entry span small,[\s\S]*\.communication-entry span em\s*\{[^}]*font-size:\s*8px\s*!important/s);
});

test("narrow Page Peeks adapt headers footers and content to their container",()=>{
  assert.match(css,/@container \(max-width: 520px\)[\s\S]*\.speed-dial-page-peek h3\s*\{[^}]*font-size:\s*clamp\(/s);
  assert.match(css,/@container \(max-width: 400px\)[\s\S]*\.speed-dial-page-peek > footer\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(css,/@container \(max-width: 400px\)[\s\S]*\.peek-network article,[\s\S]*\.peek-settings article\s*\{[^}]*grid-template-columns:\s*auto minmax\(0, 1fr\)\s*!important/s);
  assert.match(css,/@container \(max-width: 400px\)[\s\S]*\.peek-media-art\s*\{[^}]*width:\s*56px\s*!important[^}]*height:\s*56px\s*!important/s);
});

test("vertical resize math and CSS share effective height limits",()=>{
  assert.match(css,/\.resizable-popup\s*\{[^}]*max-height:\s*calc\(100vh - 16px\)\s*!important/s);
  assert.match(patcher,/computedMaxHeight=Number\.parseFloat\(computedStyle\.maxHeight\)/);
  assert.match(patcher,/computedCssMinHeight=Number\.parseFloat\(computedStyle\.getPropertyValue\("--lcars-popup-min-height"\)\)/);
  assert.match(patcher,/effectiveMinHeight=Math\.max\(minHeight,cssMinHeight\)/);
  assert.match(patcher,/Math\.min\(window\.innerHeight-16,availableHeight,cssMaxHeight\)/);
  assert.match(patcher,/Math\.min\(effectiveMinHeight,maxHeight\)/);
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
