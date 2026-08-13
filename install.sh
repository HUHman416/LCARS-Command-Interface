#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "$0")" && pwd)"
desktop="${XDG_CURRENT_DESKTOP:-${DESKTOP_SESSION:-unknown}}"
session="${XDG_SESSION_TYPE:-unknown}"
common=(python3 curl psmisc playerctl wireplumber wl-clipboard xdg-utils)

if command -v dnf >/dev/null 2>&1; then
  manager=dnf; packages=("${common[@]}" libnotify procps-ng fuse-libs)
  [[ "${desktop,,}" == *kde* ]] && packages+=(plasma-systemmonitor filelight pavucontrol plasma-discover bluedevil libkscreen qt6-qttools cargo gcc openssl-devel)
  [[ "${desktop,,}" == *gnome* ]] && packages+=(gnome-system-monitor baobab pavucontrol gnome-software gnome-bluetooth)
  sudo dnf install -y "${packages[@]}"
elif command -v apt-get >/dev/null 2>&1; then
  manager=apt; sudo apt-get update; packages=("${common[@]}" libnotify-bin procps)
  if apt-cache show libfuse2t64 >/dev/null 2>&1; then packages+=(libfuse2t64); else packages+=(libfuse2); fi
  [[ "${desktop,,}" == *kde* ]] && packages+=(plasma-systemmonitor filelight pavucontrol plasma-discover bluedevil libkscreen-bin)
  [[ "${desktop,,}" == *gnome* ]] && packages+=(gnome-system-monitor baobab pavucontrol gnome-software gnome-bluetooth)
  sudo apt-get install -y "${packages[@]}"
elif command -v pacman >/dev/null 2>&1; then
  manager=pacman; packages=(python curl psmisc playerctl wireplumber wl-clipboard libnotify procps-ng xdg-utils fuse2)
  [[ "${desktop,,}" == *kde* ]] && packages+=(plasma-systemmonitor filelight pavucontrol discover bluedevil libkscreen)
  [[ "${desktop,,}" == *gnome* ]] && packages+=(gnome-system-monitor baobab pavucontrol gnome-software gnome-bluetooth)
  sudo pacman -S --needed --noconfirm "${packages[@]}"
elif command -v zypper >/dev/null 2>&1; then
  manager=zypper; packages=("${common[@]}" libnotify-tools procps fuse)
  sudo zypper --non-interactive install "${packages[@]}"
elif command -v apk >/dev/null 2>&1; then
  manager=apk; sudo apk add python3 curl psmisc playerctl wireplumber wl-clipboard libnotify procps xdg-utils fuse
elif command -v xbps-install >/dev/null 2>&1; then
  manager=xbps; sudo xbps-install -Sy python3 curl psmisc playerctl wireplumber wl-clipboard libnotify procps-ng xdg-utils fuse
else
  echo "No supported package manager was detected."
  echo "Install Python 3, playerctl, WirePlumber/wpctl, curl, and xdg-utils, then retry."
  exit 1
fi

if [[ "${desktop,,}" == *kde* && "${session,,}" == wayland* ]] && ! command -v kdotool >/dev/null 2>&1 && [[ ! -x "$HOME/.cargo/bin/kdotool" ]] && command -v cargo >/dev/null 2>&1; then
  cargo install --locked --git https://github.com/jinliu/kdotool || echo "KDotool unavailable; Task Rail controls will be marked restricted."
fi

if [[ "${session,,}" == x11* ]] && ! command -v xdotool >/dev/null 2>&1; then
  case "$manager" in dnf) sudo dnf install -y xdotool;; apt) sudo apt-get install -y xdotool;; pacman) sudo pacman -S --needed --noconfirm xdotool;; zypper) sudo zypper --non-interactive install xdotool;; apk) sudo apk add xdotool;; xbps) sudo xbps-install -y xdotool;; esac
fi

echo "Installing the LCARS universal Linux interface…"
cd "$project_dir"
appimage_source="$project_dir/LCARS-Command-Interface.AppImage"
if [[ ! -f "$appimage_source" ]]; then
  echo "The LCARS desktop application is missing from this installer."
  exit 1
fi
expected_appimage_sha256="76a0389c512af08cf1f0d99e9f8b3325cc24be7b69c7b23b5c3c926bd4856708"
actual_appimage_sha256="$(sha256sum "$appimage_source" | awk '{print $1}')"
if [[ "$actual_appimage_sha256" != "$expected_appimage_sha256" ]]; then
  echo "This installer contains the wrong LCARS AppImage and will not continue."
  echo "Expected: $expected_appimage_sha256"
  echo "Received: $actual_appimage_sha256"
  echo "Download the uniquely versioned LCARS Linux v22.2 package."
  exit 1
fi
install_dir="$HOME/.local/opt/lcars-command-interface"

# End an older installed instance before replacing its AppImage. Electron's
# single-instance lock would otherwise focus that still-running version after
# an update, even when its files had already been removed.
pkill -f "$install_dir/LCARS-Command-Interface.AppImage" 2>/dev/null || true
pkill -f "$project_dir/LCARS-Command-Interface.AppImage" 2>/dev/null || true
pkill -x "lcars-command-i" 2>/dev/null || true
pkill -f '/tmp/.mount_LCARS.*/lcars-command-interface' 2>/dev/null || true
for _ in 1 2 3 4 5; do
  if ! pgrep -f "$install_dir/LCARS-Command-Interface.AppImage" >/dev/null 2>&1 \
     && ! pgrep -x "lcars-command-i" >/dev/null 2>&1; then break; fi
  sleep 0.2
done

mkdir -p "$install_dir" "$HOME/.local/share/icons/hicolor/512x512/apps"
install -m 755 "$appimage_source" "$install_dir/LCARS-Command-Interface.AppImage"
[[ -f "$project_dir/lcars-command-interface.png" ]] && install -m 644 "$project_dir/lcars-command-interface.png" "$HOME/.local/share/icons/hicolor/512x512/apps/lcars-command-interface.png"
chmod +x "$project_dir/start-local.sh" "$project_dir/install-autostart.sh" "$project_dir/install.sh" "$project_dir/Install-LCARS-Linux.run" "$project_dir/uninstall-linux.sh" "$project_dir/local/lcars-recovery.sh"
[[ -f "$project_dir/Start-LCARS-Linux.desktop" ]] && chmod +x "$project_dir/Start-LCARS-Linux.desktop"
"$project_dir/install-autostart.sh"

echo
echo "Installation complete for ${desktop} / ${session} using ${manager}."
echo "LCARS will explain any desktop-specific restrictions inside the affected controls."
