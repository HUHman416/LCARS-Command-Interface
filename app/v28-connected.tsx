"use client";

import { useMemo, useState } from "react";

export type PaddRole = "viewer" | "operator" | "command";
export type PaddPermission = "navigate" | "media" | "volume" | "dnd" | "routine" | "app" | "workstation" | "notice-read" | "notice-archive" | "notice-dismiss-all" | "quick" | "handoff" | "clipboard" | "file-receive" | "autoApprove" | "communications" | "telemetry";
export type PaddWidget = "status" | "media" | "communications" | "telemetry" | "quick-actions";
export type PaddNotificationSettings = {enabled:boolean;priorityOnly:boolean;connectionEvents:boolean;routineResults:boolean};
export type PaddSyncPolicy = {page:boolean;media:boolean;notifications:boolean;telemetry:boolean;workstations:boolean;applications:boolean;procedures:boolean;accessibility:boolean};
export type PaddDevice = {
  id:string;name:string;role:PaddRole;createdAt:number;lastSeen:number;online?:boolean;
  lastAddress?:string;connectionCount?:number;battery?:number;network?:string;latencyMs?:number;clientVersion?:string;
  permissions?:Partial<Record<PaddPermission,boolean>>;widgets?:PaddWidget[];workstation?:string;proximity?:boolean;
  notifications?:Partial<PaddNotificationSettings>;compatibility?:"compatible"|"client-outdated"|"station-outdated"|"unknown";
  sync?:Partial<PaddSyncPolicy>;transport?:string;queuedDeliveries?:number;
};
export type PaddApproval = {id:string;action:string;value:unknown;device:string;deviceName:string;createdAt:number;expiresAt:number};
export type PaddActivity = {id:string;action:string;device:string;deviceName:string;status:string;detail:string;createdAt:number};
export type PaddStatus = {
  ok:boolean;enabled:boolean;online:boolean;error?:string;port:number;version:string;platform:string;
  addresses:string[];devices:PaddDevice[];clipboardEnabled?:boolean;activity?:PaddActivity[];approvals?:PaddApproval[];
  fileTransferEnabled?:boolean;station?:{id:string;name:string;fingerprint:string;createdAt:number};discovery?:{enabled:boolean;port:number};
  diagnostics?:{connected:number;paired:number;pendingApprovals:number;queuedCommands:number;queuedDeliveries?:number;eventBacklog:number};
  pairing?:{code?:string;expiresAt:number}|null;message?:string;
};
export type PaddOperation = "start" | "disable" | "revoke" | "role" | "rename" | "permissions" | "profile" | "layout" | "proximity" | "identify" | "clipboard" | "file-transfer" | "approve" | "deny" | "notifications" | "sync-policy" | "preset" | "copy-settings" | "station-rename" | "delivery" | "clear-queue";

const permissionGroups:{title:string;items:{id:PaddPermission;label:string}[]}[]=[
  {title:"SAFE CONTROL",items:[{id:"navigate",label:"NAVIGATION"},{id:"media",label:"MEDIA"},{id:"volume",label:"VOLUME"},{id:"quick",label:"QUICK ACTIONS"}]},
  {title:"CONNECTED OPERATIONS",items:[{id:"communications",label:"COMMUNICATIONS"},{id:"telemetry",label:"TELEMETRY"},{id:"notice-read",label:"ACKNOWLEDGE"},{id:"notice-archive",label:"ARCHIVE"},{id:"notice-dismiss-all",label:"DISMISS ALL"},{id:"handoff",label:"HANDOFF"}]},
  {title:"COMMAND REQUESTS",items:[{id:"dnd",label:"DND"},{id:"routine",label:"ROUTINES"},{id:"app",label:"APPLICATIONS"},{id:"workstation",label:"WORKSTATIONS"},{id:"clipboard",label:"TEXT CLIPBOARD"},{id:"file-receive",label:"SMALL FILES"},{id:"autoApprove",label:"AUTO-APPROVE"}]},
];
const widgets:{id:PaddWidget;label:string}[]=[
  {id:"status",label:"STATION STATUS"},{id:"media",label:"NOW PLAYING"},{id:"communications",label:"COMMUNICATIONS"},{id:"telemetry",label:"TELEMETRY"},{id:"quick-actions",label:"QUICK ACTIONS"},
];
const roleDefaults:Record<PaddRole,Partial<Record<PaddPermission,boolean>>>={
  viewer:{communications:true,telemetry:true},
  operator:{navigate:true,media:true,volume:true,quick:true,communications:true,telemetry:true,"notice-read":true,"notice-archive":true,"notice-dismiss-all":true,handoff:true},
  command:{navigate:true,media:true,volume:true,quick:true,communications:true,telemetry:true,"notice-read":true,"notice-archive":true,"notice-dismiss-all":true,handoff:true,dnd:true,routine:true,app:true,workstation:true,clipboard:true,"file-receive":true,autoApprove:false},
};
const notificationDefaults:PaddNotificationSettings={enabled:true,priorityOnly:true,connectionEvents:true,routineResults:true};
const syncDefaults:PaddSyncPolicy={page:true,media:true,notifications:true,telemetry:true,workstations:true,applications:true,procedures:true,accessibility:true};

const age=(stamp:number)=>stamp?new Date(stamp*1000).toLocaleString():"NEVER";
const displayValue=(value:unknown)=>typeof value==="string"?value:JSON.stringify(value);

export function ConnectedOperationsPanel({status,busy,now,workstations,refresh,operate}:{
  status:PaddStatus|null;busy:string;now:number;workstations:{id:string;name:string}[];refresh:()=>void;
  operate:(operation:PaddOperation,device?:PaddDevice,payload?:Record<string,unknown>)=>void;
}){
  const [area,setArea]=useState<"federation"|"fleet"|"approvals"|"activity"|"diagnostics">("federation");
  const [copied,setCopied]=useState(false);
  const [names,setNames]=useState<Record<string,string>>({});
  const [copySources,setCopySources]=useState<Record<string,string>>({});
  const [deliveryText,setDeliveryText]=useState<Record<string,string>>({});
  const [stationName,setStationName]=useState("");
  const remaining=status?.pairing?Math.max(0,status.pairing.expiresAt-now):0;
  const primaryAddress=status?.addresses[0]||"";
  const setupDetails=[primaryAddress,status?.pairing?.code?`CODE ${status.pairing.code}`:"ARM A CODE IN LCARS"].filter(Boolean).join(" · ");
  const summary=status?.diagnostics||{connected:0,paired:status?.devices.length||0,pendingApprovals:status?.approvals?.length||0,queuedCommands:0,queuedDeliveries:0,eventBacklog:0};
  const onlineDevices=useMemo(()=>status?.devices.filter((device)=>device.online)||[],[status]);
  const copySetup=()=>navigator.clipboard?.writeText(setupDetails).then(()=>{setCopied(true);window.setTimeout(()=>setCopied(false),1800);}).catch(()=>{});
  const permission=(device:PaddDevice,id:PaddPermission)=>device.permissions?.[id]??Boolean(roleDefaults[device.role][id]);
  const notification=(device:PaddDevice,id:keyof PaddNotificationSettings)=>device.notifications?.[id]??notificationDefaults[id];
  const sync=(device:PaddDevice,id:keyof PaddSyncPolicy)=>device.sync?.[id]??syncDefaults[id];
  const changePermission=(device:PaddDevice,id:PaddPermission,value:boolean)=>operate("permissions",device,{permissions:{...device.permissions,[id]:value}});
  const changeNotification=(device:PaddDevice,id:keyof PaddNotificationSettings,value:boolean)=>operate("notifications",device,{notifications:{...notificationDefaults,...device.notifications,[id]:value}});
  const changeSync=(device:PaddDevice,id:keyof PaddSyncPolicy,value:boolean)=>operate("sync-policy",device,{sync:{...syncDefaults,...device.sync,[id]:value}});
  const changeWidget=(device:PaddDevice,id:PaddWidget,value:boolean)=>{
    const current=device.widgets?.length?device.widgets:widgets.map((item)=>item.id);
    const next=value?Array.from(new Set([...current,id])):current.filter((item)=>item!==id);
    operate("layout",device,{widgets:next});
  };
  const submitName=(device:PaddDevice)=>{
    const value=(names[device.id]??device.name).trim().slice(0,48);
    if(value&&value!==device.name)operate("rename",device,{value});
  };
  const exportDiagnostics=()=>{
    const report={schema:1,kind:"lcars-connected-diagnostics",generatedAt:new Date().toISOString(),station:{enabled:Boolean(status?.enabled),online:Boolean(status?.online),version:status?.version||"unknown",platform:status?.platform||"unknown",listenerPort:status?.port||0,privateAddressAvailable:Boolean(status?.addresses.length),summary},devices:(status?.devices||[]).map((device,index)=>({device:`PADD ${String(index+1).padStart(2,"0")}`,online:Boolean(device.online),role:device.role,battery:device.battery,networkType:device.network,latencyMs:device.latencyMs,clientVersion:device.clientVersion||"unknown",compatibility:device.compatibility||"unknown",connectionCount:device.connectionCount||0,permissions:device.permissions||{},widgets:device.widgets||[],notifications:{...notificationDefaults,...device.notifications}}))};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"})),link=document.createElement("a");
    link.href=url;link.download=`lcars-connected-diagnostics-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(url);
  };
  const mismatches=status?.devices.filter((device)=>device.compatibility&&device.compatibility!=="compatible"&&device.compatibility!=="unknown")||[];
  const sendText=(device:PaddDevice,kind:"clipboard"|"notice")=>{const value=(deliveryText[device.id]||"").trim();if(!value)return;operate("delivery",device,{kind,payload:kind==="clipboard"?{text:value}:{title:"LCARS TRANSMISSION",text:value,priority:"priority"}});setDeliveryText((old)=>({...old,[device.id]:""}));};
  const sendFile=(device:PaddDevice,file:File)=>{if(file.size>524288)return window.alert("Federation file transfers are limited to 512 KiB.");const reader=new FileReader();reader.onload=()=>operate("delivery",device,{kind:"file",payload:{name:file.name,mime:file.type||"application/octet-stream",content:String(reader.result).split(",")[1]||""}});reader.readAsDataURL(file);};
  return <section className="connected-operations-panel">
    <header className="connected-operations-head">
      <span><small>VERSION 30.2 DEVELOPMENT · FEDERATION</small><b>FEDERATION OPERATIONS</b><p>One operator, many trusted stations: automatic discovery, durable identities, AES-256-GCM synchronization, selective data routes, operational handoff, and bounded offline delivery queues.</p></span>
      <strong className={status?.enabled&&status.online?"online":""}>{status?.enabled&&status.online?"LINK ONLINE":"LINK STANDBY"}</strong>
    </header>
    <div className="connected-summary">
      <article><small>CONNECTED</small><b>{String(summary.connected).padStart(2,"0")}</b><em>{summary.paired} TRUSTED DEVICE{summary.paired===1?"":"S"}</em></article>
      <article><small>APPROVAL QUEUE</small><b>{String(summary.pendingApprovals).padStart(2,"0")}</b><em>SENSITIVE REQUESTS WAIT HERE</em></article>
      <article><small>LINK HEALTH</small><b>{status?.online?"NOMINAL":"OFFLINE"}</b><em>{status?.error||`${onlineDevices.length} ACTIVE · ${summary.queuedCommands} QUEUED`}</em></article>
      <article><small>TEXT CLIPBOARD</small><b>{status?.clipboardEnabled?"ARMED":"BLOCKED"}</b><em>TEXT ONLY · DESKTOP APPROVAL</em></article>
    </div>
    <nav className="connected-area-tabs" aria-label="Connected Operations categories">
      {([['federation','FEDERATION'],['fleet','TRUST + POLICY'],['approvals',`APPROVALS ${summary.pendingApprovals?`· ${summary.pendingApprovals}`:""}`],['activity','TIMELINE'],['diagnostics','DIAGNOSTICS']] as const).map(([id,label])=><button key={id} aria-current={area===id?"page":undefined} onClick={()=>setArea(id)}>{label}</button>)}
    </nav>

    {area==="federation"&&<>
      <section className="federation-identity">
        <header><span><small>PERSISTENT STATION IDENTITY</small><b>{status?.station?.name||"LCARS STATION"}</b></span><em>{status?.station?.fingerprint||"IDENTITY INITIALIZING"}</em></header>
        <div><label><small>STATION NAME</small><input value={stationName||status?.station?.name||""} onChange={(event)=>setStationName(event.target.value)} maxLength={48}/></label><button onClick={()=>{const value=(stationName||status?.station?.name||"").trim();if(value)operate("station-rename",undefined,{value});}}>SAVE IDENTITY</button><article><small>DISCOVERY BEACON</small><b>{status?.discovery?.enabled?`ONLINE · UDP ${status.discovery.port}`:"STANDBY"}</b></article><article><small>TRANSPORT</small><b>AES-256-GCM · SIGNED REQUESTS</b></article></div>
      </section>
      <section className="federation-delivery">
        <header><span><small>OPERATIONAL HANDOFF</small><b>STATION ROUTING + OFFLINE QUEUES</b></span><em>{summary.queuedDeliveries||0} QUEUED</em></header>
        {status?.devices.length?status.devices.map((device,index)=><article key={device.id}>
          <header><i>{String(index+1).padStart(2,"0")}</i><span><b>{device.name}</b><small>{device.online?"ONLINE":"OFFLINE · DELIVERY WILL QUEUE"} · {device.transport?.toUpperCase()||"SECURE MIGRATION"}</small></span><em>{device.queuedDeliveries||0} PENDING</em></header>
          <div className="federation-handoff-actions"><button onClick={()=>operate("delivery",device,{kind:"page",payload:{page:"overview",title:"STATUS CONSOLE"}})}>HAND OFF STATUS</button><button onClick={()=>operate("delivery",device,{kind:"page",payload:{page:"media",title:"MEDIA CONSOLE"}})}>HAND OFF MEDIA</button><button onClick={()=>operate("delivery",device,{kind:"page",payload:{page:"communications",title:"COMMUNICATIONS"}})}>HAND OFF COMMS</button><button disabled={!device.queuedDeliveries} onClick={()=>operate("clear-queue",device)}>CLEAR QUEUE</button></div>
          <div className="federation-message"><input value={deliveryText[device.id]||""} onChange={(event)=>setDeliveryText((old)=>({...old,[device.id]:event.target.value}))} placeholder="TEXT OR PRIORITY TRANSMISSION" maxLength={4000}/><button disabled={!status?.clipboardEnabled||device.transport!=="aes-256-gcm"} onClick={()=>sendText(device,"clipboard")}>SEND CLIPBOARD</button><button onClick={()=>sendText(device,"notice")}>ROUTE NOTICE</button><label className={!status?.fileTransferEnabled||device.transport!=="aes-256-gcm"?"disabled":""}>SEND FILE<input type="file" disabled={!status?.fileTransferEnabled||device.transport!=="aes-256-gcm"} onChange={(event)=>{const file=event.target.files?.[0];if(file)sendFile(device,file);event.currentTarget.value="";}}/></label></div>
          {device.transport!=="aes-256-gcm"&&<small className="federation-secure-note">CLIPBOARD + FILE ROUTES REQUIRE THE VERSION 30.2 NATIVE ANDROID LINK</small>}
        </article>):<p className="connected-empty">PAIR A TRUSTED STATION TO BEGIN FEDERATION HANDOFF</p>}
      </section>
    </>}

    {area==="fleet"&&<>
      <section className="padd-pairing-deck">
        <header><span><small>TRUSTED LOCAL NETWORK</small><b>PAIR ANOTHER PADD</b></span><em>{status?.pairing?`${Math.ceil(remaining/60)} MIN REMAINING`:"DISARMED"}</em></header>
        <div><a className="padd-download-v28" href="https://github.com/HUHman416/LCARS-Command-Interface/releases/download/v30.3/LCARS-Mobile-Environment-v30.3-Android.apk" target="_blank" rel="noreferrer">DOWNLOAD ANDROID 30.3 ↗</a><button disabled={busy==="start"} onClick={()=>operate("start")}>{status?.pairing?"REPLACE CODE":"ARM ONE-USE CODE"}</button><button disabled={!primaryAddress} onClick={copySetup}>{copied?"SETUP COPIED":"COPY STATION + CODE"}</button><button disabled={busy==="refresh"} onClick={refresh}>REFRESH LINK</button><button className="danger" disabled={busy==="disable"||!status?.enabled} onClick={()=>operate("disable")}>DISABLE LINK</button></div>
        {status?.pairing?.code&&<p className="padd-code-v28"><small>PAIRING CODE</small><b>{status.pairing.code}</b><em>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</em></p>}
        {status?.addresses.length?<p className="padd-address-v28">{status.addresses.join(" · ")}</p>:<p className="padd-address-v28 warning">NO PRIVATE IPv4 ADDRESS DETECTED</p>}
      </section>
      <section className="padd-fleet-list">
        <header><span><small>TRUST REGISTRY</small><b>{status?.devices.length||0} PAIRED PADD{status?.devices.length===1?"":"S"}</b></span><em>TERMINAL · FILES · PROCESSES · POWER REMAIN BLOCKED</em></header>
        {status?.devices.length?status.devices.map((device,index)=>{
          const activeWidgets=device.widgets?.length?device.widgets:widgets.map((item)=>item.id);
          return <article className={device.online?"online":""} key={device.id}>
            <div className="padd-device-identity"><i>{String(index+1).padStart(2,"0")}</i><span><input aria-label={`Name for ${device.name}`} value={names[device.id]??device.name} onChange={(event)=>setNames((old)=>({...old,[device.id]:event.target.value}))} onBlur={()=>submitName(device)} onKeyDown={(event)=>{if(event.key==="Enter")event.currentTarget.blur();}}/><small>{device.online?"CONNECTED":"OFFLINE"} · LAST LINK {age(device.lastSeen)}</small></span><strong className={device.compatibility&&device.compatibility!=="compatible"&&device.compatibility!=="unknown"?"mismatch":""}>{device.compatibility==="client-outdated"?"UPDATE PADD":device.compatibility==="station-outdated"?"UPDATE STATION":device.battery!=null&&device.battery>=0?`${device.battery}% BATTERY`:device.network||"PADD"}</strong></div>
            <div className="padd-device-controls">
              <label><small>ROLE</small><select aria-label={`Role for ${device.name}`} value={device.role} onChange={(event)=>operate("role",device,{role:event.target.value})}><option value="viewer">VIEWER</option><option value="operator">OPERATOR</option><option value="command">COMMAND</option></select></label>
              <label><small>CONNECTED WORKSTATION</small><select value={device.workstation||""} onChange={(event)=>operate("profile",device,{value:event.target.value})}><option value="">NO AUTOMATIC PROFILE</option>{workstations.map((profile)=><option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
              <label className="padd-inline-toggle"><input type="checkbox" checked={Boolean(device.proximity)} onChange={(event)=>operate("proximity",device,{enabled:event.target.checked})}/><span><b>PROXIMITY PROFILE</b><small>APPLY ON CONNECT</small></span></label>
            </div>
            <div className="padd-policy-tools">
              <span><small>PERMISSION PRESET</small><nav><button onClick={()=>operate("preset",device,{preset:"viewer"})}>MONITOR</button><button onClick={()=>operate("preset",device,{preset:"operator"})}>OPERATOR</button><button onClick={()=>operate("preset",device,{preset:"command"})}>COMMAND</button></nav></span>
              <label><small>COPY POLICY FROM</small><select value={copySources[device.id]||""} onChange={(event)=>setCopySources((old)=>({...old,[device.id]:event.target.value}))}><option value="">SELECT ANOTHER PADD</option>{status.devices.filter((candidate)=>candidate.id!==device.id).map((candidate)=><option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>
              <button disabled={!copySources[device.id]} onClick={()=>operate("copy-settings",device,{sourceId:copySources[device.id]})}>COPY SETTINGS</button>
            </div>
            <div className="padd-permission-grid">
              {permissionGroups.map((group)=><fieldset key={group.title}><legend>{group.title}</legend>{group.items.map((item)=><label key={item.id}><input type="checkbox" checked={permission(device,item.id)} onChange={(event)=>changePermission(device,item.id,event.target.checked)}/><span>{item.label}</span></label>)}</fieldset>)}
              <fieldset><legend>PADD WIDGETS</legend>{widgets.map((item)=><label key={item.id}><input type="checkbox" checked={activeWidgets.includes(item.id)} onChange={(event)=>changeWidget(device,item.id,event.target.checked)}/><span>{item.label}</span></label>)}</fieldset>
              <fieldset><legend>NOTIFICATION ROUTE</legend><label><input type="checkbox" checked={notification(device,"enabled")} onChange={(event)=>changeNotification(device,"enabled",event.target.checked)}/><span>ROUTE TO STATION</span></label><label><input type="checkbox" checked={notification(device,"priorityOnly")} onChange={(event)=>changeNotification(device,"priorityOnly",event.target.checked)}/><span>PRIORITY ONLY</span></label><label><input type="checkbox" checked={notification(device,"connectionEvents")} onChange={(event)=>changeNotification(device,"connectionEvents",event.target.checked)}/><span>LINK EVENTS</span></label><label><input type="checkbox" checked={notification(device,"routineResults")} onChange={(event)=>changeNotification(device,"routineResults",event.target.checked)}/><span>ROUTINE RESULTS</span></label></fieldset>
              <fieldset><legend>SELECTIVE SYNCHRONIZATION</legend>{(Object.keys(syncDefaults) as (keyof PaddSyncPolicy)[]).map((id)=><label key={id}><input type="checkbox" checked={sync(device,id)} onChange={(event)=>changeSync(device,id,event.target.checked)}/><span>{id.toUpperCase()}</span></label>)}</fieldset>
            </div>
            <footer><span>{device.lastAddress||"ADDRESS NOT RECORDED"} · {device.network||"NETWORK UNKNOWN"} · {device.latencyMs||0} MS · {device.connectionCount||0} LINKS · CLIENT {device.clientVersion||"UNKNOWN"}</span><div><button onClick={()=>operate("identify",device)}>IDENTIFY</button><button className="danger" onClick={()=>operate("revoke",device)}>REVOKE</button></div></footer>
          </article>;
        }):<p className="connected-empty">NO TRUSTED PADD DEVICES · ARM A PAIRING CODE TO BEGIN</p>}
      </section>
    </>}

    {area==="approvals"&&<section className="padd-approval-list">
      <header><span><small>DESKTOP AUTHORIZATION</small><b>PENDING PADD REQUESTS</b></span><em>NOTHING SENSITIVE RUNS UNTIL APPROVED</em></header>
      {status?.approvals?.length?status.approvals.map((approval,index)=>{const seconds=Math.max(0,approval.expiresAt-now);return <article key={approval.id}><i>{String(index+1).padStart(2,"0")}</i><span><small>{approval.deviceName} · {age(approval.createdAt)} · EXPIRES IN {seconds}s</small><b>{approval.action.toUpperCase()}</b><p>{displayValue(approval.value)}</p></span><div><button disabled={!seconds} onClick={()=>operate("approve",undefined,{approvalId:approval.id})}>APPROVE</button><button className="danger" onClick={()=>operate("deny",undefined,{approvalId:approval.id})}>DENY</button></div></article>}):<p className="connected-empty">APPROVAL QUEUE CLEAR</p>}
    </section>}

    {area==="activity"&&<section className="padd-activity-list">
      <header><span><small>LOCAL AUDIT TRAIL</small><b>CONNECTED ACTIVITY</b></span><em>NO TOKENS OR CLIPBOARD CONTENT ARE RECORDED</em></header>
      {status?.activity?.length?status.activity.map((item,index)=><article key={item.id}><i>{String(index+1).padStart(2,"0")}</i><span><small>{item.deviceName} · {age(item.createdAt)}</small><b>{item.action.replaceAll("-"," ").toUpperCase()}</b><p>{item.detail||item.status}</p></span><em>{item.status.toUpperCase()}</em></article>):<p className="connected-empty">NO CONNECTED ACTIVITY RECORDED</p>}
    </section>}

    {area==="diagnostics"&&<section className="padd-diagnostics-v28">
      <header><span><small>CONNECTION QUALITY</small><b>FLEET DIAGNOSTICS</b></span><em>{status?.version||"VERSION UNKNOWN"} · {status?.platform||"PLATFORM UNKNOWN"}</em></header>
      <div className="padd-diagnostic-grid"><article><small>LISTENER</small><b>{status?.online?`PORT ${status.port}`:"OFFLINE"}</b><p>{status?.error||"GUARDED LOCAL-NETWORK SERVICE"}</p></article><article><small>EVENT BACKLOG</small><b>{summary.eventBacklog}</b><p>CONNECT/DISCONNECT AUTOMATION SIGNALS</p></article><article><small>COMMAND QUEUE</small><b>{summary.queuedCommands}</b><p>ALLOWLISTED REQUESTS READY FOR LCARS</p></article><article><small>ACTIVE LINKS</small><b>{summary.connected}/{summary.paired}</b><p>HEARTBEAT WINDOW: 20 SECONDS</p></article></div>
      <section className={`padd-recovery-panel ${status?.online&&primaryAddress&&!mismatches.length?"nominal":"attention"}`}><header><span><small>CONNECTION RECOVERY</small><b>{status?.online&&primaryAddress&&!mismatches.length?"LINK PATH NOMINAL":"ACTION RECOMMENDED"}</b></span><em>{mismatches.length?`${mismatches.length} VERSION MISMATCH${mismatches.length===1?"":"ES"}`:primaryAddress?"PRIVATE ADDRESS READY":"PRIVATE ADDRESS MISSING"}</em></header><ol><li className={status?.enabled?"ready":""}>PADD SERVICE ENABLED</li><li className={status?.online?"ready":""}>LOCAL LISTENER RESPONDING</li><li className={primaryAddress?"ready":""}>PRIVATE NETWORK ADDRESS AVAILABLE</li><li className={!mismatches.length?"ready":""}>CLIENT VERSIONS ALIGNED</li></ol><p>{mismatches.length?"Update the listed PADD or desktop before relying on remote commands. Pairing remains available for recovery.":!primaryAddress?"Connect the desktop to a trusted private Wi-Fi or Ethernet network, then run the link check again.":status?.online?"If a PADD still cannot reconnect, refresh both ends, verify they share the same private network, then revoke and pair again.":"Start the PADD service and verify no firewall rule is blocking the local listener."}</p></section>
      <label className="clipboard-arm"><input type="checkbox" checked={Boolean(status?.clipboardEnabled)} onChange={(event)=>operate("clipboard",undefined,{enabled:event.target.checked})}/><span><b>ENABLE OPT-IN TEXT CLIPBOARD REQUESTS</b><small>Text only, limited in size, and every request requires approval unless you explicitly enable auto-approval for that device.</small></span></label>
      <label className="clipboard-arm"><input type="checkbox" checked={Boolean(status?.fileTransferEnabled)} onChange={(event)=>operate("file-transfer",undefined,{enabled:event.target.checked})}/><span><b>ENABLE SMALL-FILE FEDERATION TRANSFER</b><small>Desktop-initiated files are AES-256-GCM protected in transit, limited to 512 KiB, and delivered only to paired stations with explicit file permission.</small></span></label>
      <div className="padd-diagnostic-actions"><button onClick={refresh}>RUN LINK CHECK</button><button disabled={!primaryAddress} onClick={copySetup}>COPY CONNECTION DETAILS</button><button onClick={exportDiagnostics}>EXPORT PRIVATE DIAGNOSTICS</button><button onClick={()=>operate("start")}>ARM RECOVERY CODE</button></div>
    </section>}
  </section>;
}
