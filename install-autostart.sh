#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
mode="${1:-interactive}"
installed_app="$HOME/.local/opt/lcars-command-interface/LCARS-Command-Interface.AppImage"
portable_app="$project_dir/LCARS-Command-Interface.AppImage"
provided_app="${LCARS_APPLICATION_PATH:-}"
launcher="$HOME/.local/bin/lcars-command-interface"
recovery_launcher="$HOME/.local/bin/lcars-desktop-recovery"
desktop_file="$HOME/.local/share/applications/lcars-command-interface.desktop"
recovery_file="$HOME/.local/share/applications/lcars-recovery.desktop"
autostart_file="$HOME/.config/autostart/lcars-command-interface.desktop"
icon_dir="$HOME/.local/share/icons/hicolor/512x512/apps"
icon_file="$icon_dir/lcars-command-interface.png"

case "$mode" in
  interactive|--register|--enable-autostart|--disable-autostart) ;;
  --help|-h)
    echo "Usage: ./install-autostart.sh [--register|--enable-autostart|--disable-autostart]"
    echo "  --register          Add LCARS to the Linux application launcher/search."
    echo "  --enable-autostart  Register LCARS and start it when this user signs in."
    echo "  --disable-autostart Keep launcher/search registration but stop login startup."
    exit 0
    ;;
  *) echo "Unknown option: $mode" >&2; exit 2 ;;
esac

if [[ ! -x "$portable_app" ]]; then
  for candidate in "$project_dir"/LCARS-Command-Interface*.AppImage; do
    if [[ -x "$candidate" ]]; then
      portable_app="$candidate"
      break
    fi
  done
fi

if [[ -n "$provided_app" && -x "$provided_app" ]]; then
  application="$provided_app"
elif [[ -x "$installed_app" ]]; then
  application="$installed_app"
elif [[ -x "$portable_app" ]]; then
  application="$portable_app"
else
  echo "LCARS AppImage was not found beside this script or in ~/.local/opt/lcars-command-interface." >&2
  exit 1
fi

mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.config/autostart" "$icon_dir"
printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$application" > "$launcher"
chmod +x "$launcher"
recovery_script="$HOME/.local/opt/lcars-command-interface/lcars-recovery.sh"
[[ -x "$recovery_script" ]] || recovery_script="$project_dir/local/lcars-recovery.sh"
if [[ -x "$recovery_script" ]]; then
  printf '#!/usr/bin/env bash\nexec %q\n' "$recovery_script" > "$recovery_launcher"
  chmod +x "$recovery_launcher"
  {
    echo "[Desktop Entry]"
    echo "Type=Application"
    echo "Name=LCARS Desktop Recovery"
    echo "Comment=Restore desktop panels after an interrupted LCARS session"
    echo "Exec=$recovery_launcher"
    echo "NoDisplay=true"
    [[ "${XDG_CURRENT_DESKTOP:-}" == *KDE* ]] && echo "X-KDE-Shortcuts=Meta+Shift+Escape"
  } > "$recovery_file"
  chmod +x "$recovery_file"
fi
provided_icon="${LCARS_ICON_PATH:-$project_dir/lcars-command-interface.png}"
if [[ -f "$provided_icon" ]]; then
  install -m 644 "$provided_icon" "$icon_file"
fi

{
  echo "[Desktop Entry]"
  echo "Type=Application"
  echo "Name=LCARS Command Interface"
  echo "GenericName=System Command Interface"
  echo "Comment=Local LCARS desktop command environment"
  echo "Exec=$launcher"
  echo "Icon=$icon_file"
  echo "StartupWMClass=lcars-command-interface"
  echo "StartupNotify=true"
  echo "Terminal=false"
  echo "Categories=System;Utility;"
  echo "Keywords=LCARS;Star Trek;Terminal;System;"
} > "$desktop_file"
chmod +x "$desktop_file"

if [[ "$mode" == "interactive" ]]; then
  mode="--register"
  if [[ -t 0 ]]; then
    read -r -p "Start LCARS automatically when you sign in? [y/N] " answer
    [[ "${answer,,}" == y || "${answer,,}" == yes ]] && mode="--enable-autostart"
  fi
fi

if [[ "$mode" == "--enable-autostart" ]]; then
  cp "$desktop_file" "$autostart_file"
  echo "X-GNOME-Autostart-enabled=true" >> "$autostart_file"
  chmod +x "$autostart_file"
  autostart_status="enabled"
elif [[ "$mode" == "--disable-autostart" ]]; then
  rm -f "$autostart_file"
  autostart_status="disabled"
else
  autostart_status="$([[ -f "$autostart_file" ]] && echo enabled || echo unchanged)"
fi

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true
echo "LCARS is registered in your Linux application launcher and taskbar search."
echo "Login autostart: $autostart_status"
