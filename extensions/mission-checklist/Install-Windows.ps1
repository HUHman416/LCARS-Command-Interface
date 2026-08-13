$ErrorActionPreference = "Stop"
$Target = Join-Path $env:LOCALAPPDATA "LCARS Command Interface\extensions\mission-checklist"
New-Item -ItemType Directory -Force -Path $Target | Out-Null
Copy-Item (Join-Path $PSScriptRoot "lcars-module.json") (Join-Path $Target "lcars-module.json") -Force
Write-Host "Mission Checklist installed. In LCARS, choose Updates > Scan Extensions, then add it from Configure Overview."
