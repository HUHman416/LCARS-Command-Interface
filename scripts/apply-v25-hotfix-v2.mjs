import fs from "node:fs";

const path = new URL("../app/page.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const cssPath = new URL("../app/v25.css", import.meta.url);
let v25Css = fs.readFileSync(cssPath, "utf8");
const communicationsWidthOriginal = '.notice-history { width: min(660px,94vw) !important; max-height: 82vh !important; overflow: auto !important; }';
const communicationsWidthPatched = '.notice-history { width: min(660px,94vw); max-height: 82vh !important; overflow: auto !important; }';
if (v25Css.includes(communicationsWidthOriginal)) v25Css = v25Css.replace(communicationsWidthOriginal, communicationsWidthPatched);
else if (!v25Css.includes(communicationsWidthPatched)) throw new Error("V25 Communications Center width override was not found; refusing to patch an unknown source layout.");
fs.writeFileSync(cssPath, v25Css);

const observerOriginal = '    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(()=>{clampFloatingPosition();persist();});';
const observerPatched = '    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(()=>{if(element.dataset.lcarsResizing!=="1")clampFloatingPosition();persist();});';
if (source.includes(observerOriginal)) source = source.replace(observerOriginal, observerPatched);
else if (!source.includes(observerPatched)) throw new Error("V25 popup ResizeObserver layout was not found; refusing to patch an unknown source layout.");

const pagePeekMinOriginal = 'floating minWidth={360} minHeight={300} ariaModal={false}';
const pagePeekMinPatched = 'floating minWidth={360} minHeight={180} ariaModal={false}';
if (source.includes(pagePeekMinOriginal)) source = source.replace(pagePeekMinOriginal, pagePeekMinPatched);
else if (!source.includes(pagePeekMinPatched)) throw new Error("V25 Page Peek minimum-height layout was not found; refusing to patch an unknown source layout.");

// Communications Center used to scroll the ResizablePopup element itself. That also
// scrolls its absolutely positioned resize handles, which can move the south handle
// away from the visible border. Put the history content in its own scrolling region.
const communicationsScrollMarker = 'className="communications-scroll"';
if (!source.includes(communicationsScrollMarker)) {
  const communicationsContentMarker = '          <input\n            aria-label="Search communications history"';
  const communicationsStart = source.indexOf(communicationsContentMarker);
  const communicationsEnd = source.indexOf('        </ResizablePopup>', communicationsStart);
  if (communicationsStart < 0 || communicationsEnd < 0) throw new Error("V25 Communications Center content layout was not found; refusing to patch an unknown source layout.");
  source = source.slice(0, communicationsStart)
    + '          <div className="communications-scroll">\n'
    + source.slice(communicationsStart, communicationsEnd)
    + '          </div>\n'
    + source.slice(communicationsEnd);
}

const startMarker = '  const beginResize=(direction:"n"|"ne"|"e"|"se"|"s"|"sw"|"w"|"nw",event:ReactPointerEvent<HTMLSpanElement>)=>{';
const endMarker = '  const popupClass=`resizable-popup${floating?" resizable-popup-floating":""}${className?` ${className}`:""}`;';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) {
  throw new Error("V25 ResizablePopup resize handler was not found; refusing to patch an unknown source layout.");
}

const replacement = [
  '  const beginResize=(direction:"n"|"ne"|"e"|"se"|"s"|"sw"|"w"|"nw",event:ReactPointerEvent<HTMLSpanElement>)=>{',
  '    const element=ref.current;',
  '    if(!element)return;',
  '    event.preventDefault();event.stopPropagation();',
  '    const start=element.getBoundingClientRect(),startX=event.clientX,startY=event.clientY;',
  '    const parent=element.offsetParent?.getBoundingClientRect();',
  '    const parentLeft=parent?.left||0,parentTop=parent?.top||0;',
  '    const startLeft=start.left-parentLeft,startTop=start.top-parentTop;',
  '    const baseLeft=floating?startLeft:start.left,baseTop=floating?startTop:start.top;',
  '    const west=direction.includes("w"),east=direction.includes("e"),north=direction.includes("n"),south=direction.includes("s");',
  '    const computedStyle=getComputedStyle(element);',
  '    const computedMaxHeight=Number.parseFloat(computedStyle.maxHeight);',
  '    const computedCssMinHeight=Number.parseFloat(computedStyle.getPropertyValue("--lcars-popup-min-height"));',
  '    const cssMinHeight=Number.isFinite(computedCssMinHeight)?computedCssMinHeight:minHeight;',
  '    const effectiveMinHeight=Math.max(minHeight,cssMinHeight);',
  '    element.dataset.lcarsResizing="1";',
  '',
  '    // Centered dialogs otherwise re-center while their size changes, which makes',
  '    // an edge drag look like a move. Freeze them at their current screen position.',
  '    if(!floating)element.style.position="fixed";',
  '    element.style.left=`${baseLeft}px`;',
  '    element.style.top=`${baseTop}px`;',
  '    element.style.right="auto";',
  '    element.style.bottom="auto";',
  '',
  '    const move=(pointer:PointerEvent)=>{',
  '      const dx=pointer.clientX-startX,dy=pointer.clientY-startY;',
  '      const availableWidth=west?start.right-8:east?window.innerWidth-start.left-8:window.innerWidth-16;',
  '      const availableHeight=north?start.bottom-8:south?window.innerHeight-start.top-8:window.innerHeight-16;',
  '      const maxWidth=Math.max(80,Math.min(window.innerWidth-16,availableWidth));',
  '      const cssMaxHeight=Number.isFinite(computedMaxHeight)?computedMaxHeight:window.innerHeight-16;',
  '      const maxHeight=Math.max(80,Math.min(window.innerHeight-16,availableHeight,cssMaxHeight));',
  '      const requestedWidth=west?start.width-dx:east?start.width+dx:start.width;',
  '      const requestedHeight=north?start.height-dy:south?start.height+dy:start.height;',
  '      const width=Math.min(maxWidth,Math.max(Math.min(minWidth,maxWidth),requestedWidth));',
  '      const height=Math.min(maxHeight,Math.max(Math.min(effectiveMinHeight,maxHeight),requestedHeight));',
  '      const nextLeft=west?baseLeft+start.width-width:baseLeft;',
  '      element.style.width=`${width}px`;',
  '      element.style.height=`${height}px`;',
  '      element.style.left=`${nextLeft}px`;',
  '      // The browser may impose an intrinsic content minimum taller than the',
  '      // requested height. Anchor north resize from the actual rendered height so',
  '      // the whole popup cannot be translated downward after height stops shrinking.',
  '      const renderedHeight=element.getBoundingClientRect().height;',
  '      const nextTop=north?baseTop+start.height-renderedHeight:baseTop;',
  '      element.style.top=`${nextTop}px`;',
  '    };',
  '    const finish=()=>{',
  '      delete element.dataset.lcarsResizing;',
  '      window.removeEventListener("pointermove",move);',
  '      window.removeEventListener("pointerup",finish);',
  '      window.removeEventListener("pointercancel",finish);',
  '    };',
  '    window.addEventListener("pointermove",move);',
  '    window.addEventListener("pointerup",finish,{once:true});',
  '    window.addEventListener("pointercancel",finish,{once:true});',
  '  };',
  '',
].join("\n");

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log("Applied V25 Hotfix v2 popup resize fixes (rendered-height anchoring + Communications resize handles fixed).");
