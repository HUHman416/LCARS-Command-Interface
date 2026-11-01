import { computerTerminology } from "./tos-terminology";
/** Read-only TOS registers. Every value comes from the existing application state. */
type Reading={label:string;value:string|number;attention?:boolean;percent?:number};
type Props={section:string;connected:boolean;platform:string;meters:(string|number)[][];applications:number;windows:number;players:number;volume:number;muted:boolean;operator:string;role:string;modules:number;isolated:number;paired:number;online:number;pending:number;notices:number;dnd:boolean;updateAvailable:boolean;channel:string;scale:number;sound:boolean;contrast:boolean;motion:boolean;colorSafe:boolean;settingsArea:string;restore:boolean};
const titles:Record<string,string>={overview:"ENGINEERING STATUS",terminal:"COMMAND PROCESSOR",files:"LIBRARY RECORDS",system:"ENGINEERING ANALYSIS",media:"AUDIO / VISUAL MONITOR",network:"COMMUNICATIONS ANALYSIS",updates:"PROGRAM REVISION CONTROL",settings:"CONFIGURATION REGISTERS",portals:"AUTHORIZATION MONITOR",utilities:"OPERATIONS SERVICES",commissioning:"STATION READINESS"};
const codes:Record<string,string>={overview:"01",terminal:"02",files:"03",system:"04",media:"05",network:"06",updates:"07",settings:"08",portals:"09",utilities:"10",commissioning:"11"};
export function TosInformationReadout(p:Props){
 const core:Reading={label:"COMPUTER LINK",value:p.connected?"LOCAL CORE ONLINE":"LOCAL CORE OFFLINE",attention:!p.connected};
 let readings:Reading[];
 switch(p.section){
  case "overview":return <p className="tos-screen-source">ENGINEERING DATA · {p.connected?"LOCAL CORE SAMPLE":"DEMONSTRATION SAMPLE"} · READOUT ONLY</p>;
  case "system":readings=p.meters.map(([label,value])=>({label:String(label),value:`${Math.round(Number(value)||0)}%`,percent:Math.max(0,Math.min(100,Number(value)||0))}));break;
  case "terminal":readings=[core,{label:"COMMAND SOURCE",value:p.connected?"LOCAL CORE":"PREVIEW ONLY"},{label:"OPERATOR",value:p.operator},{label:"HOST",value:p.platform}];break;
  case "files":readings=[core,{label:"RECORD HANDLING",value:"FILES / DOCUMENTS"},{label:"OPERATOR",value:p.operator},{label:"AUTHORITY",value:p.role.toUpperCase()}];break;
  case "media":readings=[{label:"MEDIA SOURCES",value:p.players},{label:"OUTPUT LEVEL",value:`${p.volume}%`,percent:p.volume},{label:"AUDIO OUTPUT",value:p.muted?"MUTED":"UNMUTED",attention:p.muted},core];break;
  case "network":readings=[core,{label:"PAIRED STATIONS",value:p.paired},{label:"ONLINE STATIONS",value:p.online},{label:"OPERATOR",value:p.operator}];break;
  case "updates":readings=[core,{label:"RELEASE CHANNEL",value:p.channel.toUpperCase()},{label:"REVISION STATUS",value:p.updateAvailable?"UPDATE AVAILABLE":"NO UPDATE REPORTED",attention:p.updateAvailable},{label:"INSTALLED MODULES",value:p.modules}];break;
  case "settings":readings=[{label:"SETTINGS REGISTER",value:p.settingsArea.toUpperCase()},{label:"DISPLAY SCALE",value:`${p.scale}%`},{label:"KEY AUDIO",value:p.sound?"ENABLED":"DISABLED"},{label:"HIGH CONTRAST",value:p.contrast?"ON":"OFF"},{label:"REDUCED MOTION",value:p.motion?"ON":"OFF"},{label:"COLOR-SAFE MARKS",value:p.colorSafe?"ON":"OFF"}];break;
  case "portals":readings=[core,{label:"AWAITING AUTHORITY",value:p.pending,attention:p.pending>0},{label:"AUTHORITY",value:p.role.toUpperCase()},{label:"PAIRED STATIONS",value:p.paired}];break;
  case "utilities":readings=[core,{label:"COMMUNICATIONS",value:p.dnd?"DO NOT DISTURB":"NOTICES ACTIVE"},{label:"NOTICE RECORDS",value:p.notices},{label:"OPERATOR",value:p.operator}];break;
  case "commissioning":readings=[core,{label:"INSTALLED MODULES",value:p.modules},{label:"ISOLATED MODULES",value:p.isolated,attention:p.isolated>0},{label:"SESSION RESTORE",value:p.restore?"ENABLED":"DISABLED"}];break;
  default:readings=[core,{label:"APPLICATION INDEX",value:p.applications},{label:"OPEN WINDOWS",value:p.windows},{label:"OPERATOR",value:p.operator}];
 }
 return <section className={`tos-information-register register-${p.section}`} aria-label={`${titles[p.section]||"AUXILIARY DISPLAY"} information registers`}>
  <header><span>COMPUTER RECORD {codes[p.section]||"AUX"}</span><b>{titles[p.section]||"AUXILIARY DISPLAY"}</b><small>{(p.section==="system"||p.section==="media")&&!p.connected?"DEMONSTRATION SAMPLE":"INFORMATION DISPLAY"}</small></header>
  <div className="tos-information-fields">{readings.map((reading,index)=><div className={reading.attention?"attention":""} key={reading.label}><i aria-hidden="true">{String(index+1).padStart(2,"0")}</i><span><small>{reading.label}</small><strong>{reading.label==="OPERATOR"&&reading.value==="LCARS OPERATOR"?computerTerminology(reading.value):reading.value}</strong>{reading.percent!==undefined&&<span className="tos-register-scale" aria-hidden="true">{Array.from({length:20},(_,segment)=><i className={reading.percent!>segment*5?"lit":""} key={segment}/>)}</span>}</span></div>)}</div>
  {(p.section==="network"||p.section==="portals")&&<figure className="tos-link-plot"><figcaption>{p.section==="network"?"COMMUNICATIONS LINK TOPOLOGY":"AUTHORIZATION SEQUENCE"} · {p.connected?"LOCAL CORE CONNECTED":"LOCAL CORE OFFLINE"}</figcaption><svg viewBox="0 0 720 120" role="img" aria-label={p.section==="network"?`Local core ${p.connected?"online":"offline"}; ${p.paired} paired stations, ${p.online} reported online`:`${p.pending} requests awaiting authority; operator role ${p.role}; local core ${p.connected?"online":"offline"}`}>
   {Array.from({length:19},(_,index)=><line key={index} x1={index*40} y1="0" x2={index*40} y2="120" stroke="#20211d"/>)}
   {Array.from({length:4},(_,index)=><line key={index} x1="0" y1={index*40} x2="720" y2={index*40} stroke="#20211d"/>)}
   <path d="M120 60H340M380 60H600" fill="none" stroke={p.connected?"#f1bc5b":"#75786d"} strokeWidth="2" strokeDasharray={p.connected?undefined:"4 5"}/>
   <path d="M264 55l8 5-8 5M494 55l8 5-8 5" fill="none" stroke="#fff4d4"/>
   {[100,360,620].map((x,index)=><g key={x}><rect x={x-19} y="41" width="38" height="38" fill="#000" stroke={index===1?"#f1bc5b":"#fff4d4"} strokeWidth="2"/><text x={x} y="65" textAnchor="middle" fill="#fff4d4" fontFamily="monospace" fontSize="12">{p.section==="network"?["HOST",p.connected?"ON":"OFF",String(p.paired)][index]:[String(p.pending),p.role.toUpperCase().slice(0,3),p.connected?"ON":"OFF"][index]}</text><text x={x} y="24" textAnchor="middle" fill="#f1bc5b" fontFamily="monospace" fontSize="10">{p.section==="network"?["LOCAL WORKSTATION","COMMAND CORE","PAIRED STATIONS"][index]:["REQUEST QUEUE","OPERATOR AUTHORITY","EXECUTION CORE"][index]}</text><text x={x} y="102" textAnchor="middle" fill="#fff4d4" fontFamily="monospace" fontSize="9">{p.section==="network"?["LOCAL-FIRST",p.connected?"LINK ESTABLISHED":"LINK UNAVAILABLE",`${p.online} REPORTED ONLINE`][index]:[p.pending?"AWAITING DECISION":"QUEUE CLEAR",p.role.toUpperCase(),p.connected?"AVAILABLE":"UNAVAILABLE"][index]}</text></g>)}
  </svg></figure>}

 </section>;
}
