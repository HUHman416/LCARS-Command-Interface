import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const main=readFileSync(new URL("../desktop/main.cjs",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/page.tsx",import.meta.url),"utf8");
const css=readFileSync(new URL("../app/v24.css",import.meta.url),"utf8");
const linux=readFileSync(new URL("../local/lcars_bridge.py",import.meta.url),"utf8");
const windows=readFileSync(new URL("../windows/lcars_bridge_windows.py",import.meta.url),"utf8");
const linuxRegistration=readFileSync(new URL("../install-autostart.sh",import.meta.url),"utf8");
const builder=readFileSync(new URL("../electron-builder.yml",import.meta.url),"utf8");
const nsisOptions=readFileSync(new URL("../windows/installer/lcars-options.nsh",import.meta.url),"utf8");

test("lcars protocol serves audio with a playable MIME type and no HTML fallback",()=>{
  assert.match(main,/"\.mp3":"audio\/mpeg"/);
  assert.match(main,/LCARS asset not found/);
  assert.match(main,/new Response\(fs\.readFileSync\(target\)/);
  assert.match(main,/response\.blob\(\)/);
  assert.match(main,/blob\.type\.startsWith\('audio\/'\)/);
});

test("rail tray actuator is contained, unrotated, and labelled accessibly",()=>{
  assert.match(page,/aria-label="Open system tray" title="Tray Command Deck"/);
  assert.match(css,/right:0!important/);
  assert.match(css,/writing-mode:horizontal-tb!important/);
  assert.doesNotMatch(css,/right:-2[01]px/);
});

test("Linux tray entries prefer application-provided labels over DBus numbers",()=>{
  assert.match(linux,/property_value\(service,path,"Title"\)/);
  assert.match(linux,/property_value\(service,path,"Id"\)/);
  assert.match(linux,/property_value\(service,path,"DesktopEntry"\)/);
  assert.match(linux,/process_identity\(service\)/);
  assert.match(linux,/desktop_name or \("" if generic else title\)/);
});

test("page density is normalized and scoped without moving the root shell",()=>{
  assert.match(page,/pageDensityScope: "global" \| "per-page"/);
  assert.match(page,/activePageDensity/);
  assert.match(page,/PAGE SIZE CONTROL/);
  assert.match(css,/Page-size presets affect only internal spacing/);
  assert.doesNotMatch(css,/page-density-(?:compact|wide)[^}]*transform:/);
});

test("Linux and Windows expose normalized graphics and memory details",()=>{
  for(const bridge of [linux,windows]){
    assert.match(bridge,/"memory"/);
    assert.match(bridge,/"graphics"/);
    assert.match(bridge,/"memoryTotal"/);
    assert.match(bridge,/"memoryUsed"/);
  }
  assert.match(page,/HardwareTelemetry/);
  assert.match(page,/memory-detail/);
  assert.match(page,/graphics-detail/);
});

test("power control suspends the whole computer on Linux and Windows",()=>{
  assert.match(page,/SLEEP COMPUTER/);
  assert.match(linux,/"sleep":"suspend"/);
  assert.match(windows,/SetSuspendState/);
});

test("Speed Dial is modular, ordered, and includes Do Not Disturb",()=>{
  assert.match(page,/speedDial: SpeedDialItem\[\]/);
  assert.match(page,/action:dnd/);
  assert.match(page,/function SpeedDialEditor/);
  assert.match(page,/aria-label="LCARS Speed Dial"/);
  assert.match(css,/system-tray\.speed-dial/);
});

test("custom sidebar pages accept applications, modules, and full extensions",()=>{
  assert.match(page,/type CustomPage =/);
  assert.match(page,/function CustomPageManager/);
  assert.match(page,/kind: \"app\" \| \"module\" \| \"extension\"/);
  assert.match(page,/section\.startsWith\("custom:"\)/);
  assert.match(css,/\.custom-page-manager/);
});

test("application tiles expose embedded versus native destinations and Shift detach",()=>{
  assert.match(page,/type ApplicationDestination = "embedded" \| "native"/);
  assert.match(page,/embeddedPageForApp/);
  assert.match(page,/event\.shiftKey\?"native":undefined/);
  assert.match(page,/NORMAL CLICK USES THE SHOWN DESTINATION/);
  assert.match(css,/\.drawer-destination/);
});

test("portable Linux registration and Windows installer autostart are opt-in",()=>{
  assert.match(linuxRegistration,/--enable-autostart/);
  assert.match(linuxRegistration,/\.local\/share\/applications/);
  assert.match(builder,/include: windows\/installer\/lcars-options\.nsh/);
  assert.match(nsisOptions,/Start LCARS Command Interface when I sign in/);
  assert.match(nsisOptions,/Reset existing LCARS settings/);
  assert.match(nsisOptions,/install-runtime\.ps1/);
  assert.match(nsisOptions,/\$SMSTARTUP/);
});

test("Current metadata and protected sleep voice intent stay aligned",()=>{
  assert.match(page,/V\$\{update\?\.current\|\|LCARS_VERSION\} · \$\{prefs\.updateChannel\.toUpperCase\(\)\}/);
  assert.match(page,/sleep\|suspend/);
  assert.match(linux,/LCARS_VERSION="26\.(?:3\.0-dev\.1|0\.0)"/);
  assert.match(windows,/LCARS_VERSION="26\.(?:3\.0-dev\.1|0\.0)"/);
});
