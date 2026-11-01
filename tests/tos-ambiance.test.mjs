import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const bootstrap=require('../desktop/startup-audio.cjs').startupAudioBootstrap;
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function harness({enabled=false,startup=true,href='lcars://app/index.html',blocked=false,deferred=false,safe=false}={}){
 let now=0,nextTimer=0,release;
 const timers=new Map(),tracks=[],assets=[],revoked=[],events=[],listeners=new Map();
 const storage=new Map([['lcars-theme','tos'],['lcars-tos-ambiance',String(enabled)],['lcars-shell-prefs',JSON.stringify({startupSound:startup})],['lcars-accessibility','{"soundVolume":40}']]);
 class Audio{
  constructor(url){this.url=url;this.volume=1;this.currentTime=0;this.paused=true;this.readyState=1;this.dataset={};this.plays=0;tracks.push(this);}
  async play(){this.plays++;if(blocked){const e=new Error('user gesture required');e.name='NotAllowedError';throw e;}this.paused=false;}
  pause(){this.paused=true;}remove(){this.removed=true;}
 }
 class AudioURL extends URL{static createObjectURL(){return 'blob:track-'+tracks.length;}static revokeObjectURL(url){revoked.push(url);}}
 const win={location:{href},document:{body:{appendChild(){}},querySelector:()=>null},addEventListener:(name,fn)=>listeners.set(name,fn),dispatchEvent:event=>events.push(event)};
 const gate=deferred?new Promise(resolve=>{release=resolve;}):Promise.resolve();
 const context={window:win,Audio,URL:AudioURL,AbortController,Date:{now:()=>now},CustomEvent:class{constructor(type,props){this.type=type;this.detail=props.detail;}},localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},sessionStorage:{getItem:()=>safe?'1':null},setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),fetch:async asset=>{assets.push(asset);await gate;return{ok:true,blob:async()=>({type:'audio/mpeg'})};}};
 runInNewContext(bootstrap,context);
 return{api:win.__lcarsInterfaceAudio,win,tracks,assets,revoked,events,storage,listeners,release:()=>release?.(),unblock:()=>{blocked=false;},advance:async ms=>{const end=now+ms;while(true){const pending=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending)break;now=pending[1].at;timers.delete(pending[0]);pending[1].fn();await flush();}now=end;await flush();}};
}
test('manual ambiance fades in from four seconds and every subsequent loop returns there',async()=>{
 const h=harness();await h.api.setAmbiance(true);const track=h.tracks[0];
 assert.match(h.assets[0],/tos-bridge-ambiance.mp3$/);assert.equal(track.currentTime,4);assert.equal(track.volume,0);assert.equal(track.paused,false);
 await h.advance(900);assert.ok(track.volume>0&&track.volume<.4);await h.advance(940);assert.equal(track.volume,.4);
 for(let i=0;i<3;i++){track.currentTime=257;track.paused=true;await track.onended();assert.equal(track.currentTime,4);assert.equal(track.volume,.4);assert.equal(track.paused,false);}
 assert.equal(h.tracks.length,1);assert.equal(h.assets.length,1);assert.equal(h.storage.get('lcars-tos-ambiance'),'true');
});
test('enabled startup plays the full intro once with no end fade and coalesces renderer/native callers',async()=>{
 const h=harness({enabled:true,deferred:true});const a=h.api.startup(),b=h.api.startup();h.release();await Promise.all([a,b]);
 assert.equal(h.tracks.length,1);assert.equal(h.tracks[0].plays,1);assert.equal(h.tracks[0].currentTime,0);assert.equal(h.tracks[0].volume,.4);
 await h.advance(12000);assert.equal(h.tracks[0].volume,.4);assert.equal((await h.api.startup()).status,'ALREADY PLAYED');
 await h.tracks[0].onended();assert.equal(h.tracks[0].currentTime,4);
 const quiet=harness({enabled:true,startup:false});await quiet.api.startup();assert.equal(quiet.tracks[0].currentTime,4);assert.equal(quiet.tracks[0].volume,0);
});
test('turning ambiance off fades, pauses, and prevents another loop',async()=>{
 const h=harness({enabled:true});await h.api.startup();await h.api.setAmbiance(false);const track=h.tracks[0];
 assert.equal(h.api.status().phase,'FADING OUT');await h.advance(320);assert.ok(track.volume>0&&track.volume<.4);await h.advance(400);
 assert.equal(track.volume,0);assert.equal(track.paused,true);assert.equal(h.api.status().phase,'OFF');const plays=track.plays;await track.onended();assert.equal(track.plays,plays);
});
test('rapid toggles and cancellation during loading cannot start stale audio',async()=>{
 const h=harness({deferred:true});const first=h.api.setAmbiance(true);await h.api.setAmbiance(false);h.release();await first;assert.equal(h.tracks.length,0);assert.equal(h.api.status().phase,'OFF');
 const next=h.api.setAmbiance(true);await h.api.setAmbiance(false);const last=h.api.setAmbiance(true);await Promise.all([next,last]);assert.equal(h.tracks.length,1);assert.equal(h.tracks[0].plays,1);assert.equal(h.api.status().phase,'PLAYING');
 await h.api.setAmbiance(false);await h.advance(100);await h.api.setAmbiance(true);await h.advance(2000);assert.equal(h.tracks[0].paused,false);assert.equal(h.tracks[0].volume,.4);
});
test('theme changes stop pending and active ambiance, returning to TOS resumes its bed',async()=>{
 const h=harness({deferred:true});const pending=h.api.setAmbiance(true);h.api.sync('classic',true,40);h.release();await pending;assert.equal(h.api.status().phase,'SUSPENDED');assert.ok(h.tracks.every(track=>track.paused));
 await h.api.sync('tos',true,40);assert.equal(h.tracks[0].currentTime,4);assert.equal(h.tracks[0].paused,false);h.api.sync('classic',true,40);assert.equal(h.tracks[0].paused,true);
});
test('autoplay recovery, volume/mute, audio errors, and unload stay on one owner',async()=>{
 const h=harness({blocked:true});assert.equal((await h.api.setAmbiance(true)).status,'BLOCKED');h.unblock();await h.api.resume();await h.advance(2000);assert.equal(h.tracks.length,1);
 h.api.setVolume(0);assert.equal(h.tracks[0].volume,0);h.api.setVolume(75);assert.equal(h.tracks[0].volume,.75);
 h.tracks[0].onerror();assert.equal(h.api.status().phase,'FAILED');assert.equal(h.tracks[0].paused,true);
 h.listeners.get('unload')();assert.equal(h.revoked.length,1);assert.equal(h.tracks[0].removed,true);
});
test('detached windows and recovery mode never start a second bridge recording',async()=>{
 for(const options of [{href:'lcars://app/index.html?tool=page-peek&page=overview'},{href:'lcars://app/index.html?section=terminal'},{safe:true}]){
  const h=harness({...options,enabled:true});await h.api.startup();await h.api.setAmbiance(true);await h.api.resume();assert.equal(h.tracks.length,0);
 }
 const config=readFileSync(new URL('../electron-builder.yml',import.meta.url),'utf8');assert.match(config,/desktop\/startup-audio.cjs/);assert.match(config,/app\/interface-audio-runtime.js/);
});

test('the first gesture on the ambiance key cannot race the startup retry and turn PLAY off',async()=>{
 const h=harness({enabled:true,blocked:true});await h.api.startup();assert.equal(h.api.status().phase,'BLOCKED');h.unblock();
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8'),start=page.indexOf('    const power=async('),end=page.indexOf('    window.addEventListener(',start);
 assert.ok(start>=0&&end>start);
 const power=runInNewContext('let powered=false;'+ts.transpileModule(page.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';power;',{interfaceAudio:h.api});
 await power({type:'pointerdown',target:{closest:()=>true}});assert.equal(h.tracks[0].plays,1);
 await h.api.resume();assert.equal(h.api.status().enabled,true);assert.equal(h.api.status().phase,'PLAYING');assert.equal(h.tracks[0].plays,2);
});
