"""Validation, state, signing, and repository support for LCARS Module API v3."""
from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import shutil
import time
import zipfile
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

API_VERSION=3
SUPPORTED_API_VERSIONS={2,3}
PLACEMENTS={"overview","header","page","tray","panel"}
PRIMITIVES={"text","button","input","toggle","list","progress","clock","timer","tabs","grid"}
CAPABILITIES={"time-date","system-read","notifications","safe-files","app-launch","network-read","media-read","media-control"}
CAPABILITY_LABELS={
    "time-date":"Read local date and time",
    "system-read":"Read system telemetry",
    "notifications":"Create LCARS notices",
    "safe-files":"Read operator-selected files",
    "app-launch":"Launch installed applications",
    "network-read":"Read network status",
    "media-read":"Read media session metadata",
    "media-control":"Control media playback",
}
SIZES={"compact","standard","wide"}
REMOTE_CATALOG_URL="https://raw.githubusercontent.com/HUHman416/LCARS-Command-Interface/Modules/catalog.json"
TRUSTED_RAW_HOST="raw.githubusercontent.com"
TRUSTED_RAW_PREFIX="/HUHman416/LCARS-Command-Interface/Modules/"
OFFICIAL_SOURCE={"id":"official","name":"LCARS OFFICIAL","owner":"HUHman416","repository":"LCARS-Command-Interface","ref":"Modules","catalogUrl":REMOTE_CATALOG_URL,"enabled":True,"official":True,"channel":"stable"}
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
    api_version=data.get("apiVersion")
    if api_version not in SUPPORTED_API_VERSIONS:raise ValueError("unsupported Extension API version")
    ident=_text(data.get("id"),48)
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    requested=data.get("capabilities",[])
    if not isinstance(requested,list) or any(item not in CAPABILITIES for item in requested):raise ValueError("unsupported extension capability")
    version=_text(data.get("version","1.0.0"),20)
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?",version):raise ValueError("module version must use semantic versioning")
    placements=[];placement_ids=set()
    for placement in data.get("placements",[])[:12]:
        if not isinstance(placement,dict) or placement.get("type") not in PLACEMENTS:raise ValueError("unsupported extension placement")
        ui=placement.get("ui",[])
        if not isinstance(ui,list):raise ValueError("placement UI must be a list")
        placement_id=_text(placement.get("id","primary"),48)
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,47}",placement_id) or placement_id in placement_ids:raise ValueError("placement ids must be unique kebab-case values")
        placement_ids.add(placement_id)
        placements.append({"id":placement_id,"type":placement["type"],"title":_text(placement.get("title",data.get("name",ident)),80),"defaultSize":placement.get("defaultSize") if placement.get("defaultSize") in SIZES else "standard","ui":[_primitive(node) for node in ui[:40]]})
    if not placements:raise ValueError("extension has no placements")
    settings=[];setting_keys=set()
    for setting in data.get("settings",[])[:32]:
        if not isinstance(setting,dict) or setting.get("type") not in {"text","number","toggle","select"}:raise ValueError("unsupported extension setting")
        key=_text(setting.get("key"),48)
        if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,47}",key) or key in setting_keys:raise ValueError("setting keys must be unique identifiers")
        setting_keys.add(key)
        entry={"key":key,"type":setting["type"],"label":_text(setting.get("label"),80),"description":_text(setting.get("description"),180),"default":setting.get("default")}
        if setting.get("type")=="select":entry["options"]=[_text(item,80) for item in setting.get("options",[])[:20]]
        settings.append(entry)
    return {"apiVersion":api_version,"id":ident,"name":_text(data.get("name",ident),48),"version":version,"description":_text(data.get("description","Local LCARS extension"),180),"author":_text(data.get("author","Unknown"),64),"capabilities":requested,"settings":settings,"placements":placements,"tickSeconds":max(1,min(3600,int(data.get("tickSeconds",1)))),"minimumLcarsVersion":_text(data.get("minimumLcarsVersion","30.3" if api_version==3 else "27.1"),20),"moduleApiStatus":"stable" if api_version==3 else "compatible"}


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
    request=Request(url,headers={"User-Agent":"LCARS-Command-Interface-Module-API/30.6","Accept":"application/json"})
    with urlopen(request,timeout=8) as response:
        length=response.headers.get("Content-Length")
        if length and int(length)>limit:raise ValueError("remote module payload exceeds size limit")
        payload=response.read(limit+1)
    if len(payload)>limit:raise ValueError("remote module payload exceeds size limit")
    return payload


def _atomic_json(path:Path,value):
    path.parent.mkdir(parents=True,exist_ok=True);temporary=path.with_suffix(path.suffix+".tmp")
    temporary.write_text(json.dumps(value,indent=2)+"\n",encoding="utf-8");temporary.replace(path)


def _read_json(path:Path,fallback):
    try:
        value=json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value,type(fallback)) else fallback
    except Exception:return fallback


def _b64url(value:bytes):return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


def _b64url_decode(value:str):return base64.urlsafe_b64decode(value+"="*((4-len(value)%4)%4))


def _signature_payload(ident:str,version:str,digest:str):
    return json.dumps({"id":ident,"version":version,"sha256":digest},sort_keys=True,separators=(",",":")).encode("utf-8")


def _rsa_sign(payload:bytes,key):
    modulus=int(key["n"],16);private=int(key["d"],16);size=(modulus.bit_length()+7)//8
    digest_info=bytes.fromhex("3031300d060960864801650304020105000420")+hashlib.sha256(payload).digest()
    encoded=b"\x00\x01"+b"\xff"*(size-len(digest_info)-3)+b"\x00"+digest_info
    return _b64url(pow(int.from_bytes(encoded,"big"),private,modulus).to_bytes(size,"big"))


def _rsa_verify(payload:bytes,signature:str,public_key):
    try:
        modulus=int(str(public_key["n"]),16);exponent=int(public_key.get("e",65537));size=(modulus.bit_length()+7)//8
        raw=_b64url_decode(signature)
        if len(raw)!=size:return False
        decoded=pow(int.from_bytes(raw,"big"),exponent,modulus).to_bytes(size,"big")
        digest_info=bytes.fromhex("3031300d060960864801650304020105000420")+hashlib.sha256(payload).digest()
        return len(decoded)>=len(digest_info)+11 and decoded.startswith(b"\x00\x01") and decoded.endswith(b"\x00"+digest_info) and set(decoded[2:-(len(digest_info)+1)])=={255}
    except Exception:return False


def _is_probable_prime(candidate:int,rounds=24):
    if candidate<2:return False
    for prime in (2,3,5,7,11,13,17,19,23,29,31,37):
        if candidate%prime==0:return candidate==prime
    odd=candidate-1;power=0
    while odd%2==0:power+=1;odd//=2
    for _ in range(rounds):
        base=secrets.randbelow(candidate-3)+2;value=pow(base,odd,candidate)
        if value in (1,candidate-1):continue
        for __ in range(power-1):
            value=pow(value,2,candidate)
            if value==candidate-1:break
        else:return False
    return True


def _prime(bits:int):
    while True:
        candidate=secrets.randbits(bits)|(1<<(bits-1))|1
        if _is_probable_prime(candidate):return candidate


def _load_or_create_signing_key(path:Path):
    existing=_read_json(path,{})
    if all(existing.get(name) for name in ("n","d","e","keyId")):return existing
    exponent=65537
    while True:
        first=_prime(1024);second=_prime(1024)
        if first==second:continue
        phi=(first-1)*(second-1)
        if phi%exponent:break
    modulus=first*second;private=pow(exponent,-1,phi)
    public={"algorithm":"rsa-sha256","n":format(modulus,"x"),"e":exponent}
    key={**public,"d":format(private,"x"),"keyId":hashlib.sha256(json.dumps(public,sort_keys=True,separators=(",",":")).encode()).hexdigest()[:24]}
    _atomic_json(path,key)
    try:path.chmod(0o600)
    except OSError:pass
    return key


def _signature_state(entry,payload:bytes):
    signature=_text(entry.get("signature"),4096);public_key=entry.get("signingKey")
    if not signature or not isinstance(public_key,dict):return {"status":"legacy","verified":False,"keyId":""}
    key_id=_text(entry.get("signerKeyId"),64)
    public={"algorithm":_text(public_key.get("algorithm"),32),"n":_text(public_key.get("n"),1024),"e":int(public_key.get("e",65537))}
    expected=hashlib.sha256(json.dumps(public,sort_keys=True,separators=(",",":")).encode()).hexdigest()[:24]
    verified=public.get("algorithm")=="rsa-sha256" and key_id==expected and _rsa_verify(_signature_payload(_text(entry.get("id"),48),_text(entry.get("version"),20),hashlib.sha256(payload).hexdigest()),signature,public)
    return {"status":"verified" if verified else "invalid","verified":verified,"keyId":key_id}


def module_platform_status(extension_dir:Path,bundled_dir:Path|None,runtime_dir:Path):
    loaded=load_extensions(extension_dir,bundled_dir);permissions=_read_json(runtime_dir/"permissions.json",{});health=_read_json(runtime_dir/"health.json",{})
    bundled_ids=set()
    if bundled_dir and bundled_dir.exists():
        for path in list(bundled_dir.glob("*/lcars-module.json"))+list(bundled_dir.glob("*.lcars-module.json")):
            try:bundled_ids.add(validate_manifest(json.loads(path.read_text(encoding="utf-8")))["id"])
            except Exception:pass
    changed=False;records=[];extensions=[]
    for item in loaded.get("extensions",[]):
        ident=item["id"]
        if ident not in permissions:
            permissions[ident]=list(item.get("capabilities",[]));changed=True
        grants=[name for name in permissions.get(ident,[]) if name in item.get("capabilities",[])]
        target=extension_dir/ident;previous=target/".previous-lcars-module.json";installation=_read_json(target/".lcars-installation.json",{})
        entry_health=health.get(ident,{}) if isinstance(health.get(ident),dict) else {}
        record={"id":ident,"apiVersion":item.get("apiVersion",1),"apiStatus":item.get("moduleApiStatus","legacy"),"requestedCapabilities":item.get("capabilities",[]),"grantedCapabilities":grants,"permissionLabels":{name:CAPABILITY_LABELS[name] for name in item.get("capabilities",[])},"health":entry_health.get("status","ready"),"failureCount":int(entry_health.get("failureCount",0) or 0),"lastFailure":entry_health.get("lastFailure",""),"rollbackAvailable":previous.is_file(),"signed":installation.get("signatureStatus","bundled" if ident in bundled_ids else "local"),"signerKeyId":installation.get("signerKeyId",""),"sourceId":installation.get("sourceId","bundled" if ident in bundled_ids else "local"),"bundled":ident in bundled_ids}
        records.append(record);extensions.append({**item,"grantedCapabilities":grants,"moduleHealth":record})
    if changed:_atomic_json(runtime_dir/"permissions.json",permissions)
    return {**loaded,"extensions":extensions,"platform":{"apiVersion":API_VERSION,"supportedApiVersions":sorted(SUPPORTED_API_VERSIONS),"contract":"stable","executionModel":"host-rendered-declarative"},"records":records}


def module_platform_operation(extension_dir:Path,bundled_dir:Path|None,runtime_dir:Path,operation:str,ident="",capabilities=None,detail=""):
    if ident and not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid module id")
    if operation=="permissions":
        manifest=next((item for item in load_extensions(extension_dir,bundled_dir).get("extensions",[]) if item["id"]==ident),None)
        if not manifest:raise ValueError("module is not installed")
        grants=list(dict.fromkeys(capabilities or []))
        if any(name not in manifest.get("capabilities",[]) for name in grants):raise ValueError("permission is not requested by this module")
        permissions=_read_json(runtime_dir/"permissions.json",{});permissions[ident]=grants;_atomic_json(runtime_dir/"permissions.json",permissions)
        return {"ok":True,"message":f"{manifest['name']} permissions updated","grantedCapabilities":grants}
    if operation in {"failure","ready"}:
        health=_read_json(runtime_dir/"health.json",{});entry=health.get(ident,{}) if isinstance(health.get(ident),dict) else {}
        if operation=="failure":entry={"status":"isolated","failureCount":min(999,int(entry.get("failureCount",0) or 0)+1),"lastFailure":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"detail":_text(detail,200)}
        else:entry={"status":"ready","failureCount":0,"lastFailure":entry.get("lastFailure",""),"detail":"Renderer recovered"}
        health[ident]=entry;_atomic_json(runtime_dir/"health.json",health)
        return {"ok":True,"message":f"Module {ident} health recorded","health":entry}
    if operation=="rollback":
        target=extension_dir/ident;previous=target/".previous-lcars-module.json";current=target/"lcars-module.json"
        if not previous.is_file() or not current.is_file():raise ValueError("no previous module version is available")
        current_raw=current.read_bytes();previous_raw=previous.read_bytes();restored=validate_manifest(json.loads(previous_raw.decode("utf-8")))
        temporary=current.with_suffix(".json.tmp");temporary.write_bytes(previous_raw);temporary.replace(current);previous.write_bytes(current_raw)
        return {"ok":True,"message":f"{restored['name']} restored to {restored['version']}","version":restored["version"]}
    raise ValueError("unsupported module platform operation")


def _github_source(value,channel="stable"):
    raw=_text(value,512).rstrip("/")
    parsed=urlparse(raw)
    if parsed.scheme!="https" or parsed.hostname!="github.com" or parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment:raise ValueError("use a public https://github.com/OWNER/REPOSITORY URL")
    parts=[part for part in parsed.path.split("/") if part]
    if len(parts)!=2:raise ValueError("repository URL must identify one public GitHub repository")
    owner,repositories=parts;repository=repositories[:-4] if repositories.lower().endswith(".git") else repositories
    if not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}",owner) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,100}",repository):raise ValueError("repository owner or name is invalid")
    if channel not in {"stable","development"}:raise ValueError("module channel must be stable or development")
    ident=(f"community-{owner}-{repository}").lower();ident=re.sub(r"[^a-z0-9-]+","-",ident).strip("-")[:96]
    catalog_name="catalog-development.json" if channel=="development" else "catalog.json"
    return {"id":ident,"name":f"{owner} / {repository}","owner":owner,"repository":repository,"ref":"HEAD","catalogUrl":f"https://raw.githubusercontent.com/{owner}/{repository}/HEAD/{catalog_name}","repositoryUrl":f"https://github.com/{owner}/{repository}","enabled":True,"official":False,"channel":channel}


def repository_sources(source_file:Path|None=None):
    community=[]
    if source_file and source_file.is_file():
        try:
            data=json.loads(source_file.read_text(encoding="utf-8"))
            if isinstance(data,list):
                for item in data[:24]:
                    if not isinstance(item,dict):continue
                    try:
                        source=_github_source(str(item.get("repositoryUrl") or ""),str(item.get("channel","stable")));source["enabled"]=item.get("enabled") is not False;community.append(source)
                    except Exception:continue
        except Exception:pass
    seen={OFFICIAL_SOURCE["id"]};result=[dict(OFFICIAL_SOURCE)]
    for source in community:
        if source["id"] not in seen:seen.add(source["id"]);result.append(source)
    return result


def _write_sources(source_file:Path,sources):
    source_file.parent.mkdir(parents=True,exist_ok=True);temporary=source_file.with_suffix(".tmp")
    payload=[{"repositoryUrl":item["repositoryUrl"],"enabled":item.get("enabled") is not False,"channel":item.get("channel","stable")} for item in sources if not item.get("official")]
    temporary.write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8");temporary.replace(source_file)


def repository_source_operation(source_file:Path,operation:str,value="",ident="",channel="stable"):
    sources=repository_sources(source_file)
    if operation=="add":
        source=_github_source(value,channel)
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
    if operation=="channel":
        if source.get("official"):raise ValueError("the official source channel is fixed")
        replacement=_github_source(source["repositoryUrl"],channel);replacement["enabled"]=source.get("enabled") is not False
        sources=[replacement if item["id"]==ident else item for item in sources];_write_sources(source_file,sources);REMOTE_CACHE.pop(ident,None)
        return {"ok":True,"message":f'{source["name"]} now follows the {channel} channel',"sources":repository_sources(source_file)}
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
        if not isinstance(data,dict) or data.get("schemaVersion") not in {1,2} or not isinstance(data.get("modules"),list):raise ValueError("unsupported module catalog schema")
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
            signature=_text(source.get("signature"),4096);signing_key=source.get("signingKey") if isinstance(source.get("signingKey"),dict) else None
            if data.get("schemaVersion")==2 and (not signature or not signing_key):continue
            entries.append({"id":ident,"name":_text(source.get("name",ident),48),"version":_text(source.get("version","1.0.0"),20),"description":_text(source.get("description","Downloadable LCARS module"),180),"author":_text(source.get("author","Unknown"),64),"capabilities":capabilities,"manifestUrl":manifest_url,"sha256":checksum,"minimumLcarsVersion":_text(source.get("minimumLcarsVersion"),20),"category":_text(source.get("category"),40),"featured":bool(source.get("featured")),"lastUpdated":_text(source.get("lastUpdated"),40),"repository":True,"sourceId":source_config["id"],"sourceName":source_config["name"],"official":bool(source_config.get("official")),"channel":source_config.get("channel","stable"),"signature":signature,"signingKey":signing_key,"signerKeyId":_text(source.get("signerKeyId"),64),"signatureStatus":"signed" if signature else "legacy"})
        result={"at":now,"catalog":entries,"error":""}
    except Exception as exc:result={"at":now,"catalog":[],"error":str(exc)}
    REMOTE_CACHE[source_config["id"]]=result;return result


def extension_catalog(extension_dir:Path,bundled_dir:Path|None=None,source_file:Path|None=None,force=False,runtime_dir:Path|None=None):
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
    if runtime_dir:
        records={item["id"]:item for item in module_platform_status(extension_dir,bundled_dir,runtime_dir).get("records",[])}
        for ident,item in known.items():
            if ident in records:item.update({"moduleHealth":records[ident],"rollbackAvailable":records[ident]["rollbackAvailable"],"grantedCapabilities":records[ident]["grantedCapabilities"],"signatureStatus":item.get("signatureStatus") or records[ident]["signed"],"signerKeyId":item.get("signerKeyId") or records[ident]["signerKeyId"]})
    errors=[f'{item["name"]}: {item["error"]}' for item in source_status if item.get("error")]
    return {"catalog":list(known.values()),"apiVersion":API_VERSION,"supportedApiVersions":sorted(SUPPORTED_API_VERSIONS),"contract":"stable","repository":"Modules","repositoryUrl":REMOTE_CATALOG_URL,"repositoryError":" · ".join(errors),"sources":source_status,"capabilities":CAPABILITY_LABELS}


def extension_operation(extension_dir:Path,bundled_dir:Path|None,ident:str,operation:str,source_file:Path|None=None,source_id="",runtime_dir:Path|None=None,approved_capabilities=None):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("invalid extension id")
    catalog=extension_catalog(extension_dir,bundled_dir,source_file).get("catalog",[])
    bundled_ids={item["id"] for item in catalog if item.get("bundled")}
    if ident in bundled_ids:raise ValueError("bundled extensions can be disabled but not removed")
    target=(extension_dir/ident).resolve();root=extension_dir.resolve()
    if root not in target.parents:raise ValueError("invalid extension path")
    if operation=="remove":
        if not target.is_dir():raise ValueError("extension is not installed in the local module folder")
        shutil.rmtree(target)
        if runtime_dir:
            permissions=_read_json(runtime_dir/"permissions.json",{});permissions.pop(ident,None);_atomic_json(runtime_dir/"permissions.json",permissions)
        return {"ok":True,"message":f"Extension {ident} removed"}
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
    signature=_signature_state(entry,payload)
    if signature["status"]=="invalid":raise ValueError("module package signature verification failed")
    if manifest.get("apiVersion")==API_VERSION and not signature["verified"]:raise ValueError("Extension API v3 repository packages must be signed")
    previous_installation=_read_json(target/".lcars-installation.json",{})
    if operation=="update" and previous_installation.get("signerKeyId") and signature.get("keyId") and previous_installation["signerKeyId"]!=signature["keyId"]:raise ValueError("module publisher identity changed; remove and reinstall only after verifying the new signer")
    requested=manifest.get("capabilities",[]);approved=list(dict.fromkeys(approved_capabilities or []))
    if any(item not in requested for item in approved):raise ValueError("approved permission is not requested by the module")
    if requested and set(approved)!=set(requested):raise ValueError("operator capability approval is required before installation")
    extension_dir.mkdir(parents=True,exist_ok=True);target.mkdir(parents=True,exist_ok=True)
    temporary=target/"lcars-module.json.tmp";destination=target/"lcars-module.json"
    if operation=="update" and destination.is_file():shutil.copy2(destination,target/".previous-lcars-module.json")
    temporary.write_bytes(payload);temporary.replace(destination)
    _atomic_json(target/".lcars-installation.json",{"installedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"sourceId":entry.get("sourceId"),"channel":entry.get("channel","stable"),"sha256":actual,"signatureStatus":signature["status"],"signerKeyId":signature["keyId"]})
    if runtime_dir:
        permissions=_read_json(runtime_dir/"permissions.json",{});permissions[ident]=approved;_atomic_json(runtime_dir/"permissions.json",permissions)
    return {"ok":True,"message":f"{manifest['name']} {manifest['version']} installed from {entry.get('sourceName','Module Repository')}","id":ident,"version":manifest["version"],"sha256":actual,"sourceId":entry.get("sourceId"),"signature":signature,"grantedCapabilities":approved,"rollbackAvailable":operation=="update"}


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
    key=_load_or_create_signing_key(publisher_dir/"publisher-signing-key.json");public={"algorithm":"rsa-sha256","n":key["n"],"e":key["e"]}
    entry={"id":ident,"name":manifest["name"],"version":manifest["version"],"description":manifest["description"],"author":manifest["author"],"capabilities":manifest.get("capabilities",[]),"manifestUrl":manifest_url,"sha256":digest,"minimumLcarsVersion":manifest.get("minimumLcarsVersion","30.3" if manifest.get("apiVersion")==3 else "27.1"),"category":"COMMUNITY","lastUpdated":__import__("datetime").date.today().isoformat(),"signature":_rsa_sign(_signature_payload(ident,manifest["version"],digest),key),"signerKeyId":key["keyId"],"signingKey":public}
    (target/"catalog.json").write_text(json.dumps({"schemaVersion":2,"moduleApiVersion":API_VERSION,"channel":"stable","modules":[entry]},indent=2)+"\n",encoding="utf-8")
    (target/"catalog-development.json").write_text(json.dumps({"schemaVersion":2,"moduleApiVersion":API_VERSION,"channel":"development","modules":[entry]},indent=2)+"\n",encoding="utf-8")
    (target/"SHA256SUMS.txt").write_text(f"{digest}  modules/{ident}/lcars-module.json\n",encoding="utf-8")
    readme=f"# {manifest['name']} — LCARS Module Repository\n\nThis package was generated by LCARS Module Forge 30.6. It contains host-rendered declarative Extension API v{manifest['apiVersion']} JSON only.\n\n1. Create a public GitHub repository.\n2. Copy the contents of this folder to its `main` branch.\n3. Replace `YOUR-GITHUB-NAME/YOUR-REPOSITORY` in both catalogs.\n4. Use `catalog.json` for Stable and `catalog-development.json` for Development.\n5. In LCARS, open Updates → Module Platform → Sources and add the repository URL.\n\nLCARS verifies SHA-256, the RSA-SHA256 publisher signature, requested capabilities, and the stable manifest contract before installation. Executable plug-in code is not supported. Keep the private signing key in the parent Module Forge folder secure; it is never included in this package.\n"
    (target/"README.md").write_text(readme,encoding="utf-8")
    return {"ok":True,"message":f"Signed repository package prepared for {manifest['name']}","path":str(target),"id":ident,"sha256":digest,"signatureStatus":"verified","signerKeyId":key["keyId"],"files":["README.md","catalog.json","catalog-development.json","SHA256SUMS.txt",f"modules/{ident}/lcars-module.json"]}


def create_module_draft(extension_dir:Path,data):
    if not isinstance(data,dict):raise ValueError("Module Forge draft must be an object")
    ident=_text(data.get("id"),48);name=_text(data.get("name"),48);description=_text(data.get("description"),180);placement=_text(data.get("placement","overview"),24)
    if placement not in PLACEMENTS:raise ValueError("unsupported Module Forge placement")
    capabilities=data.get("capabilities",[]) if isinstance(data.get("capabilities"),list) else []
    manifest={"apiVersion":API_VERSION,"id":ident,"name":name or ident,"version":_text(data.get("version","0.1.0"),20),"description":description or "Module Forge declarative module","author":_text(data.get("author","LCARS Operator"),64),"minimumLcarsVersion":"30.3","capabilities":capabilities,"settings":[],"placements":[{"id":"primary","type":placement,"title":name or ident,"defaultSize":"standard","ui":[{"type":"text","id":"status","text":_text(data.get("text","MODULE READY"),240)}]}]}
    clean=validate_manifest(manifest);target=(extension_dir/clean["id"]).resolve();root=extension_dir.resolve()
    if root not in target.parents:raise ValueError("invalid Module Forge path")
    target.mkdir(parents=True,exist_ok=True);path=target/"lcars-module.json"
    if path.exists():shutil.copy2(path,target/".previous-lcars-module.json")
    _atomic_json(path,manifest)
    return {"ok":True,"message":f"{clean['name']} draft created with stable Extension API v{API_VERSION}","id":clean["id"],"path":str(path),"manifest":clean}


def module_package_operation(extension_dir:Path,bundled_dir:Path|None,publisher_dir:Path,runtime_dir:Path,operation:str,ident="",path_value="",approved_capabilities=None):
    if operation=="export":
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident):raise ValueError("select a valid installed module id")
        paths=list(extension_dir.glob(f"{ident}/lcars-module.json"))+([] if not bundled_dir else list(bundled_dir.glob(f"{ident}/lcars-module.json")))
        if not paths:raise ValueError("module is not installed")
        raw=paths[0].read_bytes();manifest=validate_manifest(json.loads(raw.decode("utf-8")));digest=hashlib.sha256(raw).hexdigest();key=_load_or_create_signing_key(publisher_dir/"publisher-signing-key.json");public={"algorithm":"rsa-sha256","n":key["n"],"e":key["e"]}
        package={"schemaVersion":1,"moduleApiVersion":manifest["apiVersion"],"id":ident,"version":manifest["version"],"sha256":digest,"signature":_rsa_sign(_signature_payload(ident,manifest["version"],digest),key),"signerKeyId":key["keyId"],"signingKey":public}
        exports=publisher_dir/"exports";exports.mkdir(parents=True,exist_ok=True);destination=exports/f"{ident}-{manifest['version']}.lcars-module"
        with zipfile.ZipFile(destination,"w",compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("lcars-module.json",raw);archive.writestr("package.json",json.dumps(package,indent=2)+"\n")
        return {"ok":True,"message":f"Signed {manifest['name']} package exported","path":str(destination),"sha256":digest,"signerKeyId":key["keyId"]}
    if operation in {"inspect","import"}:
        source=Path(path_value).expanduser().resolve()
        if not source.is_file() or source.stat().st_size>2097152:raise ValueError("module package is missing or exceeds 2 MiB")
        with zipfile.ZipFile(source,"r") as archive:
            names=set(archive.namelist())
            if names!={"lcars-module.json","package.json"}:raise ValueError("module package contains unsupported files")
            if any(item.file_size>262144 for item in archive.infolist()):raise ValueError("module package entry exceeds size limit")
            raw=archive.read("lcars-module.json");package=json.loads(archive.read("package.json").decode("utf-8"))
        manifest=validate_manifest(json.loads(raw.decode("utf-8")));digest=hashlib.sha256(raw).hexdigest()
        if package.get("schemaVersion")!=1 or package.get("id")!=manifest["id"] or package.get("version")!=manifest["version"] or package.get("sha256")!=digest:raise ValueError("module package metadata does not match its manifest")
        signature=_signature_state(package,raw)
        if not signature["verified"]:raise ValueError("module package signature verification failed")
        requested=manifest.get("capabilities",[]);approved=list(dict.fromkeys(approved_capabilities or []))
        if operation=="inspect":return {"ok":True,"message":f"Signed {manifest['name']} package verified","id":manifest["id"],"name":manifest["name"],"version":manifest["version"],"capabilities":requested,"signature":signature,"apiVersion":manifest["apiVersion"]}
        if requested and set(requested)!=set(approved):raise ValueError("operator capability approval is required before import")
        target=(extension_dir/manifest["id"]).resolve();root=extension_dir.resolve();previous_installation=_read_json(target/".lcars-installation.json",{})
        if previous_installation.get("signerKeyId") and previous_installation["signerKeyId"]!=signature["keyId"]:raise ValueError("module publisher identity changed; remove the installed module before trusting a different signer")
        if root not in target.parents:raise ValueError("invalid module package path")
        target.mkdir(parents=True,exist_ok=True);destination=target/"lcars-module.json";had_previous=destination.exists()
        if had_previous:shutil.copy2(destination,target/".previous-lcars-module.json")
        temporary=destination.with_suffix(".json.tmp");temporary.write_bytes(raw);temporary.replace(destination)
        _atomic_json(target/".lcars-installation.json",{"installedAt":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),"sourceId":"import","channel":"local","sha256":digest,"signatureStatus":"verified","signerKeyId":signature["keyId"]})
        permissions=_read_json(runtime_dir/"permissions.json",{});permissions[manifest["id"]]=approved;_atomic_json(runtime_dir/"permissions.json",permissions)
        return {"ok":True,"message":f"Signed {manifest['name']} package imported","id":manifest["id"],"version":manifest["version"],"signature":signature,"rollbackAvailable":had_previous}
    raise ValueError("unsupported module package operation")


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
