"use client";
import { Children, cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useId, useRef, useState, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ComponentPropsWithRef, type HTMLAttributes, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { subscribeConsoleDialogs, type ConsoleDialogRequest } from "./console-dialogs";

type Group={id:string;label:string};
type ConsoleContext={enabled:boolean;targets:Record<string,HTMLDivElement>;register:((group:Group,token:string)=>()=>void)|null;rename:((id:string,label:string)=>void)|null;group:Group;inBank:boolean};
const defaultGroup={id:"station",label:"STATION CONTROLS"};
const Context=createContext<ConsoleContext>({enabled:false,targets:{},register:null,rename:null,group:defaultGroup,inBank:false});
function caption(value:ReactNode):string{return Children.toArray(value).map(item=>typeof item==="string"||typeof item==="number"?String(item):isValidElement(item)?caption((item.props as {children?:ReactNode}).children):"").join(" ").replace(/\s+/g," ").trim().slice(0,64);}
function useDeck(enabled:boolean,initialGroup:Group=defaultGroup){
  const [groups,setGroups]=useState<Group[]>([]),[targets,setTargets]=useState<Record<string,HTMLDivElement>>({});
  const members=useRef(new Map<string,Set<string>>());
  const register=useCallback((group:Group,token:string)=>{
    let tokens=members.current.get(group.id);
    if(!tokens){tokens=new Set();members.current.set(group.id,tokens);setGroups(old=>[...old.filter(item=>item.id!==group.id),group]);}
    tokens.add(token);
    return ()=>{const current=members.current.get(group.id);current?.delete(token);if(current?.size===0){members.current.delete(group.id);setGroups(old=>old.filter(item=>item.id!==group.id));}};
  },[]);
  const attach=useCallback((id:string,node:HTMLDivElement|null)=>setTargets(old=>{if(old[id]===node||(!node&&!old[id]))return old;const next={...old};if(node)next[id]=node;else delete next[id];return next;}),[]);
  const rename=useCallback((id:string,label:string)=>setGroups(old=>old.some(group=>group.id===id&&group.label!==label)?old.map(group=>group.id===id?{...group,label}:group):old),[]);
  const value:ConsoleContext={enabled,targets,register,rename,group:initialGroup,inBank:false};
  return {value,deck:<div className="tos-command-deck" role="region" aria-label="Console control deck">{groups.map(group=><ControlBank key={group.id} group={group} attach={attach}/>)}</div>};
}
function ControlBank({group,attach}:{group:Group;attach:(id:string,node:HTMLDivElement|null)=>void}){
  const ref=useCallback((node:HTMLDivElement|null)=>attach(group.id,node),[attach,group.id]);
  return <section className="tos-control-group"><h4>{group.label}</h4><div className="tos-command-bank" ref={ref}/></section>;
}
export function ConsoleThemeProvider({tos,children,onFeedback}:{tos:boolean;children:ReactNode;onFeedback?:(cancel?:boolean)=>void}){
  const [dialogs,setDialogs]=useState<ConsoleDialogRequest[]>([]);
  useEffect(()=>{if(!tos){setDialogs([]);return;}return subscribeConsoleDialogs(request=>setDialogs(current=>[...current,request]));},[tos]);
  return <Context.Provider value={{enabled:tos,targets:{},register:null,rename:null,group:defaultGroup,inBank:false}}>{children}{tos&&dialogs[0]&&<ConsolePromptWindow key={dialogs[0].id} request={dialogs[0]} feedback={onFeedback} close={value=>{dialogs[0].finish(value);setDialogs(current=>current.slice(1));}}/>}</Context.Provider>;
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
  }}><header><small>LIBRARY COMPUTER · OPERATOR INPUT</small><h2 id="tos-prompt-title">{request.kind==="prompt"?"INPUT REQUIRED":request.kind==="confirm"?"CONFIRM ACTION":"COMPUTER NOTICE"}</h2></header><p id="tos-prompt-message">{request.message}</p><div className="tos-command-deck"><section className="tos-control-group"><h4>OPERATOR CONTROL</h4><div className="tos-command-bank">{request.kind==="prompt"&&<input aria-label={request.message} value={value} onChange={event=>setValue(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();answer(value);}}}/>}<button onClick={()=>answer(request.kind==="prompt"?value:"confirmed")}>{request.kind==="confirm"?"CONFIRM":request.kind==="alert"?"ACKNOWLEDGE":"ACCEPT"}</button>{request.kind!=="alert"&&<button onClick={()=>answer(null)}>CANCEL</button>}</div></section></div></section></div></div>;
}
/** Logical groups keep each section's physical keys in a labeled, aligned bank. */
export function ConsoleGroup({label,children}:{label:ReactNode;children:ReactNode}){
  const context=useContext(Context),id=useId();
  return <Context.Provider value={{...context,group:{id,label:caption(label)||"CONTROLS"}}}>{children}</Context.Provider>;
}
/** Real React controls move to the housing without copied handlers or replayed clicks. */
export function ConsoleControls({children}:{children:ReactNode}){
  const context=useContext(Context),token=useId();
  const active=context.enabled&&!context.inBank&&Boolean(context.register);
  useEffect(()=>active?context.register?.(context.group,token):undefined,[active,context.register,context.group.id,token]);
  useEffect(()=>{if(active)context.rename?.(context.group.id,context.group.label);},[active,context.rename,context.group.id,context.group.label]);
  if(!active)return <>{children}</>;
  const target=context.targets[context.group.id];
  return target?createPortal(<Context.Provider value={{...context,inBank:true}}>{children}</Context.Provider>,target):null;
}
export function ConsoleDisplay({tos,children}:{tos:boolean;children:ReactNode}){
  const {value,deck}=useDeck(tos);
  if(!tos)return <>{children}</>;
  return <div className="tos-station"><Context.Provider value={value}><div className="tos-monitor">{children}</div>{deck}</Context.Provider></div>;
}
/** Modal controls stay in their own window and inside its focus boundary. */
export function ConsoleWindowControls({children}:{children:ReactNode}){
  const {enabled,group}=useContext(Context),{value,deck}=useDeck(enabled,{id:"window",label:group.id==="station"?"WINDOW CONTROLS":group.label});
  if(!enabled)return <>{children}</>;
  return <Context.Provider value={value}>{children}{deck}</Context.Provider>;
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
export function ConsoleButton({consoleChoice=false,children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{consoleChoice?:boolean}){
  const context=useContext(Context);
  const selection=context.enabled&&Boolean(context.register)&&props.role==="option"?{role:undefined,"aria-selected":undefined,"aria-pressed":props["aria-selected"]}:{};
  const control=<button {...props} {...selection}>{children}</button>;
  if(!context.enabled||context.inBank||!context.register)return control;
  return <>{(consoleChoice||props.className==="app-launch-button")&&<div role={props.role==="option"?"listitem":undefined} className={`tos-display-choice ${props.className||""}`}>{displayOnly(children)}</div>}<ConsoleControls>{control}</ConsoleControls></>;
}
export function ConsoleField(props:InputHTMLAttributes<HTMLInputElement>){return <ConsoleControls><input {...props}/></ConsoleControls>;}
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
export function ConsoleLink(props:AnchorHTMLAttributes<HTMLAnchorElement>){return <ConsoleControls><a {...props}/></ConsoleControls>;}
export function ConsoleDisclosure({children,...props}:HTMLAttributes<HTMLDetailsElement>&{open?:boolean}){
  const context=useContext(Context),[open,setOpen]=useState(Boolean(props.open));
  if(!context.enabled||!context.register)return <details {...props}>{children}</details>;
  const parts=Children.toArray(children),summary=parts.find(item=>isValidElement(item)&&item.type==="summary") as ReactElement<{children:ReactNode}>|undefined;
  return <section className={props.className}><ConsoleButton aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{summary?.props.children||"DETAILS"} {open?"−":"+"}</ConsoleButton>{open&&parts.filter(item=>item!==summary)}</section>;
}

export function ConsoleChoiceList(props:HTMLAttributes<HTMLDivElement>){const context=useContext(Context);return <div {...props} {...(context.enabled&&context.register?{role:"list","aria-multiselectable":undefined}:{})}/>;}

/** Picture glass stays informational; fullscreen uses its hardware key in TOS. */
export function ConsoleVideo(props:ComponentPropsWithRef<"video">){const context=useContext(Context);return <video {...props} {...(context.enabled&&context.register?{onDoubleClick:undefined}:{})}/>;}
