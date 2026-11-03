"use client";
import {useCallback,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {computerTerminology} from './tos-terminology';
import {consoleScreenSheets,type ScreenPart,type ScreenSheet,type ScreenBoundary} from './tos-screen-pages';

/** A fixed glass viewport over the original, mounted display. No cloned records or handlers. */
export function TosScreen({children,pageKey='display',navigationTarget,controlsOpen=true,toggleControls}:{children:ReactNode;pageKey?:string;navigationTarget?:HTMLDivElement|null;controlsOpen?:boolean;toggleControls?:()=>void}){
 const viewport=useRef<HTMLDivElement|null>(null),track=useRef<HTMLDivElement|null>(null);
 const [sheets,setSheets]=useState<ScreenSheet[]>([{label:'STATUS',start:0,end:0,part:1}]),[selected,setSelected]=useState(0),[limit,setLimit]=useState(4);
 const key=useRef(pageKey),activeSheet=useRef(sheets[0]);activeSheet.current=sheets[Math.min(selected,sheets.length-1)];
 const change=useCallback((index:number)=>setSelected(index),[]);
 useLayoutEffect(()=>{
  const glass=viewport.current,source=track.current;if(!glass||!source)return;
  let frame=0,disposed=false;
  const layout=()=>{
   frame=0;if(disposed)return;
   const height=Math.max(24,glass.clientHeight-2),width=glass.clientWidth;
   const value=`${height}px`;if(source.style.getPropertyValue('--tos-display-height')!==value)source.style.setProperty('--tos-display-height',value);
   const content=source.querySelector<HTMLElement>('.content')||source;
   // Uncap nested record panes as well; their complete contents belong to these sheets.
   for(const element of Array.from(content.querySelectorAll<HTMLElement>('*'))){
    if(element.matches('input,textarea,video,audio,iframe'))continue;
    const overflow=getComputedStyle(element).overflowY;
    if(element.clientHeight&&element.scrollHeight>element.clientHeight+2&&(overflow==='auto'||overflow==='scroll'))element.dataset.tosFlowSource='';
   }
   const origin=content.getBoundingClientRect().top;
   const visible=(element:Element)=>{const box=element.getBoundingClientRect();return box.height>0&&box.width>0&&getComputedStyle(element).display!=='none';};
   const relative=(element:Element)=>{const box=element.getBoundingClientRect();return {top:Math.max(0,box.top-origin),bottom:Math.max(0,box.bottom-origin)};};
   const end=Math.ceil(Math.max(content.scrollHeight,content.getBoundingClientRect().height));
   const markers=[{label:pageKey==='overview'?'STATION STATUS':pageKey.replace(/^custom:/,'').replaceAll('-',' ').toUpperCase(),start:0}];
   // Section and panel headings define the named display parts.
   const headings=Array.from(content.querySelectorAll<HTMLElement>('h3,h4,[data-tos-screen-part]')).filter(visible);
   for(const heading of headings){
    const start=relative(heading).top,label=computerTerminology(heading.dataset.tosScreenPart||heading.textContent||'INFORMATION').replace(/\s+/g,' ').trim().replace(/\s+(?:SYS|APP|OPS)-\d+$/,'').slice(0,44);
    if(start>markers.at(-1)!.start+24&&label)markers.push({label,start});
   }
   const parts:ScreenPart[]=markers.map((part,index)=>({...part,end:markers[index+1]?.start??end}));
   const blocks:ScreenBoundary[]=Array.from(content.querySelectorAll('svg,img,video,canvas,iframe,tr,li,p,.tos-display-choice,.tos-information-fields>div,.tos-numeric-bank>article,dl>div')).filter(visible).map(relative);
   // Actual rendered text lines prevent cuts through a line in long paragraphs or terminal output.
   const walker=document.createTreeWalker(content,NodeFilter.SHOW_TEXT);
   for(let node=walker.nextNode();node;node=walker.nextNode()){
    if(!node.textContent?.trim()||!node.parentElement||node.parentElement.closest('svg,script,style')||!visible(node.parentElement))continue;
    const range=document.createRange();range.selectNodeContents(node);
    for(const rect of Array.from(range.getClientRects()))if(rect.height&&rect.width)blocks.push({top:Math.max(0,rect.top-origin),bottom:Math.max(0,rect.bottom-origin)});
   }
   const next=consoleScreenSheets(parts,blocks,height);
   setSheets(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);
   setLimit((navigationTarget?.clientWidth||width)<980?2:4);
   if(key.current!==pageKey||activeSheet.current.label==='STATUS'){key.current=pageKey;setSelected(pageKey==='overview'?Math.max(0,next.findIndex(item=>item.label==='ENGINEERING INSTRUMENTS')):0);}else {const matching=next.findIndex(item=>item.label===activeSheet.current.label&&item.part===activeSheet.current.part);setSelected(matching<0?Math.max(0,next.findIndex(item=>item.label===activeSheet.current.label)):matching);}
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(layout);};
  const resize=new ResizeObserver(schedule),mutation=new MutationObserver(schedule);
  resize.observe(glass);resize.observe(source);mutation.observe(source,{subtree:true,childList:true,characterData:true});
  document.fonts?.ready.then(()=>!disposed&&schedule());layout();
  return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();};
 },[pageKey,navigationTarget]);
 const current=Math.min(selected,sheets.length-1),sheet=sheets[current],first=Math.floor(current/limit)*limit;
 useLayoutEffect(()=>{
  const source=track.current;if(!source)return;
  // Off-sheet source remains mounted for state/portals, and is excluded from assistive reading.
  const content=source.querySelector<HTMLElement>('.content')||source,origin=content.getBoundingClientRect().top;
  for(const element of Array.from(content.querySelectorAll<HTMLElement>('*'))){
   if(element.closest('svg'))continue;
   const box=element.getBoundingClientRect(),top=box.top-origin,bottom=box.bottom-origin;
   const outside=bottom<=sheet.start+.5||top>=sheet.end-.5;
   if(outside&&!element.hasAttribute('aria-hidden')){element.dataset.tosSheetAria='';element.setAttribute('aria-hidden','true');}
   else if(!outside&&element.hasAttribute('data-tos-sheet-aria')){delete element.dataset.tosSheetAria;element.removeAttribute('aria-hidden');}
  }
 },[sheet]);
 const navigation=<nav className="tos-display-selector" aria-label="Information display pages" onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();change(Math.max(0,Math.min(sheets.length-1,current+(event.key==='ArrowRight'?1:-1))));}}}>
  <button data-console-cap="square" data-console-face="full" type="button" aria-label="Previous display page" disabled={current===0} onClick={()=>change(current-1)}>◀</button>
  <div className="tos-display-keys" style={{gridTemplateColumns:`repeat(${limit},minmax(0,1fr))`}}>{sheets.slice(first,first+limit).map((item,offset)=><button data-console-cap="square" type="button" key={first+offset} aria-label={`Display page ${first+offset+1}: ${item.label}${item.part>1?` continued ${item.part}`:''}`} aria-pressed={first+offset===current} aria-controls="tos-information-glass" title={`${item.label}${item.part>1?` · SHEET ${item.part}`:''}`} onClick={()=>change(first+offset)}><i>{String(first+offset+1).padStart(2,'0')}</i><span>{item.label}{item.part>1?` · ${item.part}`:''}</span></button>)}</div>
  <button data-console-cap="square" data-console-face="full" type="button" aria-label="Next display page" disabled={current===sheets.length-1} onClick={()=>change(current+1)}>▶</button>
  {toggleControls&&<button data-console-cap="square" data-console-tone="blue" type="button" className="tos-display-command-key" aria-label="Command keys" aria-expanded={controlsOpen} onClick={toggleControls} title="Show or stow the command bank"><span>COMMAND KEYS</span><b>{controlsOpen?"▾":"▴"}</b></button>}
  <output aria-live="polite">DISPLAY {current+1} / {sheets.length}</output>
 </nav>;
 return <>{navigationTarget?createPortal(navigation,navigationTarget):navigation}<div ref={viewport} className="tos-screen-viewport" data-display-start={sheet.start} data-display-end={sheet.end} data-display-total={sheets.at(-1)?.end} id="tos-information-glass" role="region" aria-label={`${sheet.label} information display, page ${current+1} of ${sheets.length}`}><div ref={track} className="tos-screen-track" style={{transform:`translate3d(0,${-sheet.start}px,0)`,clipPath:`inset(${sheet.start}px 0 max(0px, calc(100% - ${sheet.end}px)) 0)`}}>{children}</div></div></>;
}
