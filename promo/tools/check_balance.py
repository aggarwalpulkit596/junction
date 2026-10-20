"""Prints speech-to-music and speech-to-sfx ratios (dB, A-ish weighted RMS) inside each VO line."""
import json, os, numpy as np, soundfile as sf
from scipy import signal
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TL = json.load(open(f"{ROOT}/script/timeline.json"))
st = {k: sf.read(f"{ROOT}/audio/stems/{k}.wav")[0].mean(1) for k in ("vo", "music", "sfx")}
SR = 48000
b, a = signal.butter(2, [300 / 24000, 5000 / 24000], "band")  # speech band
for k in st: st[k] = signal.lfilter(b, a, st[k])
db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
for v in TL["vo"]:
    s, e = int(v["start"] * SR), int((v["start"] + v["dur"]) * SR)
    print(v["id"], "vo-music %5.1f dB" % (db(st["vo"][s:e]) - db(st["music"][s:e])), " vo-sfx %5.1f dB" % (db(st["vo"][s:e]) - db(st["sfx"][s:e])))
