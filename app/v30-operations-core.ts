export type OperationsSeverity="routine"|"priority"|"warning"|"critical";
export type OperationsSubsystem="COMMUNICATIONS"|"STATIONS"|"COMPUTER CORE"|"AUTOMATION"|"MEDIA"|"SECURITY"|"SYSTEM"|"MODULES"|"UPDATES";
export type OperationsAction={kind:"notice"|"procedure"|"undo"|"media";target:string;player?:string};
export type OperationsEvent={
  id:string;time:number;title:string;detail:string;station:string;operator:string;subsystem:OperationsSubsystem;severity:OperationsSeverity;
  status:string;groupKey:string;explanation:string;acknowledged?:boolean;assignee?:string;action?:OperationsAction;reversible?:boolean;
};
export type OperationsMeta={acknowledged?:boolean;assignee?:string};
export type OperationsFilters={query:string;station:string;operator:string;subsystem:string;severity:string};
type NoticeInput={id:number;text:string;kind:string;source?:string;priority?:string;time?:string;repeats?:number;action?:OperationsAction};
type ActivityInput={id:string;time:string;source:string;title:string;detail:string;status:string;reversible?:boolean;station?:string;operator?:string;subsystem?:string;severity?:string;group?:string;explanation?:string;action?:OperationsAction};
type AuditInput={id:string;planId:string;time:string;source:string;title:string;detail:string;status:string;risk:string;reversible:boolean;input:string};
type StationInput={id:string;action:string;device?:string;deviceName?:string;status:string;detail:string;createdAt:number};

const clean=(value:unknown,limit=220)=>String(value||"").replace(/\s+/g," ").trim().slice(0,limit);
const subsystemFor=(value:string,source=""):OperationsSubsystem=>{
  const text=`${source} ${value}`.toLowerCase();
  if(/media|music|audio|playback|player/.test(text))return"MEDIA";
  if(/padd|station|federation|device/.test(text))return"STATIONS";
  if(/procedure|routine|automation/.test(text))return"AUTOMATION";
  if(/security|authorization|lock|credential|protected/.test(text))return"SECURITY";
  if(/module|extension/.test(text))return"MODULES";
  if(/update|release/.test(text))return"UPDATES";
  if(/notice|communication/.test(text))return"COMMUNICATIONS";
  if(/computer|command|voice/.test(text))return"COMPUTER CORE";
  return"SYSTEM";
};
const severityFor=(status:string,priority="",text=""):OperationsSeverity=>{
  const value=`${status} ${priority} ${text}`.toLowerCase();
  if(/critical|failed|failure|rejected|error|denied/.test(value))return"critical";
  if(/attention|warning|cancelled|expired/.test(value))return"warning";
  if(/priority|protected|running|queued/.test(value))return"priority";
  return"routine";
};
const explanationFor=(title:string,detail:string,status:string)=>{
  if(/failed|rejected|error/i.test(`${title} ${detail} ${status}`))return`The requested operation did not reach its intended completed state. ${detail||"Review the related subsystem and retry when it is available."}`;
  if(/running|queued/i.test(status))return`The operation entered an active or queued state. ${detail}`;
  if(/cancelled|denied/i.test(`${title} ${status}`))return`The previous state was preserved because the operation was cancelled or denied. ${detail}`;
  return`LCARS recorded a completed state transition. ${detail}`;
};
const timestamp=(value:unknown,fallback=Date.now())=>{const parsed=typeof value==="number"?value:Date.parse(String(value||""));return Number.isFinite(parsed)&&parsed>0?parsed:fallback;};
const eventMeta=(id:string,meta:Record<string,OperationsMeta>)=>({acknowledged:Boolean(meta[id]?.acknowledged),assignee:clean(meta[id]?.assignee,64)||undefined});
const eventAction=(action:OperationsAction|undefined):OperationsAction|undefined=>action&&["notice","procedure","undo","media"].includes(action.kind)&&clean(action.target,180)?{kind:action.kind,target:clean(action.target,180),player:clean(action.player,180)||undefined}:undefined;

export function buildOperationsTimeline({notices=[],activity=[],audit=[],stations=[],meta={}}:{notices?:NoticeInput[];activity?:ActivityInput[];audit?:AuditInput[];stations?:StationInput[];meta?:Record<string,OperationsMeta>}):OperationsEvent[]{
  const events:OperationsEvent[]=[];
  for(const item of notices){const id=`notice:${Math.abs(item.id)}`,title=clean(item.text,160),source=clean(item.source||"LCARS CORE",64),time=Math.floor(Math.abs(item.id))||Date.now();events.push({id,time,title,detail:`${source}${(item.repeats||1)>1?` · REPEATED ${item.repeats}×`:""}`,station:"LOCAL CORE",operator:"SYSTEM",subsystem:subsystemFor(title,source),severity:severityFor(item.kind,item.priority,title),status:item.kind==="error"?"failed":"notice",groupKey:`notice:${source}:${title.toLowerCase()}`,explanation:explanationFor(title,source,item.kind),action:eventAction(item.action)||{kind:"notice",target:String(item.id)},...eventMeta(id,meta)});}
  for(const item of activity){const id=`activity:${item.id}`,subsystem=(item.subsystem||subsystemFor(`${item.title} ${item.detail}`,item.source)) as OperationsSubsystem;events.push({id,time:timestamp(item.time),title:clean(item.title,160),detail:clean(item.detail),station:clean(item.station||"LOCAL CORE",64),operator:clean(item.operator||item.source||"SYSTEM",64),subsystem,severity:(item.severity||severityFor(item.status,"",`${item.title} ${item.detail}`)) as OperationsSeverity,status:clean(item.status,24),groupKey:clean(item.group||`${subsystem}:${item.title}`,180),explanation:clean(item.explanation||explanationFor(item.title,item.detail,item.status),320),action:eventAction(item.action),reversible:Boolean(item.reversible),...eventMeta(id,meta)});}
  for(const item of audit){const id=`audit:${item.id}`,severity=severityFor(item.status,item.risk,`${item.title} ${item.detail}`);events.push({id,time:timestamp(item.time),title:clean(item.title,160),detail:clean(item.detail),station:"LOCAL CORE",operator:item.source==="voice"?"VOICE OPERATOR":"LCARS OPERATOR",subsystem:item.risk==="protected"?"SECURITY":"COMPUTER CORE",severity,status:item.status,groupKey:`computer:${item.planId}`,explanation:explanationFor(item.title,item.detail,item.status),action:item.reversible&&item.status==="completed"?{kind:"undo",target:item.planId}:undefined,reversible:item.reversible,...eventMeta(id,meta)});}
  for(const item of stations){const id=`station:${item.id}`,title=clean(item.action.replace(/-/g," ").toUpperCase(),160),station=clean(item.deviceName||item.device||"FEDERATION STATION",64);events.push({id,time:timestamp(Number(item.createdAt)*1000),title,detail:clean(item.detail),station,operator:"REMOTE OPERATOR",subsystem:"STATIONS",severity:severityFor(item.status,"",`${item.action} ${item.detail}`),status:clean(item.status,24),groupKey:`station:${item.device||station}:${item.action}`,explanation:explanationFor(title,item.detail,item.status),...eventMeta(id,meta)});}
  return events.sort((left,right)=>right.time-left.time||left.id.localeCompare(right.id)).slice(0,600);
}

export function filterOperationsTimeline(events:OperationsEvent[],filters:OperationsFilters){
  const query=clean(filters.query).toLowerCase();return events.filter((event)=>(!query||`${event.title} ${event.detail} ${event.station} ${event.operator} ${event.subsystem} ${event.explanation}`.toLowerCase().includes(query))&&(filters.station==="all"||event.station===filters.station)&&(filters.operator==="all"||event.operator===filters.operator)&&(filters.subsystem==="all"||event.subsystem===filters.subsystem)&&(filters.severity==="all"||event.severity===filters.severity));
}

export function groupOperationsTimeline(events:OperationsEvent[]){
  const groups:{id:string;title:string;severity:OperationsSeverity;events:OperationsEvent[]}[]=[];
  for(const event of events){const related=groups.find((group)=>group.id===event.groupKey&&Math.abs(group.events.at(-1)!.time-event.time)<=300000);if(related){related.events.push(event);if(event.severity==="critical"||event.severity==="warning"&&related.severity!=="critical")related.severity=event.severity;}else groups.push({id:event.groupKey,title:event.title,severity:event.severity,events:[event]});}
  return groups;
}
