[CmdletBinding()]
param([switch]$Quiet)
$RuntimeDir = Join-Path $env:LOCALAPPDATA "LCARS Command Interface"
$PidFile = Join-Path $RuntimeDir "runtime.json"
if (Test-Path $PidFile) {
    try {
        $Runtime = Get-Content $PidFile -Raw | ConvertFrom-Json
        foreach ($Id in @($Runtime.bridge,$Runtime.web)) {
            if ($Id) { Stop-Process -Id $Id -Force -ErrorAction SilentlyContinue }
        }
    } catch {}
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
if (-not $Quiet) { Write-Host "LCARS local services stopped." -ForegroundColor Cyan }

