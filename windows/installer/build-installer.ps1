[CmdletBinding()]
param()
$ErrorActionPreference="Stop"
$ProjectDir=Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..")
Set-Location $ProjectDir
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw "Node.js 22 or newer is required to build the installer." }
if (-not (Test-Path (Join-Path $ProjectDir "node_modules"))) { npm ci }
npm run desktop:package:windows -- --publish never
if ($LASTEXITCODE -ne 0) { throw "Electron/NSIS packaging failed." }
$Installer=Get-ChildItem (Join-Path $ProjectDir "release-desktop") -Filter "*.exe" | Where-Object { $_.Name -notmatch "uninstall" } | Select-Object -First 1
if (-not $Installer) { throw "The Windows setup executable was not produced." }
Write-Host "Installer created: $($Installer.FullName)" -ForegroundColor Green
