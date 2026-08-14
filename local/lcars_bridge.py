#!/usr/bin/env python3
"""Local-only, allowlisted universal Linux system bridge for LCARS."""
import json, os, shutil, subprocess, pty, select, threading, time, uuid, signal, re, base64, mimetypes, tempfile
from configparser import ConfigParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PORT=8765
APP_DIRS=[Path.home()/".local/share/applications",Path("/usr/local/share/applications"),Path("/usr/share/applications")]
CONFIG_DIR=Path.home()/".config/lcars-command-interface"
CONFIG_FILE=CONFIG_DIR/"settings.json"
EXTENSION_DIR=Path(os.environ.get("LCARS_EXTENSION_DIR",Path.home()/".local/share/lcars-command-interface/extensions"))
TERMINALS={}
TERMINAL_LOCK=threading.Lock()
ICON_CACHE={}
ICON_INDEX=None

def extension_manifests():
    """Load the non-executable Module API v1 manifest format."""
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

def system_details():
    cores=[]
    try:
        for row in Path("/proc/stat").read_text().splitlines():
            match=re.match(r"cpu(\d+)\s+(.+)",row)
            if not match:continue
            values=[int(x) for x in match.group(2).split()];total=sum(values);idle=values[3]+(values[4] if len(values)>4 else 0)
            cores.append({"name":"CORE "+match.group(1),"usage":round(100*(total-idle)/total) if total else 0})
    except Exception:pass
    return {"cpu":{"logical":os.cpu_count() or 1,"load":[round(x,2) for x in os.getloadavg()],"cores":cores},"storage":storage_data(),"kernel":os.uname().release}

def storage_action(ident,action):
    allowed={x["id"]:x for x in storage_data() if x["removable"] and x["type"] in ("part","rom")}
    if ident not in allowed:return {"ok":False,"message":"Only detected removable volumes can be mounted from LCARS"}
    if not shutil.which("udisksctl"):return {"ok":False,"message":"UDisks2/udisksctl is not installed"}
    command="unmount" if action=="unmount" else "mount" if action=="mount" else ""
    if not command:return {"ok":False,"message":"Unknown storage command"}
    result=subprocess.run(["udisksctl",command,"-b",ident],capture_output=True,text=True,timeout=30)
    return {"ok":result.returncode==0,"message":(result.stdout or result.stderr).strip() or command.title()+" complete"}

def tray_data():
    if not shutil.which("gdbus"):return {"items":[],"supported":False,"reason":"GDBus is unavailable"}
    try:
        raw=subprocess.run(["gdbus","call","--session","--dest","org.kde.StatusNotifierWatcher","--object-path","/StatusNotifierWatcher","--method","org.freedesktop.DBus.Properties.Get","org.kde.StatusNotifierWatcher","RegisteredStatusNotifierItems"],capture_output=True,text=True,timeout=3)
        values=list(dict.fromkeys(re.findall(r"'([^']+)'",raw.stdout)));items=[]
        for value in values:
            service,path=(value.split("/",1)+[""])[:2] if "/" in value else (value,"")
            path="/"+path if path else "/StatusNotifierItem";name=service.split(".")[-1] or "Tray Service"
            items.append({"id":service+"|"+path,"name":name,"status":"ACTIVE"})
        return {"items":items,"supported":raw.returncode==0,"reason":"" if raw.returncode==0 else "StatusNotifierWatcher did not respond"}
    except Exception:return {"items":[],"supported":False,"reason":"System tray inventory unavailable"}

def voice_status():
    engine=command_path("whisper-cli") or command_path("whisper-cpp")
    return {"available":bool(engine and shutil.which("ffmpeg")),"engine":engine or "","ffmpeg":shutil.which("ffmpeg") or "","reason":"" if engine and shutil.which("ffmpeg") else "Install whisper.cpp and FFmpeg, then select a local model in Voice Control settings"}

def tray_action(ident):
    allowed={item["id"] for item in tray_data()["items"]}
    if ident not in allowed or "|" not in ident:return {"ok":False,"message":"Tray service is no longer registered"}
    service,path=ident.split("|",1)
    result=subprocess.run(["gdbus","call","--session","--dest",service,"--object-path",path,"--method","org.kde.StatusNotifierItem.Activate","0","0"],capture_output=True,text=True,timeout=4)
    return {"ok":result.returncode==0,"message":"Tray service activated" if result.returncode==0 else "This tray service did not accept activation"}

def voice_transcribe(data):
    status=voice_status();prefs=load_config().get("shell_prefs",{});engine=str(prefs.get("voiceEngine") or status["engine"]);model=Path(str(prefs.get("voiceModel") or "")).expanduser()
    if not engine or not Path(engine).is_file() or not model.is_file():return {"ok":False,"message":"Configure a whisper.cpp executable and model in Settings"}
    encoded=str(data.get("audio","")).split(",")[-1]
    if len(encoded)>28_000_000:return {"ok":False,"message":"Voice sample is too large"}
    try:
        with tempfile.TemporaryDirectory(prefix="lcars-voice-") as folder:
            source=Path(folder)/"sample.webm";wav=Path(folder)/"sample.wav";source.write_bytes(base64.b64decode(encoded,validate=True))
            convert=subprocess.run(["ffmpeg","-loglevel","error","-y","-i",str(source),"-ar","16000","-ac","1",str(wav)],capture_output=True,text=True,timeout=30)
            if convert.returncode:return {"ok":False,"message":"FFmpeg could not decode the microphone sample"}
            result=subprocess.run([engine,"-m",str(model),"-f",str(wav),"-nt","-np"],capture_output=True,text=True,timeout=90);text=(result.stdout or "").strip()
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
        gpu=0
        if shutil.which("nvidia-smi"):
            out=subprocess.run(["nvidia-smi","--query-gpu=utilization.gpu","--format=csv,noheader,nounits"],capture_output=True,text=True,timeout=2)
            if out.returncode==0: gpu=int(out.stdout.splitlines()[0])
        env=linux_environment()
        return {"platform":env["distro"].upper(),"environment":env,"meters":[["CPU",cpu,"SYSTEM PROCESSOR"],["GPU",gpu,"NVIDIA GRAPHICS"],["MEM",used,f'{(mem["MemTotal"]-mem["MemAvailable"])/1048576:.1f} / {mem["MemTotal"]/1048576:.1f} GB'],["DISK",disk_used,f"{disk.free/1073741824:.0f} GB AVAILABLE"]]}
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
            art=values[4] if values[4].startswith(("https://","http://")) else ""
            player={"id":name,"name":display_name,"status":values[0] or "Stopped","artist":values[1],"title":values[2] or "No media","album":values[3],"artUrl":art,"position":position,"length":length,"volume":volume}
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
                    clean=name.strip()
                    advanced=bool(re.search(r"(?i)(monitor|capture|playback|input_[A-Z0-9]+|output_[A-Z0-9]+|[_ .-](FL|FR|FC|LFE|RL|RR|MONO)(?:\b|$))",clean))
                    group=re.sub(r"(?i)\b(input|output)_(FL|FR|FC|LFE|RL|RR|MONO)\b","",clean)
                    group=re.sub(r"(?i)[:._ -]*(monitor|capture|playback)[._ -]*(FL|FR|FC|LFE|RL|RR|MONO)?$","",group)
                    group=re.sub(r"\s+"," ",group).strip(" .:_-") or clean
                    streams.append({"id":ident,"name":clean,"group":group,"advanced":advanced,"volume":value})
    return {"players":list(players_by_name.values()),"streams":streams}

def start_first(candidates):
    for command in candidates:
        if shutil.which(command[0]):
            subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
            return True
    return False

def integration_health():
    displays=displays_data()
    env=linux_environment()
    return {
        "windows":{"available":env["capabilities"]["windowControl"],"detail":f'{env["desktop"]} / {env["session"]} window adapter'},
        "displays":{"available":env["capabilities"]["displayControl"],"detail":f'{len(displays)} display output(s) detected'},
        "audio":{"available":bool(shutil.which("wpctl")),"detail":"PipeWire controls ready" if shutil.which("wpctl") else "wpctl missing; install wireplumber"},
        "media":{"available":bool(shutil.which("playerctl")),"detail":"MPRIS controls ready" if shutil.which("playerctl") else "playerctl missing"},
        "terminal":{"available":Path(os.environ.get("SHELL","/bin/bash")).is_file(),"detail":os.environ.get("SHELL","/bin/bash")},
        "storage":{"available":bool(shutil.which("udisksctl")),"detail":f'{len(storage_data())} block device(s); UDisks2 '+("ready" if shutil.which("udisksctl") else "missing")},
        "voice":{"available":voice_status()["available"],"detail":voice_status()["reason"] or "Offline whisper.cpp and FFmpeg ready"},
        "tray":{"available":tray_data()["supported"],"detail":tray_data()["reason"] or f'{len(tray_data()["items"])} StatusNotifier service(s)'},
    }

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
    if action in ("poweroff","reboot"):
        command=["systemctl","poweroff" if action=="poweroff" else "reboot"]
        if not shutil.which(command[0]): return "System power control is not available on this Linux distribution"
        subprocess.Popen(command,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        return "Computer shutdown requested" if action=="poweroff" else "Computer restart requested"
    if action=="shell-mode-off":
        running=shutil.which("pgrep") and subprocess.run(["pgrep","-x","plasmashell"],capture_output=True).stdout
        if not running:
            service=subprocess.run(["systemctl","--user","start","plasma-plasmashell.service"],capture_output=True,text=True,timeout=8) if shutil.which("systemctl") else None
            if (not service or service.returncode!=0) and shutil.which("plasmashell"):
                subprocess.Popen(["plasmashell"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
        return "Plasma desktop restored"
    if action=="identify-displays":
        if start_first([["systemsettings","kcm_kscreen"],["gnome-control-center","display"],["cinnamon-settings","display"],["xfce4-display-settings"],["lxqt-config-monitor"]]): return "Display identification opened"
        return "Display settings are not installed"
    if action=="integration-recheck":
        health=integration_health(); ready=sum(1 for item in health.values() if item["available"])
        return f"Integration check complete — {ready}/{len(health)} systems ready"
    if action=="lcars-update-check":
        return "LCARS Version 23.0 local build — public update channel remains on the approved release"
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
    def do_GET(self):
        route=urlparse(self.path).path
        if route=="/api/apps": self.send_json({"apps":applications()})
        elif route=="/api/system": self.send_json(system_data())
        elif route=="/api/system-details": self.send_json(system_details())
        elif route=="/api/storage": self.send_json({"drives":storage_data()})
        elif route=="/api/tray": self.send_json(tray_data())
        elif route=="/api/voice-status": self.send_json(voice_status())
        elif route=="/api/compat": self.send_json(linux_environment())
        elif route=="/api/audio": self.send_json(audio_data())
        elif route=="/api/audio-devices": self.send_json({"devices":audio_devices_data()})
        elif route=="/api/files":
            from urllib.parse import parse_qs
            requested=parse_qs(urlparse(self.path).query).get("path",["~"])[0]
            self.send_json(file_list(requested))
        elif route=="/api/media": self.send_json(media_data())
        elif route=="/api/windows": self.send_json({"windows":windows_data(),"kwin":bool(command_path("kdotool"))})
        elif route=="/api/displays": self.send_json({"displays":displays_data()})
        elif route=="/api/health-check": self.send_json({"health":integration_health()})
        elif route=="/api/config": self.send_json(load_config())
        elif route=="/api/extensions": self.send_json(extension_manifests())
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
            if route=="/api/audio":
                volume=max(0,min(100,int(data.get("volume",0))))
                if not shutil.which("wpctl"): return self.send_json({"error":"wpctl unavailable"},503)
                subprocess.run(["wpctl","set-volume","@DEFAULT_AUDIO_SINK@",f"{volume}%"],timeout=3)
                return self.send_json({"volume":volume})
            if route=="/api/storage-action":return self.send_json(storage_action(str(data.get("id","")),str(data.get("action",""))))
            if route=="/api/tray-action":return self.send_json(tray_action(str(data.get("id",""))))
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
                if command not in ("previous","play-pause","next","shuffle","stop"): return self.send_json({"error":"invalid command"},400)
                args=["playerctl","--player",player,command]
                if command=="shuffle": args.append("Toggle")
                result=subprocess.run(args,capture_output=True,text=True,timeout=3)
                return self.send_json({"ok":result.returncode==0})
            if route=="/api/stream-volume":
                ident=str(data.get("id","")); volume=max(0,min(100,int(data.get("volume",0))))
                if not ident.isdigit(): return self.send_json({"error":"invalid stream"},400)
                result=subprocess.run(["wpctl","set-volume",ident,f"{volume}%"],capture_output=True,text=True,timeout=3)
                return self.send_json({"ok":result.returncode==0,"volume":volume})
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
            self.send_json({"launched":app_id})
        except Exception as exc: self.send_json({"error":str(exc)},400)
    def log_message(self,fmt,*args): pass

if __name__=="__main__":
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
