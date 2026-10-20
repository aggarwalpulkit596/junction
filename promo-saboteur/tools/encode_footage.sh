#!/usr/bin/env bash
# Encode footage/f#####.jpg into assets/footage.mp4 (720p) for the interactive and standalone players.
# Frames without footage (pure-UI moments) are filled with the backdrop colour so the video stays aligned to film time.
set -euo pipefail
cd "$(dirname "$0")/.."
.venv/bin/python - <<'PY'
import json, os, subprocess, tempfile
from PIL import Image
TL = json.load(open('script/timeline.json')); n = round(TL['duration'] * 30)
tmp = tempfile.mkdtemp(); blk = os.path.join(tmp, 'black.jpg'); Image.new('RGB', (1080, 1920), (5, 6, 26)).save(blk, quality=90)
lst = os.path.join(tmp, 'list.txt')
with open(lst, 'w') as f:
    for i in range(n):
        p = os.path.abspath(f'footage/f{i:05d}.jpg'); f.write(f"file '{p if os.path.exists(p) else blk}'\nduration {1/30:.6f}\n")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst, '-vf', 'scale=720:1280:flags=lanczos,fps=30',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', 'assets/footage.mp4'], check=True)
print('wrote assets/footage.mp4')
PY
