#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
case "$platform" in linux|windows) ;; *) echo "Usage: $0 linux|windows" >&2; exit 2;; esac

project_dir="$(cd "$(dirname "$0")/.." && pwd)"
runtime_dir="$project_dir/voice-runtime/$platform"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT

release="b4938"
if [[ "$platform" == "linux" ]]; then
  archive="whisper-bin-ubuntu-x64.tar.gz"
  archive_sha256="f4cfc1f969a13805908fb72043ce7cc896eb42e0b8afbe841dc8e7298923b061"
else
  archive="whisper-bin-x64.zip"
  archive_sha256="c2a4b60edb11f7e11a9191ffb50929535527d4d91c9903dbe3e554583bbbc63d"
fi
archive_url="https://github.com/ggml-org/whisper.cpp/releases/download/$release/$archive"
model="ggml-tiny.en-q5_1.bin"
model_sha1="3fb92ec865cbbc769f08137f22470d6b66e071b6"
model_url="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$model?download=true"

mkdir -p "$runtime_dir"
find "$runtime_dir" -mindepth 1 -maxdepth 1 ! -name .gitkeep -exec rm -rf {} +
curl --fail --location --retry 3 --output "$temporary_dir/$archive" "$archive_url"
printf '%s  %s\n' "$archive_sha256" "$temporary_dir/$archive" | sha256sum --check --status
mkdir -p "$temporary_dir/extracted"
if [[ "$platform" == "windows" ]]; then
  if command -v unzip >/dev/null 2>&1; then unzip -q "$temporary_dir/$archive" -d "$temporary_dir/extracted"
  elif command -v 7z >/dev/null 2>&1; then 7z x -y -o"$temporary_dir/extracted" "$temporary_dir/$archive" >/dev/null
  else echo "A ZIP extractor is required for the Windows whisper.cpp runtime" >&2; exit 3
  fi
else
  tar -xzf "$temporary_dir/$archive" -C "$temporary_dir/extracted"
fi

if [[ "$platform" == "linux" ]]; then
  engine="$(find "$temporary_dir/extracted" -type f \( -name whisper-cli -o -name main \) -print -quit)"
else
  engine="$(find "$temporary_dir/extracted" -type f \( -iname whisper-cli.exe -o -iname main.exe \) -print -quit)"
fi
test -n "$engine"
cp -a "$(dirname "$engine")/." "$runtime_dir/"

curl --fail --location --retry 3 --output "$runtime_dir/$model" "$model_url"
printf '%s  %s\n' "$model_sha1" "$runtime_dir/$model" | sha1sum --check --status
if [[ "$platform" == "linux" ]]; then chmod +x "$runtime_dir/whisper-cli" 2>/dev/null || chmod +x "$runtime_dir/main"; fi
printf '{"schema":1,"component":"whisper.cpp","release":"%s","model":"%s","modelSha1":"%s","platform":"%s"}\n' "$release" "$model" "$model_sha1" "$platform" > "$runtime_dir/runtime-manifest.json"
echo "Prepared verified offline voice runtime for $platform."
