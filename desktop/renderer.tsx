import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/v23-1.css";
import "../app/v23-2.css";
import "../app/v24.css";
import "../app/v24-1.css";
import "../app/v25.css";
import "../app/v25-hotfix-v2.css";

const nativeFetch: typeof window.fetch = window.fetch.bind(window);
const compatFallback = {
  distro: "Windows",
  desktop: "Windows Desktop",
  session: "native",
  capabilities: {},
  restrictions: [],
};

window.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  const response = await nativeFetch(input, init);
  if (url.includes("127.0.0.1:8765/api/compat") && !response.ok) {
    console.warn(
      "LCARS compatibility endpoint unavailable; using Windows hotfix fallback.",
    );
    return new Response(JSON.stringify(compatFallback), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return response;
};

/*
 * V25 Hotfix v2 popup resize shim.
 *
 * The original ResizablePopup pointer handler uses a viewport-wide maximum and
 * then lets its ResizeObserver clamp floating popups after each size change.
 * When a popup sits near the bottom of the screen, that clamp can translate the
 * entire popup while a vertical edge is being dragged.  South-edge resizing can
 * therefore feel like it does nothing, while north-edge resizing looks like a
 * move operation.
 *
 * Native desktop builds intercept only resize-handle pointer drags here.  The
 * opposite edge is kept stationary and the requested size is bounded before it
 * reaches the observer, so no corrective translation is required.  This shim is
 * deliberately isolated to the V25 hotfix branch while the behavior is tested
 * on both Linux and Windows.
 */
type PopupResizeDirection = "n"|"ne"|"e"|"se"|"s"|"sw"|"w"|"nw";
const popupResizeDirection=(target:HTMLElement):PopupResizeDirection|null=>{
  if(target.classList.contains("popup-resize-edge-n"))return "n";
  if(target.classList.contains("popup-resize-edge-e"))return "e";
  if(target.classList.contains("popup-resize-edge-s"))return "s";
  if(target.classList.contains("popup-resize-edge-w"))return "w";
  if(target.classList.contains("popup-resize-corner-nw"))return "nw";
  if(target.classList.contains("popup-resize-corner-ne"))return "ne";
  if(target.classList.contains("popup-resize-corner-sw"))return "sw";
  if(target.classList.contains("popup-resize-grip"))return "se";
  return null;
};
const popupMinimum=(popup:HTMLElement,name:string,fallback:number)=>{
  const value=Number.parseFloat(getComputedStyle(popup).getPropertyValue(name));
  return Number.isFinite(value)&&value>0?value:fallback;
};
const beginPopupResizeHotfix=(event:PointerEvent)=>{
  if(event.button!==0)return;
  const target=event.target instanceof HTMLElement?event.target:null;
  if(!target)return;
  const direction=popupResizeDirection(target);
  if(!direction)return;
  const popup=target.closest<HTMLElement>(".resizable-popup");
  if(!popup)return;

  /* Stop the old React resize handler from registering a competing drag. */
  event.preventDefault();
  event.stopImmediatePropagation();

  const start=popup.getBoundingClientRect();
  const startX=event.clientX,startY=event.clientY;
  const west=direction.includes("w"),east=direction.includes("e"),north=direction.includes("n"),south=direction.includes("s");
  const minWidth=popupMinimum(popup,"--lcars-popup-min-width",320);
  const minHeight=popupMinimum(popup,"--lcars-popup-min-height",220);
  const floating=popup.classList.contains("resizable-popup-floating");
  const parent=popup.offsetParent?.getBoundingClientRect();
  const startLeft=Number.parseFloat(popup.style.left)||start.left-(parent?.left||0);
  const startTop=Number.parseFloat(popup.style.top)||start.top-(parent?.top||0);

  /* Floating LCARS surfaces must use explicit anchors during a resize. */
  if(floating){
    popup.style.left=`${startLeft}px`;
    popup.style.top=`${startTop}px`;
    popup.style.right="auto";
    popup.style.bottom="auto";
  }

  const move=(pointer:PointerEvent)=>{
    pointer.preventDefault();
    pointer.stopImmediatePropagation();
    const dx=pointer.clientX-startX,dy=pointer.clientY-startY;
    const viewportMaxWidth=Math.max(160,window.innerWidth-16);
    const viewportMaxHeight=Math.max(140,window.innerHeight-16);
    const maxWidth=floating
      ? Math.max(160,Math.min(viewportMaxWidth,west?start.right-8:east?window.innerWidth-start.left-8:viewportMaxWidth))
      : viewportMaxWidth;
    const maxHeight=floating
      ? Math.max(140,Math.min(viewportMaxHeight,north?start.bottom-8:south?window.innerHeight-start.top-8:viewportMaxHeight))
      : viewportMaxHeight;
    const requestedWidth=west?start.width-dx:east?start.width+dx:start.width;
    const requestedHeight=north?start.height-dy:south?start.height+dy:start.height;
    const width=Math.min(maxWidth,Math.max(Math.min(minWidth,maxWidth),requestedWidth));
    const height=Math.min(maxHeight,Math.max(Math.min(minHeight,maxHeight),requestedHeight));

    popup.style.width=`${width}px`;
    popup.style.height=`${height}px`;
    if(floating&&west)popup.style.left=`${startLeft+start.width-width}px`;
    if(floating&&north)popup.style.top=`${startTop+start.height-height}px`;
  };
  const finish=(pointer:PointerEvent)=>{
    pointer.stopImmediatePropagation();
    window.removeEventListener("pointermove",move,true);
    window.removeEventListener("pointerup",finish,true);
    window.removeEventListener("pointercancel",finish,true);
  };
  window.addEventListener("pointermove",move,true);
  window.addEventListener("pointerup",finish,true);
  window.addEventListener("pointercancel",finish,true);
};
window.addEventListener("pointerdown",beginPopupResizeHotfix,true);

const recoveryKeys=["lcars-theme","lcars-favorites","lcars-overview-widgets","lcars-widget-sizes","lcars-pinned-players","lcars-shell-prefs","lcars-accessibility","lcars-workspaces","lcars-user-name","lcars-session-restore","lcars-custom-pages","lcars-app-destinations","lcars-default-workstation","lcars-selected-player","lcars-routines","lcars-activity-log","lcars-tray-shortcuts","lcars-control-mappings","lcars-disabled-extensions"];
const restoreValues=(values:Record<string,string>)=>{recoveryKeys.forEach((key)=>localStorage.removeItem(key));Object.entries(values).forEach(([key,value])=>{if(recoveryKeys.includes(key)&&typeof value==="string")localStorage.setItem(key,value);});};
const bootAttempts=Number(sessionStorage.getItem("lcars-boot-attempts")||"0")+1;
sessionStorage.setItem("lcars-boot-attempts",String(bootAttempts));
if(bootAttempts>=3)sessionStorage.setItem("lcars-safe-mode","1");
window.addEventListener("lcars-runtime-stable",(event)=>{
  sessionStorage.setItem("lcars-boot-attempts","0");
  if(sessionStorage.getItem("lcars-safe-mode")!=="1")localStorage.setItem("lcars-last-known-good",JSON.stringify({created:new Date().toISOString(),values:(event as CustomEvent).detail||{}}));
});

class RendererRecovery extends React.Component<React.PropsWithChildren, {error:string}> {
  state={error:""};
  static getDerivedStateFromError(error:unknown){return{error:String(error)}}
  componentDidCatch(error:unknown,info:React.ErrorInfo){console.error("LCARS renderer recovered from a component failure",error,info)}
  render(){if(this.state.error){const button={padding:"12px 24px",margin:"4px",border:0,borderRadius:"20px 2px 20px 20px",background:"#b29be6",color:"#080808"};return <main style={{background:"#000",color:"#f4b66b",minHeight:"100vh",padding:"8vh",fontFamily:"sans-serif"}}><h1>LCARS RENDERER RECOVERY</h1><p>An interface component failed. The local core and your saved configuration remain intact.</p><pre style={{whiteSpace:"pre-wrap",color:"#ddd",maxHeight:"24vh",overflow:"auto"}}>{this.state.error}</pre><div><button style={button} onClick={()=>location.reload()}>RELOAD INTERFACE</button><button style={{...button,background:"#7f9cf1"}} onClick={()=>{sessionStorage.setItem("lcars-safe-mode","1");location.reload();}}>START SAFE MODE</button><button style={{...button,background:"#ff9868"}} onClick={async()=>{try{const snapshot=JSON.parse(localStorage.getItem("lcars-last-known-good")||"null");if(snapshot?.values){restoreValues(snapshot.values);sessionStorage.removeItem("lcars-safe-mode");const shellPrefs=JSON.parse(snapshot.values["lcars-shell-prefs"]||"{}");await nativeFetch("http://127.0.0.1:8765/api/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({shell_prefs:shellPrefs})}).catch(()=>null);location.reload();}}catch{}}}>RESTORE LAST KNOWN GOOD</button></div><small>After three failed starts, LCARS automatically bypasses saved visual settings and extensions for this session.</small></main>}return this.props.children;}
}

createRoot(document.getElementById("root")!).render(<RendererRecovery><Home /></RendererRecovery>);
