import fs from "node:fs";

const path = new URL("../app/page.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const observerOriginal = '    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(()=>{clampFloatingPosition();persist();});';
const observerPatched = '    const observer=typeof ResizeObserver==="undefined"?null:new ResizeObserver(()=>{if(element.dataset.lcarsResizing!=="1")clampFloatingPosition();persist();});';
if (source.includes(observerOriginal)) source = source.replace(observerOriginal, observerPatched);
else if (!source.includes(observerPatched)) throw new Error("V25 popup ResizeObserver layout was not found; refusing to patch an unknown source layout.");

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
  '    const wasFixed=!floating||computedStyle.position==="fixed";',
  '    const computedMaxHeight=Number.parseFloat(computedStyle.maxHeight);',
  '    const computedCssMinHeight=Number.parseFloat(computedStyle.getPropertyValue("--lcars-popup-min-height"));',
  '    const cssMinHeight=Number.isFinite(computedCssMinHeight)?computedCssMinHeight:minHeight;',
  '    const effectiveMinHeight=Math.max(minHeight,cssMinHeight);',
  '    const verticalBottom=wasFixed?window.innerHeight-start.bottom:(parent?parent.bottom-start.bottom:window.innerHeight-start.bottom);',
  '    element.dataset.lcarsResizing="1";',
  '',
  '    // Freeze centered dialogs and convert all horizontal positioning to an explicit',
  '    // left coordinate. Vertical resizing is anchored by the opposite edge: north',
  '    // uses bottom, south uses top. This avoids recalculating top while height changes.',
  '    if(!floating)element.style.position="fixed";',
  '    element.style.left=`${baseLeft}px`;',
  '    element.style.right="auto";',
  '    if(north){',
  '      element.style.top="auto";',
  '      element.style.bottom=`${verticalBottom}px`;',
  '    }else{',
  '      element.style.top=`${baseTop}px`;',
  '      element.style.bottom="auto";',
  '    }',
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
  '    };',
  '    const finish=()=>{',
  '      const finalRect=element.getBoundingClientRect(),finalParent=element.offsetParent?.getBoundingClientRect();',
  '      const finalTop=wasFixed?finalRect.top:finalRect.top-(finalParent?.top||0);',
  '      element.style.top=`${finalTop}px`;',
  '      element.style.bottom="auto";',
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
console.log("Applied V25 Hotfix v2 source-level popup resize geometry fix (opposite-edge vertical anchoring enabled).");
