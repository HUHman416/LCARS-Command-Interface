import type { ReactNode } from "react";

/** The display scrolls inside its stationary bezel; other families keep their existing DOM. */
export function ConsoleDisplay({tos,children}:{tos:boolean;children:ReactNode}){
  return tos?<div className="tos-monitor">{children}</div>:<>{children}</>;
}
