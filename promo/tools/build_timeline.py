"""Single source of truth for timing.

Reads script/lines.json, audio/vo/durations.json and audio/vo/words.json and writes:
  src/timeline.js        window.TL = {...}  (read by the animation)
  script/timeline.json   same data (read by make_audio.py)
  exports/junction-promo.srt

Edit VO_START / SCENES / the beat table below to retime the film; then rerun
make_audio.py and re-render.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lines = json.load(open(f"{ROOT}/script/lines.json"))
dur = json.load(open(f"{ROOT}/audio/vo/durations.json"))
words = json.load(open(f"{ROOT}/audio/vo/words.json"))

BAR = 6.4 / 3                      # the title drop (the paper map slams down) lands on bar 3
BPM = 4 * 60 / BAR                 # 112.5
END = round(20 * BAR, 3)           # end card on bar 20
DURATION = 52.0
VO_START = {"L01": 0.7, "L02": 6.85, "L03": 11.85, "L04": 15.6, "L05": 18.55, "L06": 24.78,
            "L07": 31.0, "L08": 35.85, "L09": END + 0.5, "L10": END + 2.25}
SCENES = [("hook", 0.0), ("title", 6.4), ("cards", 11.6), ("claim", 15.35), ("tunnel", 20.45),
          ("rivals", 24.4), ("postcards", 30.8), ("score", 35.6), ("end", END)]
SC = dict(SCENES)

def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())

def word_at(lid, needle, nth=0, edge="start"):
    hits = [w for w in words[lid] if norm(needle) == norm(w[0])] or [w for w in words[lid] if norm(needle) in norm(w[0])]
    w = hits[nth]
    return round(VO_START[lid] + (w[1] if edge == "start" else w[2]), 3)

B = {}
def beat(name, t):
    B[name] = round(t, 3)

beat("drop", SC["title"])
beat("end", DURATION)
# hook
beat("edinburgh", word_at("L01", "edinburgh"))
beat("athens", word_at("L01", "athens"))
beat("twenty", word_at("L01", "20"))
beat("robots", word_at("L01", "robots"))
beat("racing", word_at("L01", "racing"))
beat("track", word_at("L01", "track"))
# title
beat("junction", word_at("L02", "junction"))
beat("europe", word_at("L02", "europe"))
beat("rail", word_at("L02", "rail"))
beat("cities", word_at("L02", "28"))
# cards
beat("draw", word_at("L03", "draw"))
beat("two", word_at("L03", "two"))
beat("turn", word_at("L03", "turn"))
beat("loco", word_at("L03", "locomotives"))
beat("wild", word_at("L03", "wild"))
# claim + ferry
beat("match", word_at("L04", "match"))
beat("colour", word_at("L04", "color"))
beat("yours", word_at("L04", "yours"))
beat("ferries", word_at("L05", "ferries"))
beat("ferryloco", word_at("L05", "locomotive"))
# tunnel
beat("tunnels", word_at("L05", "tunnels"))
beat("flip", word_at("L05", "flip"))
beat("match2", word_at("L05", "match"))
beat("more", word_at("L05", "more"))
# rivals
beat("rose", word_at("L06", "rose"))
beat("sandy", word_at("L06", "sandy"))
beat("mint", word_at("L06", "mint"))
beat("routes", word_at("L06", "routes"))
beat("blocked", word_at("L06", "blocked"))
beat("station", word_at("L06", "station"))
beat("borrow", word_at("L06", "borrow"))
# postcards
beat("city", word_at("L07", "city"))
beat("postcard", word_at("L07", "postcard"))
beat("connect", word_at("L07", "connect"))
beat("stamped", word_at("L07", "stamped"))
# score
beat("tickets", word_at("L08", "tickets"))
beat("longest", word_at("L08", "longest"))
beat("take", word_at("L08", "take"))
beat("continent", word_at("L08", "continent"))
beat("win", word_at("L08", "continent", edge="end") + 0.25)
# end
beat("junction2", VO_START["L09"])
beat("europe2", word_at("L09", "europe"))
beat("quick", word_at("L10", "quick"))
beat("minutes", word_at("L10", "minutes"))
beat("browser", word_at("L10", "browser"))

# ---- captions: split each line's word timings across its caption chunks by letter count
caps = []
for ln in lines:
    lid = ln["id"]; ws = words[lid]
    wl = [len(norm(w[0])) or 1 for w in ws]
    total_w = sum(wl)
    chunks = ln["cap"]
    cl = [len(norm(c)) or 1 for c in chunks]
    total_c = sum(cl)
    acc_c = 0; wi = 0; acc_w = 0
    for ci, c in enumerate(chunks):
        acc_c += cl[ci]
        target = acc_c / total_c * total_w
        first = wi
        while wi < len(ws) and (acc_w + wl[wi] / 2 <= target or ci == len(chunks) - 1):
            acc_w += wl[wi]; wi += 1
        last = max(first, wi - 1)
        s = VO_START[lid] + ws[first][1] - 0.08
        e = VO_START[lid] + ws[last][2] + 0.3
        caps.append({"line": lid, "text": c, "start": round(s, 3), "end": round(e, 3)})
for i in range(len(caps) - 1):
    caps[i]["end"] = round(min(caps[i]["end"], caps[i + 1]["start"] - 0.02), 3)
    if caps[i]["end"] - caps[i]["start"] < 0.8:
        caps[i]["end"] = round(min(caps[i]["start"] + 0.8, caps[i + 1]["start"] - 0.02), 3)

# ---- sound design cues (name, time, gain). Files are synthesised by make_audio.py.
S = []
def sfx(name, t, gain=1.0):
    S.append({"sfx": name, "t": round(t, 3), "gain": gain})

# hook: the ticket slides in and gets punched; twenty little cars clatter into a row; three robots pop up
sfx("slide", 0.15, 0.6)
sfx("punch", B["edinburgh"] + 0.35, 0.7)
sfx("pencil", B["athens"] - 0.1, 0.5)
for i in range(10):
    sfx("clack", B["twenty"] - 0.1 + i * 0.06, 0.35 + 0.02 * (i % 3))
for i in range(3):
    sfx("boing", B["robots"] + 0.05 + i * 0.16, 0.42)
sfx("whoosh", SC["title"] - 0.45, 0.5)
# title: map pieces slam down on the drop, a whistle, the city pins ripple in
sfx("whistle", B["drop"] - 0.05, 0.55)
for i in range(5):
    sfx("snap", B["drop"] + i * 0.09, 0.7)
sfx("stamp", B["junction"] + 0.05, 0.55)
sfx("sparkle", B["europe"] + 0.1, 0.4)
for i in range(7):
    sfx("tick", B["cities"] - 0.3 + i * 0.07, 0.4)
# scene changes
for name in ("cards", "claim", "tunnel", "rivals", "postcards", "score"):
    sfx("whoosh", SC[name] - 0.36, 0.42)
sfx("whoosh", SC["end"] - 0.4, 0.5)
# cards
sfx("deal", SC["cards"] + 0.15, 0.55)
sfx("deal", B["two"] + 0.05, 0.7)
sfx("deal", B["turn"] + 0.05, 0.7)
sfx("flip", B["loco"] - 0.1, 0.7)
sfx("sparkle", B["wild"], 0.5)
# claim: four white cards drop onto London–Edinburgh, cars clack into place
for i in range(4):
    sfx("clack", B["colour"] + 0.2 + i * 0.13, 0.42)
sfx("ding", B["yours"] + 0.05, 0.38)
sfx("horn", B["ferries"] + 0.1, 0.45)
sfx("tag", B["ferryloco"] + 0.1, 0.6)
sfx("clack", B["ferryloco"] + 0.45, 0.6); sfx("clack", B["ferryloco"] + 0.58, 0.6)
# tunnel: three cards flip, one matches
for i in range(3):
    sfx("flip", B["flip"] + 0.05 + i * 0.22, 0.65)
sfx("scribble", B["match2"] + 0.05, 0.55)
sfx("tag", B["more"], 0.6)
# rivals
sfx("pop", B["rose"] + 0.3, 0.5); sfx("pop", B["sandy"] + 0.25, 0.5); sfx("pop", B["mint"] + 0.3, 0.5)
for b, n in (("rose", 2), ("sandy", 3), ("mint", 4)):
    for i in range(n):
        sfx("clack", B[b] + 0.3 + i * 0.07, 0.45)
sfx("buzz", B["blocked"] - 0.05, 0.55)
sfx("stamp", B["station"] + 0.1, 0.7)
sfx("pencil", B["borrow"] + 0.05, 0.6)
# postcards
for i in range(4):
    sfx("rustle", B["city"] - 0.25 + i * 0.3, 0.45)
sfx("stamp", B["stamped"] + 0.02, 0.85)
sfx("stamp", B["stamped"] + 0.3, 0.5)
# score
sfx("check", B["tickets"] + 0.3, 0.7)
sfx("pencil", B["longest"], 0.5)
sfx("tag", B["longest"] + 0.55, 0.55)
sfx("fill", B["take"] - 0.2, 0.45)
sfx("whistle", B["win"] - 0.1, 0.5)
sfx("sparkle", B["win"] + 0.1, 0.55)
# end
sfx("snap", B["junction2"] - 0.2, 0.6)
sfx("sparkle", B["europe2"] + 0.15, 0.5)
sfx("tag", B["quick"] + 0.05, 0.55)
for i in range(4):
    sfx("boing", B["browser"] + 0.75 + i * 0.1, 0.3)

tl = {"duration": DURATION, "fps": 30, "width": 1080, "height": 1920, "bpm": round(BPM, 4),
      "vo": [{"id": k, "start": v, "dur": dur[k]} for k, v in VO_START.items()],
      "scenes": [{"name": n, "start": s, "end": (SCENES[i + 1][1] if i + 1 < len(SCENES) else DURATION)}
                 for i, (n, s) in enumerate(SCENES)],
      "beats": B, "captions": caps, "sfx": S,
      "words": {k: [[w[0], round(VO_START[k] + w[1], 3), round(VO_START[k] + w[2], 3)] for w in v] for k, v in words.items()}}

vo = sorted(tl["vo"], key=lambda v: v["start"])
for a, b in zip(vo, vo[1:]):
    assert a["start"] + a["dur"] < b["start"], (a, b)
assert vo[-1]["start"] + vo[-1]["dur"] < DURATION - 2

json.dump(tl, open(f"{ROOT}/script/timeline.json", "w"), indent=1)
open(f"{ROOT}/src/timeline.js", "w").write("// Generated by tools/build_timeline.py — do not hand-edit.\nwindow.TL = " + json.dumps(tl, indent=1) + ";\n")

def ts(t):
    ms = int(round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
os.makedirs(f"{ROOT}/exports", exist_ok=True)
with open(f"{ROOT}/exports/junction-promo.srt", "w") as f:
    for i, c in enumerate(caps, 1):
        f.write(f"{i}\n{ts(c['start'])} --> {ts(c['end'])}\n{c['text']}\n\n")
print(json.dumps(B))
for c in caps:
    print(f"{c['start']:6.2f}-{c['end']:6.2f} {c['text']}")
