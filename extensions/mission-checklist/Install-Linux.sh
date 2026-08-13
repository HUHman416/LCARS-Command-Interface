#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target_dir="${XDG_DATA_HOME:-$HOME/.local/share}/lcars-command-interface/extensions/mission-checklist"
mkdir -p "$target_dir"
cp "$script_dir/lcars-module.json" "$target_dir/lcars-module.json"
echo "Mission Checklist installed. In LCARS, choose Updates > Scan Extensions, then add it from Configure Overview."
