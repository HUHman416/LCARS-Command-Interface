import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { interpretComputerCommand } from "../app/v30-core.ts";
import { matchMediaSource, mediaSourceAliases, preferredMediaSource } from "../app/v30-media-core.ts";
import { decryptOperatorBackup, encryptOperatorBackup, normalizeOperatorIdentities, normalizeOperatorWorkspace, operatorCan } from "../app/v30-operator-core.ts";

const source=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const media=[
  {id:"spotify",name:"Spotify",status:"Paused"},
  {id:"chromium.instance92",name:"Chromium",status:"Stopped"},
];
const context={pages:[],apps:[],procedures:[],workstations:[],themes:[],mediaSources:media.map((item)=>({...item,aliases:mediaSourceAliases(item)}))};

test("media aliases and live state selection cover the requested sources",()=>{
  assert.equal(matchMediaSource(media,"Spotify")?.id,"spotify");
  assert.equal(matchMediaSource(media,"Chrome")?.id,"chromium.instance92");
  assert.equal(matchMediaSource(media,"Opera GX")?.id,"chromium.instance92");
  assert.equal(preferredMediaSource(media,"play")?.id,"spotify");
  assert.equal(preferredMediaSource([{...media[0],status:"Playing"},{...media[1],status:"Paused"}],"pause")?.id,"spotify");
  assert.equal(preferredMediaSource(media,"play","VLC"),null);
});

test("Computer Core parses untargeted and named resume phrases without inventing a source",()=>{
  const generic=interpretComputerCommand("Resume Music",context,"voice");
  assert.equal(generic.valid,true);
  assert.equal(generic.steps[0].target,"play");
  assert.equal(generic.steps[0].value,undefined);
  for(const phrase of ["Resume Spotify","Play music from Chrome","Continue using Opera GX"]){
    const plan=interpretComputerCommand(phrase,context,"voice");
    assert.equal(plan.valid,true,phrase);
    assert.equal(plan.steps[0].command,"media-control",phrase);
  }
  assert.equal(interpretComputerCommand("Resume Imaginary Player",context,"voice").valid,false);
});

test("operator identities are bounded, role-aware, and backup credentials never roam",async()=>{
  const workspace=normalizeOperatorWorkspace({theme:"voyager",favoriteIds:Array.from({length:30},(_,index)=>`app-${index}`),workstations:[{name:"Bridge"}],routines:[{name:"Night Watch"}],prefs:{voiceAuthorizationCode:"must-not-export"}});
  assert.equal(workspace.favoriteIds.length,20);
  const [administrator]=normalizeOperatorIdentities([{id:"captain",name:"Captain",role:"administrator",credential:{salt:"salt",hash:"hash",iterations:310000},createdAt:"2026-08-30",updatedAt:"2026-08-30",stationPreferences:{},workspace}]);
  assert.equal(operatorCan(administrator,"identity"),true);
  assert.equal(operatorCan({...administrator,role:"operator"},"protected"),false);
  assert.equal(operatorCan({...administrator,role:"guest",awayTeam:true},"automation"),false);
  const backup=await encryptOperatorBackup(administrator,"eight-characters");
  const restored=await decryptOperatorBackup(backup,"eight-characters");
  assert.equal(restored.credential,null);
  assert.equal(restored.workspace.theme,"voyager");
  assert.equal(restored.workspace.prefs.voiceAuthorizationCode,undefined);
  assert.notEqual(restored.id,administrator.id);
  await assert.rejects(()=>decryptOperatorBackup(backup,"wrong-password"));
});

test("Version 30.8 retains the operator center, integrated player, and secure roaming",async()=>{
  const [page,styles,bridge,padd,android,workflow,pkg,gradle]=await Promise.all([
    source("../app/page.tsx"),source("../app/v30.css"),source("../local/lcars_bridge.py"),source("../shared/lcars_padd.py"),source("../mobile/android/app/src/main/java/com/lcars/padd/CompanionDock.java"),source("../.github/workflows/v30-development.yml"),source("../package.json"),source("../mobile/android/app/build.gradle"),
  ]);
  for(const token of ["OPERATOR IDENTITIES","QUICK OPERATOR SWITCH","AWAY TEAM PROFILE","TRUSTED-STATION ROAMING","ENCRYPTED PROFILE BACKUP","LCARS MEDIA DECK","FULLSCREEN"])assert.ok(page.includes(token),token);
  assert.match(styles,/\.operator-center/);
  assert.match(styles,/\.integrated-media-hud/);
  assert.match(bridge,/command was accepted but playback remained/);
  assert.match(bridge,/media_player_aliases/);
  assert.match(padd,/_scrub_profile_value/);
  assert.match(padd,/kind not in \{"page", "clipboard", "notice", "file", "profile"\}/);
  assert.match(android,/roaming-profile-v30-7/);
  assert.equal(JSON.parse(pkg).version,"30.8.1-dev.1");
  assert.match(gradle,/versionCode 308002/);
  assert.match(workflow,/gh release (?:view|create) v30\.8\.1/);
});
