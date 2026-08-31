import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildOperationsTimeline, filterOperationsTimeline, groupOperationsTimeline } from "../app/v30-operations-core.ts";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Operations timeline unifies, classifies, filters, groups, and preserves operator metadata",()=>{
  const events=buildOperationsTimeline({
    notices:[{id:200,text:"Media command was rejected",kind:"error",source:"COMPUTER CORE",priority:"critical",action:{kind:"media",target:"play"}}],
    activity:[{id:"a1",time:"2026-08-30T18:01:00Z",source:"ROUTINE",title:"Procedure Morning",detail:"All steps complete",status:"success",subsystem:"AUTOMATION",group:"procedure:morning",action:{kind:"procedure",target:"morning"}}],
    audit:[{id:"c1",planId:"plan-1",time:"2026-08-30T18:00:00Z",source:"voice",title:"STATUS REPORT",detail:"Completed",status:"completed",risk:"safe",reversible:true,input:"computer status report"}],
    stations:[{id:"s1",action:"delivery-queued",device:"padd-1",deviceName:"READY ROOM",status:"queued",detail:"notice · 1 pending",createdAt:1788112920}],
    meta:{"notice:200":{acknowledged:true,assignee:"CAPTAIN"}},
  });
  assert.deepEqual(new Set(events.map((event)=>event.subsystem)),new Set(["MEDIA","AUTOMATION","COMPUTER CORE","STATIONS"]));
  const media=events.find((event)=>event.id==="notice:200");
  assert.equal(media.severity,"critical");
  assert.equal(media.action.kind,"media");
  assert.equal(media.acknowledged,true);
  assert.equal(media.assignee,"CAPTAIN");
  assert.equal(filterOperationsTimeline(events,{query:"ready room",station:"all",operator:"all",subsystem:"all",severity:"all"})[0].subsystem,"STATIONS");
  assert.equal(filterOperationsTimeline(events,{query:"",station:"all",operator:"all",subsystem:"MEDIA",severity:"critical"}).length,1);
});

test("related events group only inside the five-minute observability window",()=>{
  const base={title:"Media state changed",detail:"Spotify",station:"LOCAL CORE",operator:"SYSTEM",subsystem:"MEDIA",severity:"routine",status:"success",groupKey:"media:spotify",explanation:"Playback changed"};
  const groups=groupOperationsTimeline([
    {...base,id:"1",time:1000000},
    {...base,id:"2",time:800000,severity:"warning"},
    {...base,id:"3",time:100000},
  ]);
  assert.equal(groups.length,2);
  assert.equal(groups[0].events.length,2);
  assert.equal(groups[0].severity,"warning");
});

test("Version 30.6 UI exposes the complete actionable Operations Center",async()=>{
  const [page,styles,linux,windows,workflow,pkg,android]=await Promise.all([source("../app/page.tsx"),source("../app/v30.css"),source("../local/lcars_bridge.py"),source("../windows/lcars_bridge_windows.py"),source("../.github/workflows/v30-development.yml"),source("../package.json"),source("../mobile/android/app/build.gradle")]);
  for(const token of ["OPERATIONS CENTER","WHAT CHANGED?","ACKNOWLEDGE","ASSIGN","RUN AGAIN","REVERSE","PROPAGATE","EXPORT REPORT"])assert.ok(page.includes(token),token);
  assert.match(page,/buildOperationsTimeline/);
  assert.match(page,/lcars-operations-meta/);
  assert.match(page,/kind:\"notice\"/);
  assert.match(styles,/\.operations-center\.notice-history/);
  assert.match(linux,/def media_control\(player,command\)/);
  assert.match(linux,/\"play\",\"pause\"/);
  assert.match(windows,/\"play\":0xB3,\"pause\":0xB3/);
  assert.equal(JSON.parse(pkg).version,"30.6.0-dev.1");
  assert.match(android,/versionCode 306001/);
  assert.match(workflow,/gh release (?:view|create) v30\.6/);
});
