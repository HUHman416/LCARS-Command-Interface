"""Validation, state, and trusted remote catalog support for LCARS Extension API v2."""
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
REMOTE_CACHE={"at":0.0,"catalog":[],"error":""}


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


def _download(url:str,limit:int):
    if not _trusted_url(url):raise ValueError("module download URL is outside the trusted Modules branch")
    request=Request(url,headers={"User-Agent":"LCARS-Command-Interface-Module-API/26.1","Accept":"application/json"})
    with urlopen(request,timeout=8) as response:
        length=response.headers.get("Content-Length")
        if length and int(length)>limit:raise ValueError("remote module payload exceeds size limit")
        payload=response.read(limit+1)
    if len(payload)>limit:raise ValueError("remote module payload exceeds size limit")
    return payload


def _remote_catalog():
    import time
    now=time.time()
    if REMOTE_CACHE["catalog"] and now-REMOTE_CACHE["at"]<60:return REMOTE_CACHE
    try:
        raw=_download(REMOTE_CATALOG_URL,262144)
        data=json.loads(raw.decode("utf-8"))
        if not isinstance(data,dict) or data.get("schemaVersion")!=1 or not isinstance(data.get("modules"),list):raise ValueError("unsupported module catalog schema")
        entries=[]
        for source in data["modules"][:128]:
            if not isinstance(source,dict):continue
            ident=_text(source.get("id"),48)
            manifest_url=_text(source.get("manifestUrl"),512)
            checksum=_text(source.get("sha256"),64).lower()
            capabilities=source.get("capabilities",[])
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):continue
            if not _trusted_url(manifest_url) or not re.fullmatch(r"[0-9a-f]{64}",checksum):continue
            if not isinstance(capabilities,list) or any(item not in CAPABILITIES for item in capabilities):continue
            entries.append({"id":ident,"name":_text(source.get("name",ident),48),"version":_text(source.get("version","1.0.0"),20),"description":_text(source.get("description","Downloadable LCARS module"),180),"author":_text(source.get("author","Unknown"),64),"capabilities":capabilities,"manifestUrl":manifest_url,"sha256":checksum,"minimumLcarsVersion":_text(source.get("minimumLcarsVersion"),20),"category":_text(source.get("category"),40),"featured":bool(source.get("featured")),"repository":True})
        REMOTE_CACHE.update(at=now,catalog=entries,error="")
    except Exception as exc:REMOTE_CACHE.update(at=now,catalog=[],error=str(exc))
    return REMOTE_CACHE


def extension_catalog(extension_dir:Path,bundled_dir:Path|None=None):
    installed=load_extensions(extension_dir,bundled_dir).get("extensions",[])
    installed_map={item["id"]:item for item in installed};bundled_ids=set()
    if bundled_dir and bundled_dir.exists():
        for path in list(bundled_dir.glob("*/lcars-module.json"))+list(bundled_dir.glob("*.lcars-module.json")):
            try:bundled_ids.add(validate_manifest(json.loads(path.read_text(encoding="utf-8")))["id"])
            except Exception:pass
    known={item["id"]:{"id":item["id"],"name":item["name"],"version":item["version"],"description":item["description"],"author":item["author"],"capabilities":item.get("capabilities",[]),"installed":True,"bundled":item["id"] in bundled_ids} for item in installed}
    remote=_remote_catalog()
    for entry in remote.get("catalog",[]):
        current=installed_map.get(entry["id"]);merged=dict(entry);merged["installed"]=bool(current);merged["installedVersion"]=current.get("version") if current else "";merged["updateAvailable"]=bool(current and current.get("version")!=entry.get("version"));merged["bundled"]=entry["id"] in bundled_ids;known[entry["id"]]=merged
    return {"catalog":list(known.values()),"apiVersion":API_VERSION,"repository":"Modules","repositoryUrl":REMOTE_CATALOG_URL,"repositoryError":remote.get("error","")}


def extension_operation(extension_dir:Path,bundled_dir:Path|None,ident:str,operation:str):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    catalog=extension_catalog(extension_dir,bundled_dir).get("catalog",[])
    bundled_ids={item["id"] for item in catalog if item.get("bundled")}
    if ident in bundled_ids:raise ValueError("bundled extensions can be disabled but not removed")
    target=(extension_dir/ident).resolve();root=extension_dir.resolve()
    if root not in target.parents:raise ValueError("invalid extension path")
    if operation=="remove":
        if not target.is_dir():raise ValueError("extension is not installed in the local module folder")
        shutil.rmtree(target);return {"ok":True,"message":f"Extension {ident} removed"}
    if operation not in {"install","update"}:raise ValueError("unsupported extension operation")
    entry=next((item for item in catalog if item.get("id")==ident and item.get("repository")),None)
    if not entry:raise ValueError("module is not present in the trusted Modules repository")
    payload=_download(entry.get("manifestUrl",""),131072)
    actual=hashlib.sha256(payload).hexdigest()
    if actual!=entry.get("sha256"):raise ValueError("module checksum verification failed")
    manifest=validate_manifest(json.loads(payload.decode("utf-8")))
    if manifest["id"]!=ident:raise ValueError("downloaded module id does not match catalog entry")
    if manifest["version"]!=entry.get("version"):raise ValueError("downloaded module version does not match catalog entry")
    extension_dir.mkdir(parents=True,exist_ok=True);target.mkdir(parents=True,exist_ok=True)
    temporary=target/"lcars-module.json.tmp";destination=target/"lcars-module.json"
    temporary.write_bytes(payload);temporary.replace(destination)
    return {"ok":True,"message":f"{manifest['name']} {manifest['version']} installed from the trusted Modules repository","id":ident,"version":manifest["version"],"sha256":actual}


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
