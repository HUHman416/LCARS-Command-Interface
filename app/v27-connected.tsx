"use client";

import { useState } from "react";

export type PaddRole = "viewer" | "operator" | "command";
export type PaddDevice = { id:string;name:string;role:PaddRole;createdAt:number;lastSeen:number };
export type PaddStatus = {
  ok:boolean;
  enabled:boolean;
  online:boolean;
  error?:string;
  port:number;
  version:string;
  platform:string;
  addresses:string[];
  devices:PaddDevice[];
  pairing?:{code?:string;expiresAt:number}|null;
  message?:string;
};

export function PaddLinkPanel({status,busy,refresh,operate}:{status:PaddStatus|null;busy:string;refresh:()=>void;operate:(operation:"start"|"disable"|"revoke"|"role",device?:PaddDevice,role?:PaddRole)=>void}){
  const remaining=status?.pairing?Math.max(0,status.pairing.expiresAt-Math.floor(Date.now()/1000)):0;
  const seen=(stamp:number)=>stamp?new Date(stamp*1000).toLocaleString():"NEVER";
  const [copied,setCopied]=useState(false);
  const primaryAddress=status?.addresses[0]||"";
  const setupDetails=[primaryAddress,status?.pairing?.code?`CODE ${status.pairing.code}`:"ARM A CODE IN LCARS"].filter(Boolean).join(" · ");
  const copySetup=()=>navigator.clipboard?.writeText(setupDetails).then(()=>{setCopied(true);window.setTimeout(()=>setCopied(false),1800);}).catch(()=>{});
  return <section className="padd-link-panel">
    <header><span><small>VERSION 27.2.1 CONNECTED LCARS</small><b>PADD COMPANION SETUP</b><p>The Android PADD now carries its own native LCARS interface. Pair it once on a trusted local network, then it remembers this station while retaining the guarded companion controls.</p></span><strong className={status?.enabled&&status.online?"online":""}>{status?.enabled&&status.online?"ONLINE":"STANDBY"}</strong></header>
    <div className="padd-link-overview">
      <article><small>LISTENER</small><b>{status?.online?`PORT ${status.port}`:"NOT AVAILABLE"}</b><em>{status?.error||"SEPARATE FROM THE LOOPBACK SYSTEM CORE"}</em></article>
      <article><small>PAIRED DEVICES</small><b>{String(status?.devices.length||0).padStart(2,"0")}</b><em>VIEWER · OPERATOR · COMMAND ROLES</em></article>
      <article><small>PAIRING WINDOW</small><b>{status?.pairing?`${Math.ceil(remaining/60)} MIN` : "DISARMED"}</b><em>ONE SUCCESSFUL PAIRING PER CODE</em></article>
    </div>
    <section className="padd-setup-grid" aria-label="PADD setup steps">
      <article><i>01</i><span><small>INSTALL THE STANDALONE APP</small><b>ANDROID PADD</b><p>Install the Version 27.2.1 APK. Its interface is bundled in the app, so it no longer loads the desktop web page.</p></span><a href="https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v27.2.1/LCARS-PADD-Companion-v27.2.1-Android.apk" target="_blank" rel="noreferrer">DOWNLOAD APK ↗</a></article>
      <article><i>02</i><span><small>OPEN A FIVE-MINUTE WINDOW</small><b>ARM PAIRING</b><p>LCARS starts the private-network listener and generates a one-use six-digit code.</p></span><button disabled={busy==="start"} onClick={()=>operate("start")}>{status?.pairing?"REPLACE CODE":"ARM PAIRING CODE"}</button></article>
      <article><i>03</i><span><small>FINISH ON THE PADD</small><b>ENTER STATION + CODE</b><p>Use the first private address below, your device name, and the code. The PADD reconnects automatically afterward.</p></span><button disabled={!primaryAddress} onClick={copySetup}>{copied?"COPIED":"COPY SETUP DETAILS"}</button></article>
    </section>
    {status?.addresses.length?<div className="padd-addresses"><small>OPEN ONE OF THESE ADDRESSES ON A PHONE OR TABLET CONNECTED TO THE SAME NETWORK</small>{status.addresses.map(address=><button key={address} onClick={()=>navigator.clipboard?.writeText(address)}><b>{address}</b><em>COPY</em></button>)}</div>:<p className="padd-no-address">NO PRIVATE IPv4 ADDRESS DETECTED · CONNECT THIS COMPUTER TO THE SAME LOCAL NETWORK AS THE PADD</p>}
    {status?.pairing?.code&&<div className="padd-code"><span><small>ONE-USE PAIRING CODE</small><b>{status.pairing.code}</b></span><em>EXPIRES IN {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</em></div>}
    <nav><button disabled={busy==="start"} onClick={()=>operate("start")}>{status?.pairing?"REPLACE PAIRING CODE":"ARM PAIRING CODE"}</button><button disabled={busy==="disable"||!status?.enabled} onClick={()=>operate("disable")}>DISABLE PADD LINK</button><button disabled={busy==="refresh"} onClick={refresh}>REFRESH LINK</button></nav>
    <section className="padd-device-list"><header><b>PAIRED PADD REGISTRY</b><small>COMMAND NEVER INCLUDES TERMINAL, FILE, PROCESS, OR POWER ACCESS</small></header>{status?.devices.length?status.devices.map((device,index)=><article key={device.id}><i>{String(index+1).padStart(2,"0")}</i><span><b>{device.name}</b><small>LAST LINK {seen(device.lastSeen)}</small></span><select aria-label={`Role for ${device.name}`} value={device.role} onChange={(event)=>operate("role",device,event.target.value as PaddRole)}><option value="viewer">VIEWER</option><option value="operator">OPERATOR</option><option value="command">COMMAND</option></select><button className="danger" onClick={()=>operate("revoke",device)}>REVOKE</button></article>):<p>NO PADD DEVICES PAIRED</p>}</section>
  </section>;
}
