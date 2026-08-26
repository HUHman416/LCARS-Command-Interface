"use client";

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
  return <section className="padd-link-panel">
    <header><span><small>VERSION 27 CONNECTED LCARS</small><b>PADD COMPANION LINK</b><p>Pair personal PADDs over this local network. One-use codes expire after five minutes; stored device tokens are hashed, role-limited, and revocable.</p></span><strong className={status?.enabled&&status.online?"online":""}>{status?.enabled&&status.online?"ONLINE":"STANDBY"}</strong></header>
    <div className="padd-link-overview">
      <article><small>LISTENER</small><b>{status?.online?`PORT ${status.port}`:"NOT AVAILABLE"}</b><em>{status?.error||"SEPARATE FROM THE LOOPBACK SYSTEM CORE"}</em></article>
      <article><small>PAIRED DEVICES</small><b>{String(status?.devices.length||0).padStart(2,"0")}</b><em>VIEWER · OPERATOR · COMMAND ROLES</em></article>
      <article><small>PAIRING WINDOW</small><b>{status?.pairing?`${Math.ceil(remaining/60)} MIN` : "DISARMED"}</b><em>ONE SUCCESSFUL PAIRING PER CODE</em></article>
    </div>
    {status?.addresses.length?<div className="padd-addresses"><small>OPEN ONE OF THESE ADDRESSES ON A PHONE OR TABLET CONNECTED TO THE SAME NETWORK</small>{status.addresses.map(address=><button key={address} onClick={()=>navigator.clipboard?.writeText(address)}><b>{address}</b><em>COPY</em></button>)}</div>:<p className="padd-no-address">NO PRIVATE IPv4 ADDRESS DETECTED · CONNECT THIS COMPUTER TO THE SAME LOCAL NETWORK AS THE PADD</p>}
    {status?.pairing?.code&&<div className="padd-code"><span><small>ONE-USE PAIRING CODE</small><b>{status.pairing.code}</b></span><em>EXPIRES IN {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</em></div>}
    <nav><button disabled={busy==="start"} onClick={()=>operate("start")}>{status?.pairing?"REPLACE PAIRING CODE":"ARM PAIRING CODE"}</button><button disabled={busy==="disable"||!status?.enabled} onClick={()=>operate("disable")}>DISABLE PADD LINK</button><button disabled={busy==="refresh"} onClick={refresh}>REFRESH LINK</button></nav>
    <section className="padd-device-list"><header><b>PAIRED PADD REGISTRY</b><small>COMMAND NEVER INCLUDES TERMINAL, FILE, PROCESS, OR POWER ACCESS</small></header>{status?.devices.length?status.devices.map((device,index)=><article key={device.id}><i>{String(index+1).padStart(2,"0")}</i><span><b>{device.name}</b><small>LAST LINK {seen(device.lastSeen)}</small></span><select aria-label={`Role for ${device.name}`} value={device.role} onChange={(event)=>operate("role",device,event.target.value as PaddRole)}><option value="viewer">VIEWER</option><option value="operator">OPERATOR</option><option value="command">COMMAND</option></select><button className="danger" onClick={()=>operate("revoke",device)}>REVOKE</button></article>):<p>NO PADD DEVICES PAIRED</p>}</section>
  </section>;
}
