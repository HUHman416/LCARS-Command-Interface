$ErrorActionPreference = "Stop"
if (Get-Command py -ErrorAction SilentlyContinue) { exit 0 }
if (Get-Command python -ErrorAction SilentlyContinue) { exit 0 }
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Windows Package Manager is required to install Python." }
winget install --id Python.Python.3.12 --exact --silent --accept-package-agreements --accept-source-agreements
