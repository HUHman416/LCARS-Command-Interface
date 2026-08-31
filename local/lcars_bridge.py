#!/usr/bin/env python3
"""Local-only, allowlisted universal Linux system bridge for LCARS."""
import json, os, shutil, subprocess, pty, select, threading, time, uuid, signal, re, base64, mimetypes, tempfile, socket, sys, hashlib
from configparser import ConfigParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

sys.path.insert(0,str(Path(__file__).resolve().parent.parent/"shared"))
from lcars_updater import check_update, download_update, schedule_install, rollback_status, schedule_rollback
from lcars_extensions import load_extensions, extension_state, save_extension_state, extension_catalog as build_extension_catalog, extension_operation, repository_source_operation, prepare_module_publication, module_platform_status, module_platform_operation, module_package_operation, create_module_draft
from lcars_documents import read_document, write_document
from lcars_padd import PaddController
from lcars_data_fabric import DataFabric

PORT=8765
LCARS_VERSION="30.8"
APP_DIRS=[Path.home()/".local/share/applications",Path("/usr/local/share/applications"),Path("/usr/share/applications")]
CONFIG_DIR=Path.home()/".config/lcars-command-interface"
CONFIG_FILE=CONFIG_DIR/"settings.json"
SESSION_CONFIG_FILE=CONFIG_DIR/"session.json"
SESSION_STATE_DIR=Path(os.environ.get("XDG_STATE_HOME",Path.home()/".local/state"))/"lcars-command-interface"
SESSION_ASSET_DIR=Path(__file__).resolve().parent.parent/"session"
UPDATE_DIR=CONFIG_DIR/"updates"
EXTENSION_DIR=Path(os.environ.get("LCARS_EXTENSION_DIR",Path.home()/".local/share/lcars-command-interface/extensions"))
BUILTIN_EXTENSION_DIR=Path(__file__).resolve().parent.parent/"extensions"
EXTENSION_STATE_DIR=CONFIG_DIR/"extension-state"
MODULE_SOURCE_FILE=CONFIG_DIR/"module-sources.json"
MODULE_PUBLISHER_DIR=CONFIG_DIR/"module-publisher"
MODULE_RUNTIME_DIR=CONFIG_DIR/"module-platform"
PADD_ASSET_DIR=Path(__file__).resolve().parent.parent/"padd"
PADD=PaddController(CONFIG_DIR,PADD_ASSET_DIR,LCARS_VERSION,"linux")
DATA_FABRIC=DataFabric(CONFIG_DIR,"linux")
TERMINALS={}
TERMINAL_LOCK=threading.Lock()
ICON_CACHE={}
ICON_INDEX=None
MEDIA_ICON_CACHE={}
MEDIA_ART_PATHS={}
NETWORK_CACHE={"at":0,"value":None}
TRAY_CACHE={"at":0,"value":None}
GRAPHICS_CACHE={"at":0,"value":None}
CPU_TIME_CACHE={}

def network_details():
    if NETWORK_CACHE["value"] and time.time()-NETWORK_CACHE["at"]<6:return NETWORK_CACHE["value"]
    addresses={};gateway="";interfaces=[]
    try:
        for link in json.loads(subprocess.run(["ip","-j","address"],capture_output=True,text=True,timeout=2).stdout or "[]"):
            addresses[link.get("ifname","")]=next((x.get("local","") for x in link.get("addr_info",[]) if x.get("family")=="inet"),"")
    except Exception:pass
    try:
        route=subprocess.run(["ip","route","show","default"],capture_output=True,text=True,timeout=2).stdout.split();gateway=route[route.index("via")+1] if "via" in route else ""
    except Exception:pass
    counters={}
    try:
        for line in Path("/proc/net/dev").read_text().splitlines()[2:]:
            name,values=line.split(":",1);parts=values.split();counters[name.strip()]=(int(parts[0]),int(parts[8]))
    except Exception:pass
    for path in sorted(Path("/sys/class/net").glob("*")):
        name=path.name
        if name=="lo":continue
        try:state=(path/"operstate").read_text().strip()
        except Exception:state="unknown"
        try:speed=(path/"speed").read_text().strip()+" MBPS"
        except Exception:speed=""
        rx,tx=counters.get(name,(0,0));interfaces.append({"id":name,"name":name,"kind":"wireless" if (path/"wireless").exists() else "ethernet","state":"connected" if state=="up" else state,"address":addresses.get(name,""),"gateway":gateway if state=="up" else "","dns":"SYSTEM RESOLVER","speed":speed,"received":rx,"sent":tx})
    try:socket.getaddrinfo("example.com",443);dns=True
    except Exception:dns=False
    value={"interfaces":interfaces,"diagnostics":{"gateway":bool(gateway),"dns":dns,"internet":dns and any(x["state"]=="connected" for x in interfaces),"latency":None},"bluetooth":Path("/sys/class/bluetooth").exists() or bool(shutil.which("bluetoothctl"))}
    NETWORK_CACHE.update(at=time.time(),value=value);return value

def extension_manifests():
    """Load the non-executable Module API v1 manifest format."""
    return module_platform_status(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,MODULE_RUNTIME_DIR)
    # Legacy parser retained below for migration reference; API v2 normalizes v1.
    EXTENSION_DIR.mkdir(parents=True,exist_ok=True)
    modules=[];errors=[];seen=set()
    paths=list(EXTENSION_DIR.glob("*/lcars-module.json"))+list(EXTENSION_DIR.glob("*.lcars-module.json"))
    for path in paths[:64]:
        try:
            if path.stat().st_size>65536: raise ValueError("manifest exceeds 64 KiB")
            data=json.loads(path.read_text(encoding="utf-8"))
            ident=str(data.get("id","")).strip()
            module=data.get("module",{})
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]{2,47}",ident): raise ValueError("invalid module id")
            if ident in seen: raise ValueError("duplicate module id")
            if data.get("schema")!=1 or module.get("type")!="checklist": raise ValueError("unsupported module schema or type")
            items=module.get("defaultItems",[])
            if not isinstance(items,list): raise ValueError("defaultItems must be a list")
            clean_items=[str(item).strip()[:100] for item in items[:24] if str(item).strip()]
            allowed_pages={"overview","terminal","files","system","media","network","updates","settings"};voice=[]
            for command in data.get("voiceCommands",[])[:12]:
                phrase=str(command.get("phrase","")).strip()[:80];page=str(command.get("page","")).strip()
                if phrase and page in allowed_pages:voice.append({"phrase":phrase,"page":page,"response":str(command.get("response",""))[:120]})
            clean={"schema":1,"id":ident,"name":str(data.get("name",ident))[:48],"version":str(data.get("version","1.0.0"))[:20],"description":str(data.get("description","Local LCARS extension"))[:180],"author":str(data.get("author","Unknown"))[:64],"voiceCommands":voice,"module":{"type":"checklist","defaultSize":module.get("defaultSize","standard") if module.get("defaultSize") in ("compact","standard","wide") else "standard","defaultItems":clean_items}}
            modules.append(clean);seen.add(ident)
        except Exception as exc: errors.append({"file":path.name,"error":str(exc)})
    return {"extensions":modules,"errors":errors,"directory":str(EXTENSION_DIR)}

def linux_environment():
    os_release={}
    try:
        for line in Path("/etc/os-release").read_text().splitlines():
            if "=" in line:
                key,value=line.split("=",1);os_release[key]=value.strip().strip('"')
    except Exception: pass
    desktop=os.environ.get("XDG_CURRENT_DESKTOP") or os.environ.get("DESKTOP_SESSION") or "Unknown desktop"
    session=os.environ.get("XDG_SESSION_TYPE") or "unknown"
    is_kde="kde" in desktop.casefold() or "plasma" in desktop.casefold()
    is_gnome="gnome" in desktop.casefold()
    x11=session.casefold()=="x11"
    window_control=bool(command_path("kdotool")) if is_kde and not x11 else bool(shutil.which("xdotool")) if x11 else False
    display_control=bool(shutil.which("kscreen-doctor")) if is_kde else bool(shutil.which("xrandr")) if x11 else bool(shutil.which("wlr-randr"))
    shell_control=is_kde and bool(shutil.which("plasmashell"))
    reasons=[]
    if not window_control:
        if is_gnome and not x11: reasons.append({"feature":"Task Rail window controls","reason":"GNOME Wayland prevents ordinary applications from controlling other windows.","remedy":"Window listing remains visible when available; focus, move, minimize, and close require a future GNOME Shell extension."})
        else: reasons.append({"feature":"Task Rail window controls","reason":f"No compatible window-control adapter was found for {desktop} on {session}.","remedy":"Use KDE Plasma Wayland with KDotool, or an X11 session with xdotool."})
    if not display_control: reasons.append({"feature":"Display routing","reason":f"No supported display controller was found for {desktop} on {session}.","remedy":"Install KScreen on KDE, xrandr on X11, or wlr-randr on compatible wlroots desktops."})
    if not shell_control: reasons.append({"feature":"LCARS Shell Mode","reason":"Safe panel hiding and desktop recovery are currently implemented only for KDE Plasma.","remedy":"LCARS can still run full-screen and at login; your normal desktop panels remain available."})
    if not shutil.which("wpctl"): reasons.append({"feature":"Audio routing","reason":"WirePlumber/wpctl is not available.","remedy":"Install WirePlumber or use your desktop audio settings."})
    if not shutil.which("playerctl"): reasons.append({"feature":"Media controls","reason":"playerctl is not available.","remedy":"Install playerctl to connect MPRIS-compatible players."})
    return {"distro":os_release.get("PRETTY_NAME",os_release.get("NAME","Linux")),"id":os_release.get("ID","linux"),"desktop":desktop,"session":session,"capabilities":{"windowControl":window_control,"displayControl":display_control,"shellControl":shell_control,"audio":bool(shutil.which("wpctl")),"media":bool(shutil.which("playerctl")),"updates":any(shutil.which(x) for x in ("dnf","apt","pacman","zypper","apk","xbps-install"))},"restrictions":reasons}

def terminal_create(name="Main",shell="",directory="~",scrollback=10000,history=False):
    ident=uuid.uuid4().hex[:12]
    allowed_shells=set(Path("/etc/shells").read_text().split()) if Path("/etc/shells").exists() else {"/bin/bash","/bin/zsh","/bin/fish"}
    chosen_shell=shell if shell in allowed_shells and Path(shell).is_file() else os.environ.get("SHELL","/bin/bash")
    cwd=Path(directory).expanduser()
    if not cwd.is_dir(): cwd=Path.home()
    limit=max(1000,min(200000,int(scrollback)))
    env={**os.environ,"TERM":"xterm-256color"}
    if not history: env["HISTFILE"]="/dev/null"
    process=subprocess.Popen([chosen_shell],cwd=cwd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,env=env,start_new_session=True)
    TERMINALS[ident]={"id":ident,"name":name[:32],"process":process,"output":f"LCARS COMMAND ENVIRONMENT\n{cwd}\n","closed":False,"limit":limit}
    def reader():
        while ident in TERMINALS and not TERMINALS[ident]["closed"]:
            try:
                chunk=process.stdout.readline() if process.stdout else ""
                if chunk:
                    with TERMINAL_LOCK: TERMINALS[ident]["output"]=(TERMINALS[ident]["output"]+chunk)[-TERMINALS[ident]["limit"]:]
                elif process.poll() is not None: break
                else: time.sleep(.05)
            except Exception: break
    threading.Thread(target=reader,daemon=True).start()
    return {"id":ident,"name":name[:32]}

def terminal_close(ident):
    term=TERMINALS.pop(ident,None)
    if term:
        term["closed"]=True
        try: os.killpg(os.getpgid(term["process"].pid),signal.SIGHUP)
        except Exception: pass

def load_config():
    base={"shell_prefs":{}}
    try: base.update(json.loads(CONFIG_FILE.read_text()))
    except Exception: pass
    return base

def save_config(data):
    CONFIG_DIR.mkdir(parents=True,exist_ok=True)
    current=load_config()
    if "shell_prefs" in data and isinstance(data["shell_prefs"],dict): current["shell_prefs"]=data["shell_prefs"]
    CONFIG_FILE.write_text(json.dumps(current,indent=2))
    return current

def load_session_config():
    base={"baseDesktop":"auto","kiosk":False,"crashRecovery":True,"safeModeOnFailure":True,"windowRules":[]}
    try:
        value=json.loads(SESSION_CONFIG_FILE.read_text(encoding="utf-8"))
        if isinstance(value,dict):base.update(value)
    except Exception:pass
    base["baseDesktop"]=base["baseDesktop"] if base["baseDesktop"] in {"auto","plasma","gnome","cinnamon","xfce","lxqt"} else "auto"
    for key in ("kiosk","crashRecovery","safeModeOnFailure"):base[key]=bool(base.get(key))
    rules=base.get("windowRules",[])
    base["windowRules"]=[{"match":str(item.get("match","")).strip()[:80],"deck":max(1,min(20,int(item.get("deck",1))))} for item in rules[:20] if isinstance(item,dict) and str(item.get("match","")).strip()]
    return base

def save_session_config(data):
    current=load_session_config()
    if "baseDesktop" in data:current["baseDesktop"]=str(data.get("baseDesktop","auto"))
    for key in ("kiosk","crashRecovery","safeModeOnFailure"):
        if key in data:current[key]=bool(data.get(key))
    if "windowRules" in data:current["windowRules"]=data.get("windowRules",[])
    SESSION_CONFIG_FILE.parent.mkdir(parents=True,exist_ok=True)
    SESSION_CONFIG_FILE.write_text(json.dumps(load_session_config_from(current),indent=2),encoding="utf-8")
    return load_session_config()

def load_session_config_from(value):
    base={"baseDesktop":"auto","kiosk":False,"crashRecovery":True,"safeModeOnFailure":True,"windowRules":[]};base.update(value if isinstance(value,dict) else {})
    base["baseDesktop"]=base["baseDesktop"] if base["baseDesktop"] in {"auto","plasma","gnome","cinnamon","xfce","lxqt"} else "auto"
    for key in ("kiosk","crashRecovery","safeModeOnFailure"):base[key]=bool(base.get(key))
    base["windowRules"]=[{"match":str(item.get("match","")).strip()[:80],"deck":max(1,min(20,int(item.get("deck",1))))} for item in base.get("windowRules",[])[:20] if isinstance(item,dict) and str(item.get("match","")).strip()]
    return base

def virtual_decks():
    if shutil.which("wmctrl"):
        try:
            decks=[]
            for line in subprocess.run(["wmctrl","-d"],capture_output=True,text=True,timeout=3).stdout.splitlines():
                match=re.match(r"\s*(\d+)\s+([*-])\s+.*?\s+([^\s].*)$",line)
                if match:decks.append({"id":int(match.group(1))+1,"name":match.group(3).strip()[:48],"active":match.group(2)=="*"})
            if decks:return decks
        except Exception:pass
    if command_path("kdotool"):
        script='var a=workspace.desktops.map((d,i)=>({id:i+1,name:d.name||("DECK "+String(i+1).padStart(2,"0")),active:d===workspace.currentDesktop}));output_result(JSON.stringify(a));'
        result=kdotool("kwinscript","--inline",script)
        for line in reversed(result.stdout.splitlines()):
            try:
                start=line.find("[");end=line.rfind("]");value=json.loads(line[start:end+1] if start>=0 and end>=start else line.strip())
                if isinstance(value,list) and value:return value[:20]
            except Exception:pass
    qdbus=shutil.which("qdbus6") or shutil.which("qdbus")
    if qdbus:
        try:
            count=int(subprocess.run([qdbus,"org.kde.KWin","/KWin","org.kde.KWin.numberOfDesktops"],capture_output=True,text=True,timeout=3).stdout.strip() or "1")
            active=int(subprocess.run([qdbus,"org.kde.KWin","/KWin","org.kde.KWin.currentDesktop"],capture_output=True,text=True,timeout=3).stdout.strip() or "1")
            return [{"id":index,"name":f"DECK {index:02d}","active":index==active} for index in range(1,max(1,min(20,count))+1)]
        except Exception:pass
    return [{"id":1,"name":"DECK 01","active":True}]

def session_status():
    helper=Path("/usr/local/libexec/lcars-command-interface/lcars-session")
    wayland=Path("/usr/share/wayland-sessions/lcars-command-interface.desktop")
    x11=Path("/usr/share/xsessions/lcars-command-interface.desktop")
    config=load_session_config()
    return {"ok":True,"supported":sys.platform.startswith("linux"),"installed":helper.is_file() and (wayland.is_file() or x11.is_file()),"active":os.environ.get("LCARS_SESSION")=="1","mode":os.environ.get("LCARS_SESSION_KIND",os.environ.get("XDG_SESSION_TYPE","unknown")),"kioskActive":os.environ.get("LCARS_SESSION_KIOSK")=="1","config":config,"decks":virtual_decks(),"capabilities":{"loginSession":True,"normalDesktopFallback":True,"crashRecovery":True,"safeMode":True,"kiosk":linux_environment()["capabilities"]["shellControl"],"windowTasking":linux_environment()["capabilities"]["windowControl"],"multiMonitor":linux_environment()["capabilities"]["displayControl"],"windowRules":bool(shutil.which("wmctrl") or command_path("kdotool"))},"message":"LCARS is the active login session" if os.environ.get("LCARS_SESSION")=="1" else "Application mode · LCARS login remains opt-in"}

def session_operation(data):
    operation=str(data.get("operation","status"))
    if operation=="configure":
        return {**session_status(),"config":save_session_config(data),"message":"LCARS session preferences saved"}
    if operation in {"install","uninstall"}:
        installer=SESSION_ASSET_DIR/"install-session.sh"
        if not installer.is_file():raise FileNotFoundError("LCARS session installer is not included in this build")
        command=["bash",str(installer),"--"+operation] if os.geteuid()==0 else ["pkexec","bash",str(installer),"--"+operation]
        if not shutil.which(command[0]):raise RuntimeError("PolicyKit authorization is unavailable on this Linux installation")
        result=subprocess.run(command,capture_output=True,text=True,timeout=180)
        if result.returncode!=0:raise RuntimeError((result.stderr or result.stdout or "Session registration was cancelled").strip()[:300])
        return {**session_status(),"message":result.stdout.strip() or f"LCARS login session {operation} complete"}
    if operation=="switch-deck":
        deck=max(1,min(20,int(data.get("deck",1))))
        if shutil.which("wmctrl"):
            result=subprocess.run(["wmctrl","-s",str(deck-1)],capture_output=True,text=True,timeout=3)
        elif command_path("kdotool"):
            result=kdotool("kwinscript","--inline",f'var i={deck-1};if(workspace.desktops[i]){{workspace.currentDesktop=workspace.desktops[i];output_result("selected");}}')
        else:
            qdbus=shutil.which("qdbus6") or shutil.which("qdbus")
            if not qdbus:raise RuntimeError("Virtual desktop switching is unavailable in this desktop session")
            result=subprocess.run([qdbus,"org.kde.KWin","/KWin","org.kde.KWin.currentDesktop",str(deck)],capture_output=True,text=True,timeout=3)
        if result.returncode!=0:raise RuntimeError("The desktop rejected the deck switch")
        return {**session_status(),"message":f"DECK {deck:02d} selected"}
    if operation=="apply-rules":
        rules=load_session_config()["windowRules"];applied=0
        if shutil.which("wmctrl"):
            windows=subprocess.run(["wmctrl","-lx"],capture_output=True,text=True,timeout=3).stdout.splitlines()
            for rule in rules:
                for line in windows:
                    parts=line.split(None,4)
                    if len(parts)>=5 and rule["match"].casefold() in (parts[2]+" "+parts[4]).casefold():
                        result=subprocess.run(["wmctrl","-ir",parts[0],"-t",str(rule["deck"]-1)],capture_output=True,text=True,timeout=3);applied+=result.returncode==0
        elif command_path("kdotool"):
            script=f'var rules={json.dumps(rules)};var n=0;for(var r of rules){{var d=workspace.desktops[r.deck-1];if(!d)continue;for(var w of workspace.windowList()){{var s=String(w.caption||"")+" "+String(w.resourceClass||w.resourceName||"");if(s.toLowerCase().includes(r.match.toLowerCase())){{w.desktops=[d];n++;}}}}}}output_result(String(n));'
            result=kdotool("kwinscript","--inline",script)
            if result.returncode!=0:raise RuntimeError("KWin rejected the automatic placement rules")
            for line in reversed(result.stdout.splitlines()):
                if line.strip().isdigit():applied=int(line.strip());break
        else:raise RuntimeError("Automatic window placement is unavailable in this desktop session")
        return {**session_status(),"message":f"{applied} window placement rule(s) applied"}
    if operation=="escape":
        SESSION_STATE_DIR.mkdir(parents=True,exist_ok=True);(SESSION_STATE_DIR/"session-escape").touch();protected_action("shell-mode-off")
        return {**session_status(),"message":"Normal desktop escape route armed · close LCARS to continue"}
    if operation!="status":raise ValueError("Unknown LCARS session operation")
    return session_status()

def safe_home_path(value="~"):
    home=Path.home().resolve()
    candidate=Path(value).expanduser().resolve()
    if candidate!=home and home not in candidate.parents: raise ValueError("Path is outside your home directory")
    return candidate

def file_list(value="~"):
    folder=safe_home_path(value)
    if not folder.is_dir(): raise ValueError("Folder not found")
    items=[]
    for path in folder.iterdir():
        try:
            stat=path.stat(); items.append({"name":path.name,"path":str(path),"directory":path.is_dir(),"size":stat.st_size,"modified":int(stat.st_mtime),"hidden":path.name.startswith(".")})
        except OSError: pass
    items.sort(key=lambda x:(not x["directory"],x["name"].casefold()))
    return {"path":str(folder),"parent":str(folder.parent) if folder!=Path.home().resolve() else "","items":items}

def file_transfer(source_value,destination_value,move=False):
    source=safe_home_path(source_value); destination=safe_home_path(destination_value)
    if not source.exists() or not destination.is_dir(): raise ValueError("Source or destination is unavailable")
    target=destination/source.name
    if target.exists():
        stem,suffix=source.stem,source.suffix; number=2
        while target.exists(): target=destination/f"{stem} ({number}){suffix}"; number+=1
    if move: shutil.move(str(source),str(target))
    elif source.is_dir(): shutil.copytree(source,target)
    else: shutil.copy2(source,target)
    return str(target)

def command_path(name):
    return shutil.which(name) or (str(Path.home()/".cargo/bin"/name) if (Path.home()/".cargo/bin"/name).is_file() else None)

def kdotool(*args):
    binary=command_path("kdotool")
    if not binary: return subprocess.CompletedProcess(args,127,"","kdotool unavailable")
    return subprocess.run([binary,*args],capture_output=True,text=True,timeout=5)

def windows_data():
    env=linux_environment()
    if not env["capabilities"]["windowControl"]:
        return [{"id":"lcars-preview","name":"LCARS Command Interface","app":"LCARS","monitor":"CURRENT DISPLAY","active":True,"minimized":False,"restricted":True}]
    if env["session"].casefold()=="x11" and shutil.which("xdotool"):
        found=subprocess.run(["xdotool","search","--onlyvisible","--name",".*"],capture_output=True,text=True,timeout=5)
        active=subprocess.run(["xdotool","getactivewindow"],capture_output=True,text=True,timeout=2).stdout.strip()
        result=[]
        for ident in dict.fromkeys(found.stdout.split()):
            name=subprocess.run(["xdotool","getwindowname",ident],capture_output=True,text=True,timeout=2).stdout.strip()
            klass=subprocess.run(["xprop","-id",ident,"WM_CLASS"],capture_output=True,text=True,timeout=2).stdout.split("=")[-1].replace('"',"").split(",")[-1].strip() if shutil.which("xprop") else "Application"
            if name: result.append({"id":ident,"name":name,"app":klass or "Application","monitor":"X11 DESKTOP","active":ident==active,"minimized":False})
        return result
    script='var a=workspace.windowList().filter(w=>!w.skipTaskbar).map(w=>({id:String(w.internalId),name:w.caption||"Window",app:String(w.resourceClass||w.resourceName||"Application"),monitor:w.output?w.output.name:"UNASSIGNED",active:w===workspace.activeWindow,minimized:!!w.minimized,attention:!!w.demandsAttention}));output_result(JSON.stringify(a));'
    result=kdotool("kwinscript","--inline",script)
    for line in reversed(result.stdout.splitlines()):
        try:
            start=line.find("["); end=line.rfind("]")
            value=json.loads(line[start:end+1] if start>=0 and end>=start else line.strip())
            if isinstance(value,list): return value
        except Exception: pass
    # KDotool's native search path is slower, but remains useful when KWin's
    # scripting result format changes between Plasma releases.
    found=kdotool("search","--name",".*")
    active=kdotool("getactivewindow").stdout.strip().splitlines()
    active_id=active[-1].strip() if active else ""
    windows=[]
    for ident in dict.fromkeys(x.strip() for x in found.stdout.splitlines() if x.strip()):
        name=kdotool("getwindowname",ident).stdout.strip().splitlines()
        klass=kdotool("getwindowclassname",ident).stdout.strip().splitlines()
        caption=name[-1].strip() if name else ""
        app=klass[-1].strip() if klass else caption
        if caption:
            windows.append({"id":ident,"name":caption,"app":app or "Application","monitor":"UNASSIGNED","active":ident==active_id,"minimized":False,"attention":False})
    if windows: return windows
    return [{"id":"lcars-preview","name":"LCARS Command Interface","app":"LCARS","monitor":"DISPLAY 1","active":True,"minimized":False}]

ANSI_ESCAPE_RE=re.compile(r"\x1B(?:\[[0-?]*[ -/]*[@-~]|[@-_])")

def parse_kscreen_output(output):
    # Plasma 6 may emit ANSI bold/control sequences even when stdout is being
    # captured by the desktop bridge. Normalize those sequences before matching
    # Output, enabled, priority, and Geometry fields.
    output=ANSI_ESCAPE_RE.sub("",output or "").replace("\r","")
    displays=[]
    blocks=re.split(r"(?=^\s*Output:\s+)",output,flags=re.M)
    for block in blocks:
        first=block.splitlines()[0].strip() if block.strip() else ""
        match=re.match(r"\s*Output:\s+(\d+)\s+([^\s]+)(?:\s+(.*))?$",first)
        if not match: continue
        ident,name,status=match.groups(); status=(status or "")+" "+block; geometry="ACTIVE"
        geom=re.search(r"Geometry:\s*([^\n]+)",block)
        if geom: geometry=geom.group(1).strip().replace(" "," · ")
        enabled=bool(re.search(r"(?im)^\s*enabled\b",status)) and not bool(re.search(r"(?im)^\s*disabled\b",status))
        displays.append({"id":ident,"name":name,"enabled":enabled,"primary":"priority 1" in status.lower() or "primary" in status.lower(),"geometry":geometry if enabled else "DISABLED","source":"KScreen + DRM"})
    return displays

def displays_data():
    output=subprocess.run(["kscreen-doctor","-o"],capture_output=True,text=True,timeout=4).stdout if shutil.which("kscreen-doctor") else ""
    displays=parse_kscreen_output(output)
    # The kernel DRM connector list catches physically connected monitors that
    # KScreen has not activated or has temporarily omitted after sleep/hotplug.
    for connector in sorted(Path("/sys/class/drm").glob("card*-*")):
        try:
            if (connector/"status").read_text().strip()!="connected": continue
            name=connector.name.split("-",1)[1]
            if any(d["name"].casefold()==name.casefold() for d in displays): continue
            modes=(connector/"modes").read_text().splitlines() if (connector/"modes").exists() else []
            displays.append({"id":"drm-"+name,"name":name,"enabled":False,"primary":False,"geometry":modes[0]+" · CONNECTED / DISABLED" if modes else "CONNECTED / DISABLED","source":"Kernel DRM (not active in KScreen)"})
        except Exception: pass
    if displays and not any(x["primary"] for x in displays): next((x for x in displays if x["enabled"]),displays[0])["primary"]=True
    if not displays and shutil.which("xrandr"):
        raw=subprocess.run(["xrandr","--query"],capture_output=True,text=True,timeout=4).stdout
        for index,line in enumerate(x for x in raw.splitlines() if " connected" in x):
            match=re.match(r"(\S+) connected\s+(primary\s+)?(?:(\d+x\d+\+-?\d+\+-?\d+))?",line)
            if match: displays.append({"id":"xrandr-"+match.group(1),"name":match.group(1),"enabled":bool(match.group(3)),"primary":bool(match.group(2)),"geometry":match.group(3) or "CONNECTED / DISABLED","source":"XRandR"})
    return displays or [{"id":"1","name":"CURRENT DISPLAY","enabled":True,"primary":True,"geometry":"ACTIVE","source":"GENERIC LINUX FALLBACK"}]

def window_action(ident,action,display=""):
    if ident=="lcars-preview": return "Preview window selected"
    env=linux_environment()
    if not env["capabilities"]["windowControl"]: return "Window control is restricted by this desktop session — review the compatibility notice"
    if env["session"].casefold()=="x11" and shutil.which("xdotool"):
        commands={"activate":["windowactivate",ident],"minimize":["windowminimize",ident],"close":["windowclose",ident]}
        if action in commands:
            result=subprocess.run(["xdotool",*commands[action]],capture_output=True,text=True,timeout=4)
            return action.title()+" command sent" if result.returncode==0 else "X11 window command failed"
        return "Moving windows between X11 monitors is not available in this adapter"
    commands={"activate":"windowactivate","minimize":"windowminimize","close":"windowclose"}
    if action in commands:
        result=kdotool(commands[action],ident)
        return action.title()+" command sent" if result.returncode==0 else "KWin window command unavailable"
    if action=="move" and display:
        script=f'var id={json.dumps(ident)},target={json.dumps(display)};var w=workspace.windowList().find(x=>String(x.internalId)===id);var s=workspace.screens.find(x=>x.name===target);if(w&&s){{w.output=s;workspace.activeWindow=w;output_result("moved");}}'
        return "Window moved to "+display if kdotool("kwinscript","--inline",script).returncode==0 else "Unable to move window"
    return "Unknown window command"

def display_action(action,display):
    displays=displays_data()
    target=next((d for d in displays if d["name"]==display),None)
    if display=="other": target=next((d for d in displays if not d["primary"]),displays[0])
    if not target: return "Display not found"
    if action=="move-lcars":
        if not target["enabled"]: return target["name"]+" is connected but disabled — enable it in Display Configuration first"
        env=linux_environment()
        if env["session"].casefold()=="x11" and shutil.which("xdotool"):
            geom=re.search(r"\+(-?\d+)\+(-?\d+)",target["geometry"]);x,y=geom.groups() if geom else ("0","0")
            active=subprocess.run(["xdotool","getactivewindow"],capture_output=True,text=True,timeout=2).stdout.strip()
            result=subprocess.run(["xdotool","windowmove",active,x,y],capture_output=True,text=True,timeout=3) if active else None
            return "LCARS moved to "+target["name"] if result and result.returncode==0 else "Unable to route the LCARS window through X11"
        geom=re.search(r"(-?\d+),(-?\d+)",target["geometry"]); x,y=geom.groups() if geom else (None,None)
        if x is None: return "KScreen did not report coordinates for "+target["name"]
        result=kdotool("getactivewindow","windowstate","--remove","fullscreen","windowmove",x,y,"windowstate","--add","fullscreen")
        return "LCARS moved to "+target["name"] if result.returncode==0 else "Monitor routing unavailable — review Integration Health in Settings"
    if action=="terminal":
        executable=os.environ.get("LCARS_EXECUTABLE","")
        if not executable or not Path(executable).is_file():return "Remote Terminal requires the installed native LCARS desktop application"
        try:
            geom=re.search(r"(-?\d+),(-?\d+)",target["geometry"]);position=",".join(geom.groups()) if geom else ""
            subprocess.Popen([executable,"--lcars-terminal","--display="+target["name"],"--position="+position],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            return "Native LCARS Terminal requested on "+target["name"]
        except Exception:return "Unable to open a second native LCARS window"
    return "Unknown display command"

def applications():
    found={}
    for folder in APP_DIRS:
        if not folder.exists(): continue
        for path in folder.glob("*.desktop"):
            try:
                c=ConfigParser(interpolation=None,strict=False);c.read(path,encoding="utf-8")
                d=c["Desktop Entry"]
                if d.get("Type")!="Application" or d.get("NoDisplay","false").lower()=="true" or d.get("Hidden","false").lower()=="true": continue
                name=d.get("Name","").strip()
                if name: found[path.name]={"id":path.name,"name":name,"comment":d.get("Comment","Application"),"icon":icon_data(d.get("Icon",""))}
            except Exception: pass
    return sorted(found.values(),key=lambda x:x["name"].lower())

def icon_data(value):
    """Resolve a freedesktop icon to a local data URL usable by the renderer."""
    global ICON_INDEX
    if not value:return ""
    if value in ICON_CACHE:return ICON_CACHE[value]
    direct=Path(value).expanduser();candidates=[direct] if direct.is_file() else []
    if ICON_INDEX is None:
        ICON_INDEX={}
        for root in (Path.home()/".local/share/icons",Path.home()/".icons",Path("/usr/share/icons/hicolor"),Path("/usr/share/pixmaps")):
            if not root.exists():continue
            for path in root.glob("**/*"):
                if path.is_file() and path.suffix.lower() in (".png",".svg",".xpm") and path.stem not in ICON_INDEX:ICON_INDEX[path.stem]=path
    if not candidates and ICON_INDEX.get(Path(value).stem):candidates.append(ICON_INDEX[Path(value).stem])
    if not candidates:ICON_CACHE[value]="";return ""
    try:
        path=candidates[0]
        if path.stat().st_size>524_288:return ""
        mime=mimetypes.guess_type(path.name)[0] or "image/png"
        result="data:"+mime+";base64,"+base64.b64encode(path.read_bytes()).decode();ICON_CACHE[value]=result;return result
    except Exception:ICON_CACHE[value]="";return ""

def application_icon_for(name):
    """Resolve an exact desktop-entry identity; an absent icon is safer than a wrong one."""
    key=re.sub(r"[^a-z0-9]+","",str(name).casefold())
    if not key:return ""
    if key in MEDIA_ICON_CACHE:return MEDIA_ICON_CACHE[key]
    for folder in APP_DIRS:
        if not folder.exists():continue
        for path in folder.glob("*.desktop"):
            try:
                config=ConfigParser(interpolation=None,strict=False);config.read(path,encoding="utf-8")
                entry=config["Desktop Entry"]
                executable=entry.get("Exec","").split()[0] if entry.get("Exec") else ""
                aliases=(entry.get("Name",""),entry.get("StartupWMClass",""),path.stem,Path(executable).name)
                if key in {re.sub(r"[^a-z0-9]+","",str(alias).casefold()) for alias in aliases if alias}:
                    result=icon_data(entry.get("Icon",""));MEDIA_ICON_CACHE[key]=result;return result
            except Exception:pass
    MEDIA_ICON_CACHE[key]=""
    return ""

def storage_data():
    if not shutil.which("lsblk"):return []
    try:
        raw=subprocess.run(["lsblk","-J","-b","-o","NAME,PATH,LABEL,SIZE,TYPE,FSTYPE,MOUNTPOINTS,RM,HOTPLUG,MODEL"],capture_output=True,text=True,timeout=4)
        nodes=json.loads(raw.stdout).get("blockdevices",[]);result=[]
        def walk(node,parent=""):
            kind=node.get("type","");mounts=[x for x in (node.get("mountpoints") or []) if x]
            if kind in ("disk","part","rom"):result.append({"id":node.get("path",node.get("name","")),"name":node.get("label") or node.get("model") or node.get("name","DRIVE"),"size":int(node.get("size") or 0),"type":kind,"filesystem":node.get("fstype") or "","mountpoints":mounts,"mounted":bool(mounts),"removable":bool(node.get("rm") or node.get("hotplug")),"parent":parent})
            for child in node.get("children") or []:walk(child,node.get("path",parent))
        for node in nodes:walk(node)
        return result
    except Exception:return []

def memory_details():
    values={}
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            key,value=line.split(":",1);values[key]=int(value.strip().split()[0])*1024
    except Exception:pass
    total=int(values.get("MemTotal",0));available=int(values.get("MemAvailable",values.get("MemFree",0)));used=max(0,total-available)
    swap_total=int(values.get("SwapTotal",0));swap_free=int(values.get("SwapFree",0));swap_used=max(0,swap_total-swap_free)
    return {"total":total,"used":used,"available":available,"percent":round(used*100/total) if total else 0,"swapTotal":swap_total,"swapUsed":swap_used,"modules":[]}

def graphics_details():
    if GRAPHICS_CACHE["value"] is not None and time.time()-GRAPHICS_CACHE["at"]<3:return GRAPHICS_CACHE["value"]
    adapters=[];seen=set()
    vendor_names={"0x10de":"NVIDIA","0x1002":"AMD","0x1022":"AMD","0x8086":"INTEL"}
    if shutil.which("nvidia-smi"):
        try:
            query="name,utilization.gpu,temperature.gpu,memory.total,memory.used,driver_version"
            rows=subprocess.run(["nvidia-smi",f"--query-gpu={query}","--format=csv,noheader,nounits"],capture_output=True,text=True,timeout=3).stdout.splitlines()
            for row in rows:
                parts=[item.strip() for item in row.split(",")]
                if len(parts)<6:continue
                name,usage,temp,total,used,driver=parts[:6];seen.add(name.casefold())
                adapters.append({"name":name,"vendor":"NVIDIA","driver":driver,"usage":max(0,min(100,int(float(usage or 0)))),"temperature":float(temp) if temp not in ("N/A","") else None,"memoryTotal":int(float(total or 0))*1048576,"memoryUsed":int(float(used or 0))*1048576,"resolution":""})
        except Exception:pass
    for card in sorted(Path("/sys/class/drm").glob("card[0-9]*")):
        if not re.fullmatch(r"card\d+",card.name):continue
        device=card/"device"
        if not device.exists():continue
        try:vendor=(device/"vendor").read_text().strip().lower()
        except Exception:vendor=""
        try:driver=(device/"driver").resolve().name
        except Exception:driver=""
        try:
            slot=next((line.split("=",1)[1] for line in (device/"uevent").read_text().splitlines() if line.startswith("PCI_SLOT_NAME=")),"")
        except Exception:slot=""
        name=""
        if slot and shutil.which("lspci"):
            try:
                output=subprocess.run(["lspci","-s",slot],capture_output=True,text=True,timeout=2).stdout.strip()
                name=output.split(": ",1)[-1] if ": " in output else output
            except Exception:pass
        name=name or f"{vendor_names.get(vendor,'GRAPHICS')} ADAPTER {card.name.replace('card','')}"
        if any(existing in name.casefold() or name.casefold() in existing for existing in seen):continue
        def integer_file(filename):
            try:return int((device/filename).read_text().strip())
            except Exception:return 0
        temperature=None
        for sensor in device.glob("hwmon/hwmon*/temp1_input"):
            try:temperature=round(int(sensor.read_text().strip())/1000,1);break
            except Exception:pass
        resolution=""
        try:
            modes=[]
            for connector in Path("/sys/class/drm").glob(card.name+"-*"):
                if (connector/"status").read_text().strip()=="connected":
                    mode=(connector/"modes").read_text().splitlines();modes+=mode[:1]
            resolution=" · ".join(dict.fromkeys(modes))
        except Exception:pass
        adapters.append({"name":name[:120],"vendor":vendor_names.get(vendor,vendor or "UNKNOWN"),"driver":driver,"usage":max(0,min(100,integer_file("gpu_busy_percent"))),"temperature":temperature,"memoryTotal":integer_file("mem_info_vram_total"),"memoryUsed":integer_file("mem_info_vram_used"),"resolution":resolution})
    GRAPHICS_CACHE.update(at=time.time(),value=adapters);return adapters

def system_details():
    cores=[]
    try:
        for row in Path("/proc/stat").read_text().splitlines():
            match=re.match(r"cpu(\d+)\s+(.+)",row)
            if not match:continue
            values=[int(x) for x in match.group(2).split()];total=sum(values);idle=values[3]+(values[4] if len(values)>4 else 0);key=match.group(1);previous=CPU_TIME_CACHE.get(key);CPU_TIME_CACHE[key]=(total,idle)
            if previous:
                total_delta=max(0,total-previous[0]);idle_delta=max(0,idle-previous[1]);usage=round(100*(total_delta-idle_delta)/total_delta) if total_delta else 0
            else:usage=round(100*(total-idle)/total) if total else 0
            cores.append({"name":"CORE "+key,"usage":max(0,min(100,usage))})
    except Exception:pass
    return {"cpu":{"logical":os.cpu_count() or 1,"load":[round(x,2) for x in os.getloadavg()],"cores":cores},"memory":memory_details(),"graphics":graphics_details(),"storage":storage_data(),"kernel":os.uname().release}

def storage_action(ident,action):
    allowed={x["id"]:x for x in storage_data() if x["removable"] and x["type"] in ("part","rom")}
    if ident not in allowed:return {"ok":False,"message":"Only detected removable volumes can be mounted from LCARS"}
    if not shutil.which("udisksctl"):return {"ok":False,"message":"UDisks2/udisksctl is not installed"}
    command="unmount" if action=="unmount" else "mount" if action=="mount" else ""
    if not command:return {"ok":False,"message":"Unknown storage command"}
    result=subprocess.run(["udisksctl",command,"-b",ident],capture_output=True,text=True,timeout=30)
    return {"ok":result.returncode==0,"message":(result.stdout or result.stderr).strip() or command.title()+" complete"}

def tray_data():
    if TRAY_CACHE["value"] and time.time()-TRAY_CACHE["at"]<4:return TRAY_CACHE["value"]
    if not shutil.which("gdbus"):return {"items":[],"supported":False,"reason":"GDBus is unavailable"}
    try:
        raw=subprocess.run(["gdbus","call","--session","--dest","org.kde.StatusNotifierWatcher","--object-path","/StatusNotifierWatcher","--method","org.freedesktop.DBus.Properties.Get","org.kde.StatusNotifierWatcher","RegisteredStatusNotifierItems"],capture_output=True,text=True,timeout=3)
        values=list(dict.fromkeys(re.findall(r"'([^']+)'",raw.stdout)));items=[]
        def property_value(service,path,name):
            try:
                response=subprocess.run(["gdbus","call","--session","--dest",service,"--object-path",path,"--method","org.freedesktop.DBus.Properties.Get","org.kde.StatusNotifierItem",name],capture_output=True,text=True,timeout=2)
                quoted=re.findall(r"'((?:[^'\\]|\\.)*)'",response.stdout)
                return bytes(quoted[-1],"utf-8").decode("unicode_escape").strip() if quoted else ""
            except Exception:return ""
        def friendly_service(value):
            clean=re.sub(r"^(org|com|net|io)\.","",value,flags=re.I)
            clean=re.sub(r"(?i)(statusnotifieritem|indicator|tray)[-_.]*", "", clean)
            clean=re.sub(r"[-_.:]?\d+(?:[-_.:]\d+)*$", "", clean)
            parts=[part for part in re.split(r"[._:-]+",clean) if part and not part.isdigit()]
            return " ".join(parts[-2:] if len(parts)>1 else parts).strip().title() or "Tray Service"
        def process_identity(service):
            try:
                response=subprocess.run(["gdbus","call","--session","--dest","org.freedesktop.DBus","--object-path","/org/freedesktop/DBus","--method","org.freedesktop.DBus.GetConnectionUnixProcessID",service],capture_output=True,text=True,timeout=2)
                match=re.search(r"uint32\s+(\d+)",response.stdout)
                if not match:return ""
                pid=match.group(1);comm=(Path("/proc")/pid/"comm").read_text().strip()
                cmd=(Path("/proc")/pid/"cmdline").read_bytes().split(b"\0",1)[0].decode(errors="replace")
                return Path(cmd).name or comm
            except Exception:return ""
        def desktop_identity(*values):
            keys={re.sub(r"\.desktop$","",Path(str(value)).name,flags=re.I).casefold() for value in values if value}
            keys|={key.replace("-","").replace("_","").replace(".","") for key in list(keys)}
            if not keys:return ("","")
            for folder in APP_DIRS:
                if not folder.exists():continue
                for path in folder.glob("*.desktop"):
                    try:
                        config=ConfigParser(interpolation=None,strict=False);config.read(path,encoding="utf-8");entry=config["Desktop Entry"]
                        candidates={path.stem.casefold(),entry.get("StartupWMClass","").casefold(),Path(entry.get("Exec","").split()[0]).name.casefold() if entry.get("Exec") else ""}
                        candidates|={key.replace("-","").replace("_","").replace(".","") for key in list(candidates)}
                        if keys.isdisjoint(candidates):continue
                        return (entry.get("Name","").strip(),entry.get("Icon","").strip())
                    except Exception:pass
            return ("","")
        for value in values:
            service,path=(value.split("/",1)+[""])[:2] if "/" in value else (value,"")
            path="/"+path if path else "/StatusNotifierItem"
            title=property_value(service,path,"Title");app_id=property_value(service,path,"Id");status=property_value(service,path,"Status")
            desktop_entry=property_value(service,path,"DesktopEntry");icon_name=property_value(service,path,"IconName");menu_path=property_value(service,path,"Menu");process=process_identity(service)
            desktop_name,desktop_icon=desktop_identity(desktop_entry,app_id,process)
            generic=not title or title.isdigit() or title.casefold() in ("status notifier item","statusnotifieritem","indicator","tray")
            name=desktop_name or ("" if generic else title) or friendly_service(app_id or process or service)
            if not name or name.isdigit() or name=="Tray Service":name=friendly_service(process or desktop_entry or app_id or service)
            items.append({"id":service+"|"+path,"name":name[:80],"status":status.upper() if status else "ACTIVE","icon":icon_data(icon_name or desktop_icon),"hasContextMenu":bool(menu_path and menu_path!="/")})
        result={"items":items,"supported":raw.returncode==0,"reason":"" if raw.returncode==0 else "StatusNotifierWatcher did not respond"};TRAY_CACHE.update(at=time.time(),value=result);return result
    except Exception:return {"items":[],"supported":False,"reason":"System tray inventory unavailable"}

def voice_status():
    root=Path(__file__).resolve().parent.parent
    runtime=next((path for path in (root/"voice",root/"voice-runtime"/"linux") if path.exists()),root/"voice")
    engine=next((str(path) for path in (runtime/"whisper-cli",runtime/"main") if path.is_file()),"") or command_path("whisper-cli") or command_path("whisper-cpp")
    model=next((str(path) for path in (runtime/"ggml-tiny.en-q5_1.bin",runtime/"ggml-tiny.en.bin") if path.is_file()),"")
    ffmpeg=shutil.which("ffmpeg") or ""
    available=bool(engine and model)
    return {"available":available,"engine":engine or "","model":model,"ffmpeg":ffmpeg,"bundled":bool(engine and model and runtime in Path(engine).parents),"runtime":str(runtime),"reason":"" if available else "Bundled whisper.cpp voice files are unavailable; custom engine and model paths remain supported"}

def tray_action(ident,action="activate",x=0,y=0):
    allowed={item["id"] for item in tray_data()["items"]}
    if ident not in allowed or "|" not in ident:return {"ok":False,"message":"Tray service is no longer registered"}
    service,path=ident.split("|",1)
    methods={"activate":"Activate","secondary":"SecondaryActivate","context":"ContextMenu"};method=methods.get(action)
    if not method:return {"ok":False,"message":"Unknown tray action"}
    try:px=max(-32768,min(32767,int(x)));py=max(-32768,min(32767,int(y)))
    except Exception:px=py=0
    result=subprocess.run(["gdbus","call","--session","--dest",service,"--object-path",path,"--method",f"org.kde.StatusNotifierItem.{method}",str(px),str(py)],capture_output=True,text=True,timeout=4)
    messages={"activate":"Tray service activated","secondary":"Secondary tray action requested","context":"Tray context actions opened"}
    return {"ok":result.returncode==0,"message":messages[action] if result.returncode==0 else "This tray service did not accept the requested action"}

def voice_transcribe(data):
    status=voice_status();prefs=load_config().get("shell_prefs",{});engine=str(prefs.get("voiceEngine") or status["engine"]);model=Path(str(prefs.get("voiceModel") or status.get("model") or "")).expanduser()
    if not engine or not Path(engine).is_file() or not model.is_file():return {"ok":False,"message":"The local whisper.cpp voice runtime is unavailable; reinstall 30.8 or select custom files in Settings"}
    encoded=str(data.get("audio","")).split(",")[-1]
    if len(encoded)>28_000_000:return {"ok":False,"message":"Voice sample is too large"}
    try:
        with tempfile.TemporaryDirectory(prefix="lcars-voice-") as folder:
            raw=base64.b64decode(encoded,validate=True);source=Path(folder)/"sample.input";wav=Path(folder)/"sample.wav"
            if raw[:4]==b"RIFF" and raw[8:12]==b"WAVE":wav.write_bytes(raw)
            else:
                if not status["ffmpeg"]:return {"ok":False,"message":"This legacy microphone format needs FFmpeg; the 30.8 PCM recorder does not"}
                source.write_bytes(raw);convert=subprocess.run([status["ffmpeg"],"-loglevel","error","-y","-i",str(source),"-ar","16000","-ac","1",str(wav)],capture_output=True,text=True,timeout=30)
                if convert.returncode:return {"ok":False,"message":"FFmpeg could not decode the microphone sample"}
            environment={**os.environ,"PATH":str(Path(engine).parent)+os.pathsep+os.environ.get("PATH","")};environment["LD_LIBRARY_PATH"]=str(Path(engine).parent)+os.pathsep+os.environ.get("LD_LIBRARY_PATH","")
            result=subprocess.run([engine,"-m",str(model),"-f",str(wav),"-l","en","-nt","-np"],capture_output=True,text=True,timeout=90,cwd=str(Path(engine).parent),env=environment);text=(result.stdout or "").strip()
            return {"ok":result.returncode==0 and bool(text),"text":text,"message":(result.stderr or "Voice command was not recognized").strip()[-300:]}
    except Exception as exc:return {"ok":False,"message":str(exc)}

def system_data():
    try:
        mem={}
        for line in Path("/proc/meminfo").read_text().splitlines():
            k,v=line.split(":",1);mem[k]=int(v.strip().split()[0])
        used=100-round(mem["MemAvailable"]/mem["MemTotal"]*100)
        load=os.getloadavg()[0]; cpus=os.cpu_count() or 1; cpu=min(100,round(load/cpus*100))
        disk=shutil.disk_usage(Path.home()); disk_used=round((disk.total-disk.free)/disk.total*100)
        graphics=graphics_details();gpu=max((int(item.get("usage") or 0) for item in graphics),default=0);gpu_name=" + ".join(item.get("name","GRAPHICS") for item in graphics[:2]) or "GRAPHICS ADAPTER"
        env=linux_environment()
        return {"platform":env["distro"].upper(),"environment":env,"meters":[["CPU",cpu,"SYSTEM PROCESSOR"],["GPU",gpu,gpu_name],["MEM",used,f'{(mem["MemTotal"]-mem["MemAvailable"])/1048576:.1f} / {mem["MemTotal"]/1048576:.1f} GB'],["DISK",disk_used,f"{disk.free/1073741824:.0f} GB AVAILABLE"]]}
    except Exception: return {}

def audio_data():
    if not shutil.which("wpctl"): return {"volume":0,"available":False}
    try:
        out=subprocess.run(["wpctl","get-volume","@DEFAULT_AUDIO_SINK@"],capture_output=True,text=True,timeout=2)
        value=float(out.stdout.split()[1])
        return {"volume":round(value*100),"muted":"MUTED" in out.stdout,"available":True}
    except Exception: return {"volume":0,"available":False}

def audio_devices_data():
    if not shutil.which("wpctl"): return []
    try: status=subprocess.run(["wpctl","status","-n"],capture_output=True,text=True,timeout=3).stdout
    except Exception: return []
    devices=[]; section=None
    for line in status.splitlines():
        stripped=line.strip(" │├└─\t")
        if stripped=="Sinks:": section="output"; continue
        if stripped=="Sources:": section="input"; continue
        if stripped.endswith(":") and section: section=None; continue
        if not section: continue
        match=re.match(r"(\*)?\s*(\d+)\.\s+(.+?)(?:\s+\[|$)",stripped)
        if match:
            marker,ident,name=match.groups()
            devices.append({"id":ident,"name":name.strip(),"default":bool(marker),"kind":section})
    return devices

def media_art_source(value):
    raw=str(value or "").strip()
    if raw.startswith(("https://","http://")):return raw
    if not raw.startswith("file://"):return ""
    try:
        parsed=urlparse(raw)
        path=Path(unquote(parsed.path)).resolve()
        mime=mimetypes.guess_type(path.name)[0] or ""
        stat=path.stat()
        if not path.is_file() or not mime.startswith("image/") or stat.st_size>8388608:return ""
        token=hashlib.sha256(f"{path}:{stat.st_mtime_ns}:{stat.st_size}".encode()).hexdigest()[:24]
        if len(MEDIA_ART_PATHS)>=64 and token not in MEDIA_ART_PATHS:MEDIA_ART_PATHS.pop(next(iter(MEDIA_ART_PATHS)))
        MEDIA_ART_PATHS[token]=path
        return f"http://127.0.0.1:{PORT}/api/media-art?id={token}"
    except Exception:return ""

def media_data():
    players_by_name={}
    if shutil.which("playerctl"):
        listed=subprocess.run(["playerctl","-l"],capture_output=True,text=True,timeout=2)
        for name in dict.fromkeys(x.strip() for x in listed.stdout.splitlines() if x.strip()):
            fmt="{{status}}\t{{artist}}\t{{title}}\t{{album}}\t{{mpris:artUrl}}\t{{mpris:length}}"
            meta=subprocess.run(["playerctl","--player",name,"metadata","--format",fmt],capture_output=True,text=True,timeout=2)
            values=(meta.stdout.strip().split("\t")+[""]*6)[:6]
            pos=subprocess.run(["playerctl","--player",name,"position"],capture_output=True,text=True,timeout=2)
            try: position=float(pos.stdout.strip())
            except Exception: position=0
            try: length=float(values[5])/1000000
            except Exception: length=0
            vol=subprocess.run(["playerctl","--player",name,"volume"],capture_output=True,text=True,timeout=2)
            try: volume=round(float(vol.stdout.strip())*100)
            except Exception: volume=0
            display_name=name.split(".")[0].replace("-"," ").title()
            art=media_art_source(values[4])
            player={"id":name,"name":display_name,"status":values[0] or "Stopped","artist":values[1],"title":values[2] or "No media","album":values[3],"artUrl":art,"position":position,"length":length,"volume":volume,"icon":application_icon_for(display_name)}
            key=display_name.casefold()
            status_rank={"Playing":2,"Paused":1,"Stopped":0}
            previous=players_by_name.get(key)
            if previous is None or status_rank.get(player["status"],0)>status_rank.get(previous["status"],0):
                players_by_name[key]=player
    streams=[]
    if shutil.which("wpctl"):
        status=subprocess.run(["wpctl","status","-n"],capture_output=True,text=True,timeout=2).stdout
        in_streams=False
        for line in status.splitlines():
            stripped=line.strip()
            if "Streams:" in stripped: in_streams=True; continue
            if in_streams and stripped.endswith(":") and "Streams:" not in stripped: break
            if in_streams:
                import re
                match=re.search(r"[│├└─*\s]*(\d+)\.\s+(.+?)(?:\s+\[|$)",stripped)
                if match and not any(x["id"]==match.group(1) for x in streams):
                    ident,name=match.groups()
                    vol=subprocess.run(["wpctl","get-volume",ident],capture_output=True,text=True,timeout=1)
                    try: value=round(float(vol.stdout.split()[1])*100)
                    except Exception: value=0
                    muted="MUTED" in vol.stdout.upper()
                    clean=name.strip()
                    advanced=bool(re.search(r"(?i)(monitor|capture|playback|input_[A-Z0-9]+|output_[A-Z0-9]+|[_ .-](FL|FR|FC|LFE|RL|RR|MONO)(?:\b|$))",clean))
                    group=re.sub(r"(?i)\b(input|output)_(FL|FR|FC|LFE|RL|RR|MONO)\b","",clean)
                    group=re.sub(r"(?i)[:._ -]*(monitor|capture|playback)[._ -]*(FL|FR|FC|LFE|RL|RR|MONO)?$","",group)
                    group=re.sub(r"\s+"," ",group).strip(" .:_-") or clean
                    streams.append({"id":ident,"name":clean,"group":group,"advanced":advanced,"volume":value,"muted":muted,"icon":application_icon_for(group),"routeAvailable":bool(shutil.which("pavucontrol"))})
    return {"players":list(players_by_name.values()),"streams":streams}

def media_player_aliases(player):
    identity=re.sub(r"[^a-z0-9]+"," ",str(player).casefold()).strip();aliases={identity,str(player).casefold()}
    if re.search(r"chromium|chrome|opera|vivaldi|brave|edge",identity):aliases.update({"browser","chromium","chrome","google chrome","opera","opera gx","vivaldi","brave","edge"})
    if "firefox" in identity:aliases.update({"browser","firefox","mozilla firefox"})
    if "spotify" in identity:aliases.update({"spotify","spotify music"})
    if "vlc" in identity:aliases.update({"vlc","vlc media player"})
    return aliases

def media_control(player,command):
    command={"resume":"play","continue":"play","unpause":"play","hold":"pause"}.get(command,command)
    allowed={"previous","play-pause","play","pause","next","shuffle","stop"}
    if command not in allowed:return {"ok":False,"error":"Invalid media command"}
    if not shutil.which("playerctl"):return {"ok":False,"error":"Media controls require playerctl"}
    listed=subprocess.run(["playerctl","-l"],capture_output=True,text=True,timeout=2)
    players=list(dict.fromkeys(item.strip() for item in listed.stdout.splitlines() if item.strip()))
    if not players:return {"ok":False,"error":"No MPRIS media sessions are available"}
    requested=str(player or "").casefold().strip()
    matching=[candidate for candidate in players if requested and any(requested==alias or requested in alias or alias in requested for alias in media_player_aliases(candidate))]
    if requested and not matching:return {"ok":False,"error":f"No MPRIS media source matches {player}"}
    eligible=matching or players
    statuses={}
    for candidate in eligible:
        result=subprocess.run(["playerctl","--player",candidate,"status"],capture_output=True,text=True,timeout=2)
        statuses[candidate]=(result.stdout.strip() or "Stopped").casefold()
    preference={
        "play":{"paused":0,"stopped":1,"playing":2},
        "pause":{"playing":0,"paused":1,"stopped":2},
    }.get(command,{"playing":0,"paused":1,"stopped":2})
    ordered=sorted(eligible,key=lambda candidate:(0 if candidate==player else 1,preference.get(statuses.get(candidate,"stopped"),3)))
    errors=[]
    for candidate in ordered:
        state=statuses.get(candidate,"stopped")
        if command=="play" and state=="playing":return {"ok":True,"player":candidate,"command":command,"status":"Playing","message":"Media is already playing"}
        if command=="pause" and state=="paused":return {"ok":True,"player":candidate,"command":command,"status":"Paused","message":"Media is already paused"}
        args=["playerctl","--player",candidate,command]
        if command=="shuffle":args.append("Toggle")
        result=subprocess.run(args,capture_output=True,text=True,timeout=3)
        if result.returncode==0:
            if command in {"play","pause","stop"}:
                expected={"play":"playing","pause":"paused","stop":"stopped"}[command];confirmed=""
                for delay in (0,.12,.28,.5):
                    if delay:time.sleep(delay)
                    check=subprocess.run(["playerctl","--player",candidate,"status"],capture_output=True,text=True,timeout=2)
                    confirmed=(check.stdout.strip() or "Stopped").casefold()
                    if confirmed==expected:break
                if confirmed!=expected:
                    if command=="play" and state in {"paused","stopped"}:
                        fallback=subprocess.run(["playerctl","--player",candidate,"play-pause"],capture_output=True,text=True,timeout=3)
                        if fallback.returncode==0:
                            check=subprocess.run(["playerctl","--player",candidate,"status"],capture_output=True,text=True,timeout=2);confirmed=(check.stdout.strip() or "Stopped").casefold()
                    if confirmed!=expected:
                        errors.append(f"{candidate}: command was accepted but playback remained {confirmed}")
                        continue
            return {"ok":True,"player":candidate,"command":command,"status":expected.title() if command in {"play","pause","stop"} else "Accepted","message":f"{command.replace('-',' ').title()} confirmed on {candidate}"}
        detail=(result.stderr or result.stdout).strip()
        if detail:errors.append(f"{candidate}: {detail}")
    return {"ok":False,"error":errors[0] if errors else f"No media session accepted {command}"}

def start_first(candidates):
    for command in candidates:
        if shutil.which(command[0]):
            subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            return True
    return False

def integration_health():
    displays=displays_data()
    env=linux_environment()
    try:extension_result=extension_manifests()
    except Exception as exc:extension_result={"extensions":[],"errors":[{"error":type(exc).__name__}]}
    config_ready=CONFIG_DIR.exists() or os.access(CONFIG_DIR.parent,os.W_OK)
    power_ready=bool(shutil.which("systemctl"))
    return {
        "window_control":{"available":env["capabilities"]["windowControl"],"detail":f'{env["desktop"]} / {env["session"]} window adapter',"remedy":"Install the supported desktop window-control adapter, then recheck."},
        "displays":{"available":env["capabilities"]["displayControl"],"detail":f'{len(displays)} display output(s) detected',"remedy":"Install your desktop display utility (KScreen on KDE) and reconnect the display."},
        "audio":{"available":bool(shutil.which("wpctl")),"detail":"PipeWire controls ready" if shutil.which("wpctl") else "wpctl missing; install wireplumber","remedy":"Install WirePlumber/PipeWire tools to enable audio routing."},
        "media":{"available":bool(shutil.which("playerctl")),"detail":"MPRIS controls ready" if shutil.which("playerctl") else "playerctl missing","remedy":"Install playerctl to control MPRIS-compatible players."},
        "terminal":{"available":Path(os.environ.get("SHELL","/bin/bash")).is_file(),"detail":os.environ.get("SHELL","/bin/bash"),"remedy":"Choose an installed shell in Settings → Embedded Terminal."},
        "storage":{"available":bool(shutil.which("udisksctl")),"detail":f'{len(storage_data())} block device(s); UDisks2 '+("ready" if shutil.which("udisksctl") else "missing"),"remedy":"Install UDisks2 for safe removable-drive mount controls."},
        "voice":{"available":voice_status()["available"],"detail":voice_status()["reason"] or "Bundled offline whisper.cpp and English command model ready","remedy":"Reinstall Version 30.8 voice resources or select custom whisper.cpp files in Settings."},
        "tray":{"available":tray_data()["supported"],"detail":tray_data()["reason"] or f'{len(tray_data()["items"])} StatusNotifier service(s)',"remedy":"Use a KDE StatusNotifier-compatible desktop session for re-hosted tray items."},
        "extensions":{"available":not bool(extension_result.get("errors")),"detail":f'{len(extension_result.get("extensions",[]))} module(s), {len(extension_result.get("errors",[]))} rejected',"remedy":"Remove or update rejected manifests shown in the extension bay."},
        "configuration":{"available":config_ready,"detail":"Local settings storage ready" if config_ready else "Settings directory is not writable","remedy":"Restore write access to the LCARS configuration directory."},
        "updater":{"available":True,"detail":"Verified GitHub release channel configured","remedy":"Connect to GitHub and use the manual update check for detailed errors."},
        "power":{"available":power_ready,"detail":"systemd-logind power controls ready" if power_ready else "systemctl unavailable","remedy":"Use a systemd-logind compatible session or the operating system power menu."},
    }

def engineering_data():
    processes=[];sensors=[];current_uid=os.getuid();protected_names={"systemd","init","kthreadd","plasmashell","kwin_wayland","kwin_x11","lcars_bridge.py","lcars-command-interface"}
    try:
        raw=subprocess.run(["ps","-eo","pid=,comm=,%cpu=,%mem=,user=,stat=","--sort=-%cpu"],capture_output=True,text=True,timeout=3).stdout
        for line in raw.splitlines()[:120]:
            parts=line.split(None,5)
            if len(parts)<6:continue
            pid_text,name,cpu,memory,user,state=parts
            try:pid=int(pid_text);owner=Path(f"/proc/{pid}").stat().st_uid
            except Exception:continue
            if owner!=current_uid:continue
            protected=pid in {1,os.getpid(),os.getppid()} or name.casefold() in protected_names or "lcars" in name.casefold()
            processes.append({"pid":pid,"name":name[:80],"cpu":round(float(cpu),1),"memory":round(float(memory),1),"user":user[:48],"state":"stopped" if "T" in state else "running","protected":protected})
    except Exception:pass
    for path in sorted(Path("/sys/class/thermal").glob("thermal_zone*"))[:8]:
        try:
            value=float((path/"temp").read_text().strip())/1000;name=(path/"type").read_text().strip().replace("_"," ").upper()
            sensors.append({"id":f"temp-{path.name}","name":name or "THERMAL ZONE","kind":"temperature","value":f"{value:.1f}°C","status":"attention" if value>=85 else "ready","detail":"KERNEL THERMAL SENSOR"})
        except Exception:pass
    for path in sorted(Path("/sys/class/hwmon").glob("hwmon*/fan*_input"))[:8]:
        try:
            value=int(path.read_text().strip());name=(path.parent/"name").read_text().strip().replace("_"," ").upper()
            sensors.append({"id":f"fan-{path.parent.name}-{path.stem}","name":name+" FAN","kind":"fan","value":f"{value} RPM","status":"ready" if value>0 else "attention","detail":"HARDWARE MONITOR"})
        except Exception:pass
    for path in sorted(Path("/sys/class/power_supply").glob("*")):
        try:
            kind=(path/"type").read_text().strip().casefold()
            if kind not in ("battery","ups"):continue
            capacity=int((path/"capacity").read_text().strip());state=(path/"status").read_text().strip() if (path/"status").exists() else ""
            sensors.append({"id":f"power-{path.name}","name":path.name.upper(),"kind":"ups" if kind=="ups" else "battery","value":f"{capacity}%","status":"attention" if capacity<20 and state.casefold()!="charging" else "ready","detail":state.upper() or kind.upper()})
        except Exception:pass
    removable=sum(1 for drive in storage_data() if drive.get("removable"));sensors.append({"id":"storage-matrix","name":"STORAGE MATRIX","kind":"drive","value":f"{len(storage_data())} DRIVES","status":"ready","detail":f"{removable} REMOVABLE DEVICE(S)"})
    return {"generated":int(time.time()),"processes":processes[:80],"sensors":sensors[:24],"processControl":True,"serviceControl":False,"notes":["Only processes owned by the current user can be controlled","LCARS and critical desktop processes remain protected"]}

def process_action(pid,action):
    if action not in ("terminate","suspend","resume"):raise ValueError("unsupported process action")
    pid=int(pid);target=Path(f"/proc/{pid}")
    if pid<=1 or pid in (os.getpid(),os.getppid()) or not target.exists():raise ValueError("process is unavailable or protected")
    if target.stat().st_uid!=os.getuid():raise PermissionError("LCARS only controls processes owned by the current user")
    try:name=(target/"comm").read_text().strip().casefold()
    except Exception:name=""
    if "lcars" in name or name in {"systemd","plasmashell","kwin_wayland","kwin_x11"}:raise PermissionError("this desktop process is protected")
    os.kill(pid,{"terminate":signal.SIGTERM,"suspend":signal.SIGSTOP,"resume":signal.SIGCONT}[action])
    return {"ok":True,"message":f"Process {pid} {action} command accepted"}

def routine_command(command):
    commands={"refresh-applications":lambda:"Application inventory refreshed","integration-recheck":lambda:protected_action("integration-recheck"),"open-system-monitor":lambda:protected_action("system-monitor"),"open-software-center":lambda:protected_action("software-center")}
    if command not in commands:raise PermissionError("routine command is not on the LCARS allowlist")
    return {"ok":True,"message":commands[command]()}

def diagnostics_report():
    """Return support facts without usernames, paths, files, credentials or history."""
    environment=linux_environment();media=media_data()
    try:extensions=extension_manifests()
    except Exception as exc:extensions={"extensions":[],"errors":[{"error":type(exc).__name__}]}
    return {
        "schema":1,
        "generatedUtc":time.strftime("%Y-%m-%dT%H:%M:%SZ",time.gmtime()),
        "lcarsVersion":LCARS_VERSION,
        "platform":{"family":"Linux","distribution":environment.get("distro","Linux"),"desktop":environment.get("desktop","Unknown"),"session":environment.get("session","unknown")},
        "health":integration_health(),
        "inventory":{"displays":len(displays_data()),"applications":sum(len(list(folder.glob("*.desktop"))) for folder in APP_DIRS if folder.exists()),"drives":len(storage_data()),"mediaPlayers":len(media.get("players",[])),"audioStreams":len(media.get("streams",[])),"extensions":len(extensions.get("extensions",[])),"rejectedExtensions":len(extensions.get("errors",[]))},
        "configuration":{"settingsFilePresent":CONFIG_FILE.is_file(),"extensionStateDirectoryPresent":EXTENSION_STATE_DIR.is_dir(),"updateDirectoryPresent":UPDATE_DIR.is_dir()},
        "privacy":"Sanitized report: no usernames, home paths, file names, credentials, terminal history, window titles, or media titles are included.",
    }

def export_diagnostics():
    report=diagnostics_report();destination=Path.home()/"Downloads"/f"LCARS-Diagnostics-{time.strftime('%Y%m%d-%H%M%S')}.json"
    destination.parent.mkdir(parents=True,exist_ok=True);destination.write_text(json.dumps(report,indent=2),encoding="utf-8")
    return {"ok":True,"message":"Privacy-safe diagnostics report exported to Downloads","path":str(destination)}

def protected_action(action):
    mappings={
        "system-monitor":[["plasma-systemmonitor"],["gnome-system-monitor"]],
        "storage":[["filelight"],["baobab"]],
        "processes":[["plasma-systemmonitor"],["gnome-system-monitor"]],
        "media-player":[["elisa"],["vlc"]],
        "audio-settings":[["systemsettings","kcm_pulseaudio"],["pavucontrol"]],
        "network-settings":[["systemsettings","kcm_networkmanagement"],["nm-connection-editor"]],
        "wifi":[["systemsettings","kcm_networkmanagement"],["nm-connection-editor"]],
        "bluetooth":[["systemsettings","kcm_bluetooth"],["blueman-manager"]],
        "software-center":[["plasma-discover"],["gnome-software"]],
        "check-updates":[["plasma-discover","--mode","Update"],["gnome-software","--mode","updates"]],
        "display-settings":[["systemsettings","kcm_kscreen"]],
    }
    if action=="close-bay-app":
        return "Application removed from bay; its native Wayland window remains under desktop control"
    if action=="minimize-bay-app":
        return "Application Bay minimized"
    if action in ("poweroff","reboot","sleep"):
        verb={"poweroff":"poweroff","reboot":"reboot","sleep":"suspend"}[action]
        command=["systemctl",verb]
        if not shutil.which(command[0]): return "System power control is not available on this Linux distribution"
        subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        return {"poweroff":"Computer shutdown requested","reboot":"Computer restart requested","sleep":"Computer sleep requested"}[action]
    if action=="logout":
        session_id=os.environ.get("XDG_SESSION_ID","")
        if session_id and shutil.which("loginctl"):
            subprocess.Popen(["loginctl","terminate-session",session_id],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True);return "Desktop session logout requested"
        if start_first([["qdbus6","org.kde.Shutdown","/Shutdown","logout"],["qdbus","org.kde.Shutdown","/Shutdown","logout"],["gnome-session-quit","--logout","--no-prompt"]]):return "Desktop session logout requested"
        return "Desktop logout control is unavailable; use the normal desktop session menu"
    if action=="shell-mode-off":
        running=shutil.which("pgrep") and subprocess.run(["pgrep","-x","plasmashell"],capture_output=True).stdout
        if not running:
            service=subprocess.run(["systemctl","--user","start","plasma-plasmashell.service"],capture_output=True,text=True,timeout=8) if shutil.which("systemctl") else None
            if (not service or service.returncode!=0) and shutil.which("plasmashell"):
                subprocess.Popen(["plasmashell"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        return "Plasma desktop restored"
    if action=="shell-mode-on":
        if not linux_environment()["capabilities"]["shellControl"]:return "Kiosk shell control is unavailable; LCARS remains full-screen above the normal desktop"
        if shutil.which("systemctl"):
            subprocess.run(["systemctl","--user","stop","plasma-plasmashell.service"],capture_output=True,text=True,timeout=8)
        elif shutil.which("pkill"):
            subprocess.run(["pkill","-x","plasmashell"],capture_output=True,text=True,timeout=3)
        return "LCARS kiosk command terminal active · normal desktop recovery remains available"
    if action=="identify-displays":
        if start_first([["systemsettings","kcm_kscreen"],["gnome-control-center","display"],["cinnamon-settings","display"],["xfce4-display-settings"],["lxqt-config-monitor"]]): return "Display identification opened"
        return "Display settings are not installed"
    if action=="integration-recheck":
        health=integration_health(); ready=sum(1 for item in health.values() if item["available"])
        return f"Integration check complete — {ready}/{len(health)} systems ready"
    if action=="repair-installation":
        helper=Path(__file__).resolve().parent.parent/"recovery"/"register-app.sh"
        if not helper.is_file():helper=Path.home()/".local/opt/lcars-command-interface"/"install-autostart.sh"
        if not helper.is_file():return "Repair helper is unavailable; reinstall the current Linux package without removing settings"
        repair_env={**os.environ,"LCARS_APPLICATION_PATH":os.environ.get("LCARS_EXECUTABLE",""),"LCARS_ICON_PATH":str(Path(__file__).resolve().parent.parent/"icons"/"lcars-command-interface.png")}
        result=subprocess.run(["bash",str(helper),"--register"],capture_output=True,text=True,timeout=20,env=repair_env)
        return "Application launcher, icon registration, and desktop recovery link repaired" if result.returncode==0 else "Repair could not refresh desktop integration: "+(result.stderr.strip()[:180] or "unknown error")
    if action=="lcars-update-check":
        return "Use Updates → LCARS Interface to check the verified GitHub release channel"
    if action=="lcars-rollback":
        previous=CONFIG_DIR/"previous-release"
        return "Previous release is ready for restoration" if previous.exists() else "No previous LCARS release has been archived yet"
    if action=="extension-scan":
        EXTENSION_DIR.mkdir(parents=True,exist_ok=True)
        count=len(list(EXTENSION_DIR.glob("*/lcars-module.json")))+len(list(EXTENSION_DIR.glob("*.lcars-module.json")))
        return f"Extension scan complete — {count} compatible module manifest(s) found"
    if action=="extension-folder":
        EXTENSION_DIR.mkdir(parents=True,exist_ok=True)
        if start_first([["xdg-open",str(EXTENSION_DIR)],["dolphin",str(EXTENSION_DIR)]]): return "LCARS extensions folder opened"
        return f"Extensions folder: {EXTENSION_DIR}"
    if action in ("refresh-system","network-refresh"): return "System information refreshed"
    if action=="check-updates":
        candidates=[["plasma-discover","--mode","Update"],["gnome-software","--mode","updates"]]
        if start_first(candidates): return "Software update control opened"
        manager=next((x for x in ("dnf","apt","pacman","zypper","apk","xbps-install") if shutil.which(x)),None)
        return f"No graphical updater is installed — use {manager or 'your distribution package manager'} in Terminal"
    if action in mappings and start_first(mappings[action]): return action.replace("-"," ").title()+" opened"
    return "Required system application is not installed"

class Handler(BaseHTTPRequestHandler):
    def send_json(self,data,status=200):
        body=json.dumps(data).encode();self.send_response(status)
        self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(body)))
        origin=self.headers.get("Origin","");allowed=origin if origin in ("lcars://app","http://127.0.0.1:8764") else "lcars://app"
        self.send_header("Access-Control-Allow-Origin",allowed);self.send_header("Access-Control-Allow-Headers","Content-Type");self.end_headers();self.wfile.write(body)
    def do_OPTIONS(self):
        origin=self.headers.get("Origin","");allowed=origin if origin in ("lcars://app","http://127.0.0.1:8764") else "lcars://app"
        self.send_response(204);self.send_header("Access-Control-Allow-Origin",allowed);self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS");self.send_header("Access-Control-Allow-Headers","Content-Type");self.end_headers()
    def send_media_art(self,path):
        try:
            mime=mimetypes.guess_type(path.name)[0] or ""
            if not path.is_file() or not mime.startswith("image/") or path.stat().st_size>8388608:return self.send_json({"error":"media artwork unavailable"},404)
            body=path.read_bytes();origin=self.headers.get("Origin","");allowed=origin if origin in ("lcars://app","http://127.0.0.1:8764") else "lcars://app"
            self.send_response(200);self.send_header("Content-Type",mime);self.send_header("Content-Length",str(len(body)));self.send_header("Cache-Control","private, max-age=3600");self.send_header("Access-Control-Allow-Origin",allowed);self.end_headers();self.wfile.write(body)
        except Exception:self.send_json({"error":"media artwork unavailable"},404)
    def send_media_file(self,path):
        try:
            if not path.is_file():return self.send_json({"ok":False,"error":"Media file was not found"},404)
            size=path.stat().st_size
            if size<=0:return self.send_json({"ok":False,"error":"Media file is empty"},400)
            start,end=0,size-1;status=200
            requested=self.headers.get("Range","")
            if requested:
                match=re.fullmatch(r"bytes=(\d*)-(\d*)",requested.strip())
                if not match:return self.send_json({"ok":False,"error":"Invalid media range"},416)
                if match.group(1):start=int(match.group(1));end=min(size-1,int(match.group(2))) if match.group(2) else size-1
                elif match.group(2):start=max(0,size-int(match.group(2)))
                if start> end or start>=size:return self.send_json({"ok":False,"error":"Media range is outside the file"},416)
                status=206
            mime=mimetypes.guess_type(path.name)[0] or {".mkv":"video/x-matroska",".flac":"audio/flac",".opus":"audio/ogg",".m4a":"audio/mp4"}.get(path.suffix.lower(),"application/octet-stream")
            origin=self.headers.get("Origin","");allowed=origin if origin in ("lcars://app","http://127.0.0.1:8764") else "lcars://app"
            length=end-start+1;self.send_response(status);self.send_header("Content-Type",mime);self.send_header("Content-Length",str(length));self.send_header("Accept-Ranges","bytes");self.send_header("Cache-Control","private, no-store");self.send_header("Access-Control-Allow-Origin",allowed)
            if status==206:self.send_header("Content-Range",f"bytes {start}-{end}/{size}")
            self.end_headers()
            with path.open("rb") as media:
                media.seek(start);remaining=length
                while remaining:
                    chunk=media.read(min(262144,remaining))
                    if not chunk:break
                    self.wfile.write(chunk);remaining-=len(chunk)
        except (BrokenPipeError,ConnectionResetError):pass
        except Exception as exc:self.send_json({"ok":False,"error":str(exc)},400)
    def do_GET(self):
        route=urlparse(self.path).path
        if route=="/api/apps": self.send_json({"apps":applications()})
        elif route=="/api/system": self.send_json(system_data())
        elif route=="/api/system-details": self.send_json(system_details())
        elif route=="/api/storage": self.send_json({"drives":storage_data()})
        elif route=="/api/network-details": self.send_json(network_details())
        elif route=="/api/tray": self.send_json(tray_data())
        elif route=="/api/padd-pairing": self.send_json(PADD.status(True))
        elif route=="/api/padd-commands": self.send_json({"commands":PADD.pop_commands()})
        elif route=="/api/padd-events": self.send_json({"events":PADD.pop_events()})
        elif route=="/api/data-fabric": self.send_json(DATA_FABRIC.status())
        elif route=="/api/universal-search":
            from urllib.parse import parse_qs
            try:self.send_json(DATA_FABRIC.search_files(parse_qs(urlparse(self.path).query).get("q",[""])[0],24))
            except Exception as exc:self.send_json({"ok":False,"error":str(exc)},400)
        elif route=="/api/voice-status": self.send_json(voice_status())
        elif route=="/api/compat": self.send_json(linux_environment())
        elif route=="/api/lcars-session": self.send_json(session_status())
        elif route=="/api/audio": self.send_json(audio_data())
        elif route=="/api/audio-devices": self.send_json({"devices":audio_devices_data()})
        elif route=="/api/files":
            from urllib.parse import parse_qs
            requested=parse_qs(urlparse(self.path).query).get("path",["~"])[0]
            self.send_json(file_list(requested))
        elif route=="/api/file-preview":
            from urllib.parse import parse_qs
            try:
                path=safe_home_path(parse_qs(urlparse(self.path).query).get("path",[""])[0]);mime=mimetypes.guess_type(path.name)[0] or ""
                if not path.is_file() or path.stat().st_size>2097152:self.send_json({"error":"preview unavailable"},400)
                elif mime.startswith("image/"):self.send_json({"kind":"image","content":f"data:{mime};base64,"+base64.b64encode(path.read_bytes()).decode()})
                elif mime.startswith("text/") or path.suffix.lower() in (".md",".json",".log",".ini",".conf",".py",".js",".ts",".tsx",".css",".html",".sh"):self.send_json({"kind":"text","content":path.read_text(encoding="utf-8",errors="replace")[:32768]})
                else:self.send_json({"kind":"","content":""})
            except Exception as exc:self.send_json({"error":str(exc)},400)
        elif route=="/api/media-file":
            try:self.send_media_file(safe_home_path(parse_qs(urlparse(self.path).query).get("path",[""])[0]))
            except Exception as exc:self.send_json({"ok":False,"error":str(exc)},403)
        elif route=="/api/media": self.send_json(media_data())
        elif route=="/api/media-art":
            token=parse_qs(urlparse(self.path).query).get("id",[""])[0]
            path=MEDIA_ART_PATHS.get(token) if re.fullmatch(r"[0-9a-f]{24}",token) else None
            self.send_media_art(path) if path else self.send_json({"error":"media artwork unavailable"},404)
        elif route=="/api/windows": self.send_json({"windows":windows_data(),"kwin":bool(command_path("kdotool"))})
        elif route=="/api/displays": self.send_json({"displays":displays_data()})
        elif route=="/api/health-check": self.send_json({"health":integration_health()})
        elif route=="/api/diagnostics": self.send_json(diagnostics_report())
        elif route=="/api/config": self.send_json(load_config())
        elif route=="/api/extensions": self.send_json(extension_manifests())
        elif route=="/api/extension-catalog": self.send_json(build_extension_catalog(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,MODULE_SOURCE_FILE,runtime_dir=MODULE_RUNTIME_DIR))
        elif route=="/api/module-platform": self.send_json(module_platform_status(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,MODULE_RUNTIME_DIR))
        elif route=="/api/engineering": self.send_json(engineering_data())
        elif route=="/api/extension-state":
            from urllib.parse import parse_qs
            try:self.send_json({"state":extension_state(EXTENSION_STATE_DIR,parse_qs(urlparse(self.path).query).get("id",[""])[0])})
            except Exception as exc:self.send_json({"error":str(exc)},400)
        elif route=="/api/lcars-update":
            try:
                channel=parse_qs(urlparse(self.path).query).get("channel",["stable"])[0]
                self.send_json({**check_update(LCARS_VERSION,"linux",channel),"rollback":rollback_status("linux",os.environ.get("LCARS_EXECUTABLE",""),CONFIG_DIR/"previous-release")})
            except Exception as exc:self.send_json({"ok":False,"silent":True,"error":str(exc)},503)
        elif route=="/api/document":
            from urllib.parse import parse_qs
            try:self.send_json(read_document(parse_qs(urlparse(self.path).query).get("path",[""])[0]))
            except Exception as exc:self.send_json({"error":str(exc)},400)
        elif route=="/api/terminal-sessions": self.send_json({"sessions":[{"id":x["id"],"name":x["name"]} for x in TERMINALS.values()]})
        elif route.startswith("/api/terminal-output/"):
            ident=route.rsplit("/",1)[-1]; term=TERMINALS.get(ident)
            self.send_json({"output":term["output"] if term else "","closed":not bool(term)})
        elif route=="/api/health": self.send_json({"status":"online"})
        else: self.send_json({"error":"not found"},404)
    def do_POST(self):
        try:
            length=int(self.headers.get("Content-Length","0")); data=json.loads(self.rfile.read(length)); app_id=data.get("id","")
            route=urlparse(self.path).path
            if route=="/api/lcars-update":
                operation=str(data.get("operation","check"))
                requested_channel=str(data.get("channel","stable"));channel=requested_channel if requested_channel in {"development","stable-release"} else "stable"
                try:
                    executable=os.environ.get("LCARS_EXECUTABLE","");archive=CONFIG_DIR/"previous-release"
                    if operation=="check":return self.send_json({**check_update(LCARS_VERSION,"linux",channel),"rollback":rollback_status("linux",executable,archive)})
                    if operation=="download":return self.send_json({**download_update(LCARS_VERSION,"linux",UPDATE_DIR,channel),"rollback":rollback_status("linux",executable,archive)})
                    if operation=="install":return self.send_json(schedule_install(str(data.get("path","")),"linux",int(os.environ.get("LCARS_PARENT_PID",os.getppid())),executable,archive))
                    if operation=="rollback":return self.send_json(schedule_rollback("linux",int(os.environ.get("LCARS_PARENT_PID",os.getppid())),executable,archive))
                    if operation=="status":return self.send_json({"ok":True,"rollback":rollback_status("linux",executable,archive)})
                    return self.send_json({"ok":False,"error":"Unknown update operation"},400)
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},503)
            if route=="/api/lcars-session":
                try:return self.send_json(session_operation(data))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/diagnostics-export":
                try:return self.send_json(export_diagnostics())
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},500)
            if route=="/api/extension-state":
                try:return self.send_json({"ok":True,"state":save_extension_state(EXTENSION_STATE_DIR,str(data.get("id","")),data.get("state",{}))})
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/extension-install":
                try:return self.send_json(extension_operation(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,str(data.get("id","")),str(data.get("operation","install")),MODULE_SOURCE_FILE,str(data.get("sourceId","")),MODULE_RUNTIME_DIR,data.get("approvedCapabilities",[])))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/module-source":
                try:return self.send_json(repository_source_operation(MODULE_SOURCE_FILE,str(data.get("operation","")),str(data.get("url","")),str(data.get("id","")),str(data.get("channel","stable"))))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/module-publisher":
                try:return self.send_json(prepare_module_publication(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,MODULE_PUBLISHER_DIR,str(data.get("id","")),str(data.get("repository","YOUR-GITHUB-NAME/YOUR-REPOSITORY"))))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/module-platform":
                try:return self.send_json(module_platform_operation(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,MODULE_RUNTIME_DIR,str(data.get("operation","")),str(data.get("id","")),data.get("capabilities",[]),str(data.get("detail",""))))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/module-package":
                try:return self.send_json(module_package_operation(EXTENSION_DIR,BUILTIN_EXTENSION_DIR,MODULE_PUBLISHER_DIR,MODULE_RUNTIME_DIR,str(data.get("operation","")),str(data.get("id","")),str(data.get("path","")),data.get("approvedCapabilities",[])))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/module-forge":
                try:return self.send_json(create_module_draft(EXTENSION_DIR,data))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/padd-pairing":
                try:return self.send_json(PADD.manage(data))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/data-fabric":
                try:
                    operation=str(data.get("operation","status"))
                    if operation=="deliver-file":
                        if not DATA_FABRIC.status()["categories"]["smallFiles"]:raise PermissionError("Small-file transfer is disabled in Data Fabric")
                        path=safe_home_path(str(data.get("path","")))
                        if not path.is_file():return self.send_json({"ok":False,"error":"File was not found"},404)
                        if path.stat().st_size>524288:return self.send_json({"ok":False,"error":"Federation file transfers are limited to 512 KiB"},400)
                        result=PADD.manage({"operation":"delivery","id":str(data.get("deviceId","")),"kind":"file","payload":{"name":path.name,"mime":mimetypes.guess_type(path.name)[0] or "application/octet-stream","content":base64.b64encode(path.read_bytes()).decode("ascii")}})
                        DATA_FABRIC.record_recent("files",str(path),path.name,str(path.parent),result.get("station",{}).get("name","LOCAL CORE"))
                        return self.send_json(result)
                    if operation=="deliver-clipboard":
                        if not DATA_FABRIC.status()["categories"]["clipboard"]:raise PermissionError("Clipboard handoff is disabled in Data Fabric")
                        result=PADD.manage({"operation":"delivery","id":str(data.get("deviceId","")),"kind":"clipboard","payload":{"text":str(data.get("text",""))}})
                        DATA_FABRIC.record_recent("clipboard",uuid.uuid4().hex,"Clipboard handoff",str(data.get("text",""))[:80])
                        return self.send_json(result)
                    if operation=="policy":
                        result=DATA_FABRIC.operate(data)
                        PADD.manage({"operation":"clipboard","enabled":result["categories"]["clipboard"]})
                        PADD.manage({"operation":"file-transfer","enabled":result["categories"]["smallFiles"]})
                        return self.send_json(result)
                    return self.send_json(DATA_FABRIC.operate(data))
                except PermissionError as exc:return self.send_json({"ok":False,"error":str(exc)},403)
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/padd-sync":
                try:return self.send_json(PADD.sync(data))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/process-action":
                try:return self.send_json(process_action(data.get("pid",0),str(data.get("action",""))))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},403)
            if route=="/api/routine-command":
                if not bool(data.get("approved")):return self.send_json({"ok":False,"error":"operator approval is required"},403)
                try:return self.send_json(routine_command(str(data.get("command",""))))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},403)
            if route=="/api/document":
                try:return self.send_json(write_document(str(data.get("path","")),str(data.get("content",""))))
                except Exception as exc:return self.send_json({"ok":False,"error":str(exc)},400)
            if route=="/api/audio":
                if not shutil.which("wpctl"): return self.send_json({"error":"wpctl unavailable"},503)
                if "muted" in data:
                    muted=bool(data.get("muted"));result=subprocess.run(["wpctl","set-mute","@DEFAULT_AUDIO_SINK@","1" if muted else "0"],capture_output=True,text=True,timeout=3)
                    return self.send_json({"ok":result.returncode==0,"muted":muted},200 if result.returncode==0 else 503)
                volume=max(0,min(100,int(data.get("volume",0))))
                subprocess.run(["wpctl","set-volume","@DEFAULT_AUDIO_SINK@",f"{volume}%"],timeout=3)
                return self.send_json({"volume":volume})
            if route=="/api/storage-action":return self.send_json(storage_action(str(data.get("id","")),str(data.get("action",""))))
            if route=="/api/tray-action":return self.send_json(tray_action(str(data.get("id","")),str(data.get("action","activate")),data.get("x",0),data.get("y",0)))
            if route=="/api/voice-transcribe":return self.send_json(voice_transcribe(data))
            if route=="/api/audio-device":
                ident=str(data.get("id",""))
                allowed={device["id"] for device in audio_devices_data()}
                if ident not in allowed: return self.send_json({"error":"audio device not found"},404)
                result=subprocess.run(["wpctl","set-default",ident],capture_output=True,text=True,timeout=3)
                return self.send_json({"ok":result.returncode==0,"message":"Audio device routing changed" if result.returncode==0 else "PipeWire could not change the default device"},200 if result.returncode==0 else 503)
            if route=="/api/config":
                return self.send_json(save_config(data))
            if route=="/api/file-transfer":
                target=file_transfer(str(data.get("source","")),str(data.get("destination","")),bool(data.get("move",False)))
                return self.send_json({"ok":True,"message":"Transfer complete","path":target})
            if route=="/api/file-folder":
                parent=safe_home_path(str(data.get("path","~"))); name=str(data.get("name","")).strip()
                if not name or name in (".","..") or "/" in name: return self.send_json({"error":"invalid folder name"},400)
                (parent/name).mkdir(exist_ok=False); return self.send_json({"ok":True,"message":"Folder created"})
            if route=="/api/file-open":
                path=safe_home_path(str(data.get("path","")))
                if not path.is_file(): return self.send_json({"error":"file not found"},404)
                result=subprocess.run(["gio","open",str(path)],capture_output=True,text=True,timeout=3)
                return self.send_json({"ok":result.returncode==0,"message":"File opened" if result.returncode==0 else "No application can open this file"},200 if result.returncode==0 else 503)
            if route=="/api/terminal-create":
                return self.send_json(terminal_create(str(data.get("name","Terminal")),str(data.get("shell","")),str(data.get("directory","~")),int(data.get("scrollback",10000)),bool(data.get("history",False))))
            if route=="/api/terminal-input":
                ident=str(data.get("id",""));term=TERMINALS.get(ident)
                if not term:return self.send_json({"error":"session missing"},404)
                value=str(data.get("input","")).replace("\r","\n")
                if value=="\u0003":
                    os.killpg(os.getpgid(term["process"].pid),signal.SIGINT)
                elif term["process"].stdin:
                    term["process"].stdin.write(value);term["process"].stdin.flush()
                return self.send_json({"ok":True})
            if route=="/api/terminal-close":
                terminal_close(str(data.get("id","")));return self.send_json({"ok":True})
            if route=="/api/media-control":
                player=str(data.get("player","")); command=str(data.get("command",""))
                result=media_control(player,command)
                return self.send_json(result,200 if result.get("ok") else 503)
            if route=="/api/stream-volume":
                ident=str(data.get("id","")); volume=max(0,min(100,int(data.get("volume",0))))
                if not ident.isdigit(): return self.send_json({"error":"invalid stream"},400)
                result=subprocess.run(["wpctl","set-volume",ident,f"{volume}%"],capture_output=True,text=True,timeout=3)
                return self.send_json({"ok":result.returncode==0,"volume":volume})
            if route=="/api/stream-mute":
                ident=str(data.get("id","")); muted=bool(data.get("muted"))
                if not ident.isdigit(): return self.send_json({"error":"invalid stream"},400)
                result=subprocess.run(["wpctl","set-mute",ident,"1" if muted else "0"],capture_output=True,text=True,timeout=3)
                return self.send_json({"ok":result.returncode==0,"muted":muted},200 if result.returncode==0 else 503)
            if route=="/api/action":
                action=str(data.get("action",""))
                return self.send_json({"message":protected_action(action)})
            if route=="/api/window-action":
                return self.send_json({"message":window_action(str(data.get("id","")),str(data.get("action","")),str(data.get("display","")))})
            if route=="/api/display-action":
                return self.send_json({"message":display_action(str(data.get("action","")),str(data.get("display","")))})
            if route!="/api/launch": return self.send_json({"error":"not found"},404)
            allowed={a["id"] for a in applications()}
            if app_id not in allowed or "/" in app_id: return self.send_json({"error":"application not allowlisted"},403)
            desktop=next((p/app_id for p in APP_DIRS if (p/app_id).exists()),None)
            if not desktop: return self.send_json({"error":"application missing"},404)
            subprocess.Popen(["gio","launch",str(desktop)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            if load_session_config()["windowRules"]:
                def apply_after_launch():
                    try:session_operation({"operation":"apply-rules"})
                    except Exception:pass
                threading.Timer(1.2,apply_after_launch).start()
            self.send_json({"launched":app_id})
        except Exception as exc: self.send_json({"error":str(exc)},400)
    def log_message(self,fmt,*args): pass

if __name__=="__main__":
    PADD.start()
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
