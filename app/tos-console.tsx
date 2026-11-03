"use client";
import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentPropsWithRef, type HTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { computerContent, computerProps, computerTerminology } from "./tos-terminology";
import { TosScreen } from "./tos-screen";
import { consoleControlPages } from "./tos-deck";
import { subscribeConsoleDialogs, type ConsoleDialogRequest } from "./console-dialogs";

type Group={id:string;label:string};
type ConsoleContext={enabled:boolean;targets:Record<string,HTMLDivElement>;register:((group:Group,token:string)=>()=>void)|null;rename:((id:string,label:string)=>void)|null;group:Group;inBank:boolean;activate?:(id:string)=>void};
const defaultGroup={id:"station",label:"STATION CONTROLS"};
const Context=createContext<ConsoleContext>({enabled:false,targets:{},register:null,rename:null,group:defaultGroup,inBank:false});
function caption(value:ReactNode):string{return Children.toArray(value).map(item=>typeof item==="string"||typeof item==="number"?String(item):isValidElement(item)?caption((item.props as {children?:ReactNode}).children):"").join(" ").replace(/\s+/g," ").trim().slice(0,64);}
function useDeck(enabled:boolean,initialGroup:Group=defaultGroup,close?:()=>void){
  const [groups,setGroups]=useState<Group[]>([]),[targets,setTargets]=useState<Record<string,HTMLDivElement>>({}),[selected,setSelected]=useState("");
  const members=useRef(new Map<string,Set<string>>());
  const register=useCallback((group:Group,token:string)=>{
    let tokens=members.current.get(group.id);
    if(!tokens){tokens=new Set();members.current.set(group.id,tokens);setGroups(old=>[...old.filter(item=>item.id!==group.id),group]);}
    tokens.add(token);
    return ()=>{const current=members.current.get(group.id);current?.delete(token);if(current?.size===0){members.current.delete(group.id);setGroups(old=>old.filter(item=>item.id!==group.id));}};
  },[]);
  const attach=useCallback((id:string,node:HTMLDivElement|null)=>setTargets(old=>{if(old[id]===node||(!node&&!old[id]))return old;const next={...old};if(node)next[id]=node;else delete next[id];return next;}),[]);
  const rename=useCallback((id:string,label:string)=>setGroups(old=>old.some(group=>group.id===id&&group.label!==label)?old.map(group=>group.id===id?{...group,label}:group):old),[]);
  const value:ConsoleContext={enabled,targets,register,rename,group:initialGroup,inBank:false,activate:setSelected};
  const active=groups.some(group=>group.id===selected)?selected:groups[0]?.id||"";
  return {value,deck:<FixedControlDeck groups={groups} active={active} select={setSelected} attach={attach} close={close}/>};
}
function FixedControlDeck({groups,active,select,attach,close}:{groups:Group[];active:string;select:(id:string)=>void;attach:(id:string,node:HTMLDivElement|null)=>void;close?:()=>void}){
  const index=groups.findIndex(group=>group.id===active),deckRef=useRef<HTMLDivElement|null>(null),[bankLimit,setBankLimit]=useState(4);
  useLayoutEffect(()=>{const deck=deckRef.current;if(!deck)return;const update=()=>{const width=deck.getBoundingClientRect().width;setBankLimit(width<340?1:width<700?2:4);};update();const resize=new ResizeObserver(update);resize.observe(deck);return()=>resize.disconnect();},[groups.length]);
  const first=Math.floor(Math.max(0,index)/bankLimit)*bankLimit;
  if(!groups.length)return null;
  return <div ref={deckRef} className="tos-command-deck tos-fixed-deck" role="region" aria-label="Console control deck" hidden={!groups.length}>
    <nav className={`tos-bank-selector ${close?"has-close":""}`} aria-label="Console bank selector">
      <button data-console-cap="square" data-console-face="full" aria-label="Previous control bank" disabled={index<=0} onClick={()=>select(groups[index-1].id)}>◀</button>
      <div className="tos-bank-keys" style={{gridTemplateColumns:`repeat(${bankLimit},minmax(0,1fr))`}}>{groups.slice(first,first+bankLimit).map((group,offset)=><button data-console-cap="square" key={group.id} className={active===group.id?"active":""} aria-label={`Control bank ${first+offset+1}: ${group.label}`} aria-pressed={active===group.id} title={group.label} onClick={()=>select(group.id)}><i>{String(first+offset+1).padStart(2,"0")}</i><span>{group.label}</span></button>)}</div>
      <button data-console-cap="square" data-console-face="full" aria-label="Next control bank" disabled={index>=groups.length-1} onClick={()=>select(groups[index+1].id)}>▶</button>{close&&<button data-console-cap="square" data-console-face="full" onClick={close}>CLOSE ×</button>}
    </nav>
    {groups.map(group=><ControlBank key={group.id} group={group} active={active===group.id} attach={attach}/>)}
  </div>;
}
/** Keep the original controls mounted, but expose only one bounded bank at a time. */
function ControlBank({group,active,attach}:{group:Group;active:boolean;attach:(id:string,node:HTMLDivElement|null)=>void}){
  const node=useRef<HTMLDivElement|null>(null),[page,setPage]=useState(0),[pages,setPages]=useState(1);
  const ref=useCallback((element:HTMLDivElement|null)=>{node.current=element;attach(group.id,element);},[attach,group.id]);
  useLayoutEffect(()=>{
    const bank=node.current;if(!bank)return;
    const layout=()=>{
      const capacity=(bank.closest(".tos-command-deck")?.getBoundingClientRect().width||800)<900?3:6;
      const units:HTMLElement[]=[];
      const visit=(element:HTMLElement)=>{
        if(element.matches("nav,form")||element.matches("div:not(.lcars-calendar-grid)")&&element.querySelector("button,input,select,textarea,a")){
          element.dataset.tosUnitWrapper="";Array.from(element.children).forEach(child=>visit(child as HTMLElement));
        }else units.push(element);
      };
      Array.from(bank.children).forEach(child=>visit(child as HTMLElement));
      const costs=units.map(element=>element.matches('textarea,.lcars-calendar-grid,input[aria-label="Search query"]')?capacity:element.matches("label,input,select")?Math.min(3,capacity):1);
      const assignments=consoleControlPages(costs,capacity),count=(assignments.at(-1)??0)+1,current=Math.min(page,count-1);
      bank.style.setProperty("--tos-bank-columns",String(Math.max(1,costs.reduce((total,cost,index)=>total+(assignments[index]===current?cost:0),0))));
      units.forEach((element,index)=>{element.dataset.tosUnit="";if(element.matches("button,a")&&!element.dataset.consoleCap)element.dataset.consoleCap="square";element.dataset.tosPageVisible=String(assignments[index]===current);element.style.setProperty("--tos-unit-span",String(costs[index]));});
      setPages(count);if(page!==current)setPage(current);
    };
    layout();
    const changes=new MutationObserver(layout),resize=new ResizeObserver(layout);
    changes.observe(bank,{childList:true,subtree:true,characterData:true});
    const deck=bank.closest(".tos-command-deck");if(deck)resize.observe(deck);
    return()=>{changes.disconnect();resize.disconnect();};
  },[page,active]);
  return <section className="tos-control-group" hidden={!active}><h4>{group.label}</h4><div className="tos-command-bank" ref={ref}/>{pages>1&&<nav className="tos-key-pages" aria-label={`${group.label} key pages`}><button data-console-cap="square" aria-label="Previous keys" disabled={page===0} onClick={()=>setPage(value=>value-1)}>◀ KEYS</button><output aria-live="polite">KEY BANK {page+1} / {pages}</output><button data-console-cap="square" aria-label="Next keys" disabled={page===pages-1} onClick={()=>setPage(value=>value+1)}>KEYS ▶</button></nav>}</section>;
}
export function useTosConsole(){return useContext(Context).enabled;}
export function ConsoleThemeProvider({tos,children,onFeedback}:{tos:boolean;children:ReactNode;onFeedback?:(cancel?:boolean)=>void}){
  const [dialogs,setDialogs]=useState<ConsoleDialogRequest[]>([]);
  useEffect(()=>{if(!tos){setDialogs([]);return;}return subscribeConsoleDialogs(request=>setDialogs(current=>[...current,request]));},[tos]);
  return <Context.Provider value={{enabled:tos,targets:{},register:null,rename:null,group:defaultGroup,inBank:false}}>{computerContent(children,tos)}{tos&&dialogs[0]&&<ConsolePromptWindow key={dialogs[0].id} request={dialogs[0]} feedback={onFeedback} close={value=>{dialogs[0].finish(value);setDialogs(current=>current.slice(1));}}/>}</Context.Provider>;
}
function ConsolePromptWindow({request,feedback,close}:{request:ConsoleDialogRequest;feedback?:((cancel?:boolean)=>void);close:(value:string|null)=>void}){
  const [value,setValue]=useState(request.initial),ref=useRef<HTMLElement|null>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.querySelector<HTMLElement>("input,button")?.focus();return()=>{if(previous?.isConnected)previous.focus();};},[]);
  const answer=(value:string|null)=>{feedback?.(value===null);close(value);};
  const source=typeof document!=="undefined"?document.querySelector<HTMLElement>(".lcars.theme-tos:not(.tos-dialog-host)"):null;
  const modes=["accessibility-contrast","reduced-motion","color-safe","alert-red","alert-yellow"].filter(mode=>source?.classList.contains(mode)).join(" ");
  return <div className={`lcars theme-tos tos-dialog-host ${modes}`} style={{fontSize:source?.style.fontSize||"100%"}}><div className="backdrop"><section ref={ref} className="tos-prompt-dialog" role={request.kind==="prompt"?"dialog":"alertdialog"} aria-modal="true" aria-labelledby="tos-prompt-title" aria-describedby="tos-prompt-message" onKeyDown={event=>{
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();answer(null);}
    if(event.key==="Tab"){const controls=Array.from(ref.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled)")||[]),first=controls[0],last=controls.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  }}><header><small>LIBRARY COMPUTER · OPERATOR INPUT</small><h2 id="tos-prompt-title">{request.kind==="prompt"?"INPUT REQUIRED":request.kind==="confirm"?"CONFIRM ACTION":"COMPUTER NOTICE"}</h2></header><p id="tos-prompt-message">{computerTerminology(request.message)}</p><div className="tos-command-deck"><section className="tos-control-group"><h4>OPERATOR CONTROL</h4><div className="tos-command-bank">{request.kind==="prompt"&&<input aria-label={computerTerminology(request.message)} value={value} onChange={event=>setValue(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();answer(value);}}}/>}<button onClick={()=>answer(request.kind==="prompt"?value:"confirmed")}>{request.kind==="confirm"?"CONFIRM":request.kind==="alert"?"ACKNOWLEDGE":"ACCEPT"}</button>{request.kind!=="alert"&&<button onClick={()=>answer(null)}>CANCEL</button>}</div></section></div></section></div></div>;
}
/** Logical groups keep each section's physical keys in a labeled, aligned bank. */
export function ConsoleGroup({label,children}:{label:ReactNode;children:ReactNode}){
  const context=useContext(Context),id=useId();
  return <Context.Provider value={{...context,group:{id,label:context.enabled?computerTerminology(caption(label)||"CONTROLS"):caption(label)||"CONTROLS"}}}>{computerContent(children,context.enabled)}</Context.Provider>;
}
/** Real React controls move to the housing without copied handlers or replayed clicks. */
export function ConsoleControls({children}:{children:ReactNode}){
  const context=useContext(Context),token=useId();
  const active=context.enabled&&!context.inBank&&Boolean(context.register);
  useEffect(()=>active?context.register?.(context.group,token):undefined,[active,context.register,context.group.id,token]);
  useEffect(()=>{if(active)context.rename?.(context.group.id,context.group.label);},[active,context.rename,context.group.id,context.group.label]);
  const target=context.targets[context.group.id];
  useEffect(()=>{
    if(!active||!target)return;
    const find=(value:ReactNode):boolean=>Children.toArray(value).some(item=>isValidElement(item)&&Boolean((item.props as {autoFocus?:boolean}).autoFocus||find((item.props as {children?:ReactNode}).children)));
    if(find(children)){context.activate?.(context.group.id);const frame=requestAnimationFrame(()=>target.querySelector<HTMLElement>("input,textarea,select")?.focus());return()=>cancelAnimationFrame(frame);}
  },[active,target,context.group.id]);
  if(!active)return <>{computerContent(children,context.enabled)}</>;
  return target?createPortal(<Context.Provider value={{...context,inBank:true}}>{computerContent(children,context.enabled)}</Context.Provider>,target):null;
}
export function ConsoleDisplay({tos,children,pageKey,navigationTarget}:{tos:boolean;children:ReactNode;pageKey?:string;navigationTarget?:HTMLDivElement|null}){
  const {value,deck}=useDeck(tos);
  const [controlsOpen,setControlsOpen]=useState(true);
  useEffect(()=>{if(!tos)return;const compact=window.matchMedia('(max-height:700px)'),update=()=>setControlsOpen(!compact.matches);update();compact.addEventListener('change',update);return()=>compact.removeEventListener('change',update);},[tos]);
  if(!tos)return <>{children}</>;
  return <div className="tos-station" data-tos-controls-open={controlsOpen}><Context.Provider value={value}><div className="tos-monitor"><TosScreen pageKey={pageKey} navigationTarget={navigationTarget} controlsOpen={controlsOpen} toggleControls={()=>setControlsOpen(value=>!value)}>{computerContent(children,tos)}</TosScreen></div>{deck}</Context.Provider></div>;
}
/** Modal controls stay in their own window and inside its focus boundary. */
export function ConsoleWindowControls({children,close}:{children:ReactNode;close?:()=>void}){
  const {enabled,group}=useContext(Context),{value,deck}=useDeck(enabled,{id:"window",label:group.id==="station"?"WINDOW CONTROLS":group.label},close);
  if(!enabled)return <>{children}</>;
  return <Context.Provider value={value}>{computerContent(children,enabled)}{deck}</Context.Provider>;
}
function displayOnly(children:ReactNode):ReactNode{
  return Children.map(children,child=>{
    if(!isValidElement(child))return child;
    const item=child as ReactElement<Record<string,unknown>>;
    if(item.type==="button"||item.type==="a"||item.type===ConsoleButton)return <span>{displayOnly(item.props.children as ReactNode)}</span>;
    if(item.type==="input"||item.type===ConsoleField)return <span aria-hidden="true">{item.props.checked?"■":"□"}</span>;
    const props=Object.fromEntries(Object.entries(item.props).map(([name,value])=>[name,/^on[A-Z]/.test(name)||name==="tabIndex"?undefined:value]));
    if("children" in props)props.children=displayOnly(props.children as ReactNode);
    return cloneElement(item,props);
  });
}
export function ConsoleButton({consoleChoice=false,consoleCap="square",consoleTone="ivory",children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{consoleChoice?:boolean;consoleCap?:"square"|"dome";consoleTone?:"ivory"|"amber"|"blue"|"coral"}){
  const context=useContext(Context);
  const selection=context.enabled&&Boolean(context.register)&&props.role==="option"?{role:undefined,"aria-selected":undefined,"aria-pressed":props["aria-selected"]}:{};
  const hardware=context.enabled&&(Boolean(context.register)||/\b(command-button|audio|header-operator|tos-ambiance-key)\b/.test(props.className||""));
  const parts=Children.toArray(children),icon=hardware?parts.find(item=>isValidElement(item)&&item.type==="i"):undefined;
  const legend=hardware?<>{icon}<span className="tos-key-legend">{computerContent(parts.filter(item=>item!==icon),true)}</span></>:computerContent(children,context.enabled);
  const control=<button {...computerProps(props,context.enabled)} {...selection} data-console-cap={hardware?consoleCap:undefined} data-console-tone={hardware?consoleTone:undefined}>{legend}</button>;
  if(!context.enabled||context.inBank||!context.register)return control;
  return <>{(consoleChoice||props.className==="app-launch-button")&&<div role={props.role==="option"?"listitem":undefined} className={`tos-display-choice ${props.className||""}`}>{displayOnly(computerContent(children,context.enabled))}</div>}<ConsoleControls>{control}</ConsoleControls></>;
}
export function ConsoleField(props:InputHTMLAttributes<HTMLInputElement>){const {enabled}=useContext(Context);return <ConsoleControls><input {...computerProps(props,enabled)}/></ConsoleControls>;}
export function ConsoleTextarea(props:TextareaHTMLAttributes<HTMLTextAreaElement>){
  const context=useContext(Context);
  return <>{context.enabled&&context.register&&!context.inBank&&<pre className="tos-document-information">{String(props.value??props.defaultValue??"")}</pre>}<ConsoleControls><textarea {...props}/></ConsoleControls></>;
}
/** Carry the physical housing choice to a new native workspace without changing other families. */
export function detachedWorkspaceUrl(tool:"document"|"page-peek",values:Record<string,string>,tos=typeof document!=="undefined"&&Boolean(document.querySelector(".lcars.theme-tos"))){
  const params=new URLSearchParams({tool,...values});
  if(tos)params.set("console","tos");
  return `lcars://app/index.html?${params}`;
}

export function ConsoleSelect(props:SelectHTMLAttributes<HTMLSelectElement>){return <ConsoleControls><select {...props}/></ConsoleControls>;}
export function ConsoleLink(props:AnchorHTMLAttributes<HTMLAnchorElement>){const {enabled}=useContext(Context);return <ConsoleControls><a {...props} data-console-cap={enabled?"square":undefined}/></ConsoleControls>;}
export function ConsoleDisclosure({children,...props}:HTMLAttributes<HTMLDetailsElement>&{open?:boolean}){
  const context=useContext(Context),[open,setOpen]=useState(Boolean(props.open));
  if(!context.enabled||!context.register)return <details {...props}>{children}</details>;
  const parts=Children.toArray(children),summary=parts.find(item=>isValidElement(item)&&item.type==="summary") as ReactElement<{children:ReactNode}>|undefined;
  return <section className={props.className}><ConsoleButton aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{summary?.props.children||"DETAILS"} {open?"−":"+"}</ConsoleButton>{open&&parts.filter(item=>item!==summary)}</section>;
}

export function ConsoleChoiceList(props:HTMLAttributes<HTMLDivElement>){const context=useContext(Context);return <div {...props} {...(context.enabled&&context.register?{role:"list","aria-multiselectable":undefined}:{})}/>;}

/** Picture glass stays informational; fullscreen uses its hardware key in TOS. */
export function ConsoleVideo(props:ComponentPropsWithRef<"video">){const context=useContext(Context);return <video {...props} {...(context.enabled&&context.register?{onDoubleClick:undefined}:{})}/>;}

/** Terminology for small standalone UI fragments without adding DOM wrappers. */
export function ConsoleCopy({children}:{children:ReactNode}){const {enabled}=useContext(Context);return <>{computerContent(children,enabled)}</>;}
