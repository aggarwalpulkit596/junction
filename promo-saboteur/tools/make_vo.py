"""Synthesise the narration, one WAV per line, with Kokoro-82M (Apache-2.0).

Usage: .venv/bin/python tools/make_vo.py [--voice am_onyx:0.6,am_michael:0.4] [--speed 0.9]
--voice takes one Kokoro voice or a weighted blend of style vectors.
Writes audio/vo/Lxx.wav (24 kHz mono, trimmed, faded) and audio/vo/durations.json.
"""
import argparse, json, os, sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--voice", default="am_onyx:0.6,am_michael:0.4")
ap.add_argument("--speed", type=float, default=0.9)
ap.add_argument("--only", default="")
args = ap.parse_args()

k = Kokoro(f"{ROOT}/tts/models/kokoro-v1.0.onnx", f"{ROOT}/tts/models/voices-v1.0.bin")
lines = json.load(open(f"{ROOT}/script/lines.json"))
voice = args.voice
if ":" in voice:  # weighted blend, e.g. am_onyx:0.6,am_michael:0.4
    voice = sum(float(w) * k.get_voice_style(n) for n, w in (part.split(":") for part in voice.split(",")))
out = {}
dpath = f"{ROOT}/audio/vo/durations.json"
if os.path.exists(dpath):
    out = json.load(open(dpath))

def trim(a, sr, thr=0.008):
    idx = np.where(np.abs(a) > thr)[0]
    if len(idx) == 0:
        return a
    s = max(0, idx[0] - int(0.02 * sr)); e = min(len(a), idx[-1] + int(0.06 * sr))
    a = a[s:e].copy()
    f = int(0.01 * sr)
    a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    return a

for ln in lines:
    if args.only and ln["id"] not in args.only.split(","):
        continue
    speed = ln.get("speed", args.speed)
    a, sr = k.create(ln["say"], voice=voice, speed=speed, lang="en-us")
    a = trim(np.asarray(a, dtype=np.float32), sr)
    sf.write(f"{ROOT}/audio/vo/{ln['id']}.wav", a, sr)
    out[ln["id"]] = round(len(a) / sr, 3)
    print(ln["id"], out[ln["id"]], flush=True)

json.dump(out, open(dpath, "w"), indent=1)
print("total speech", round(sum(out.values()), 2))
sys.stdout.flush()
os._exit(0)  # onnxruntime segfaults on interpreter teardown on this Mac; skip it
