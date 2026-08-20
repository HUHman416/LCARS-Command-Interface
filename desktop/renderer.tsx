import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import "../app/globals.css";
import "../app/v23-1.css";
import "../app/v23-2.css";

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

class RendererRecovery extends React.Component<React.PropsWithChildren, {error:string}> {
  state={error:""};
  static getDerivedStateFromError(error:unknown){return{error:String(error)}}
  componentDidCatch(error:unknown,info:React.ErrorInfo){console.error("LCARS renderer recovered from a component failure",error,info)}
  render(){if(this.state.error)return <main style={{background:"#000",color:"#f4b66b",minHeight:"100vh",padding:"8vh",fontFamily:"sans-serif"}}><h1>LCARS RENDERER RECOVERY</h1><p>An optional interface component failed without taking the workstation offline.</p><pre style={{whiteSpace:"pre-wrap",color:"#ddd"}}>{this.state.error}</pre><button style={{padding:"12px 24px"}} onClick={()=>location.reload()}>RELOAD INTERFACE</button></main>;return this.props.children;}
}

createRoot(document.getElementById("root")!).render(<RendererRecovery><Home /></RendererRecovery>);
