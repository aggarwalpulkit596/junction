#!/usr/bin/env bash
# Master the pre-mix to -14 LUFS integrated, -3 dBTP (two-pass loudnorm), then encode for the web player.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p audio/master
IN=audio/stems/mix_premaster.wav
J=$(ffmpeg -hide_banner -nostats -i $IN -af loudnorm=I=-14:TP=-3:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g() { echo "$J" | grep "\"$1\"" | sed -E 's/.*: "([^"]+)".*/\1/'; }
ffmpeg -hide_banner -loglevel error -y -i $IN -af "loudnorm=I=-14:TP=-3:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,afade=t=out:st=$(python3 -c "import json;print(json.load(open('script/timeline.json'))['duration']-0.8)"):d=0.8" -ar 48000 -c:a pcm_s24le audio/master/saboteur-trailer-mix.wav
ffmpeg -hide_banner -loglevel error -y -i audio/master/saboteur-trailer-mix.wav -c:a aac -b:a 256k audio/master/saboteur-trailer-mix.m4a
ffmpeg -hide_banner -nostats -i audio/master/saboteur-trailer-mix.wav -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I:|LRA:|Peak:)"
