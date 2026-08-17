from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Hotfix expected source block was not found in {path}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


page_system_old = '''    fetch("http://127.0.0.1:8765/api/system")
      .then((r) => r.json())
      .then((d) => {
        if (d.meters) setMeters(d.meters);
        if (d.platform) {
          setPlatform(d.platform);
          if (String(d.platform).includes("WINDOWS"))
            setPrefs((old) =>
              old.terminalShell === "/bin/bash"
                ? {
                    ...old,
                    terminalShell: "powershell.exe",
                    terminalDirectory: "~",
                  }
                : old,
            );
        }
        setBridge(true);
      })
      .catch(() => {});
'''

page_system_new = '''    const getSystem = () =>
      fetch("http://127.0.0.1:8765/api/system")
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.meters) && d.meters.length) setMeters(d.meters);
          if (d.platform) {
            setPlatform(d.platform);
            if (String(d.platform).includes("WINDOWS"))
              setPrefs((old) =>
                old.terminalShell === "/bin/bash"
                  ? {
                      ...old,
                      terminalShell: "powershell.exe",
                      terminalDirectory: "~",
                    }
                  : old,
              );
          }
          setBridge(true);
        })
        .catch(() => {});
    getSystem();
'''

replace_once("app/page.tsx", page_system_old, page_system_new)
replace_once(
    "app/page.tsx",
    '''      mediaTimer = setInterval(getMedia, 3000),\n''',
    '''      systemTimer = setInterval(getSystem, 2000),\n      mediaTimer = setInterval(getMedia, 3000),\n''',
)
replace_once(
    "app/page.tsx",
    '''      clearInterval(timer);\n      clearInterval(mediaTimer);\n''',
    '''      clearInterval(timer);\n      clearInterval(systemTimer);\n      clearInterval(mediaTimer);\n''',
)

bridge_old = '''def system_data():
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
'''

bridge_new = """def windows_system_fallback():
    script=r'''$cpu=(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average;$os=Get-CimInstance Win32_OperatingSystem;$drive=Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='$env:SystemDrive'\";$gpu=Get-CimInstance Win32_VideoController | Where-Object {$_.Name} | Select-Object -First 1 -ExpandProperty Name;$gpuUsage=0;try{$samples=(Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction Stop).CounterSamples|ForEach-Object{[double]$_.CookedValue};if($samples){$gpuUsage=[math]::Round(($samples|Measure-Object -Maximum).Maximum)}}catch{};[pscustomobject]@{cpu=[int]$cpu;memTotal=[int64]([double]$os.TotalVisibleMemorySize*1024);memFree=[int64]([double]$os.FreePhysicalMemory*1024);diskTotal=[int64]$drive.Size;diskFree=[int64]$drive.FreeSpace;gpuName=[string]$gpu;gpuUsage=[int]$gpuUsage}|ConvertTo-Json -Compress'''
    try:return json.loads(run_ps(script,8) or "{}")
    except Exception:return {}

def system_data():
    fallback=windows_system_fallback()
    cpu=round(psutil.cpu_percent(.12)) if psutil else int(fallback.get("cpu") or 0)
    memory=psutil.virtual_memory() if psutil else None
    disk=psutil.disk_usage(str(Path.home().anchor)) if psutil else None
    gpu=max(0,min(100,int(fallback.get("gpuUsage") or 0)));gpu_name=str(fallback.get("gpuName") or "WINDOWS GRAPHICS")
    if shutil.which("nvidia-smi"):
        try:
            out=subprocess.run(["nvidia-smi","--query-gpu=utilization.gpu,name","--format=csv,noheader,nounits"],capture_output=True,text=True,timeout=3,creationflags=0x08000000).stdout.strip().splitlines()[0]
            gpu_s,gpu_name=out.split(",",1);gpu=max(0,min(100,int(float(gpu_s))));gpu_name=gpu_name.strip()
        except Exception: pass
    if memory:
        mem_pct=round(memory.percent);mem_text=f"{memory.used/1073741824:.1f} / {memory.total/1073741824:.1f} GB"
    else:
        mem_total=int(fallback.get("memTotal") or 0);mem_free=int(fallback.get("memFree") or 0);mem_used=max(0,mem_total-mem_free)
        mem_pct=round(mem_used*100/mem_total) if mem_total else 0
        mem_text=f"{mem_used/1073741824:.1f} / {mem_total/1073741824:.1f} GB" if mem_total else "WINDOWS MEMORY"
    if disk:
        disk_pct=round(disk.percent);disk_text=f"{disk.free/1073741824:.0f} GB AVAILABLE"
    else:
        disk_total=int(fallback.get("diskTotal") or 0);disk_free=int(fallback.get("diskFree") or 0);disk_used=max(0,disk_total-disk_free)
        disk_pct=round(disk_used*100/disk_total) if disk_total else 0
        disk_text=f"{disk_free/1073741824:.0f} GB AVAILABLE" if disk_total else "SYSTEM DRIVE"
    return {"platform":"WINDOWS 11" if sys_version()>=11 else "WINDOWS 10","meters":[["CPU",cpu,"SYSTEM PROCESSOR"],["GPU",gpu,gpu_name],["MEM",mem_pct,mem_text],["DISK",disk_pct,disk_text]]}
"""

replace_once("windows/lcars_bridge_windows.py", bridge_old, bridge_new)
print("Windows 23.1 Hotfix v3 source patch applied successfully.")
