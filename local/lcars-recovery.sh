#!/usr/bin/env bash
set -euo pipefail

if command -v plasmashell >/dev/null 2>&1 && ! pgrep -x plasmashell >/dev/null 2>&1; then
  restored=false
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --user start plasma-plasmashell.service >/dev/null 2>&1 && restored=true
  fi
  if [[ "$restored" != true ]]; then
    nohup plasmashell >/dev/null 2>&1 &
  fi
fi

if [[ "${LCARS_RECOVERY_SILENT:-0}" != 1 ]] && command -v notify-send >/dev/null 2>&1; then
  notify-send "LCARS Recovery" "Desktop recovery completed."
fi
