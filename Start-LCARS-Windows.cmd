@echo off
set "LCARS_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LCARS_DIR%start-windows.ps1"
if errorlevel 1 pause
