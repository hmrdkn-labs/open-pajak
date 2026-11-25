#!/usr/bin/env bash
# Derives the shipped AVIF and WebP files in src/assets/img from the originals in src/img.
# Needs magick, avifenc and cwebp. Run by hand after changing an original; the output is committed.
set -euo pipefail
cd "$(dirname "$0")/.."
out=src/assets/img
mkdir -p "$out"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# name  original  crop(WxH+X+Y or none)  widths...
make() {
  local name="$1" src="$2" crop="$3"; shift 3
  for w in "$@"; do
    local args=()
    [ "$crop" != none ] && args+=(-crop "$crop" +repage)
    magick "src/img/$src" ${args[@]+"${args[@]}"} -resize "${w}x" -strip "$tmp/$name-$w.png"
    avifenc -q 55 -s 4 "$tmp/$name-$w.png" "$out/$name-$w.avif" >/dev/null
    cwebp -quiet -q 62 "$tmp/$name-$w.png" -o "$out/$name-$w.webp"
  done
}
make hero hero-forms.png 1536x864+0+80 640 1024 1536
make receipts receipts-export.png none 480 800
make handbook handbook.webp none 640 1024
ls -la "$out"
