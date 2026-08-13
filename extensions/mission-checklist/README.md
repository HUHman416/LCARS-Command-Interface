# Mission Checklist — LCARS Extension

Mission Checklist is a practical Module API v1 test. It adds a persistent checklist to the modular System Overview. Items can be added, completed, removed, and cleared; their state remains on this PC.

## Install

- Linux: run `Install-Linux.sh` from a terminal.
- Windows: right-click `Install-Windows.ps1` and choose **Run with PowerShell**.
- In LCARS, open **Updates → Extensions → Scan Extensions**.
- Open **Status → Configure Overview**, then add **Mission Checklist**.

Requires LCARS Command Interface Version 22 or newer. No executable extension code is loaded; LCARS validates and renders the declarative manifest itself.

## Remove

Delete the `mission-checklist` folder from the Extensions folder, scan again, and remove the unavailable module from Overview Configuration if it was active.
