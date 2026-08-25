"""Validation, state, and public GitHub catalog support for LCARS Extension API v2."""
from __future__ import annotations

import hashlib
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

API_VERSION=2
PLACEMENTS={"overview","header","page","tray","panel"}
PRIMITIVES={"text","button","input","toggle","list","progress","clock","timer","tabs","grid"}
CAPABILITIES={"time-date","system-read","notifications","safe-files","app-launch","network-read","media-read","media-control"}
SIZES={"compact","standard","wide"}
REMOTE_CATALOG_URL="https://raw.githubusercontent.com/HUHman416/LCARS-Command-Interface/Modules/catalog.json"
TRUSTED_RAW_HOST="raw.githubusercontent.com"
TRUSTED_RAW_PREFIX="/HUHman416/LCARS-Command-Interface/Modules/"
OFFICIAL_SOURCE={"id":"official","name":"LCARS OFFICIAL","owner":"HUHman416","repository":"LCARS-Command-Interface","ref":"Modules","catalogUrl":REMOTE_CATALOG_URL,"enabled":True,"official":True}
REMOTE_CACHE={}


def _text(value,limit=160):return str(value or "").strip()[:limit]


def _primitive(node,depth=0):
    if depth>5 or not isinstance(node,dict):raise ValueError("invalid UI primitive tree")
    kind=_text(node.get("type"),24)
    if kind not in PRIMITIVES:raise ValueError(f"unsupported UI primitive: {kind}")
    clean={"type":kind}
    for key,limit in (("id",48),("text",240),("label",80),("action",48),("source",64),("format",80),("placeholder",100)):
        if key in node:clean[key]=_text(node.get(key),limit)
    if "value" in node and isinstance(node["value"],(str,int,float,bool)):clean["value"]=node["value"]
    if "min" in node:clean["min"]=float(node["min"])
    if "max" in node:clean["max"]=float(node["max"])
    if "items" in node and isinstance(node["items"],list):clean["items"]=[_text(item,120) for item in node["items"][:40]]
    if "children" in node and isinstance(node["children"],list):clean["children"]=[_primitive(child,depth+1) for child in node["children"][:40]]
    return clean


def _legacy(data):
    module=data.get("module",{});items=module.get("defaultItems",[])
    return {"apiVersion":1,"schema":1,"id":_text(data.get("id"),48),"name":_text(data.get("name"),48),"version":_text(data.get("version","1.0.0"),20),"description":_text(data.get("description","Local LCARS extension"),180),"author":_text(data.get("author","Unknown"),64),"capabilities":[],"settings":[],"placements":[{"id":"primary","type":"overview","title":_text(data.get("name"),48),"defaultSize":module.get("defaultSize") if module.get("defaultSize") in SIZES else "standard","ui":[{"type":"list","id":"items","items":[_text(item,100) for item in items[:24] if _text(item,100)]}]}],"voiceCommands":data.get("voiceCommands",[])[:12]}


def validate_manifest(data):
    if not isinstance(data,dict):raise ValueError("manifest must be an object")
    if data.get("schema")==1:return _legacy(data)
    if data.get("apiVersion")!=API_VERSION:raise ValueError("unsupported Extension API version")
    ident=_text(data.get("id"),48)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    requested=data.get("capabilities",[])
    if not isinstance(requested,list) or any(item not in CAPABILITIES for item in requested):raise ValueError("unsupported extension capability")
    placements=[]
    for placement in data.get("placements",[])[:12]:
        if not isinstance(placement,dict) or placement.get("type") not in PLACEMENTS:raise ValueError("unsupported extension placement")
        ui=placement.get("ui",[])
        if not isinstance(ui,list):raise ValueError("placement UI must be a list")
        placements.append({"id":_text(placement.get("id","primary"),48),"type":placement["type"],"title":_text(placement.get("title",data.get("name",ident)),80),"defaultSize":placement.get("defaultSize") if placement.get("defaultSize") in SIZES else "standard","ui":[_primitive(node) for node in ui[:40]]})
    if not placements:raise ValueError("extension has no placements")
    settings=[]
    for setting in data.get("settings",[])[:32]:
        if not isinstance(setting,dict) or setting.get("type") not in {"text","number","toggle","select"}:raise ValueError("unsupported extension setting")
        entry={"key":_text(setting.get("key"),48),"type":setting["type"],"label":_text(setting.get("label"),80),"description":_text(setting.get("description"),180),"default":setting.get("default")}
        if setting.get("type")=="select":entry["options"]=[_text(item,80) for item in setting.get("options",[])[:20]]
        settings.append(entry)
    return {"apiVersion":API_VERSION,"id":ident,"name":_text(data.get("name",ident),48),"version":_text(data.get("version","1.0.0"),20),"description":_text(data.get("description","Local LCARS extension"),180),"author":_text(data.get("author","Unknown"),64),"capabilities":requested,"settings":settings,"placements":placements,"tickSeconds":max(1,min(3600,int(data.get("tickSeconds",1))))}


def load_extensions(extension_dir:Path,bundled_dir:Path|None=None):
    extension_dir.mkdir(parents=True,exist_ok=True);items=[];errors=[];seen=set()
    roots=[extension_dir]+([bundled_dir] if bundled_dir and bundled_dir.exists() else [])
    paths=[]
    for root in roots:paths+=list(root.glob("*/lcars-module.json"))+list(root.glob("*.lcars-module.json"))
    for path in paths[:64]:
        try:
            if path.stat().st_size>131072:raise ValueError("manifest exceeds 128 KiB")
            item=validate_manifest(json.loads(path.read_text(encoding="utf-8")))
            if item["id"] in seen:continue
            seen.add(item["id"]);items.append(item)
        except Exception as exc:errors.append({"file":path.name,"error":str(exc)})
    return {"extensions":items,"errors":errors,"directory":str(extension_dir),"apiVersion":API_VERSION}


def _trusted_url(value:str):
    parsed=urlparse(value)
    return parsed.scheme=="https" and parsed.hostname==TRUSTED_RAW_HOST and parsed.path.startswith(TRUSTED_RAW_PREFIX)


def _source_prefix(source):
    return f'/{source["owner"]}/{source["repository"]}/{source["ref"]}/'


def _source_url(value:str,source):
    parsed=urlparse(value)
    repository_prefix=f'/{source["owner"]}/{source["repository"]}/'
    required_prefix=_source_prefix(source) if source.get("official") else repository_prefix
    return parsed.scheme=="https" and parsed.hostname==TRUSTED_RAW_HOST and parsed.path.startswith(required_prefix) and not parsed.query and not parsed.fragment


def _download(url:str,limit:int,source=None):
    if source is None:
        if not _trusted_url(url):raise ValueError("module download URL is outside the trusted Modules branch")
    elif not _source_url(url,source):raise ValueError("module download URL is outside its declared public GitHub repository")
    request=Request(url,headers={"User-Agent":"LCARS-Command-Interface-Module-API/26.2","Accept":"application/json"})
    with urlopen(request,timeout=8) as response:
        length=response.headers.get("Content-Length")
        if length and int(length)>limit:raise ValueError("remote module payload exceeds size limit")
        payload=response.read(limit+1)
    if len(payload)>limit:raise ValueError("remote module payload exceeds size limit")
    return payload


def _github_source(value):
    raw=_text(value,512).rstrip("/")
    parsed=urlparse(raw)
    if parsed.scheme!="https" or parsed.hostname!="github.com" or parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment:raise ValueError("use a public https://github.com/OWNER/REPOSITORY URL")
    parts=[part for part in parsed.path.split("/") if part]
    if len(parts)!=2:raise ValueError("repository URL must identify one public GitHub repository")
    owner,repositories=parts;repository=repositories[:-4] if repositories.lower().endswith(".git") else repositories
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}",owner) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}",repository):raise ValueError("repository owner or name is invalid")
    ident=(f"community-{owner}-{repository}").lower();ident=re.sub(r"[^a-z0-9-]+","-",ident).strip("-")[:96]
    return {"id":ident,"name":f"{owner} / {repository}","owner":owner,"repository":repository,"ref":"HEAD","catalogUrl":f"https://raw.githubusercontent.com/{owner}/{repository}/HEAD/catalog.json","repositoryUrl":f"https://github.com/{owner}/{repository}","enabled":True,"official":False}


def repository_sources(source_file:Path|None=None):
    community=[]
    if source_file and source_file.is_file():
        try:
            data=json.loads(source_file.read_text(encoding="utf-8"))
            if isinstance(data,list):
                for item in data[:24]:
                    if not isinstance(item,dict):continue
                    try:
                        source=_github_source(str(item.get("repositoryUrl") or ""));source["enabled"]=item.get("enabled") is not False;community.append(source)
                    except Exception:continue
        except Exception:pass
    seen={OFFICIAL_SOURCE["id"]};result=[dict(OFFICIAL_SOURCE)]
    for source in community:
        if source["id"] not in seen:seen.add(source["id"]);result.append(source)
    return result


def _write_sources(source_file:Path,sources):
    source_file.parent.mkdir(parents=True,exist_ok=True);temporary=source_file.with_suffix(".tmp")
    payload=[{"repositoryUrl":item["repositoryUrl"],"enabled":item.get("enabled") is not False} for item in sources if not item.get("official")]
    temporary.write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8");temporary.replace(source_file)


def repository_source_operation(source_file:Path,operation:str,value="",ident=""):
    sources=repository_sources(source_file)
    if operation=="add":
        source=_github_source(value)
        if any(item["id"]==source["id"] for item in sources):raise ValueError("that GitHub repository is already configured")
        sources.append(source);_write_sources(source_file,sources);REMOTE_CACHE.pop(source["id"],None)
        return {"ok":True,"message":f'{source["name"]} added as a community module source',"source":source,"sources":repository_sources(source_file)}
    source=next((item for item in sources if item["id"]==ident),None)
    if not source:raise ValueError("module source is not configured")
    if source.get("official") and operation in {"remove","disable"}:raise ValueError("the official LCARS source cannot be removed or disabled")
    if operation=="refresh":
        REMOTE_CACHE.pop(source["id"],None);result=_remote_catalog(source,force=True)
        return {"ok":not bool(result.get("error")),"message":f'{source["name"]} returned {len(result.get("catalog",[]))} validated module(s)',"error":result.get("error",""),"sources":repository_sources(source_file)}
    if operation in {"enable","disable"}:
        source["enabled"]=operation=="enable";_write_sources(source_file,sources);REMOTE_CACHE.pop(source["id"],None)
        return {"ok":True,"message":f'{source["name"]} {operation}d',"sources":repository_sources(source_file)}
    if operation=="remove":
        _write_sources(source_file,[item for item in sources if item["id"]!=ident]);REMOTE_CACHE.pop(ident,None)
        return {"ok":True,"message":f'{source["name"]} removed from Module Repository',"sources":repository_sources(source_file)}
    raise ValueError("unsupported module source operation")


def _manifest_url(value,source,ident):
    candidate=_text(value,512)
    if not candidate:candidate=f"modules/{ident}/lcars-module.json"
    if candidate.startswith("https://github.com/"):
        parsed=urlparse(candidate);parts=[part for part in parsed.path.split("/") if part]
        if len(parts)>=5 and parts[0]==source["owner"] and parts[1]==source["repository"] and parts[2]=="blob":candidate=f"https://raw.githubusercontent.com/{parts[0]}/{parts[1]}/{'/'.join(parts[3:])}"
    if not urlparse(candidate).scheme:candidate=f'https://raw.githubusercontent.com/{source["owner"]}/{source["repository"]}/{source["ref"]}/{candidate.lstrip("/")}'
    if not _source_url(candidate,source):raise ValueError("manifest URL is outside its catalog repository")
    return candidate


def _remote_catalog(source_config,force=False):
    import time
    now=time.time()
    cached=REMOTE_CACHE.get(source_config["id"],{})
    if not force and cached and now-cached.get("at",0)<60:return cached
    try:
        raw=_download(source_config["catalogUrl"],262144,source_config)
        data=json.loads(raw.decode("utf-8"))
        if not isinstance(data,dict) or data.get("schemaVersion")!=1 or not isinstance(data.get("modules"),list):raise ValueError("unsupported module catalog schema")
        entries=[]
        for source in data["modules"][:128]:
            if not isinstance(source,dict):continue
            ident=_text(source.get("id"),48)
            manifest_url=_manifest_url(source.get("manifestUrl"),source_config,ident)
            checksum=_text(source.get("sha256"),64).lower()
            capabilities=source.get("capabilities",[])
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):continue
            if not re.fullmatch(r"[0-9a-f]{64}",checksum):continue
            if not isinstance(capabilities,list) or any(item not in CAPABILITIES for item in capabilities):continue
            entries.append({"id":ident,"name":_text(source.get("name",ident),48),"version":_text(source.get("version","1.0.0"),20),"description":_text(source.get("description","Downloadable LCARS module"),180),"author":_text(source.get("author","Unknown"),64),"capabilities":capabilities,"manifestUrl":manifest_url,"sha256":checksum,"minimumLcarsVersion":_text(source.get("minimumLcarsVersion"),20),"category":_text(source.get("category"),40),"featured":bool(source.get("featured")),"lastUpdated":_text(source.get("lastUpdated"),40),"repository":True,"sourceId":source_config["id"],"sourceName":source_config["name"],"official":bool(source_config.get("official"))})
        result={"at":now,"catalog":entries,"error":""}
    except Exception as exc:result={"at":now,"catalog":[],"error":str(exc)}
    REMOTE_CACHE[source_config["id"]]=result;return result


def extension_catalog(extension_dir:Path,bundled_dir:Path|None=None,source_file:Path|None=None,force=False):
    installed=load_extensions(extension_dir,bundled_dir).get("extensions",[])
    installed_map={item["id"]:item for item in installed};bundled_ids=set()
    if bundled_dir and bundled_dir.exists():
        for path in list(bundled_dir.glob("*/lcars-module.json"))+list(bundled_dir.glob("*.lcars-module.json")):
            try:bundled_ids.add(validate_manifest(json.loads(path.read_text(encoding="utf-8")))["id"])
            except Exception:pass
    known={item["id"]:{"id":item["id"],"name":item["name"],"version":item["version"],"description":item["description"],"author":item["author"],"capabilities":item.get("capabilities",[]),"installed":True,"bundled":item["id"] in bundled_ids} for item in installed}
    source_status=[]
    for source_config in repository_sources(source_file):
        if not source_config.get("enabled"):
            source_status.append({**source_config,"count":0,"error":"","status":"disabled"});continue
        remote=_remote_catalog(source_config,force=force);source_status.append({**source_config,"count":len(remote.get("catalog",[])),"error":remote.get("error",""),"status":"attention" if remote.get("error") else "ready"})
        for entry in remote.get("catalog",[]):
            if entry["id"] in known and known[entry["id"]].get("repository") and not entry.get("official"):continue
            current=installed_map.get(entry["id"]);merged=dict(entry);merged["installed"]=bool(current);merged["installedVersion"]=current.get("version") if current else "";merged["updateAvailable"]=bool(current and current.get("version")!=entry.get("version"));merged["bundled"]=entry["id"] in bundled_ids;known[entry["id"]]=merged
    errors=[f'{item["name"]}: {item["error"]}' for item in source_status if item.get("error")]
    return {"catalog":list(known.values()),"apiVersion":API_VERSION,"repository":"Modules","repositoryUrl":REMOTE_CATALOG_URL,"repositoryError":" · ".join(errors),"sources":source_status}


def extension_operation(extension_dir:Path,bundled_dir:Path|None,ident:str,operation:str,source_file:Path|None=None,source_id=""):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    catalog=extension_catalog(extension_dir,bundled_dir,source_file).get("catalog",[])
    bundled_ids={item["id"] for item in catalog if item.get("bundled")}
    if ident in bundled_ids:raise ValueError("bundled extensions can be disabled but not removed")
    target=(extension_dir/ident).resolve();root=extension_dir.resolve()
    if root not in target.parents:raise ValueError("invalid extension path")
    if operation=="remove":
        if not target.is_dir():raise ValueError("extension is not installed in the local module folder")
        shutil.rmtree(target);return {"ok":True,"message":f"Extension {ident} removed"}
    if operation not in {"install","update"}:raise ValueError("unsupported extension operation")
    entry=next((item for item in catalog if item.get("id")==ident and item.get("repository") and (not source_id or item.get("sourceId")==source_id)),None)
    if not entry:raise ValueError("module is not present in an enabled validated repository")
    source=next((item for item in repository_sources(source_file) if item["id"]==entry.get("sourceId")),None)
    if not source:raise ValueError("module source is no longer configured")
    payload=_download(entry.get("manifestUrl",""),131072,source)
    actual=hashlib.sha256(payload).hexdigest()
    if actual!=entry.get("sha256"):raise ValueError("module checksum verification failed")
    manifest=validate_manifest(json.loads(payload.decode("utf-8")))
    if manifest["id"]!=ident:raise ValueError("downloaded module id does not match catalog entry")
    if manifest["version"]!=entry.get("version"):raise ValueError("downloaded module version does not match catalog entry")
    extension_dir.mkdir(parents=True,exist_ok=True);target.mkdir(parents=True,exist_ok=True)
    temporary=target/"lcars-module.json.tmp";destination=target/"lcars-module.json"
    temporary.write_bytes(payload);temporary.replace(destination)
    return {"ok":True,"message":f"{manifest['name']} {manifest['version']} installed from {entry.get('sourceName','Module Repository')}","id":ident,"version":manifest["version"],"sha256":actual,"sourceId":entry.get("sourceId")}


def prepare_module_publication(extension_dir:Path,bundled_dir:Path|None,publisher_dir:Path,ident:str,repository_slug="YOUR-GITHUB-NAME/YOUR-REPOSITORY"):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("select a valid installed module id")
    if repository_slug!="YOUR-GITHUB-NAME/YOUR-REPOSITORY" and not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}/[A-Za-z0-9_.-]{1,100}",repository_slug):raise ValueError("GitHub repository must use OWNER/REPOSITORY format")
    paths=list(extension_dir.glob(f"{ident}/lcars-module.json"))
    if bundled_dir:paths+=list(bundled_dir.glob(f"{ident}/lcars-module.json"))
    if not paths:raise ValueError("the selected module manifest is not installed")
    raw=paths[0].read_bytes()
    if len(raw)>131072:raise ValueError("manifest exceeds 128 KiB")
    manifest=validate_manifest(json.loads(raw.decode("utf-8")))
    digest=hashlib.sha256(raw).hexdigest();target=publisher_dir/ident;module_dir=target/"modules"/ident
    if target.exists():shutil.rmtree(target)
    module_dir.mkdir(parents=True,exist_ok=True);(module_dir/"lcars-module.json").write_bytes(raw)
    manifest_url=f"https://raw.githubusercontent.com/{repository_slug}/main/modules/{ident}/lcars-module.json"
    entry={"id":ident,"name":manifest["name"],"version":manifest["version"],"description":manifest["description"],"author":manifest["author"],"capabilities":manifest.get("capabilities",[]),"manifestUrl":manifest_url,"sha256":digest,"minimumLcarsVersion":"26.2","category":"COMMUNITY","lastUpdated":__import__("datetime").date.today().isoformat()}
    (target/"catalog.json").write_text(json.dumps({"schemaVersion":1,"modules":[entry]},indent=2)+"\n",encoding="utf-8")
    (target/"SHA256SUMS.txt").write_text(f"{digest}  modules/{ident}/lcars-module.json\n",encoding="utf-8")
    readme=f"# {manifest['name']} — LCARS Module Repository\n\nThis package was generated by LCARS Module Publisher 26.2. It contains declarative Extension API v{manifest['apiVersion']} JSON only.\n\n1. Create a public GitHub repository.\n2. Copy the contents of this folder to its `main` branch.\n3. Replace `YOUR-GITHUB-NAME/YOUR-REPOSITORY` in `catalog.json`.\n4. In LCARS, open Updates → Module Repository → Sources and add the repository URL.\n\nLCARS verifies the SHA-256 checksum and validates the manifest before installation. Executable plug-in code is not supported.\n"
    (target/"README.md").write_text(readme,encoding="utf-8")
    return {"ok":True,"message":f"Repository package prepared for {manifest['name']}","path":str(target),"id":ident,"sha256":digest,"files":["README.md","catalog.json","SHA256SUMS.txt",f"modules/{ident}/lcars-module.json"]}


def extension_state(state_dir:Path,ident:str):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    path=state_dir/f"{ident}.json"
    try:return json.loads(path.read_text(encoding="utf-8"))
    except Exception:return {}


def save_extension_state(state_dir:Path,ident:str,state):
    if not isinstance(state,dict):raise ValueError("extension state must be an object")
    encoded=json.dumps(state,separators=(",",":"))
    if len(encoded)>65536:raise ValueError("extension state exceeds 64 KiB")
    state_dir.mkdir(parents=True,exist_ok=True);path=state_dir/f"{ident}.json";temporary=path.with_suffix(".tmp")
    temporary.write_text(encoded,encoding="utf-8");temporary.replace(path);return state
