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
import "../app/v25-b-compact.css";

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
