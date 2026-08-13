#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HOME/.local/bin" "$HOME/.local/share/applications" "$HOME/.config/autostart"
launcher="$HOME/.local/bin/lcars-command-interface"
recovery_launcher="$HOME/.local/bin/lcars-desktop-recovery"
installed_app="$HOME/.local/opt/lcars-command-interface/LCARS-Command-Interface.AppImage"

# Desktop Entry Exec fields do not safely accept an unquoted path containing
# spaces on every desktop.  Keep the desktop files simple and put the exact
# installation path in shell wrappers where it can be quoted correctly.
if [[ -x "$installed_app" ]]; then
  printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$installed_app" > "$launcher"
else
  printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$project_dir/start-local.sh" > "$launcher"
fi
printf '#!/usr/bin/env bash\nexec %q\n' "$project_dir/local/lcars-recovery.sh" > "$recovery_launcher"
chmod +x "$launcher" "$recovery_launcher"
desktop_file="$HOME/.local/share/applications/lcars-command-interface.desktop"
{
  echo "[Desktop Entry]"
  echo "Type=Application"
  echo "Name=LCARS Command Interface"
  echo "Comment=Local LCARS shell for Linux"
  echo "Exec=$launcher"
  echo "Icon=$HOME/.local/share/icons/hicolor/512x512/apps/lcars-command-interface.png"
  echo "StartupWMClass=lcars-command-interface"
  echo "StartupNotify=true"
  echo "Terminal=false"
  echo "Categories=System;"
} > "$desktop_file"
cp "$desktop_file" "$HOME/.config/autostart/lcars-command-interface.desktop"
recovery_file="$HOME/.local/share/applications/lcars-recovery.desktop"
{
  echo "[Desktop Entry]"
  echo "Type=Application"
  echo "Name=LCARS Desktop Recovery"
  echo "Comment=Emergency LCARS shell recovery when supported"
  echo "Exec=$recovery_launcher"
  echo "NoDisplay=true"
  [[ "${XDG_CURRENT_DESKTOP:-}" == *KDE* ]] && echo "X-KDE-Shortcuts=Meta+Shift+Escape"
} > "$recovery_file"
chmod +x "$project_dir/start-local.sh" "$project_dir/local/lcars-recovery.sh" "$desktop_file" "$recovery_file" "$HOME/.config/autostart/lcars-command-interface.desktop"
command -v kbuildsycoca6 >/dev/null 2>&1 && kbuildsycoca6 >/dev/null 2>&1 || true
echo "LCARS will now start locally when you log in."
