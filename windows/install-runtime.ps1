$ErrorActionPreference = "Stop"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw "Windows Package Manager is required to install Python." }
if (-not (Get-Command py -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  winget install --id Python.Python.3.12 --exact --silent --accept-package-agreements --accept-source-agreements
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  winget install --id Gyan.FFmpeg --exact --silent --accept-package-agreements --accept-source-agreements
}
$python = if (Get-Command py -ErrorAction SilentlyContinue) { "py" } else { "python" }
if ($python -eq "py") { & py -3 -m pip install --disable-pip-version-check psutil pycaw comtypes } else { & python -m pip install --disable-pip-version-check psutil pycaw comtypes }
