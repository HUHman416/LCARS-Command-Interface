from pathlib import Path
import json
import re

VERSION = "26.1.0-dev.1"

page_path = Path("app/page.tsx")
page = page_path.read_text(encoding="utf-8")

# Replace the old standalone Extension Hub component with the Version 26.1
# integrated repository browser. Use a callable replacement so Python does not
# interpret any backslashes in TSX as replacement escapes.
new_hub = '''function ExtensionHub({installed,catalog,disabled,setDisabled,refresh,notify,openFolder}:{installed:ExtensionManifest[];catalog:ExtensionCatalogEntry[];disabled:string[];setDisabled:(ids:string[])=>void;refresh:()=>void;notify:(text:string,kind?:"info"|"error")=>void;openFolder:()=>void}){
  const [query,setQuery]=useState(""),[busy,setBusy]=useState(""),[expanded,setExpanded]=useState(false),[details,setDetails]=useState("");
  const inventory=useMemo(()=>{const known=new Map<string,ExtensionCatalogEntry>();catalog.forEach((entry)=>known.set(entry.id,entry));installed.forEach((extension)=>{if(!known.has(extension.id))known.set(extension.id,{id:extension.id,name:extension.name,version:extension.version,description:extension.description,author:extension.author,capabilities:extension.capabilities,installed:true});});return Array.from(known.values()).filter((entry)=>`${entry.name} ${entry.description} ${entry.author} ${entry.capabilities.join(" ")}`.toLowerCase().includes(query.toLowerCase()));},[catalog,installed,query]);
  const repositoryEntries=catalog.filter((entry)=>Boolean((entry as ExtensionCatalogEntry&{repository?:boolean}).repository));
  const updateCount=repositoryEntries.filter((entry)=>Boolean((entry as ExtensionCatalogEntry&{updateAvailable?:boolean}).updateAvailable)).length;
  const operate=async(entry:ExtensionCatalogEntry,operation:"install"|"update"|"remove")=>{setBusy(entry.id);try{const response=await fetch("http://127.0.0.1:8765/api/extension-install",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:entry.id,operation})}),result=await response.json();if(!response.ok||!result.ok)throw new Error(result.error||"Module operation failed");notify(result.message||`${entry.name} ${operation} complete`);window.setTimeout(refresh,250);}catch(error){notify(error instanceof Error?error.message:"Module operation failed","error");}finally{setBusy("");}};
  const isInstalled=(id:string)=>installed.some((extension)=>extension.id===id);
  return <section className={`extension-hub module-repository-panel ${expanded?"repository-open":"repository-closed"}`}>
    <button className="module-repository-toggle" onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>
      <i>03</i>
      <span><small>DECLARATIVE MODULE API · TRUSTED MODULES BRANCH</small><b>MODULE REPOSITORY</b><p>Browse, install, update, disable, and remove validated declarative LCARS modules without leaving Updates.</p></span>
      <strong>{String(repositoryEntries.length).padStart(2,"0")}<small> AVAILABLE</small>{updateCount>0&&<em>{updateCount} UPDATE{updateCount===1?"":"S"}</em>}</strong>
      <u>{expanded?"CLOSE MODULES":"BROWSE MODULES"}</u>
    </button>
    {expanded&&<>
      <nav><input aria-label="Search Module Repository" placeholder="SEARCH MODULE REPOSITORY…" value={query} onChange={(event)=>setQuery(event.target.value)}/><button onClick={refresh}>RESCAN LOCAL</button><button onClick={openFolder}>OPEN MODULE FOLDER</button><button onClick={()=>setQuery("")}>CLEAR SEARCH</button></nav>
      <div className="module-repository-status"><b>TRUSTED SOURCE</b><span>HUHman416 / LCARS-Command-Interface / Modules</span><em>{String(installed.length).padStart(2,"0")} INSTALLED · {String(updateCount).padStart(2,"0")} UPDATE{updateCount===1?"":"S"}</em></div>
      <div className="extension-catalog">{inventory.map((entry,index)=>{const installedNow=isInstalled(entry.id),disabledNow=disabled.includes(entry.id),manifest=installed.find((item)=>item.id===entry.id),remote=entry as ExtensionCatalogEntry&{repository?:boolean;updateAvailable?:boolean;installedVersion?:string;minimumLcarsVersion?:string;category?:string;sha256?:string;featured?:boolean};const showDetails=details===entry.id;return <article className={`${disabledNow?"disabled":""} ${remote.repository?"repository-module":"local-module"}`} key={entry.id}><i>{String(index+1).padStart(2,"0")}</i><span><small>{remote.repository?(remote.featured?"FEATURED · TRUSTED REPOSITORY":"TRUSTED REPOSITORY MODULE"):entry.bundled?"BUNDLED MODULE":"LOCAL MODULE"}</small><b>{entry.name}</b><p>{entry.description}</p><em>{entry.author} · REPOSITORY V{entry.version}{installedNow?` · INSTALLED V${manifest?.version||remote.installedVersion||entry.version}`:""} · {(manifest?.capabilities||entry.capabilities).join(" · ")||"NO PRIVILEGED CAPABILITIES"}</em>{showDetails&&<div className="module-detail-strip"><span><b>CATEGORY</b>{remote.category||"GENERAL"}</span><span><b>MINIMUM LCARS</b>{remote.minimumLcarsVersion||"COMPATIBLE"}</span><span><b>PACKAGE</b>{remote.sha256?`SHA-256 ${remote.sha256.slice(0,16).toUpperCase()}…`:"LOCAL MANIFEST"}</span></div>}</span><nav><button onClick={()=>setDetails(showDetails?"":entry.id)}>{showDetails?"LESS":"DETAILS"}</button>{installedNow?<><button onClick={()=>setDisabled(disabledNow?disabled.filter((id)=>id!==entry.id):[...disabled,entry.id])}>{disabledNow?"ENABLE":"DISABLE"}</button>{remote.updateAvailable&&<button className="update" disabled={busy===entry.id} onClick={()=>operate(entry,"update")}>{busy===entry.id?"VERIFYING…":"UPDATE"}</button>}{!entry.bundled&&<button className="danger" disabled={busy===entry.id} onClick={()=>operate(entry,"remove")}>{busy===entry.id?"WORKING…":"REMOVE"}</button>}</>:remote.repository?<button className="install" disabled={busy===entry.id} onClick={()=>operate(entry,"install")}>{busy===entry.id?"VERIFYING…":"INSTALL"}</button>:null}</nav></article>;})}{!inventory.length&&<p className="extension-empty">NO MATCHING MODULES</p>}</div>
      <footer><b>DECLARATIVE SAFETY MODEL</b> · Repository manifests are downloaded only from the trusted Modules branch, checksum verified, validated by Extension API v2, and installed without executable plug-in code.</footer>
    </>}
  </section>;
}'''

hub_pattern = re.compile(r'function ExtensionHub\(.*?\n\}\n\nfunction DiagnosticsCenter', re.S)
page, count = hub_pattern.subn(lambda _m: new_hub + "\n\nfunction DiagnosticsCenter", page, count=1)
if count != 1:
    raise SystemExit(f"ExtensionHub replacement count was {count}")

# Remove the old lower-page hub before inserting the integrated copy, so the
# insertion cannot accidentally be removed by the cleanup step.
old_call = '      <ExtensionHub installed={extensions} catalog={catalog} disabled={disabled} setDisabled={setDisabled} refresh={refreshExtensions} notify={notify} openFolder={()=>action("extension-folder")}/>\n'
if page.count(old_call) != 1:
    raise SystemExit(f"Expected one lower ExtensionHub call, found {page.count(old_call)}")
page = page.replace(old_call, "", 1)

panel_pattern = re.compile(r'\n\s*<UpdatePanel\s*\n\s*number="03".*?secondaryAction=\{\(\) => action\("extension-folder"\)\}\s*\n\s*/>', re.S)
module_call = '\n        <ExtensionHub installed={extensions} catalog={catalog} disabled={disabled} setDisabled={setDisabled} refresh={refreshExtensions} notify={notify} openFolder={()=>action("extension-folder")}/>'
page, count = panel_pattern.subn(lambda _m: module_call, page, count=1)
if count != 1:
    raise SystemExit(f"Module API panel replacement count was {count}")

page = page.replace('`V25 ${prefs.updateChannel.toUpperCase()} CHANNEL`', '`V26.1 DEV · ${prefs.updateChannel.toUpperCase()} CHANNEL`')
page_path.write_text(page, encoding="utf-8")

Path("app/v26-1.css").write_text('''/* Version 26.1: trusted downloadable declarative module repository. */
.module-repository-panel { grid-column: 1 / -1; margin-top: 0; overflow: hidden; border-left-color: var(--pink); }
.module-repository-toggle { display: grid; grid-template-columns: 42px minmax(0,1fr) auto auto; align-items: center; gap: 10px; width: 100%; border: 0; border-radius: 0 !important; border-bottom: 8px solid var(--pink) !important; background: #070708 !important; color: #f7f2ff !important; padding: 0 !important; text-align: left; }
.module-repository-toggle > i { display: grid; place-items: center; align-self: stretch; min-height: 92px; background: var(--pink); color: #080709; font-style: normal; font-size: 18px; }
.module-repository-toggle > span { display: grid; align-content: center; padding: 11px 0; }
.module-repository-toggle > span > small { color: var(--orange); letter-spacing: .08em; }
.module-repository-toggle > span > b { margin-top: 2px; font-size: 24px; }
.module-repository-toggle > span > p { margin: 3px 0 0; color: #98919d; font: 10px/1.35 Arial,sans-serif; }
.module-repository-toggle > strong { display: grid; color: var(--gold); font-size: 26px; text-align: right; }
.module-repository-toggle > strong small { color: #8d8691; font-size: 8px; }
.module-repository-toggle > strong em { margin-top: 2px; color: var(--orange); font: normal 9px/1.2 Arial,sans-serif; }
.module-repository-toggle > u { min-width: 132px; margin-right: 10px; border-radius: 18px 2px 18px 18px; background: var(--gold); color: #070708; padding: 9px 12px; text-align: center; text-decoration: none; }
.module-repository-panel.repository-open .module-repository-toggle > u { background: var(--pink); }
.module-repository-status { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 8px; align-items: center; margin: 0 8px 8px; border-left: 9px solid var(--blue); background: #111015; padding: 7px 9px; font: 9px/1.3 Arial,sans-serif; }
.module-repository-status b { color: var(--blue); }.module-repository-status span { color: #aaa3af; }.module-repository-status em { color: var(--gold); font-style: normal; }
.repository-module { border-bottom-color: var(--gold) !important; }.repository-module > i { background: var(--gold) !important; }
.module-detail-strip { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 3px; margin-top: 7px; }
.module-detail-strip > span { display: grid; gap: 2px; border-left: 5px solid var(--blue); background: #151218; color: #aaa3af; padding: 5px 7px; font: 8px/1.25 Arial,sans-serif; }
.module-detail-strip > span b { color: var(--blue); }
.extension-catalog button.install { background: var(--gold); }.extension-catalog button.update { background: var(--orange); }
.extension-empty { margin: 0; border-left: 9px solid var(--violet); background: #0d0c0f; color: #98919d; padding: 14px; }
@media (max-width: 900px) { .module-repository-toggle { grid-template-columns: 38px minmax(0,1fr) auto; }.module-repository-toggle > strong { display: none; }.module-repository-toggle > u { min-width: 110px; }.module-detail-strip { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .module-repository-toggle { grid-template-columns: 34px minmax(0,1fr); }.module-repository-toggle > i { min-height: 82px; }.module-repository-toggle > u { grid-column: 2; width: 100%; margin: 0 8px 8px 0; }.module-repository-status { grid-template-columns: 1fr; }.extension-catalog article { grid-template-columns: 32px minmax(0,1fr); }.extension-catalog article > nav { grid-column: 2; flex-wrap: wrap; padding: 0 7px 7px 0; } }
''', encoding="utf-8")

layout_path = Path("app/layout.tsx")
layout = layout_path.read_text(encoding="utf-8")
if 'import "./v26-1.css";' not in layout:
    layout = layout.replace('import "./v25.css";\n', 'import "./v25.css";\nimport "./v26-1.css";\n')
layout_path.write_text(layout, encoding="utf-8")

package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = VERSION
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

lock_path = Path("package-lock.json")
lock = lock_path.read_text(encoding="utf-8")
if lock.count('"version": "25.2.0"') < 2:
    raise SystemExit("package-lock root version markers were not found")
lock = lock.replace('"version": "25.2.0"', f'"version": "{VERSION}"', 2)
lock_path.write_text(lock, encoding="utf-8")

for bridge in (Path("local/lcars_bridge.py"), Path("windows/lcars_bridge_windows.py")):
    text = bridge.read_text(encoding="utf-8")
    text, changed = re.subn(r'LCARS_VERSION="25\.2\.0"', f'LCARS_VERSION="{VERSION}"', text, count=1)
    if changed != 1:
        raise SystemExit(f"Could not update LCARS_VERSION in {bridge}")
    bridge.write_text(text, encoding="utf-8")

Path("tests/version26-1-module-repository.test.mjs").write_text('''import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const extensions = readFileSync('shared/lcars_extensions.py','utf8');
const page = readFileSync('app/page.tsx','utf8');
const packageJson = JSON.parse(readFileSync('package.json','utf8'));

test('26.1 trusts only the dedicated Modules branch',()=>{
  assert.match(extensions,/REMOTE_CATALOG_URL=.*LCARS-Command-Interface\\/Modules\\/catalog\\.json/);
  assert.match(extensions,/TRUSTED_RAW_PREFIX=.*LCARS-Command-Interface\\/Modules\\//);
  assert.match(extensions,/module download URL is outside the trusted Modules branch/);
});

test('26.1 verifies catalog module payloads before installation',()=>{
  assert.match(extensions,/hashlib\\.sha256\\(payload\\)\\.hexdigest\\(\\)/);
  assert.match(extensions,/module checksum verification failed/);
  assert.match(extensions,/downloaded module id does not match catalog entry/);
  assert.match(extensions,/downloaded module version does not match catalog entry/);
});

test('integrated Module Repository is the Updates slot 03 browser',()=>{
  assert.match(page,/DECLARATIVE MODULE API · TRUSTED MODULES BRANCH/);
  assert.match(page,/BROWSE MODULES/);
  assert.match(page,/SEARCH MODULE REPOSITORY/);
  assert.match(page,/operate\\(entry,"update"\\)/);
  assert.equal((page.match(/<ExtensionHub installed=\\{extensions\\}/g)||[]).length,1);
});

test('26.1 development builds identify themselves correctly',()=>{
  assert.equal(packageJson.version,'26.1.0-dev.1');
  assert.match(page,/V26\\.1 DEV/);
});
''', encoding="utf-8")

print("Version 26.1 finalization applied")
