"""Single source of truth for timing (Junction 3D: Saboteur Express trailer).

Reads script/lines.json, audio/vo/durations.json and audio/vo/words.json and writes:
  src/timeline.js        window.TL = {...}  (read by the animation)
  script/timeline.json   same data (read by make_audio.py)
  exports/saboteur-trailer.srt
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.load(open(f"{ROOT}/script/lines.json"))
dur = json.load(open(f"{ROOT}/audio/vo/durations.json"))
words = json.load(open(f"{ROOT}/audio/vo/words.json"))

DURATION = 55.0
BPM = 100.0                      # the driving ostinato (build/tasks and the title): 4 bars = 9.6 s
VO_START = {"L01": 0.9, "L02": 6.2, "L02B": 8.5, "L03": 11.6, "L04": 15.0, "L05": 21.2, "L06": 24.0,
            "L07": 29.6, "L08": 42.6, "L08B": 44.4, "L09": 47.3, "L10": 50.2}
SCENES = [("open", 0.0), ("lineup", 5.6), ("build", 11.2), ("tasks", 14.6), ("sabotage", 20.8), ("sightings", 23.6),
          ("meeting", 28.8), ("eject", 36.0), ("twist", 42.2), ("title", 46.8)]
SC = dict(SCENES)

def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())

def word_at(lid, needle, nth=0, edge="start"):
    hits = [w for w in words[lid] if norm(needle) == norm(w[0])] or [w for w in words[lid] if norm(needle) in norm(w[0])]
    w = hits[nth]
    return round(VO_START[lid] + (w[1] if edge == "start" else w[2]), 3)

def vo_end(lid):
    return round(VO_START[lid] + dur[lid], 3)

B = {}
def beat(name, t):
    B[name] = round(t, 3)

beat("end", DURATION)
# open
beat("rounds", word_at("L01", "twenty"))
beat("conductors", word_at("L01", "robots"))
beat("railway", word_at("L01", "railway"))
beat("india", word_at("L01", "europe"))
# lineup
beat("oneof", word_at("L02", "one"))
beat("them", vo_end("L02"))
beat("saboteur", word_at("L02B", "saboteur"))
beat("saboteurEnd", vo_end("L02B"))
# build + tasks
beat("track", word_at("L03", "rails"))
beat("tickets", word_at("L03", "routes"))
beat("tasks", word_at("L04", "tasks"))
beat("wild", word_at("L04", "locomotives"))
beat("check", word_at("L04", "check"))
beat("alibi", word_at("L04", "alibi"))
# sabotage
beat("fail", word_at("L05", "fail"))
beat("dark", word_at("L06", "dark"))
beat("two", word_at("L06", "two"))
beat("seen", word_at("L06", "seen"))
# meeting
beat("press", SC["meeting"] + 0.25)
beat("emergency", word_at("L07", "emergency"))
beat("vote", word_at("L07", "vote"))
beat("pick", 35.05)                       # the vote lands on Frost
# eject
beat("door", SC["eject"] + 1.1)
beat("thrown", SC["eject"] + 1.7)
beat("innocent", SC["eject"] + 3.6)
beat("stillout", SC["eject"] + 4.6)
# twist
beat("wrong", word_at("L08", "wrong"))
beat("eye", 43.95)
beat("away", word_at("L08B", "away"))
beat("endshot", vo_end("L08B") - 0.7)
# title
beat("smash", SC["title"])
beat("junction", VO_START["L09"])
beat("express", word_at("L09", "express"))
beat("shift", word_at("L10", "quick"))
beat("trust", word_at("L10", "trust"))
beat("trustEnd", vo_end("L10"))

# ---- captions
caps = []
for ln in lines:
    lid = ln["id"]; ws = words[lid]
    wl = [len(norm(w[0])) or 1 for w in ws]; total_w = sum(wl)
    chunks = ln["cap"]; cl = [len(norm(c)) or 1 for c in chunks]; total_c = sum(cl)
    acc_c = 0; wi = 0; acc_w = 0
    for ci, c in enumerate(chunks):
        acc_c += cl[ci]; target = acc_c / total_c * total_w; first = wi
        while wi < len(ws) and (acc_w + wl[wi] / 2 <= target or ci == len(chunks) - 1):
            acc_w += wl[wi]; wi += 1
        last = max(first, wi - 1)
        caps.append({"line": lid, "text": c, "start": round(VO_START[lid] + ws[first][1] - 0.08, 3), "end": round(VO_START[lid] + ws[last][2] + 0.3, 3)})
caps.sort(key=lambda c: c["start"])
for i in range(len(caps) - 1):
    caps[i]["end"] = round(min(caps[i]["end"], caps[i + 1]["start"] - 0.02), 3)
    if caps[i]["end"] - caps[i]["start"] < 0.8:
        caps[i]["end"] = round(min(caps[i]["start"] + 0.8, caps[i + 1]["start"] - 0.02), 3)

# ---- sound design cues (name, time, gain); synthesised by make_audio.py
S = []
def sfx(name, t, gain=1.0):
    S.append({"sfx": name, "t": round(t, 3), "gain": gain})

sfx("rumble", 0.0, 0.7)                          # the night train
sfx("horn", 0.5, 0.35)
for t in (B["rounds"], B["conductors"] - 0.05, B["railway"]):
    sfx("tick", t, 0.5)
sfx("whoosh", SC["lineup"] - 0.35, 0.5)
for i in range(4):
    sfx("clunk", SC["lineup"] + 0.25 + i * 0.32, 0.5)   # carriage lights come on one by one
sfx("flicker", B["them"] + 0.1, 0.55)
sfx("braam", B["saboteur"] - 0.05, 0.6)
sfx("boom", B["saboteur"] - 0.05, 0.6)
sfx("glitch", B["saboteur"] + 0.05, 0.25)
sfx("whoosh", SC["build"] - 0.3, 0.45)
sfx("hit", SC["build"], 0.6)
for i, t in enumerate([B["track"], B["track"] + 0.45, B["tickets"]]):
    sfx("zap", t + 0.05, 0.45)
sfx("whoosh", SC["tasks"] - 0.3, 0.45)
sfx("blip", B["wild"] - 0.2, 0.5)
sfx("confirm", B["wild"] + 0.25, 0.5)
sfx("blip", B["check"], 0.5)
sfx("confirm", B["alibi"] + 0.2, 0.55)
sfx("power_down", SC["sabotage"] - 0.15, 0.8)
sfx("alarm", B["fail"] + 0.5, 0.4)
sfx("boom", B["fail"] + 0.05, 0.55)
sfx("sparks", B["fail"] + 0.1, 0.4)
sfx("glitch", B["fail"] + 0.3, 0.3)
sfx("sparks", B["dark"], 0.25)
sfx("ping", B["two"] + 0.05, 0.35)
sfx("ping", B["two"] + 0.55, 0.35)
sfx("button", B["press"], 0.9)
sfx("alarm", B["press"] + 0.05, 0.45)
sfx("hit", B["press"] + 0.1, 0.6)
sfx("riser", B["pick"] - 2.6, 0.55)
for i in range(3):
    sfx("blip", B["vote"] + 0.6 + i * 0.75, 0.35)
sfx("hit", B["pick"], 1.0)
sfx("boom", B["pick"], 0.8)
sfx("rumble", SC["eject"] - 0.1, 0.8)
sfx("door", B["door"], 0.7)
sfx("whoosh", B["thrown"], 0.7)
sfx("thud", B["thrown"] + 0.75, 0.7)
sfx("type", B["innocent"], 0.5)
sfx("type", B["stillout"], 0.4)
sfx("low", B["innocent"] + 0.05, 0.8)
sfx("eye", B["eye"], 0.75)
sfx("boom", B["eye"] + 0.05, 0.6)
sfx("glitch", B["endshot"], 0.55)
sfx("braam", B["smash"] - 0.03, 1.0)
sfx("boom", B["smash"] - 0.03, 1.0)
sfx("hit", B["express"] + 0.05, 0.6)
sfx("blip", B["shift"] + 0.1, 0.45)
sfx("eye", B["trustEnd"] + 0.6, 0.5)

tl = {"duration": DURATION, "fps": 30, "width": 1080, "height": 1920, "bpm": BPM,
      "vo": [{"id": k, "start": v, "dur": dur[k]} for k, v in VO_START.items()],
      "scenes": [{"name": n, "start": s, "end": (SCENES[i + 1][1] if i + 1 < len(SCENES) else DURATION)} for i, (n, s) in enumerate(SCENES)],
      "beats": B, "captions": caps, "sfx": S,
      "words": {k: [[w[0], round(VO_START[k] + w[1], 3), round(VO_START[k] + w[2], 3)] for w in v] for k, v in words.items()}}

vo = sorted(tl["vo"], key=lambda v: v["start"])
for a, b in zip(vo, vo[1:]):
    assert a["start"] + a["dur"] < b["start"], (a, b)
assert vo[-1]["start"] + vo[-1]["dur"] < DURATION - 1.5

json.dump(tl, open(f"{ROOT}/script/timeline.json", "w"), indent=1)
open(f"{ROOT}/src/timeline.js", "w").write("// Generated by tools/build_timeline.py — do not hand-edit.\nwindow.TL = " + json.dumps(tl, indent=1) + ";\n")
def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
os.makedirs(f"{ROOT}/exports", exist_ok=True)
with open(f"{ROOT}/exports/saboteur-trailer.srt", "w") as f:
    for i, c in enumerate(caps, 1):
        f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
print(json.dumps(B))
for c in caps:
    print(f"{c['start']:6.2f}-{c['end']:6.2f} {c['text']}")
