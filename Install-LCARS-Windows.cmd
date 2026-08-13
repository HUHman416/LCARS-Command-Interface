@echo off
title LCARS Windows Installation
cd /d "%~dp0"
echo ============================================================
echo        LCARS WINDOWS COMMAND INTERFACE INSTALLER
echo ============================================================
echo.
echo This will install the local LCARS core and required components.
echo Windows may request approval while installing prerequisites.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"
if errorlevel 1 (
  echo.
  echo Installation did not complete. Review the message above.
  pause
  exit /b 1
)
echo.
echo Starting LCARS...
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-windows.ps1"
exit /b 0

