import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {startupSoundAsset} from '../app/tos-audio.ts';
const require=createRequire(import.meta.url);
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const main=read('desktop/main.cjs'),page=read('app/page.tsx');
const dialogExports={};
runInNewContext(ts.transpileModule(read('app/console-dialogs.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:dialogExports});
const deckExports={};
runInNewContext(ts.transpileModule(read("app/tos-deck.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:deckExports});
const terminologyExports={};
runInNewContext(ts.transpileModule(read("app/tos-terminology.tsx"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:terminologyExports,require});
const screenPages={};runInNewContext(ts.transpileModule(read('app/tos-screen-pages.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:screenPages});
const screen={};runInNewContext(ts.transpileModule(read('app/tos-screen.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:screen,require:name=>name==='./tos-screen-pages'?screenPages:name==='./tos-terminology'?terminologyExports:require(name)});
const consoleRequire=name=>name==='./tos-screen'?screen:name==="./tos-terminology"?terminologyExports:name==="./tos-deck"?deckExports:name==='./console-dialogs'?dialogExports:require(name);

const bootstrap=require('../desktop/startup-audio.cjs').startupAudioBootstrap;
function audioHarness(theme,prefs={}){
 const values=new Map([['lcars-theme',theme],['lcars-shell-prefs',JSON.stringify(prefs)]]),made=[],assets=[],revoked=[];
 class Audio{constructor(url){this.url=url;this.plays=0;this.pauses=0;made.push(this);}async play(){this.plays++;}pause(){this.pauses++;}}
 class AudioURL extends URL{static createObjectURL(){return 'blob:'+made.length;}static revokeObjectURL(url){revoked.push(url);}}
 const window={location:{href:'lcars://app/index.html'},addEventListener(){},dispatchEvent(){}};
 runInNewContext(bootstrap,{window,Audio,URL:AudioURL,CustomEvent:class{constructor(type,props){this.type=type;this.detail=props.detail;}},localStorage:{getItem:key=>values.get(key)||null},fetch:async asset=>{assets.push(asset);return{ok:true,blob:async()=>({type:'audio/mpeg'})};}});
 return{window,values,made,assets,revoked};
}
test('startup chooses the TOS fade recording and preserves mute, once-only playback, and forced testing',async()=>{
 const h=audioHarness('tos');
 assert.equal((await h.window.__lcarsPlayStartupSound()).status,'PLAYING');
 assert.match(h.assets[0],/tos-startup-10s\.mp3$/);assert.equal(h.made[0].volume,.42);
 assert.equal((await h.window.__lcarsPlayStartupSound()).status,'ALREADY PLAYED');assert.equal(h.made[0].plays,1);
 await h.window.__lcarsPlayStartupSound(true);assert.equal(h.made.length,1);assert.equal(h.made[0].plays,2);
 h.values.set('lcars-theme','classic');await h.window.__lcarsPlayStartupSound(true);
 assert.match(h.assets[1],/power-up\.mp3$/);assert.equal(h.made.length,2);assert.equal(h.revoked.length,1);
 const muted=audioHarness('tos',{startupSound:false});assert.equal((await muted.window.__lcarsPlayStartupSound()).status,'DISABLED');assert.equal(muted.assets.length,0);
 await muted.window.__lcarsPlayStartupSound(true);assert.equal(muted.assets.length,1);
 for(const family of ['classic','voyager','nemesis','picard','lower-decks','defiant',null])assert.equal(startupSoundAsset(family),'assets/sounds/power-up.mp3');
 assert.ok(readFileSync(new URL('../public/'+startupSoundAsset('tos'),import.meta.url)).length>10000);
});
test('real page-shortcut handler plays one cue for number/numpad navigation and command shortcuts',()=>{
 const start=page.indexOf('    const key = (e: KeyboardEvent) => {'),end=page.indexOf('    window.addEventListener("keydown", key, true);',start);
 assert.ok(start>=0&&end>start);
 const calls=[],context={visibleNav:[['overview'],['terminal'],['files']],shortcutTargetIsEditable:target=>Boolean(target?.editable),setSection:value=>calls.push(['section',value]),setPaletteOpen:value=>calls.push(['palette',value]),playTosKey:()=>calls.push(['sound']),setComputerSeed(){},setComputerSource(){},setComputerVoiceAuthorized(){},setComputerOpen(){},setPaletteQuery(){},setLocked(){}};
 const handler=runInNewContext(ts.transpileModule(page.slice(start,end)+';key;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const event=(code,key,extra={})=>({code,key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,repeat:false,target:null,preventDefault(){},...extra});
 handler(event('Digit3','3'));assert.deepEqual(calls,[['section','files'],['palette',false],['sound']]);calls.length=0;
 handler(event('Numpad2','2'));assert.equal(calls.filter(x=>x[0]==='sound').length,1);calls.length=0;
 handler(event('Digit1','1',{repeat:true}));assert.equal(calls.some(x=>x[0]==='sound'),false);calls.length=0;
 handler(event('Digit2','2',{target:{editable:true}}));assert.equal(calls.length,0);
 handler(event('KeyF','f',{ctrlKey:true}));handler(event('KeyK','k',{ctrlKey:true}));assert.equal(calls.filter(x=>x[0]==='sound').length,2);
});
test('only an explicitly themed LCARS-owned detached document or peek loses native window chrome',()=>{
 const {isTosDetachedWorkspace}=require('../desktop/tos-window.cjs');
 assert.equal(isTosDetachedWorkspace('lcars://app/index.html?tool=document&console=tos&path=%2Ftmp%2Fnote.txt'),true);
 assert.equal(isTosDetachedWorkspace('lcars://app/index.html?tool=page-peek&console=tos&page=overview'),true);
 for(const value of ['https://example.com/?tool=document&console=tos','lcars://other/index.html?tool=document&console=tos','lcars://app/index.html?tool=document','lcars://app/index.html?tool=unknown&console=tos','invalid'])assert.equal(isTosDetachedWorkspace(value),false,value);
 assert.match(read('electron-builder.yml'),/desktop\/tos-window\.cjs/);
});
test('other families retain native controls and TOS information renders without screen buttons',()=>{
 const source=ts.transpileModule(read('app/tos-console.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};runInNewContext(source,{exports,require:consoleRequire,URLSearchParams});
 const {ConsoleThemeProvider,ConsoleDisplay,ConsoleButton,ConsoleControls}=exports;
 const tree=tos=>React.createElement(ConsoleThemeProvider,{tos},React.createElement(ConsoleDisplay,{tos},React.createElement('section',null,React.createElement('p',null,'CURRENT INFORMATION'),React.createElement(ConsoleControls,null,React.createElement(ConsoleButton,null,'COMMAND')),React.createElement(ConsoleButton,{consoleChoice:true},React.createElement('span',null,'DOCUMENT NAME')))));
 const classic=renderToStaticMarkup(tree(false));assert.equal(classic,'<section><p>CURRENT INFORMATION</p><button>COMMAND</button><button><span>DOCUMENT NAME</span></button></section>');
 const tos=renderToStaticMarkup(tree(true));assert.match(tos,/tos-monitor/);assert.match(tos,/CURRENT INFORMATION/);assert.match(tos,/DOCUMENT NAME/);assert.doesNotMatch(tos.slice(tos.indexOf('class="tos-screen-track"')),/<button/);
 const url=exports.detachedWorkspaceUrl('document',{path:'/tmp/a b.txt'},true);assert.equal(new URL(url).searchParams.get('path'),'/tmp/a b.txt');assert.equal(new URL(url).searchParams.get('console'),'tos');
});
test('the integrated media station renders its empty state without an undefined drag flag',()=>{
 const exports={};runInNewContext(ts.transpileModule(read('app/tos-console.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:consoleRequire,URLSearchParams});
 const start=page.indexOf('const formatMediaTime ='),end=page.indexOf('function MediaConsole(',start);
 const playerSource=ts.transpileModule(page.slice(start,end)+';exports.Player=IntegratedLcarsPlayer;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const result={};runInNewContext(playerSource,{exports:result,require,...exports,useState:React.useState,useRef:React.useRef,useEffect:React.useEffect});
 const html=renderToStaticMarkup(React.createElement(result.Player,{notify(){},event(){},request:null,browse(){}}));
 assert.match(html,/OPEN AUDIO OR VIDEO/);assert.match(html,/integrated-media-stage paused/);
});
test('themed prompts wait for an operator decision and cancel safely when their host closes',async()=>{
 let tos=true;const received=[],native=[];const exports={};
 const code=ts.transpileModule(read('app/console-dialogs.ts'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 runInNewContext(code,{exports,document:{querySelector:()=>tos?{}:null},window:{prompt:(...args)=>{native.push(['prompt',...args]);return 'native name';},confirm:()=>{native.push(['confirm']);return true;},alert:message=>native.push(['alert',message])}});
 const unsubscribe=exports.subscribeConsoleDialogs(item=>received.push(item));
 let completed=false;const permission=exports.consoleConfirm('Grant module capabilities?').then(value=>{completed=true;return value;});
 await Promise.resolve();assert.equal(completed,false);assert.equal(native.length,0);received[0].finish(null);assert.equal(await permission,false);
 const name=exports.consolePrompt('Workstation name','Current name');assert.equal(received[1].initial,'Current name');received[1].finish('Bridge watch');assert.equal(await name,'Bridge watch');
 const pending=exports.consoleConfirm('Continue routine?');unsubscribe();assert.equal(await pending,false);
 tos=false;assert.equal(await exports.consolePrompt('Rename'),'native name');assert.equal(await exports.consoleConfirm('Confirm'),true);assert.equal(native.length,2);
});

test('control pages preserve order and keep whole fields within wide and compact bank capacities',()=>{
 const {consoleControlPages}=deckExports;
 assert.deepEqual(Array.from(consoleControlPages([1,1,1,3,3,1,6,1],6)),[0,0,0,0,1,1,2,3]);
 for(const capacity of [3,6]){
  const costs=[1,3,1,1,6,3,3,1,1,1,1,1],pages=consoleControlPages(costs,capacity),totals=new Map();
  assert.equal(pages.length,costs.length);
  pages.forEach((page,index)=>totals.set(page,(totals.get(page)||0)+Math.min(capacity,costs[index])));
  assert.ok([...totals.values()].every(total=>total<=capacity));
  assert.ok(pages.every((page,index)=>index===0?page===0:page===pages[index-1]||page===pages[index-1]+1));
 }
});
test('TOS Search shows bounded passive records while other families keep all native result actions',()=>{
 const helpers={};runInNewContext(ts.transpileModule(read('app/tos-console.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:helpers,require:consoleRequire,URLSearchParams});
 const search={};runInNewContext(ts.transpileModule(read('app/v30-search.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:search,require:name=>name==='./tos-console'?helpers:require(name)});
 const results=Array.from({length:12},(_,i)=>({id:String(i),category:'applications',title:`Record ${String(i+1).padStart(2,'0')}`,detail:'LOCAL APPLICATION'}));
 const props={query:'',results,devices:[],procedures:[],fabric:null,filesLoading:false};
 const render=tos=>renderToStaticMarkup(React.createElement(helpers.ConsoleThemeProvider,{tos},React.createElement(search.UniversalSearch,props)));
 const tos=render(true),classic=render(false);
 assert.match(tos,/Record 08/);assert.doesNotMatch(tos,/Record 09/);assert.doesNotMatch(tos,/<button/);assert.match(tos,/SELECTED RECORD 1 \/ 12/);
 assert.match(classic,/Record 12/);assert.equal((classic.match(/>OPEN<\/button>/g)||[]).length,12);
});

test('TOS uses Computer for owned interface copy while preserving source text, field values, and handlers',()=>{
 const {computerTerminology,computerContent}=terminologyExports;
 assert.equal(computerTerminology('SELECT ONE OR MORE ITEMS FOR LCARS COMMANDS'),'SELECT ONE OR MORE ITEMS FOR COMPUTER COMMANDS');
 assert.equal(computerTerminology('Open the LCARS interface'),'Open the Computer interface');
 assert.equal(computerTerminology('LCARS COMPUTER CORE'),'COMPUTER CORE');
 assert.equal(computerTerminology('terminal@lcars:~$'),'COMPUTER >');
 for(const value of ['LCARS Manual.pdf','https://example.com/LCARS','/home/operator/LCARS','~/LCARS','lcars://app/index.html'])assert.equal(computerTerminology(value),value);
 let passedTitle="";const LogicBoundary=({title})=>{passedTitle=title;return React.createElement('span',null,title);};
 renderToStaticMarkup(computerContent(React.createElement('div',null,React.createElement(LogicBoundary,{title:'LCARS backend identifier'})),true));assert.equal(passedTitle,'LCARS backend identifier');
 const click=()=>{},tree=React.createElement('section',null,React.createElement('button',{'aria-label':'Open LCARS',onClick:click},'LCARS COMMANDS'),React.createElement('input',{placeholder:'LCARS command',value:'LCARS actual value',readOnly:true}),React.createElement('pre',null,'LCARS terminal source'),React.createElement('b',{'data-console-verbatim':''},'LCARS original record'));
 const classic=renderToStaticMarkup(computerContent(tree,false)),tos=renderToStaticMarkup(computerContent(tree,true));
 assert.match(classic,/>LCARS COMMANDS</);assert.match(tos,/>COMPUTER COMMANDS</);assert.match(tos,/aria-label="Open Computer"/);assert.match(tos,/value="LCARS actual value"/);assert.match(tos,/LCARS terminal source/);assert.match(tos,/LCARS original record/);
 assert.equal(React.Children.toArray(computerContent(tree,true))[0].props.children[0].props.onClick,click);
 const helpers={};runInNewContext(ts.transpileModule(read('app/tos-console.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:helpers,require:consoleRequire,URLSearchParams});
 const Widget=()=>React.createElement(helpers.ConsoleCopy,null,React.createElement('small',null,'LCARS INITIALIZATION'));
 const standalone=tos=>renderToStaticMarkup(React.createElement(helpers.ConsoleThemeProvider,{tos},React.createElement(Widget)));
 assert.equal(standalone(true),'<small>COMPUTER INITIALIZATION</small>');assert.equal(standalone(false),'<small>LCARS INITIALIZATION</small>');
});
test('all eleven TOS displays expose passive state registers and honest offline/sample labels',()=>{
 const result={};runInNewContext(ts.transpileModule(read('app/tos-information.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:result,require:consoleRequire});
 const props={connected:false,platform:'TEST HOST',meters:[['CPU',18],['GPU',31],['MEM',42],['DISK',68]],applications:6,windows:2,players:3,volume:64,muted:false,operator:'LCARS OPERATOR',role:'administrator',modules:4,isolated:1,paired:2,online:1,pending:5,notices:7,dnd:false,updateAvailable:true,channel:'development',scale:110,sound:true,contrast:true,motion:false,colorSafe:false,settingsArea:'interface',restore:true};
 for(const section of ['overview','terminal','files','system','media','network','updates','settings','portals','utilities','commissioning']){
  const html=renderToStaticMarkup(React.createElement(result.TosInformationReadout,{...props,section}));assert.doesNotMatch(html,/<(?:button|input|select|textarea|a)\b/);assert.doesNotMatch(html,/LCARS OPERATOR/);
  if(['overview','system','media'].includes(section))assert.match(html,/DEMONSTRATION SAMPLE/);
  if(section==='network'){assert.match(html,/2 paired stations, 1 reported online/);assert.match(html,/local core offline/i);}
  if(section==='portals')assert.match(html,/5 requests awaiting authority/);
  if(section==='settings')assert.match(html,/110%/);
 }
});
