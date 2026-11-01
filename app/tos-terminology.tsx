import { Fragment, Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
/** Translate interface terminology, preserving literal resource addresses and file names. */
export function computerTerminology(text:string):string{
 if(text.trim()==="terminal@lcars:~$")return text.replace("terminal@lcars:~$","COMPUTER >");
 if(/(?:https?:\/\/|lcars:\/\/|(?:^|\s)(?:~\/|\/)[\w.-]|[\\\\][\w.-]|\.(?:txt|md|pdf|json|mp3|mp4|zip|exe|apk|appimage|desktop|service|sh|run|py|js|ts|tsx|html|yaml|yml|css|webmanifest|csv|ttf|wav|webm)\b)/i.test(text))return text;
 const upper=text===text.toUpperCase(),word=upper?"COMPUTER":"Computer";
 return text.replace(/\bLCARS\s+(?=COMPUTER\b)/gi,"").replace(/\bLCARS\b/gi,word);
}
/** A DOM-free boundary; source material and form values are never rewritten. */
export function computerContent(children:ReactNode,enabled:boolean):ReactNode{
 if(!enabled)return children;
 return Children.map(children,child=>{
  if(typeof child==="string")return computerTerminology(child);
  if(!isValidElement(child))return child;
  const item=child as ReactElement<Record<string,unknown>>;
  if(typeof item.type!=="string"&&item.type!==Fragment)return child;
  if(item.props["data-console-verbatim"]!==undefined||typeof item.type==="string"&&["pre","code","textarea","iframe","video","audio"].includes(item.type))return child;
  const props:Record<string,unknown>={};
  for(const name of ["aria-label","aria-description","title","placeholder","alt"])if(typeof item.props[name]==="string")props[name]=computerTerminology(item.props[name] as string);
  if("children" in item.props)props.children=computerContent(item.props.children as ReactNode,true);
  return cloneElement(item,props);
 });
}
export function computerProps<T extends object>(props:T,enabled:boolean):T{
 if(!enabled)return props;const result={...props} as T & Record<string,unknown>;
 for(const name of ["aria-label","aria-description","title","placeholder","alt"])if(typeof result[name]==="string")Object.assign(result,{[name]:computerTerminology(result[name] as string)});
 return result;
}
