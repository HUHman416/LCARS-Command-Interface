"""Capability-aware, shell-free package transactions for LCARS Software Logistics."""
from __future__ import annotations

import json
import os
import re
import shutil
import signal
import subprocess
import threading
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

PACKAGE_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9+._:@/-]{0,199}$")
SOURCE_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
LINUX_MANAGERS = ("dnf", "apt", "pacman", "zypper", "apk", "xbps-install")
LABELS = {"dnf":"DNF", "apt":"APT", "pacman":"PACMAN", "zypper":"ZYPPER", "apk":"APK", "xbps-install":"XBPS", "flatpak":"FLATPAK", "winget":"WINGET"}
SIGNATURES = {
    "dnf":"Repository metadata and package signatures are enforced by DNF policy.",
    "apt":"Repository metadata and package authentication are enforced by APT policy.",
    "pacman":"Repository and package signatures are enforced by pacman policy.",
    "zypper":"Repository metadata and package signatures are enforced by Zypper policy.",
    "apk":"Repository indexes and package signatures are enforced by APK policy.",
    "xbps-install":"Repository index and package signatures are enforced by XBPS policy.",
    "flatpak":"Repository metadata and commit signatures are enforced by Flatpak policy.",
    "winget":"Source trust and installer verification are enforced by WinGet policy.",
}

def _short(value, limit=12000):
    return str(value or "")[-limit:]

def _size(value):
    match=re.search(r"(?i)([0-9]+(?:\.[0-9]+)?)\s*(B|KB|KIB|MB|MIB|GB|GIB)", value or "")
    if not match:return None
    number=float(match.group(1));unit=match.group(2).upper()
    scale={"B":1,"KB":1000,"KIB":1024,"MB":1000000,"MIB":1048576,"GB":1000000000,"GIB":1073741824}[unit]
    return int(number*scale)

class SoftwareLogistics:
    """Expose only capabilities actually backed by an installed package manager."""
    def __init__(self, config_dir, platform, runner=None, popen=None, which=None, now=None):
        self.config_dir=Path(config_dir);self.platform=platform
        self.runner=runner or subprocess.run;self.popen=popen or subprocess.Popen
        self.which=which or shutil.which;self.now=now or time.time
        self.state_file=self.config_dir/"software-logistics.json"
        self.lock=threading.RLock();self.jobs={};self.plans={};self.cache={"at":0,"value":None}
        self.history=self._load_history()

    def _load_history(self):
        try:
            value=json.loads(self.state_file.read_text(encoding="utf-8"));rows=value.get("history",[])
            return rows[-100:] if isinstance(rows,list) else []
        except Exception:return []

    def _save_history(self):
        self.config_dir.mkdir(parents=True,exist_ok=True)
        temporary=self.state_file.with_suffix(".tmp")
        temporary.write_text(json.dumps({"schema":1,"history":self.history[-100:]},indent=2),encoding="utf-8")
        temporary.replace(self.state_file)

    def managers(self):
        names=[]
        if self.platform=="windows":
            if self.which("winget"):names.append("winget")
        else:
            native=next((item for item in LINUX_MANAGERS if self.which(item)),None)
            if native:names.append(native)
            if self.which("flatpak"):names.append("flatpak")
        return [{"id":name,"name":LABELS[name],"transactions":True,"sourceControl":name in ("flatpak","winget"),"cancellation":name=="flatpak","signaturePolicy":SIGNATURES[name]} for name in names]

    def _manager(self, requested=""):
        detected=[item["id"] for item in self.managers()]
        manager=requested or (detected[0] if detected else "")
        if manager not in detected:raise ValueError("Requested package manager is not available on this station")
        return manager

    def _package(self, value):
        value=str(value or "").strip()
        if not PACKAGE_ID.fullmatch(value) or value.startswith("-") or ".." in value:raise ValueError("Package identifier is invalid")
        return value

    def _run(self, argv, timeout=35):
        kwargs={"capture_output":True,"text":True,"timeout":timeout,"env":{**os.environ,"LC_ALL":"C","LANG":"C"}}
        if os.name=="nt":kwargs["creationflags"]=getattr(subprocess,"CREATE_NO_WINDOW",0)
        result=self.runner(list(argv),**kwargs)
        return result.returncode,_short((result.stdout or "")+("\n"+result.stderr if result.stderr else ""))

    def _update_rows(self, manager):
        commands={"apt":["apt","list","--upgradable"],"dnf":["dnf","-q","check-update"],"pacman":["pacman","-Qu"],"zypper":["zypper","--non-interactive","list-updates"],"apk":["apk","version","-l","<"],"xbps-install":["xbps-install","-Mun"],"flatpak":["flatpak","remote-ls","--updates","--columns=application,version,branch"],"winget":["winget","upgrade","--accept-source-agreements","--disable-interactivity"]}
        code,output=self._run(commands[manager],45);rows=[]
        for line in output.splitlines():
            line=line.strip()
            if not line or line.lower().startswith(("listing","name ","id ","the following","no applicable","last metadata","available upgrades")) or set(line)<=set("- |+"):continue
            if manager=="apt" and "/" in line:
                parts=line.split();old=re.search(r"upgradable from: ([^\]]+)",line);rows.append({"id":line.split("/",1)[0],"name":line.split("/",1)[0],"current":old.group(1) if old else "INSTALLED","available":parts[1] if len(parts)>1 else "AVAILABLE","manager":manager})
            elif manager in ("pacman","apk","xbps-install","flatpak"):
                parts=line.split()
                if parts:rows.append({"id":parts[0],"name":parts[0],"current":parts[1] if len(parts)>2 else "INSTALLED","available":parts[-1] if len(parts)>1 else "AVAILABLE","manager":manager})
            elif manager=="winget":
                parts=re.split(r"\s{2,}",line)
                if len(parts)>=2 and not parts[1].lower().startswith("id"):rows.append({"id":parts[1],"name":parts[0],"current":parts[2] if len(parts)>2 else "INSTALLED","available":parts[3] if len(parts)>3 else "AVAILABLE","manager":manager})
            else:
                parts=line.split()
                if parts and PACKAGE_ID.fullmatch(parts[0]):rows.append({"id":parts[0],"name":parts[0],"current":parts[1] if len(parts)>2 else "INSTALLED","available":parts[-1] if len(parts)>1 else "AVAILABLE","manager":manager})
            if len(rows)>=100:break
        return rows,code

    def status(self, refresh=False):
        with self.lock:
            if not refresh and self.cache["value"] and self.now()-self.cache["at"]<120:return self.cache["value"]
        managers=self.managers();updates=[];errors=[]
        if refresh:
            for item in managers:
                try:
                    rows,code=self._update_rows(item["id"]);updates.extend(rows)
                    if code not in (0,1,100):errors.append(f"{item['name']} scan returned status {code}")
                except Exception as exc:errors.append(f"{item['name']} scan unavailable: {type(exc).__name__}")
        detail=(" · ".join(item["name"] for item in managers)+" READY") if managers else "NO SUPPORTED PACKAGE MANAGER DETECTED"
        if not refresh and managers:detail+=" · SELECT SCAN INVENTORY TO REFRESH"
        value={"ok":True,"version":"31.4","manager":managers[0]["id"] if managers else "NONE","managers":managers,"available":bool(managers),"updates":updates,"count":len(updates),"command":"","detail":detail,"errors":errors,"sources":self.sources(),"history":list(reversed(self.history[-50:])),"jobs":[self._public_job(item) for item in self.jobs.values()]}
        with self.lock:self.cache={"at":self.now(),"value":value}
        return value

    def sources(self):
        rows=[]
        for manager in [item["id"] for item in self.managers()]:
            try:
                if manager=="flatpak":
                    _,output=self._run(["flatpak","remotes","--columns=name,url,options"])
                    for line in output.splitlines():
                        parts=line.split("\t")
                        if parts and parts[0]:rows.append({"manager":manager,"id":parts[0],"name":parts[0],"url":parts[1] if len(parts)>1 else "","enabled":not (len(parts)>2 and "disabled" in parts[2]),"mutable":True})
                elif manager=="winget":
                    _,output=self._run(["winget","source","list","--disable-interactivity"])
                    for line in output.splitlines():
                        parts=re.split(r"\s{2,}",line.strip())
                        if len(parts)>=2 and parts[0].lower() not in ("name","-"):rows.append({"manager":manager,"id":parts[0],"name":parts[0],"url":parts[1],"enabled":True,"mutable":parts[0].casefold() not in ("winget","msstore")})
                elif manager=="apt":
                    paths=[Path("/etc/apt/sources.list")]+sorted(Path("/etc/apt/sources.list.d").glob("*.list"))+sorted(Path("/etc/apt/sources.list.d").glob("*.sources"))
                    for path in paths:
                        if path.is_file():rows.append({"manager":manager,"id":str(path),"name":path.name,"url":"SYSTEM CONFIGURATION","enabled":True,"mutable":False})
                elif manager=="dnf":
                    _,output=self._run(["dnf","repolist","--all"])
                    for line in output.splitlines():
                        parts=line.split()
                        if parts and parts[-1] in ("enabled","disabled"):rows.append({"manager":manager,"id":parts[0],"name":" ".join(parts[1:-1]) or parts[0],"url":"SYSTEM REPOSITORY","enabled":parts[-1]=="enabled","mutable":False})
                elif manager=="pacman":
                    path=Path("/etc/pacman.conf")
                    if path.is_file():
                        for name in re.findall(r"(?m)^\[([^]]+)\]",path.read_text(errors="replace")):rows.append({"manager":manager,"id":name,"name":name,"url":"SYSTEM CONFIGURATION","enabled":True,"mutable":False})
                elif manager=="zypper":
                    _,output=self._run(["zypper","--non-interactive","lr","-u"])
                    for line in output.splitlines():
                        if "|" in line:
                            parts=[part.strip() for part in line.split("|")]
                            if parts and parts[0].isdigit():rows.append({"manager":manager,"id":parts[1],"name":parts[2] if len(parts)>2 else parts[1],"url":parts[-1],"enabled":len(parts)>3 and parts[3].casefold()=="yes","mutable":False})
                elif manager=="apk":
                    path=Path("/etc/apk/repositories")
                    if path.is_file():
                        for index,line in enumerate(path.read_text(errors="replace").splitlines()):
                            value=line.strip();enabled=not value.startswith("#");value=value.lstrip("#").strip()
                            if value:rows.append({"manager":manager,"id":f"apk-{index+1}","name":f"APK REPOSITORY {index+1}","url":value,"enabled":enabled,"mutable":False})
                elif manager=="xbps-install":
                    paths=sorted(Path("/etc/xbps.d").glob("*.conf"))+sorted(Path("/usr/share/xbps.d").glob("*.conf"))
                    for path in paths:
                        for index,url in enumerate(re.findall(r"(?m)^repository=(.+)$",path.read_text(errors="replace"))):rows.append({"manager":manager,"id":f"{path.name}-{index}","name":path.name,"url":url,"enabled":True,"mutable":False})
            except Exception:continue
        return rows[:100]

    def search(self, query, requested=""):
        query=str(query or "").strip()
        if len(query)<2 or len(query)>80:raise ValueError("Enter between 2 and 80 characters to search")
        managers=[self._manager(requested)] if requested else [item["id"] for item in self.managers()]
        rows=[]
        commands={"dnf":["dnf","-q","search",query],"apt":["apt-cache","search",query],"pacman":["pacman","-Ss",query],"zypper":["zypper","--non-interactive","search","--details",query],"apk":["apk","search","-v",query],"xbps-install":["xbps-query","-Rs",query],"flatpak":["flatpak","search",query,"--columns=application,name,description,version,remotes"],"winget":["winget","search",query,"--accept-source-agreements","--disable-interactivity"]}
        for manager in managers:
            try:
                _,output=self._run(commands[manager],40)
                for line in output.splitlines():
                    value=line.strip()
                    if not value or set(value)<=set("- |+") or value.lower().startswith(("name ","id ","full text","matched fields")):continue
                    if manager=="apt":parts=value.split(" - ",1);ident=parts[0].strip();name=ident;summary=parts[1] if len(parts)>1 else ""
                    elif manager=="flatpak":
                        parts=value.split("\t");ident=parts[0].strip() if parts else "";name=parts[1].strip() if len(parts)>1 else ident;summary=parts[2].strip() if len(parts)>2 else ""
                    elif manager=="winget":
                        parts=re.split(r"\s{2,}",value);name=parts[0];ident=parts[1] if len(parts)>1 else "";summary=" · ".join(parts[2:4])
                    elif manager=="pacman" and value.startswith(" ") is False and "/" in value:
                        first=value.split()[0];ident=first.split("/",1)[1];name=ident;summary=value[len(first):].strip()
                    elif manager=="apk":
                        first=value.split()[0];match=re.match(r"(.+)-([0-9][^-\s]*)$",first);ident=match.group(1) if match else first;name=ident;summary=value[len(first):].strip()
                    else:
                        parts=value.split(maxsplit=1);ident=re.sub(r"\.(?:x86_64|i686|aarch64|armv7hl|noarch|src)$","",parts[0]) if manager=="dnf" else parts[0];name=ident;summary=parts[1] if len(parts)>1 else ""
                    if PACKAGE_ID.fullmatch(ident) and not ident.startswith("-"):rows.append({"id":ident,"name":name,"summary":summary[:220],"manager":manager})
                    if len(rows)>=80:break
            except Exception:continue
        unique={}
        for row in rows:unique[(row["manager"],row["id"])]=row
        return {"ok":True,"query":query,"results":list(unique.values())[:80]}

    def _installed(self, manager, package):
        commands={"dnf":["rpm","-q",package],"apt":["dpkg-query","-W","-f=${Version}",package],"pacman":["pacman","-Q",package],"zypper":["rpm","-q",package],"apk":["apk","info","-e",package],"xbps-install":["xbps-query","-p","pkgver",package],"flatpak":["flatpak","info",package],"winget":["winget","list","--id",package,"--exact","--disable-interactivity"]}
        try:
            code,output=self._run(commands[manager],18)
            return code==0,output.strip().splitlines()[0][:120] if code==0 and output.strip() else ""
        except Exception:return False,""

    def details(self, requested, package):
        manager=self._manager(requested);package=self._package(package)
        if manager=="flatpak":
            code,output=self._run(["flatpak","search",package,"--columns=application,name,description,version,remotes"],35);installed,current=self._installed(manager,package)
            exact=next((line.split("\t") for line in output.splitlines() if line.split("\t",1)[0].strip()==package),[])
            return {"ok":code in (0,1),"id":package,"name":exact[1].strip() if len(exact)>1 else package,"manager":manager,"installed":installed,"currentVersion":current,"availableVersion":exact[3].strip() if len(exact)>3 else "","summary":exact[2].strip() if len(exact)>2 else "Package metadata supplied by Flatpak.","license":"","homepage":"","source":exact[4].strip() if len(exact)>4 else "","downloadSize":None,"signaturePolicy":SIGNATURES[manager],"raw":output[:8000]}
        commands={"dnf":["dnf","-q","info",package],"apt":["apt-cache","show",package],"pacman":["pacman","-Si",package],"zypper":["zypper","--non-interactive","info",package],"apk":["apk","info","-a",package],"xbps-install":["xbps-query","-RS",package],"flatpak":["flatpak","remote-info","--cached",package],"winget":["winget","show","--id",package,"--exact","--accept-source-agreements","--disable-interactivity"]}
        code,output=self._run(commands[manager],35);installed,current=self._installed(manager,package)
        def field(*names):
            for name in names:
                match=re.search(rf"(?im)^\s*{re.escape(name)}\s*[:=]\s*(.+)$",output)
                if match:return match.group(1).strip()[:400]
            return ""
        return {"ok":code in (0,1),"id":package,"name":field("Name","Package") or package,"manager":manager,"installed":installed,"currentVersion":current or field("Installed","Version"),"availableVersion":field("Latest","Version","Available"),"summary":field("Summary","Description") or "Package metadata supplied by the selected manager.","license":field("License"),"homepage":field("Homepage","URL"),"source":field("Source","Repository","Remote"),"downloadSize":_size(field("Download Size","Size")),"signaturePolicy":SIGNATURES[manager],"raw":output[:8000]}

    def _simulation(self, manager, action, package):
        commands={
            ("dnf","install"):["dnf","--assumeno","install",package],("dnf","remove"):["dnf","--assumeno","remove",package],("dnf","update"):["dnf","--assumeno","upgrade",package],
            ("apt","install"):["apt-get","--simulate","install",package],("apt","remove"):["apt-get","--simulate","remove",package],("apt","update"):["apt-get","--simulate","--only-upgrade","install",package],
            ("pacman","install"):["pacman","-Sp",package],("pacman","remove"):["pacman","-Rp",package],("pacman","update"):["pacman","-Sp",package],
            ("zypper","install"):["zypper","--non-interactive","--dry-run","install",package],("zypper","remove"):["zypper","--non-interactive","--dry-run","remove",package],("zypper","update"):["zypper","--non-interactive","--dry-run","update",package],
            ("apk","install"):["apk","add","--simulate",package],("apk","remove"):["apk","del","--simulate",package],("apk","update"):["apk","add","--simulate","--upgrade",package],
            ("xbps-install","install"):["xbps-install","-n",package],("xbps-install","remove"):["xbps-remove","-n",package],("xbps-install","update"):["xbps-install","-n","-u",package],
            ("flatpak","install"):["flatpak","install","--user","--assumeno",package],("flatpak","remove"):["flatpak","uninstall","--user","--assumeno",package],("flatpak","update"):["flatpak","update","--user","--assumeno",package],
        }
        command=commands.get((manager,action))
        if not command:return None,"This manager does not expose a safe preview; LCARS will still show the exact requested operation."
        try:
            _,output=self._run(command,50)
            return True,output[:8000] or "The manager reported no additional changes."
        except Exception as exc:return False,f"Change preview unavailable: {type(exc).__name__}"

    def plan(self, action, requested, package):
        if action not in ("install","remove","update"):raise ValueError("Unsupported software operation")
        manager=self._manager(requested);package=self._package(package);details=self.details(manager,package)
        preview_available,preview=self._simulation(manager,action,package)
        token=uuid.uuid4().hex;restart=bool(re.search(r"(?i)(kernel|systemd|glibc|driver|firmware|windows)",package))
        plan={"token":token,"created":int(self.now()),"expires":int(self.now()+600),"action":action,"manager":manager,"package":package,"name":details["name"],"ready":preview_available is not False,"previewAvailable":preview_available,"preview":preview,"storageImpact":_size(preview),"restartRequired":restart,"restartAssessment":"POSSIBLE RESTART" if restart else "NO RESTART INDICATED","signaturePolicy":SIGNATURES[manager],"authorization":"WINDOWS OPERATOR" if manager=="winget" else ("USER SESSION" if manager=="flatpak" else "SYSTEM ADMINISTRATOR"),"cancellable":manager=="flatpak"}
        with self.lock:self.plans[token]=plan
        return {"ok":True,"plan":plan}

    def _command(self, plan):
        manager=plan["manager"];action=plan["action"];package=plan["package"]
        commands={
            ("dnf","install"):["dnf","-y","install",package],("dnf","remove"):["dnf","-y","remove",package],("dnf","update"):["dnf","-y","upgrade",package],
            ("apt","install"):["apt-get","-y","install",package],("apt","remove"):["apt-get","-y","remove",package],("apt","update"):["apt-get","-y","--only-upgrade","install",package],
            ("pacman","install"):["pacman","--noconfirm","-S",package],("pacman","remove"):["pacman","--noconfirm","-R",package],("pacman","update"):["pacman","--noconfirm","-S",package],
            ("zypper","install"):["zypper","--non-interactive","install",package],("zypper","remove"):["zypper","--non-interactive","remove",package],("zypper","update"):["zypper","--non-interactive","update",package],
            ("apk","install"):["apk","add",package],("apk","remove"):["apk","del",package],("apk","update"):["apk","add","--upgrade",package],
            ("xbps-install","install"):["xbps-install","-y",package],("xbps-install","remove"):["xbps-remove","-y",package],("xbps-install","update"):["xbps-install","-y","-u",package],
            ("flatpak","install"):["flatpak","install","--user","-y",package],("flatpak","remove"):["flatpak","uninstall","--user","-y",package],("flatpak","update"):["flatpak","update","--user","-y",package],
            ("winget","install"):["winget","install","--id",package,"--exact","--silent","--accept-source-agreements","--accept-package-agreements","--disable-interactivity"],
            ("winget","remove"):["winget","uninstall","--id",package,"--exact","--silent","--disable-interactivity"],
            ("winget","update"):["winget","upgrade","--id",package,"--exact","--silent","--accept-source-agreements","--accept-package-agreements","--disable-interactivity"],
        }
        command=commands.get((manager,action))
        if not command:raise ValueError("This package manager does not support the requested operation")
        if self.platform!="windows" and manager not in ("flatpak",) and os.geteuid()!=0:
            if not self.which("pkexec"):raise PermissionError("Administrator authorization is required, but PolicyKit is unavailable")
            command=["pkexec"]+command
        return command

    def _public_job(self, job):
        return {key:value for key,value in job.items() if key not in ("process","command")}

    def _start_job(self, command, record):
        with self.lock:
            if any(item.get("status") in ("queued","running") for item in self.jobs.values()):raise RuntimeError("Another software transaction is already active")
            ident=uuid.uuid4().hex[:16];job={"id":ident,"status":"queued","progress":0,"log":"","started":int(self.now()),**record};self.jobs[ident]=job
        def worker():
            try:
                kwargs={"stdout":subprocess.PIPE,"stderr":subprocess.STDOUT,"text":True,"env":{**os.environ,"LC_ALL":"C","LANG":"C"}}
                if os.name=="nt":kwargs["creationflags"]=getattr(subprocess,"CREATE_NO_WINDOW",0)
                else:kwargs["start_new_session"]=True
                process=self.popen(command,**kwargs);job.update(status="running",process=process,progress=8)
                lines=[]
                if process.stdout:
                    for line in process.stdout:
                        lines.append(line.rstrip());job["log"]=_short("\n".join(lines));job["progress"]=min(92,job["progress"]+3)
                code=process.wait();job["returnCode"]=code;job["finished"]=int(self.now());job["progress"]=100
                if job.get("status")!="cancelled":job["status"]="completed" if code==0 else "failed"
            except Exception as exc:job.update(status="failed",progress=100,finished=int(self.now()),log=_short(f"{job.get('log','')}\n{type(exc).__name__}: {exc}"))
            finally:
                job.pop("process",None);entry=self._public_job(job);entry["rollbackGuidance"]="Use the package manager's version history or distribution snapshot tooling; LCARS will not claim an unsupported automatic rollback."
                with self.lock:self.history.append(entry);self.history=self.history[-100:];self._save_history();self.cache={"at":0,"value":None}
        threading.Thread(target=worker,daemon=True).start()
        return {"ok":True,"job":self._public_job(job)}

    def start(self, payload):
        token=str(payload.get("token","")).strip()
        if not payload.get("confirmed"):raise PermissionError("Review and confirm the transaction before it starts")
        with self.lock:plan=self.plans.pop(token,None)
        if not plan or plan["expires"]<self.now():raise ValueError("Transaction review expired; generate a new plan")
        command=self._command(plan)
        return self._start_job(command,{"kind":"package","action":plan["action"],"manager":plan["manager"],"package":plan["package"],"name":plan["name"],"cancellable":plan["cancellable"],"restartRequired":plan["restartRequired"]})

    def job(self, ident):
        with self.lock:job=self.jobs.get(str(ident))
        return self._public_job(job) if job else None

    def cancel(self, ident):
        with self.lock:job=self.jobs.get(str(ident))
        if not job:raise KeyError("Software transaction was not found")
        if not job.get("cancellable"):raise PermissionError("This package manager cannot be cancelled safely")
        process=job.get("process")
        if not process or process.poll() is not None:return {"ok":True,"job":self._public_job(job)}
        if os.name=="nt":process.terminate()
        else:os.killpg(process.pid,signal.SIGTERM)
        job.update(status="cancelled",progress=100,finished=int(self.now()))
        return {"ok":True,"job":self._public_job(job)}

    def source_action(self, payload):
        operation=str(payload.get("action","")).strip();manager=self._manager(str(payload.get("manager","")).strip())
        if manager not in ("flatpak","winget"):raise PermissionError("System package sources are read-only in LCARS")
        if operation not in ("add","remove") or not payload.get("confirmed"):raise PermissionError("Source changes require explicit confirmation")
        name=str(payload.get("name","")).strip()
        if not SOURCE_NAME.fullmatch(name):raise ValueError("Source name is invalid")
        if operation=="add":
            url=str(payload.get("url","")).strip();parsed=urlparse(url)
            if parsed.scheme!="https" or not parsed.netloc:raise ValueError("Software sources require an HTTPS address")
            command=["flatpak","remote-add","--user","--if-not-exists",name,url] if manager=="flatpak" else ["winget","source","add","--name",name,"--arg",url,"--accept-source-agreements","--disable-interactivity"]
        else:
            if manager=="winget" and name.casefold() in ("winget","msstore"):raise PermissionError("Built-in WinGet sources are protected")
            command=["flatpak","remote-delete","--user",name] if manager=="flatpak" else ["winget","source","remove","--name",name,"--disable-interactivity"]
        return self._start_job(command,{"kind":"source","action":operation,"manager":manager,"package":name,"name":name,"cancellable":False,"restartRequired":False})
