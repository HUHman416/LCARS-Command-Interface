#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
installed_app="$HOME/.local/opt/lcars-command-interface/LCARS-Command-Interface.AppImage"
bundled_app="$PWD/LCARS-Command-Interface.AppImage"
if [[ -x "$installed_app" ]]; then exec "$installed_app" "$@"; fi
if [[ -x "$bundled_app" ]]; then exec "$bundled_app" "$@"; fi
pid_file=".lcars-runtime.pids"
if [ -f "$pid_file" ]; then
  while read -r old_pid; do
    if [[ "$old_pid" =~ ^[0-9]+$ ]]; then kill "$old_pid" 2>/dev/null || true; fi
  done < "$pid_file"
  rm -f "$pid_file"
  read -r -t 0.5 _ || true
fi
for port in 8764 8765; do
  if command -v fuser >/dev/null && fuser "$port/tcp" >/dev/null 2>&1; then
    echo "LCARS cannot start because port $port is occupied by another process."
    echo "Close the older LCARS instance, or run: fuser -k $port/tcp"
    exit 1
  fi
done
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo "Node.js 22+ and npm are required. Install them, then run this again."
  exit 1
fi
if [ ! -d node_modules ]; then npm install; fi
python3 local/lcars_bridge.py &
bridge_pid=$!
npm run dev -- --host 127.0.0.1 --port 8764 &
ui_pid=$!
printf '%s\n%s\n' "$bridge_pid" "$ui_pid" > "$pid_file"
cleanup(){ kill "$bridge_pid" "$ui_pid" 2>/dev/null || true; rm -f "$pid_file"; "$PWD/local/lcars-recovery.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
for _ in {1..40}; do
  if command -v curl >/dev/null && curl -fsS http://127.0.0.1:8764/ >/dev/null 2>&1; then break; fi
  read -r -t 0.25 _ || true
done
if ! kill -0 "$ui_pid" 2>/dev/null || ! kill -0 "$bridge_pid" 2>/dev/null; then
  echo "LCARS failed to start. Review the messages above."
  exit 1
fi
if command -v chromium >/dev/null; then chromium --app=http://127.0.0.1:8764/ --start-fullscreen
elif command -v google-chrome >/dev/null; then google-chrome --app=http://127.0.0.1:8764/ --start-fullscreen
elif command -v firefox >/dev/null; then firefox --kiosk http://127.0.0.1:8764/
else xdg-open http://127.0.0.1:8764/; wait "$ui_pid"
fi
