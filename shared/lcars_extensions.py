"""Validation and namespaced state for declarative LCARS Extension API v2."""
from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

API_VERSION=2
PLACEMENTS={"overview","header","page","tray","panel"}
PRIMITIVES={"text","button","input","toggle","list","progress","clock","timer","tabs","grid"}
CAPABILITIES={"time-date","system-read","notifications","safe-files","app-launch","network-read","media-read","media-control"}
SIZES={"compact","standard","wide"}


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


def load_extensions(extension_dir:Path, bundled_dir:Path|None=None):
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


def extension_catalog(extension_dir:Path,bundled_dir:Path|None=None):
    installed=load_extensions(extension_dir,bundled_dir).get("extensions",[])
    bundled_ids=set()
    if bundled_dir and bundled_dir.exists():
        for path in list(bundled_dir.glob("*/lcars-module.json"))+list(bundled_dir.glob("*.lcars-module.json")):
            try:bundled_ids.add(validate_manifest(json.loads(path.read_text(encoding="utf-8")))["id"])
            except Exception:pass
    return {"catalog":[{"id":item["id"],"name":item["name"],"version":item["version"],"description":item["description"],"author":item["author"],"capabilities":item.get("capabilities",[]),"installed":True,"bundled":item["id"] in bundled_ids} for item in installed],"apiVersion":API_VERSION}


def extension_operation(extension_dir:Path,bundled_dir:Path|None,ident:str,operation:str):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    bundled_ids=set(item["id"] for item in extension_catalog(extension_dir,bundled_dir).get("catalog",[]) if item.get("bundled"))
    if ident in bundled_ids:raise ValueError("bundled extensions can be disabled but not removed")
    target=(extension_dir/ident).resolve();root=extension_dir.resolve()
    if root not in target.parents:raise ValueError("invalid extension path")
    if operation=="remove":
        if not target.is_dir():raise ValueError("extension is not installed in the local module folder")
        shutil.rmtree(target);return {"ok":True,"message":f"Extension {ident} removed"}
    raise ValueError("this catalog entry has no trusted local installation payload")


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
