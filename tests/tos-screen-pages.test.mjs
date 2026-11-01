import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {consoleScreenSheets} from '../app/tos-screen-pages.ts';
test('display sheets keep named parts separate and every record interval reachable',()=>{
 const sections=[{label:'ENGINEERING',start:0,end:530},{label:'PROGRAMS',start:530,end:700}],blocks=[{top:45,bottom:210},{top:240,bottom:390},{top:405,bottom:460}];
 const sheets=consoleScreenSheets(sections,blocks,280);
 assert.deepEqual(sheets.map(x=>[x.label,x.start,x.end]),[['ENGINEERING',0,240],['ENGINEERING',240,520],['ENGINEERING',520,530],['PROGRAMS',530,700]]);
 assert.deepEqual(sheets.map(x=>x.part),[1,2,3,1]);
});
test('nested record and line boundaries cannot leave holes or loop on a cut',()=>{
 const cases=[[],[{top:0,bottom:120}],[{top:20,bottom:80},{top:70,bottom:140},{top:135,bottom:170}],[{top:0,bottom:10000}]];
 for(const height of [24,56,125,270,700])for(const blocks of cases){
  const sheets=consoleScreenSheets([{label:'RECORDS',start:0,end:850}],blocks,height);
  assert.equal(sheets[0].start,0);assert.equal(sheets.at(-1).end,850);
  for(let i=0;i<sheets.length;i++){assert.ok(sheets[i].end>sheets[i].start);assert.ok(sheets[i].end-sheets[i].start<=height);if(i)assert.equal(sheets[i].start,sheets[i-1].end);}
 }
});
test('cuts move above complete fitting records instead of splitting them',()=>{
 for(let n=1;n<=100;n++){
  const height=90+n,blocks=Array.from({length:16},(_,i)=>({top:i*43,bottom:i*43+28}));
  const sheets=consoleScreenSheets([{label:'REGISTER',start:0,end:688}],blocks,height);
  for(const sheet of sheets.slice(0,-1))assert.ok(!blocks.some(block=>block.top<sheet.end-.5&&block.bottom>sheet.end+.5));
 }
});

test('physical display arrows use the TOS key cue and suppress repeat chatter',()=>{
 const page=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8'),start=page.indexOf('  const tosConsoleKeyboardKey='),end=page.indexOf('  const beep =',start);
 let sounds=0;class Element{closest(selector){return selector==='.tos-display-selector'?this:null;}}
 const key=runInNewContext(ts.transpileModule(page.slice(start,end)+';tosConsoleKeyboardKey;',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,{Element,playTosKey:()=>sounds++});
 key({target:new Element(),key:'ArrowRight',repeat:false});key({target:new Element(),key:'ArrowLeft',repeat:false});assert.equal(sounds,2);
 key({target:new Element(),key:'ArrowRight',repeat:true});assert.equal(sounds,2);
});
