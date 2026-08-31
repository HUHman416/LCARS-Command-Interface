import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { interpretComputerCommand } from "../app/v30-core.ts";

const context={
  pages:[{id:"overview",name:"Status"},{id:"system",name:"Systems"},{id:"media",name:"Media"},{id:"settings",name:"Settings"}],
  apps:[{id:"spotify.desktop",name:"Spotify"}],procedures:[],workstations:[],themes:[],
};

test("30.4 voice vocabulary covers deterministic media language and Starfleet operations",()=>{
  const phrases=new Map([
    ["pause","pause"],["pause the music","pause"],["hold playback","pause"],
    ["resume","play"],["play the song","play"],["continue playback","play"],
    ["skip the track","next"],["go back to the track","previous"],["stop playback","stop"],
  ]);
  for(const [phrase,target] of phrases){const plan=interpretComputerCommand(phrase,context,"voice");assert.equal(plan.valid,true,phrase);assert.equal(plan.steps[0].command,"media-control",phrase);assert.equal(plan.steps[0].target,target,phrase);}
  assert.equal(interpretComputerCommand("red alert",context).steps[0].target,"red");
  assert.equal(interpretComputerCommand("yellow alert",context).steps[0].target,"yellow");
  assert.equal(interpretComputerCommand("condition green",context).steps[0].target,"normal");
  assert.equal(interpretComputerCommand("status report",context).steps[0].target,"system");
  assert.equal(interpretComputerCommand("locate settings",context).steps[0].target,"settings");
  assert.equal(interpretComputerCommand("open hailing frequencies",context).steps[0].target,"communications");
  assert.equal(interpretComputerCommand("what is the stardate",context).steps[0].target,"calendar");
});

test("Self Destruct is a protected close-LCARS plan, never a destructive system command",()=>{
  const plan=interpretComputerCommand("Computer, initiate self destruct sequence",context,"voice");
  assert.equal(plan.valid,true);assert.equal(plan.risk,"protected");assert.equal(plan.requiresConfirmation,true);
  assert.equal(plan.steps[0].command,"exit-lcars");assert.match(plan.steps[0].detail,/Close only the LCARS interface/);
});

test("voice acknowledgement follows successful resolution and notice actions are readable pills",async()=>{
  const [page,css]=await Promise.all([readFile(new URL("../app/page.tsx",import.meta.url),"utf8"),readFile(new URL("../app/v30.css",import.meta.url),"utf8")]);
  assert.match(page,/const result=await computerRef\.current\(text,authorized\);if\(result\.accepted\)confirmCommand\(result\)/);
  assert.match(page,/input-ok\.mp3/);
  assert.doesNotMatch(page,/slice\(0, 8\)\);affirmative\(\)/);
  assert.match(page,/Promise<VoiceCommandResult>/);
  assert.match(css,/\.communication-entry > nav button[^}]*border-radius:999px/s);
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(96px,1fr\)\)/);
});

test("Linux session registration is opt-in, recoverable, packaged, and display-manager selectable",async()=>{
  const [wrapper,installer,entry,bridge,builder,desktop]=await Promise.all([
    readFile(new URL("../session/lcars-session",import.meta.url),"utf8"),
    readFile(new URL("../session/install-session.sh",import.meta.url),"utf8"),
    readFile(new URL("../session/lcars-session.desktop.in",import.meta.url),"utf8"),
    readFile(new URL("../local/lcars_bridge.py",import.meta.url),"utf8"),
    readFile(new URL("../electron-builder.yml",import.meta.url),"utf8"),
    readFile(new URL("../desktop/main.cjs",import.meta.url),"utf8"),
  ]);
  await access(new URL("../session/lcars-session",import.meta.url));
  assert.match(installer,/--install\|--uninstall\|--status/);assert.match(installer,/require_root/);assert.match(installer,/\/usr\/share\/wayland-sessions/);assert.match(installer,/\/usr\/share\/xsessions/);
  assert.match(entry,/DesktopNames=LCARS/);assert.match(wrapper,/LCARS_SESSION=1/);assert.match(wrapper,/safe_after_failure/);assert.match(wrapper,/normal desktop/i);assert.match(wrapper,/attempt.*3/s);
  assert.match(bridge,/def session_status/);assert.match(bridge,/normalDesktopFallback/);assert.match(bridge,/switch-deck/);assert.match(bridge,/apply-rules/);assert.match(bridge,/pkexec/);
  assert.match(builder,/from: session\s+to: session/);assert.match(desktop,/--lcars-session/);assert.match(desktop,/--lcars-kiosk/);assert.match(desktop,/--lcars-safe/);
});
