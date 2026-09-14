import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");

test("Version 31.5 exposes one integrated Daily Utilities page",async()=>{
  const [page,utility,css]=await Promise.all([read("../app/page.tsx"),read("../app/v31-utilities.tsx"),read("../app/v31-5.css")]);
  assert.match(page,/\["utilities", "10", "UTILITIES"\]/);
  assert.match(page,/section === "utilities" && <DailyUtilities/);
  for(const token of ["CLIPBOARD HISTORY","TAKE SCREENSHOT","START RECORDING","PORTAL AUTHORIZATION REQUIRED","OPEN FILES + DOCUMENTS TO PRINT","UNIVERSAL SEARCH","OPERATIONS LOG"])assert.ok(utility.includes(token),token);
  assert.match(css,/\.page-utilities\{min-height:0;overflow:hidden\}/);
});

test("notification service feeds approved Portal intents into existing Communications and Operations",async()=>{
  const page=await read("../app/page.tsx");
  assert.match(page,/lcars-service-notification-ids/);
  assert.match(page,/item\.kind==="notification"&&item\.decision==="approved"/);
  assert.match(page,/setHistoryOpen\(true\)/);
  assert.doesNotMatch(page,/section === "notifications"/);
  assert.match(page,/recentCutoff=Date\.now\(\)-15000/);
});

test("voice permission repair trusts the active LCARS webContents and deduplicates starts",async()=>{
  const [main,page]=await Promise.all([read("../desktop/main.cjs"),read("../app/page.tsx")]);
  assert.match(main,/lcarsOrigin\(webContents\?\.getURL\?\.\(\)\)/);
  assert.match(main,/trustedRequest\(webContents,details\?\.requestingUrl,details\?\.embeddingOrigin\)/);
  assert.match(page,/starting=useRef\(false\)/);
  assert.match(page,/if\(capture\.current\|\|starting\.current\)return/);
  assert.match(page,/Microphone access was not approved/);
});

test("Linux and Windows package and route the shared utility service",async()=>{
  const [linux,windows,builder,workflow]=await Promise.all([read("../local/lcars_bridge.py"),read("../windows/lcars_bridge_windows.py"),read("../electron-builder.yml"),read("../.github/workflows/v31-development.yml")]);
  for(const source of [linux,windows])for(const token of ["DailyUtilities","/api/daily-utilities","DAILY_UTILITIES.operate"])assert.ok(source.includes(token),token);
  assert.match(builder,/shared\/lcars_utilities\.py/g);
  assert.match(workflow,/Version 31\.5 Daily Utilities Development/);
  assert.match(workflow,/LCARS-Mobile-Environment-v31\.5-Android\.apk/);
  assert.match(workflow,/gh release create v31\.5/);
});
