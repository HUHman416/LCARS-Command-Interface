import fs from "node:fs";

const path = new URL("../app/page.tsx", import.meta.url);
let source = fs.readFileSync(path, "utf8");

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
  '    const west=direction.includes("w"),east=direction.includes("e"),north=direction.includes("n"),south=direction.includes("s");',
  '',
  '    // Centered dialogs otherwise re-center while their size changes, which makes',
  '    // an edge drag look like a move. Freeze them at their current screen position',
  '    // once the operator begins resizing. Floating peeks already have an anchor.',
  '    if(!floating){',
  '      element.style.position="fixed";',
  '      element.style.left=`${start.left}px`;',
  '      element.style.top=`${start.top}px`;',
  '      element.style.right="auto";',
  '      element.style.bottom="auto";',
  '    }else{',
  '      element.style.left=`${startLeft}px`;',
  '      element.style.top=`${startTop}px`;',
  '      element.style.right="auto";',
  '      element.style.bottom="auto";',
  '    }',
  '',
  '    const move=(pointer:PointerEvent)=>{',
  '      const dx=pointer.clientX-startX,dy=pointer.clientY-startY;',
  '      // Bound the dragged edge itself to the viewport. This prevents the',
  '      // ResizeObserver safety clamp from translating the whole popup afterward.',
  '      const availableWidth=west?start.right-8:east?window.innerWidth-start.left-8:window.innerWidth-16;',
  '      const availableHeight=north?start.bottom-8:south?window.innerHeight-start.top-8:window.innerHeight-16;',
  '      const maxWidth=Math.max(80,Math.min(window.innerWidth-16,availableWidth));',
  '      const maxHeight=Math.max(80,Math.min(window.innerHeight-16,availableHeight));',
  '      const requestedWidth=west?start.width-dx:east?start.width+dx:start.width;',
  '      const requestedHeight=north?start.height-dy:south?start.height+dy:start.height;',
  '      const width=Math.min(maxWidth,Math.max(Math.min(minWidth,maxWidth),requestedWidth));',
  '      const height=Math.min(maxHeight,Math.max(Math.min(minHeight,maxHeight),requestedHeight));',
  '      element.style.width=`${width}px`;',
  '      element.style.height=`${height}px`;',
  '      const nextLeft=west?startLeft+start.width-width:startLeft;',
  '      const nextTop=north?startTop+start.height-height:startTop;',
  '      element.style.left=`${nextLeft}px`;',
  '      element.style.top=`${nextTop}px`;',
  '    };',
  '    const finish=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",finish);window.removeEventListener("pointercancel",finish);};',
  '    window.addEventListener("pointermove",move);window.addEventListener("pointerup",finish,{once:true});window.addEventListener("pointercancel",finish,{once:true});',
  '  };',
  '',
].join("\n");

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(path, source);
console.log("Applied V25 Hotfix v2 source-level popup resize geometry fix.");
