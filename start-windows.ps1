[CmdletBinding()]
param([switch]$NoBrowser)
$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RuntimeDir = Join-Path $env:LOCALAPPDATA "LCARS Command Interface"
$PidFile = Join-Path $RuntimeDir "runtime.json"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null

function Find-Python {
    if (Get-Command py -ErrorAction SilentlyContinue) { return @("py", "-3") }
    if (Get-Command python -ErrorAction SilentlyContinue) { return @("python") }
    throw "Python 3 was not found. Run install-windows.ps1 first."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Node.js/npm was not found. Run install-windows.ps1 first." }

& (Join-Path $ProjectDir "stop-windows.ps1") -Quiet
$Python = @(Find-Python)
$BridgeArgs = @()
if ($Python.Count -gt 1) { $BridgeArgs += $Python[1..($Python.Count-1)] }
$BridgeArgs += (Join-Path $ProjectDir "windows\lcars_bridge_windows.py")
$Bridge = Start-Process -FilePath $Python[0] -ArgumentList $BridgeArgs -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
$Web = Start-Process -FilePath "cmd.exe" -ArgumentList "/d /s /c npm run dev -- --host 127.0.0.1 --port 8764" -WorkingDirectory $ProjectDir -WindowStyle Hidden -PassThru
@{ bridge = $Bridge.Id; web = $Web.Id; started = (Get-Date).ToString("o") } | ConvertTo-Json | Set-Content -Encoding UTF8 $PidFile

$Ready = $false
for ($Attempt=0; $Attempt -lt 45; $Attempt++) {
    try { if ((Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:8764" -TimeoutSec 1).StatusCode -eq 200) { $Ready=$true; break } } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $Ready) { & (Join-Path $ProjectDir "stop-windows.ps1") -Quiet; throw "The LCARS interface did not become ready." }
if (-not $NoBrowser) {
    $Edge = Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"
    if (Test-Path $Edge) { Start-Process $Edge "--app=http://127.0.0.1:8764 --start-fullscreen" }
    else { Start-Process "http://127.0.0.1:8764" }
}
Write-Host "LCARS Windows Command Interface is online." -ForegroundColor Cyan
Write-Host "Local address: http://127.0.0.1:8764"
