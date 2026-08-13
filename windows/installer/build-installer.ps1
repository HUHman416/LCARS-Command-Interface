[CmdletBinding()]
param()
$ErrorActionPreference="Stop"
$InstallerDir=Split-Path -Parent $MyInvocation.MyCommand.Path
$Compiler="${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $Compiler)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "winget is required to install Inno Setup." }
    winget install --id JRSoftware.InnoSetup --exact --accept-package-agreements --accept-source-agreements
}
if (-not (Test-Path $Compiler)) { throw "Inno Setup compiler was not found after installation." }
& $Compiler (Join-Path $InstallerDir "LCARS-Windows.iss")
Write-Host "Installer created in windows\installer\output\LCARS-Windows-Setup.exe" -ForegroundColor Green
