[CmdletBinding()]
param([switch]$SkipStartup)
$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Ensure-WingetPackage($Command,$Id) {
    if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
        if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Windows Package Manager (winget) is required to install $Command." }
        winget install --id $Id --exact --accept-package-agreements --accept-source-agreements
        $env:Path = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")
    }
}
Write-Host "Installing LCARS Windows prerequisites…" -ForegroundColor Cyan
Ensure-WingetPackage "node" "OpenJS.NodeJS.LTS"
Ensure-WingetPackage "python" "Python.Python.3.13"
Set-Location $ProjectDir
npm install

if (Get-Command py -ErrorAction SilentlyContinue) { & py -3 -m pip install --user --upgrade psutil pycaw comtypes pywin32 }
else { & python -m pip install --user --upgrade psutil pycaw comtypes pywin32 }
try {
    Install-Module AudioDeviceCmdlets -Scope CurrentUser -Force -AllowClobber -ErrorAction Stop
    Write-Host "Windows audio-device switching enabled." -ForegroundColor Green
} catch { Write-Warning "AudioDeviceCmdlets could not be installed. LCARS will still run; device switching can be enabled later." }

$Shell = New-Object -ComObject WScript.Shell
$Programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$Shortcut = $Shell.CreateShortcut((Join-Path $Programs "LCARS Command Interface.lnk"))
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $ProjectDir 'start-windows.ps1')`""
$Shortcut.WorkingDirectory = $ProjectDir
$Shortcut.Description = "LCARS Windows Command Interface"
$Shortcut.Save()
if (-not $SkipStartup) {
    $Startup = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup\LCARS Command Interface.lnk"
    Copy-Item (Join-Path $Programs "LCARS Command Interface.lnk") $Startup -Force
}
Write-Host "Installation complete." -ForegroundColor Green
Write-Host "Start LCARS from the Start Menu or run .\start-windows.ps1"
