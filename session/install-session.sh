#!/usr/bin/env bash
set -euo pipefail

operation="${1:---status}"
source_dir="$(cd "$(dirname "$0")" && pwd)"
libexec_dir="/usr/local/libexec/lcars-command-interface"
wayland_file="/usr/share/wayland-sessions/lcars-command-interface.desktop"
x11_file="/usr/share/xsessions/lcars-command-interface.desktop"

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "Administrator authorization is required to change login sessions." >&2
    exit 77
  fi
}

write_entry() {
  local destination="$1" mode="$2" label="$3"
  mkdir -p "$(dirname "$destination")"
  sed -e "s|@EXEC@|$libexec_dir/lcars-session $mode|g" -e "s|@LABEL@|$label|g" "$source_dir/lcars-session.desktop.in" > "$destination"
  chmod 644 "$destination"
}

case "$operation" in
  --install)
    require_root
    install -d -m 755 "$libexec_dir"
    install -m 755 "$source_dir/lcars-session" "$libexec_dir/lcars-session"
    write_entry "$wayland_file" --wayland "LCARS Command Session (Wayland)"
    write_entry "$x11_file" --x11 "LCARS Command Session (X11)"
    echo "LCARS login sessions installed. Select one from the session menu at your next sign-in."
    ;;
  --uninstall)
    require_root
    rm -f "$wayland_file" "$x11_file" "$libexec_dir/lcars-session"
    rmdir "$libexec_dir" 2>/dev/null || true
    echo "LCARS login sessions removed. The LCARS application and settings were preserved."
    ;;
  --status)
    [[ -x "$libexec_dir/lcars-session" && ( -f "$wayland_file" || -f "$x11_file" ) ]]
    ;;
  *) echo "Usage: $0 --install|--uninstall|--status" >&2; exit 2 ;;
esac
