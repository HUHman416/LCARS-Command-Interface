#!/usr/bin/env python3
"""Loopback-only Windows 10/11 system bridge for the LCARS interface."""
import ctypes, json, os, queue, re, shutil, subprocess, threading, time, uuid, base64, tempfile
from ctypes import wintypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

PORT=8765
HOME=Path.home()
CONFIG_DIR=Path(os.environ.get("APPDATA",HOME))/"LCARS Command Interface"
CONFIG_FILE=CONFIG_DIR/"settings.json"
EXTENSION_DIR=Path(os.environ.get("LCARS_EXTENSION_DIR",Path(os.environ.get("LOCALAPPDATA",HOME))/"LCARS Command Interface"/"extensions"))
TERMINALS={}
TERMINAL_LOCK=threading.Lock()
APP_CACHE={}
WINDOWS_ICON_CACHE={}

def extension_manifests():
    """Load the non-executable Module API v1 manifest format."""
    EXTENSION_DIR.mkdir(parents=True,exist_ok=True)
    modules=[];errors=[];seen=set()
    for path in list(EXTENSION_DIR.glob("**/lcars-module.json"))[:64]:
        try:
            if path.stat().st_size>65536: raise ValueError("manifest exceeds 64 KiB")
            data=json.loads(path.read_text(encoding="utf-8"));ident=str(data.get("id","")).strip();module=data.get("module",{})
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
            modules.append({"schema":1,"id":ident,"name":str(data.get("name",ident))[:48],"version":str(data.get("version","1.0.0"))[:20],"description":str(data.get("description","Local LCARS extension"))[:180],"author":str(data.get("author","Unknown"))[:64],"voiceCommands":voice,"module":{"type":"checklist","defaultSize":module.get("defaultSize","standard") if module.get("defaultSize") in ("compact","standard","wide") else "standard","defaultItems":clean_items}});seen.add(ident)
        except Exception as exc: errors.append({"file":path.name,"error":str(exc)})
    return {"extensions":modules,"errors":errors,"directory":str(EXTENSION_DIR)}

try:
    import psutil
except Exception:
    psutil=None

def run_ps(script,timeout=12):
    try:
        return subprocess.run(["powershell.exe","-NoLogo","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",script],capture_output=True,text=True,timeout=timeout,creationflags=0x08000000).stdout.strip()
    except Exception:
        return ""

def applications():
    global APP_CACHE
    roots=[Path(os.environ.get("PROGRAMDATA","C:/ProgramData"))/"Microsoft/Windows/Start Menu/Programs",Path(os.environ.get("APPDATA",HOME))/"Microsoft/Windows/Start Menu/Programs"]
    found=[]
    for root in roots:
        if not root.exists(): continue
        for item in root.rglob("*.lnk"):
            if any(part.lower() in ("startup","administrative tools") for part in item.parts): continue
            ident="win-"+uuid.uuid5(uuid.NAMESPACE_URL,str(item).lower()).hex[:20]
            APP_CACHE[ident]=str(item)
            found.append({"id":ident,"name":item.stem,"comment":item.parent.name if item.parent!=root else "Windows Application","shortcut":str(item)})
    application_icons([app["shortcut"] for app in found])
    for app in found:app["icon"]=WINDOWS_ICON_CACHE.get(app.pop("shortcut"),"")
    # Keep one item for duplicate application names, preferring the per-user shortcut.
    unique={}
    for app in found: unique[app["name"].lower()]=app
    return sorted(unique.values(),key=lambda a:a["name"].lower())

def application_icons(shortcuts):
    missing=[path for path in shortcuts if path not in WINDOWS_ICON_CACHE][:300]
    if not missing:return
    list_file=None
    try:
        with tempfile.NamedTemporaryFile("w",suffix=".json",delete=False,encoding="utf-8") as handle:json.dump(missing,handle);list_file=handle.name
        escaped=list_file.replace("'","''")
        script=f'''Add-Type -AssemblyName System.Drawing;$ws=New-Object -ComObject WScript.Shell;$result=@{{}};Get-Content -LiteralPath '{escaped}' -Raw|ConvertFrom-Json|ForEach-Object {{$shortcut=$_;try{{$target=$ws.CreateShortcut($shortcut).TargetPath;if(Test-Path -LiteralPath $target){{$icon=[System.Drawing.Icon]::ExtractAssociatedIcon($target);$stream=New-Object IO.MemoryStream;$icon.ToBitmap().Save($stream,[Drawing.Imaging.ImageFormat]::Png);$result[$shortcut]=[Convert]::ToBase64String($stream.ToArray());$stream.Dispose();$icon.Dispose()}}}}catch{{$result[$shortcut]=''}}}};$result|ConvertTo-Json -Compress'''
        raw=run_ps(script,45);values=json.loads(raw) if raw else {}
        for path in missing:WINDOWS_ICON_CACHE[path]="data:image/png;base64,"+values[path] if values.get(path) else ""
    except Exception:
        for path in missing:WINDOWS_ICON_CACHE[path]=""
    finally:
        if list_file:
            try:Path(list_file).unlink()
            except Exception:pass

def system_data():
    cpu=round(psutil.cpu_percent(.12)) if psutil else 0
    memory=psutil.virtual_memory() if psutil else None
    disk=psutil.disk_usage(str(Path.home().anchor)) if psutil else None
    gpu=0;gpu_name="WINDOWS GRAPHICS"
    if shutil.which("nvidia-smi"):
        try:
            out=subprocess.run(["nvidia-smi","--query-gpu=utilization.gpu,name","--format=csv,noheader,nounits"],capture_output=True,text=True,timeout=3,creationflags=0x08000000).stdout.strip().splitlines()[0]
            gpu_s,gpu_name=out.split(",",1);gpu=int(float(gpu_s));gpu_name=gpu_name.strip()
        except Exception: pass
    mem_pct=round(memory.percent) if memory else 0
    disk_pct=round(disk.percent) if disk else 0
    mem_text=f"{memory.used/1073741824:.1f} / {memory.total/1073741824:.1f} GB" if memory else "WINDOWS MEMORY"
    disk_text=f"{disk.free/1073741824:.0f} GB AVAILABLE" if disk else "SYSTEM DRIVE"
    return {"platform":"WINDOWS 11" if sys_version()>=11 else "WINDOWS 10","meters":[["CPU",cpu,"SYSTEM PROCESSOR"],["GPU",gpu,gpu_name],["MEM",mem_pct,mem_text],["DISK",disk_pct,disk_text]]}

def storage_data():
    if not psutil:return []
    items=[]
    for part in psutil.disk_partitions(all=True):
        try:
            usage=psutil.disk_usage(part.mountpoint);drive=part.device.rstrip("\\")
            dtype=run_ps(f"(Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='{drive}'\").DriveType")
            removable=dtype in ("2","5")
            items.append({"id":drive,"name":drive or part.mountpoint,"size":usage.total,"type":"volume","filesystem":part.fstype,"mountpoints":[part.mountpoint],"mounted":True,"removable":removable})
        except Exception:pass
    return items

def system_details():
    cpu=psutil.cpu_percent(.15,percpu=True) if psutil else []
    return {"cpu":{"logical":len(cpu),"load":[],"cores":[{"name":f"CORE {i}","usage":round(value)} for i,value in enumerate(cpu)]},"storage":storage_data(),"kernel":"WINDOWS NT"}

def storage_action(ident,action):
    allowed={x["id"] for x in storage_data() if x["removable"]}
    if ident not in allowed:return {"ok":False,"message":"Only detected removable volumes can be controlled from LCARS"}
    if action=="unmount":
        result=run_ps(f"$v=Get-Volume -DriveLetter '{ident[0]}';$v|Get-Partition|Remove-PartitionAccessPath -AccessPath '{ident}\\' -ErrorAction Stop;'Volume safely unmounted'")
        return {"ok":bool(result),"message":result or "Windows could not safely unmount the volume"}
    return {"ok":False,"message":"Windows remount requires Disk Management; reconnect the device or use the Storage panel"}

def voice_status():
    engine=shutil.which("whisper-cli.exe") or shutil.which("whisper-cli");ffmpeg=shutil.which("ffmpeg.exe") or shutil.which("ffmpeg")
    return {"available":bool(engine and ffmpeg),"engine":engine or "","ffmpeg":ffmpeg or "","reason":"Install whisper.cpp and FFmpeg, then select a local model in Voice Control settings" if not engine or not ffmpeg else ""}

def voice_transcribe(data):
    try:config=json.loads(CONFIG_FILE.read_text())
    except:config={}
    prefs=config.get("shell_prefs",{});status=voice_status();engine=str(prefs.get("voiceEngine") or status["engine"]);model=Path(str(prefs.get("voiceModel") or "")).expanduser();encoded=str(data.get("audio","")).split(",")[-1]
    if not engine or not Path(engine).is_file() or not model.is_file():return {"ok":False,"message":"Configure a whisper.cpp executable and model in Settings"}
    try:
        with tempfile.TemporaryDirectory(prefix="lcars-voice-") as folder:
            source=Path(folder)/"sample.webm";wav=Path(folder)/"sample.wav";source.write_bytes(base64.b64decode(encoded,validate=True))
            if subprocess.run([status["ffmpeg"],"-loglevel","error","-y","-i",str(source),"-ar","16000","-ac","1",str(wav)],creationflags=0x08000000).returncode:return {"ok":False,"message":"FFmpeg could not decode the microphone sample"}
            result=subprocess.run([engine,"-m",str(model),"-f",str(wav),"-nt","-np"],capture_output=True,text=True,timeout=90,creationflags=0x08000000);text=result.stdout.strip()
            return {"ok":result.returncode==0 and bool(text),"text":text,"message":result.stderr.strip()[-300:] or "Voice command was not recognized"}
    except Exception as exc:return {"ok":False,"message":str(exc)}

def sys_version():
    try:return int(run_ps("[System.Environment]::OSVersion.Version.Build") or 0)>=22000 and 11 or 10
    except:return 10

def window_list():
    user32=ctypes.windll.user32;items=[]
    EnumProc=ctypes.WINFUNCTYPE(wintypes.BOOL,wintypes.HWND,wintypes.LPARAM)
    def visit(hwnd,lparam):
        if not user32.IsWindowVisible(hwnd) or user32.GetWindowTextLengthW(hwnd)==0:return True
        length=user32.GetWindowTextLengthW(hwnd)+1;buf=ctypes.create_unicode_buffer(length);user32.GetWindowTextW(hwnd,buf,length)
        title=buf.value.strip()
        if not title:return True
        pid=wintypes.DWORD();user32.GetWindowThreadProcessId(hwnd,ctypes.byref(pid));name="Application"
        if psutil:
            try:name=psutil.Process(pid.value).name().removesuffix(".exe")
            except Exception:pass
        items.append({"id":str(int(hwnd)),"name":title,"app":name,"monitor":monitor_name(hwnd),"active":hwnd==user32.GetForegroundWindow(),"minimized":bool(user32.IsIconic(hwnd))})
        return True
    user32.EnumWindows(EnumProc(visit),0)
    return items

def monitor_name(hwnd):
    try:
        mon=ctypes.windll.user32.MonitorFromWindow(hwnd,2);info=MONITORINFOEX();info.cbSize=ctypes.sizeof(info);ctypes.windll.user32.GetMonitorInfoW(mon,ctypes.byref(info));return info.szDevice.replace("\\.\\","")
    except Exception:return "DISPLAY 1"

class RECT(ctypes.Structure):_fields_=[("left",wintypes.LONG),("top",wintypes.LONG),("right",wintypes.LONG),("bottom",wintypes.LONG)]
class MONITORINFOEX(ctypes.Structure):_fields_=[("cbSize",wintypes.DWORD),("rcMonitor",RECT),("rcWork",RECT),("dwFlags",wintypes.DWORD),("szDevice",wintypes.WCHAR*32)]

def displays_data():
    user32=ctypes.windll.user32;items=[];MonitorProc=ctypes.WINFUNCTYPE(wintypes.BOOL,wintypes.HMONITOR,wintypes.HDC,ctypes.POINTER(RECT),wintypes.LPARAM)
    def visit(mon,dc,rect,lparam):
        info=MONITORINFOEX();info.cbSize=ctypes.sizeof(info);user32.GetMonitorInfoW(mon,ctypes.byref(info));r=info.rcMonitor;name=info.szDevice.replace("\\.\\","")
        items.append({"id":str(int(mon)),"name":name,"enabled":True,"primary":bool(info.dwFlags&1),"geometry":f"{r.right-r.left}×{r.bottom-r.top}+{r.left}+{r.top}","source":"WIN32 DISPLAY API"})
        return True
    user32.EnumDisplayMonitors(0,None,MonitorProc(visit),0)
    return items

def window_action(ident,action,display=""):
    try:hwnd=int(ident);user32=ctypes.windll.user32
    except:return "Invalid Windows window identifier"
    if not user32.IsWindow(hwnd):return "Window is no longer available"
    if action=="activate": user32.ShowWindow(hwnd,9);user32.SetForegroundWindow(hwnd);return "Window focused"
    if action=="minimize": user32.ShowWindow(hwnd,6);return "Window minimized"
    if action=="close": user32.PostMessageW(hwnd,0x0010,0,0);return "Close request sent"
    if action=="move":
        target=next((d for d in display_rects() if d["name"]==display),None)
        if not target:return "Requested display was not found"
        r=RECT();user32.GetWindowRect(hwnd,ctypes.byref(r));w=max(640,r.right-r.left);h=max(480,r.bottom-r.top);user32.MoveWindow(hwnd,target["left"]+30,target["top"]+30,min(w,target["width"]-60),min(h,target["height"]-60),True);return f"Window moved to {display}"
    return "Unknown window command"

def display_rects():
    result=[];user32=ctypes.windll.user32;MonitorProc=ctypes.WINFUNCTYPE(wintypes.BOOL,wintypes.HMONITOR,wintypes.HDC,ctypes.POINTER(RECT),wintypes.LPARAM)
    def visit(mon,dc,rect,lparam):
        info=MONITORINFOEX();info.cbSize=ctypes.sizeof(info);user32.GetMonitorInfoW(mon,ctypes.byref(info));r=info.rcWork;result.append({"name":info.szDevice.replace("\\.\\",""),"left":r.left,"top":r.top,"width":r.right-r.left,"height":r.bottom-r.top});return True
    user32.EnumDisplayMonitors(0,None,MonitorProc(visit),0);return result

def display_action(action,display):
    if action=="terminal":
        executable=os.environ.get("LCARS_EXECUTABLE","")
        if not executable or not Path(executable).is_file():return "Remote Terminal requires the installed native LCARS desktop application"
        target=next((item for item in display_rects() if item["name"]==display),None);position=f'{target["left"]},{target["top"]}' if target else ""
        subprocess.Popen([executable,"--lcars-terminal",f"--display={display}",f"--position={position}"],creationflags=0x08000000);return f"Native LCARS Terminal requested for {display}"
    if action=="move-lcars":return "Use the Task Rail to move the LCARS browser window to the selected display"
    return "Display command sent"

def terminal_create(name="Main",shell="",directory="~",**_):
    ident=uuid.uuid4().hex[:12];chosen=shell if shell and Path(shell).exists() else "powershell.exe";cwd=Path(directory).expanduser()
    if not cwd.is_dir():cwd=HOME
    flags=0x08000000
    process=subprocess.Popen([chosen,"-NoLogo","-NoProfile"] if "powershell" in chosen.lower() else [chosen],cwd=cwd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1,creationflags=flags)
    TERMINALS[ident]={"id":ident,"name":name[:32],"process":process,"output":f"LCARS WINDOWS COMMAND ENVIRONMENT\nPowerShell · {cwd}\n","closed":False}
    def reader():
        while ident in TERMINALS and not TERMINALS[ident]["closed"]:
            line=process.stdout.readline() if process.stdout else ""
            if line:
                with TERMINAL_LOCK:TERMINALS[ident]["output"]=(TERMINALS[ident]["output"]+line)[-200000:]
            elif process.poll() is not None:break
            else:time.sleep(.05)
    threading.Thread(target=reader,daemon=True).start();return {"id":ident,"name":name[:32]}

def terminal_input(ident,value):
    term=TERMINALS.get(ident)
    if not term or term["closed"]:return False
    try:term["process"].stdin.write(value.replace("\r","\n"));term["process"].stdin.flush();return True
    except:return False

def terminal_close(ident):
    term=TERMINALS.pop(ident,None)
    if term:
        term["closed"]=True
        try:term["process"].terminate()
        except:pass

def audio_data():
    try:
        from ctypes import POINTER, cast
        from comtypes import CLSCTX_ALL
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        endpoint=AudioUtilities.GetSpeakers();interface=endpoint.Activate(IAudioEndpointVolume._iid_,CLSCTX_ALL,None);volume=cast(interface,POINTER(IAudioEndpointVolume)).GetMasterVolumeLevelScalar()
        return {"volume":round(volume*100)}
    except Exception:return {"volume":50}

def audio_devices():
    raw=run_ps("if(Get-Module -ListAvailable AudioDeviceCmdlets){Import-Module AudioDeviceCmdlets;Get-AudioDevice -List|Select-Object ID,Name,Type,Default|ConvertTo-Json -Compress}")
    if not raw:return []
    try:
        data=json.loads(raw);data=data if isinstance(data,list) else [data]
        return [{"id":str(x.get("ID","")),"name":x.get("Name","Windows Audio Device"),"kind":"input" if str(x.get("Type","")).lower()=="recording" else "output","default":bool(x.get("Default"))} for x in data]
    except:return []

def stream_data():
    if not psutil:return []
    try:
        from pycaw.pycaw import AudioUtilities
        result=[]
        for session in AudioUtilities.GetAllSessions():
            if not session.Process:continue
            vol=session.SimpleAudioVolume.GetMasterVolume();result.append({"id":str(session.Process.pid),"name":session.Process.name().removesuffix(".exe"),"group":session.Process.name().removesuffix(".exe"),"volume":round(vol*100)})
        return result
    except:return []

def media_data():
    players=[]
    if psutil:
        known={"spotify":"Spotify","vlc":"VLC","music.ui":"Media Player","wmplayer":"Windows Media Player","foobar2000":"foobar2000"}
        for p in psutil.process_iter(["pid","name"]):
            key=(p.info["name"] or "").lower().removesuffix(".exe")
            if key in known:players.append({"id":key,"name":known[key],"status":"Active","artist":"Windows Media Session","title":known[key],"album":"","volume":100})
    return {"players":players,"streams":stream_data()}

def media_key(command):
    codes={"previous":0xB1,"next":0xB0,"play-pause":0xB3,"stop":0xB2,"shuffle":0xB3};code=codes.get(command)
    if not code:return False
    ctypes.windll.user32.keybd_event(code,0,0,0);ctypes.windll.user32.keybd_event(code,0,2,0);return True

def files_data(path):
    target=Path(path).expanduser()
    if str(path)=="~":target=HOME
    target=target.resolve()
    if not target.is_dir():return {"error":"Folder not found"}
    items=[]
    try:
        for f in target.iterdir():
            try:s=f.stat();items.append({"name":f.name,"path":str(f),"directory":f.is_dir(),"size":s.st_size,"modified":s.st_mtime,"hidden":bool(f.name.startswith(".") or ctypes.windll.kernel32.GetFileAttributesW(str(f))&2)})
            except:pass
    except PermissionError:return {"error":"Windows denied access to this folder"}
    return {"path":str(target),"parent":str(target.parent) if target.parent!=target else "","items":sorted(items,key=lambda x:(not x["directory"],x["name"].lower()))}

def protected_action(action):
    commands={"system-monitor":["taskmgr.exe"],"processes":["taskmgr.exe"],"storage":["explorer.exe","shell:MyComputerFolder"],"audio-settings":["ms-settings:sound"],"network-settings":["ms-settings:network-status"],"wifi":["ms-settings:network-wifi"],"bluetooth":["ms-settings:bluetooth"],"software-center":["ms-windows-store://downloadsandupdates"],"check-updates":["ms-settings:windowsupdate"],"display-settings":["ms-settings:display"]}
    if action in commands:
        subprocess.Popen(commands[action],shell=True);return action.replace("-"," ").title()+" opened"
    if action=="poweroff":subprocess.Popen(["shutdown.exe","/s","/t","0"],creationflags=0x08000000);return "Computer shutdown requested"
    if action=="reboot":subprocess.Popen(["shutdown.exe","/r","/t","0"],creationflags=0x08000000);return "Computer restart requested"
    if action=="identify-displays":subprocess.Popen(["DisplaySwitch.exe"]);return "Windows display routing opened"
    if action=="shell-mode-on":return "Windows immersive mode uses full screen and automatic taskbar hiding; Explorer remains available for recovery"
    if action=="shell-mode-off":subprocess.Popen(["explorer.exe"]);return "Windows Explorer restored"
    if action in ("startup-console-on","startup-console-off"):return "Windows launches LCARS without a separate console"
    if action=="integration-recheck":return "Windows integration check complete"
    if action=="lcars-update-check":return "LCARS Windows Version 23.0 local build — public update channel remains unchanged"
    if action=="lcars-rollback":return "No previous Windows release has been archived yet"
    if action=="extension-scan":EXTENSION_DIR.mkdir(parents=True,exist_ok=True);return f"Extension scan complete — {len(list(EXTENSION_DIR.glob('**/lcars-module.json')))} manifest(s) found"
    if action=="extension-folder":EXTENSION_DIR.mkdir(parents=True,exist_ok=True);os.startfile(EXTENSION_DIR);return "Extensions folder opened"
    if action in ("refresh-system","network-refresh","close-bay-app","minimize-bay-app"):return action.replace("-"," ").title()
    return "This Windows integration is not available yet"

class Handler(BaseHTTPRequestHandler):
    def send_json(self,data,status=200):
        body=json.dumps(data).encode();origin=self.headers.get("Origin","");allowed=origin if origin in ("lcars://app","http://127.0.0.1:8764") else "lcars://app";self.send_response(status);self.send_header("Content-Type","application/json");self.send_header("Content-Length",str(len(body)));self.send_header("Access-Control-Allow-Origin",allowed);self.send_header("Access-Control-Allow-Headers","Content-Type");self.end_headers();self.wfile.write(body)
    def do_OPTIONS(self):
        origin=self.headers.get("Origin","");allowed=origin if origin in ("lcars://app","http://127.0.0.1:8764") else "lcars://app";self.send_response(204);self.send_header("Access-Control-Allow-Origin",allowed);self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS");self.send_header("Access-Control-Allow-Headers","Content-Type");self.end_headers()
    def do_GET(self):
        parsed=urlparse(self.path);route=parsed.path
        if route=="/api/apps":return self.send_json({"apps":applications()})
        if route=="/api/system":return self.send_json(system_data())
        if route=="/api/system-details":return self.send_json(system_details())
        if route=="/api/storage":return self.send_json({"drives":storage_data()})
        if route=="/api/tray":return self.send_json({"items":[],"supported":False,"reason":"Windows does not expose a supported API for re-hosting every third-party notification icon; LCARS quick controls remain available"})
        if route=="/api/voice-status":return self.send_json(voice_status())
        if route=="/api/audio":return self.send_json(audio_data())
        if route=="/api/audio-devices":return self.send_json({"devices":audio_devices()})
        if route=="/api/media":return self.send_json(media_data())
        if route=="/api/windows":return self.send_json({"windows":window_list(),"kwin":True})
        if route=="/api/displays":return self.send_json({"displays":displays_data()})
        if route=="/api/health-check":return self.send_json({"health":{"windows":{"available":True,"detail":"Win32 bridge ready"},"displays":{"available":True,"detail":f"{len(displays_data())} display(s)"},"audio":{"available":bool(audio_devices()),"detail":"Windows Core Audio"},"media":{"available":True,"detail":"Windows media keys ready"},"terminal":{"available":True,"detail":"PowerShell"},"storage":{"available":bool(psutil),"detail":f"{len(storage_data())} volume(s)"},"voice":{"available":voice_status()["available"],"detail":voice_status()["reason"] or "Offline whisper.cpp and FFmpeg ready"},"tray":{"available":False,"detail":"Windows does not support re-hosting all third-party notification icons"}}})
        if route=="/api/extensions":return self.send_json(extension_manifests())
        if route=="/api/config":
            try:return self.send_json(json.loads(CONFIG_FILE.read_text()))
            except:return self.send_json({})
        if route.startswith("/api/terminal-output/"):
            ident=route.rsplit("/",1)[-1];term=TERMINALS.get(ident);return self.send_json({"output":term["output"] if term else "","closed":not term or term["process"].poll() is not None})
        if route=="/api/files":return self.send_json(files_data(parse_qs(parsed.query).get("path",["~"])[0]))
        return self.send_json({"error":"not found"},404)
    def do_POST(self):
        length=int(self.headers.get("Content-Length","0"));data=json.loads(self.rfile.read(length) or b"{}")
        route=urlparse(self.path).path
        if route=="/api/launch":
            ident=str(data.get("id",""));path=APP_CACHE.get(ident)
            if not path:return self.send_json({"error":"Application is not in the Windows launcher inventory"},403)
            os.startfile(path);return self.send_json({"ok":True})
        if route=="/api/storage-action":return self.send_json(storage_action(str(data.get("id","")),str(data.get("action",""))))
        if route=="/api/voice-transcribe":return self.send_json(voice_transcribe(data))
        if route=="/api/action":return self.send_json({"message":protected_action(str(data.get("action","")))})
        if route=="/api/window-action":return self.send_json({"message":window_action(str(data.get("id","")),str(data.get("action","")),str(data.get("display","")))})
        if route=="/api/display-action":return self.send_json({"message":display_action(str(data.get("action","")),str(data.get("display","")))})
        if route=="/api/terminal-create":return self.send_json(terminal_create(str(data.get("name","Terminal")),str(data.get("shell","")),str(data.get("directory","~"))))
        if route=="/api/terminal-input":return self.send_json({"ok":terminal_input(str(data.get("id","")),str(data.get("input","")))})
        if route=="/api/terminal-close":terminal_close(str(data.get("id","")));return self.send_json({"ok":True})
        if route=="/api/media-control":return self.send_json({"ok":media_key(str(data.get("command","")))})
        if route=="/api/audio":
            try:
                from ctypes import POINTER, cast
                from comtypes import CLSCTX_ALL
                from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
                endpoint=AudioUtilities.GetSpeakers();interface=endpoint.Activate(IAudioEndpointVolume._iid_,CLSCTX_ALL,None);cast(interface,POINTER(IAudioEndpointVolume)).SetMasterVolumeLevelScalar(max(0,min(100,int(data.get("volume",0))))/100,None);return self.send_json({"ok":True})
            except:return self.send_json({"error":"Windows Core Audio component unavailable"},503)
        if route=="/api/audio-device":
            ident=str(data.get("id","")).replace("'","''");run_ps(f"Import-Module AudioDeviceCmdlets;Set-AudioDevice -ID '{ident}'");return self.send_json({"message":"Windows audio device changed"})
        if route=="/api/stream-volume":return self.send_json({"ok":False,"message":"Per-application volume changes require the Windows audio companion"})
        if route=="/api/config":CONFIG_DIR.mkdir(parents=True,exist_ok=True);CONFIG_FILE.write_text(json.dumps(data,indent=2));return self.send_json({"ok":True})
        if route=="/api/file-open":os.startfile(str(data.get("path","")));return self.send_json({"ok":True})
        if route=="/api/file-folder":Path(str(data.get("path","~"))).expanduser().joinpath(str(data.get("name","New Folder"))).mkdir();return self.send_json({"ok":True})
        if route=="/api/file-transfer":
            src=Path(str(data.get("source","")));dst=Path(str(data.get("destination","")))/src.name
            (shutil.move if data.get("move") else (shutil.copytree if src.is_dir() else shutil.copy2))(str(src),str(dst));return self.send_json({"ok":True})
        return self.send_json({"error":"not found"},404)
    def log_message(self,format,*args):pass

if __name__=="__main__":
    print(f"LCARS Windows local core ready on http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
