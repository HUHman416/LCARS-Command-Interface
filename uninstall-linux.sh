#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
echo "LCARS UNIVERSAL LINUX UNINSTALLER"
echo
echo "This removes LCARS startup entries and optionally your LCARS settings."
echo "Shared system packages such as Node.js, Python, PipeWire, and playerctl will be preserved."
echo
read -r -p "Uninstall LCARS for this user? [y/N] " answer
[[ "${answer,,}" == y || "${answer,,}" == yes ]] || { echo "Uninstall cancelled."; exit 0; }

# Stop the standalone desktop process first. Removing its files does not stop
# an already-running Electron instance, which can survive into a reinstall.
pkill -f "$HOME/.local/opt/lcars-command-interface/LCARS-Command-Interface.AppImage" 2>/dev/null || true
pkill -f "$project_dir/LCARS-Command-Interface.AppImage" 2>/dev/null || true
pkill -x "lcars-command-i" 2>/dev/null || true
pkill -f '/tmp/.mount_LCARS.*/lcars-command-interface' 2>/dev/null || true

if [[ -f "$project_dir/.lcars-runtime.pids" ]]; then
  while read -r pid; do [[ "$pid" =~ ^[0-9]+$ ]] && kill "$pid" 2>/dev/null || true; done < "$project_dir/.lcars-runtime.pids"
  rm -f "$project_dir/.lcars-runtime.pids"
fi
for port in 8764 8765; do command -v fuser >/dev/null 2>&1 && fuser -k "$port/tcp" >/dev/null 2>&1 || true; done
"$project_dir/local/lcars-recovery.sh" >/dev/null 2>&1 || true

if [[ -f /usr/share/wayland-sessions/lcars-command-interface.desktop || -f /usr/share/xsessions/lcars-command-interface.desktop ]]; then
  read -r -p "Also remove the optional LCARS login session entries? [Y/n] " session_entries
  if [[ -z "$session_entries" || "${session_entries,,}" == y || "${session_entries,,}" == yes ]]; then
    if [[ -x "$project_dir/session/install-session.sh" ]] && command -v pkexec >/dev/null 2>&1; then
      pkexec bash "$project_dir/session/install-session.sh" --uninstall || echo "Session entries remain installed; remove them later from LCARS Settings."
    else
      echo "Session entries remain installed because the authorization helper is unavailable."
    fi
  fi
fi

rm -f "$HOME/.config/autostart/lcars-command-interface.desktop"
rm -f "$HOME/.local/share/applications/lcars-command-interface.desktop"
rm -f "$HOME/.local/share/applications/lcars-recovery.desktop"
rm -f "$HOME/.local/bin/lcars-command-interface"
rm -f "$HOME/.local/bin/lcars-desktop-recovery"
rm -rf "$HOME/.local/opt/lcars-command-interface"
rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/lcars-command-interface.png"

read -r -p "Also remove saved themes, profiles, settings, and extensions? [y/N] " settings
if [[ "${settings,,}" == y || "${settings,,}" == yes ]]; then
  rm -rf "$HOME/.config/lcars-command-interface" "$HOME/.local/share/lcars-command-interface"
  echo "LCARS user settings removed."
else
  echo "LCARS user settings preserved."
fi

command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true
echo
echo "LCARS has been uninstalled for this user. You may now delete:"
echo "  $project_dir"
