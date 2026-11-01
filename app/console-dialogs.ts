export type ConsoleDialogRequest={id:number;kind:"prompt"|"confirm"|"alert";message:string;initial:string;finish:(value:string|null)=>void};
let host:((request:ConsoleDialogRequest)=>void)|null=null;
let sequence=0;
const pending=new Set<ConsoleDialogRequest>();
/** An explicit service, rather than overriding browser dialog APIs. */
export function subscribeConsoleDialogs(listener:(request:ConsoleDialogRequest)=>void){
  host=listener;
  return ()=>{if(host===listener){host=null;for(const request of [...pending])request.finish(null);}};
}
function request(kind:ConsoleDialogRequest["kind"],message:string,initial=""):Promise<string|null>{
  if(typeof window==="undefined")return Promise.resolve(null);
  if(!host||!document.querySelector(".lcars.theme-tos")){
    if(kind==="prompt")return Promise.resolve(window.prompt(message,initial));
    if(kind==="confirm")return Promise.resolve(window.confirm(message)?"confirmed":null);
    window.alert(message);return Promise.resolve("");
  }
  return new Promise(resolve=>{const item:ConsoleDialogRequest={id:++sequence,kind,message,initial,finish:value=>{if(pending.delete(item))resolve(value);}};pending.add(item);host?.(item);});
}
export const consolePrompt=(message:string,initial="")=>request("prompt",message,initial);
export const consoleConfirm=async(message:string)=>await request("confirm",message)!==null;
export const consoleAlert=async(message:string)=>{await request("alert",message);};
