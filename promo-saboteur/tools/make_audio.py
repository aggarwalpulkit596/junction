"""Original trailer score + sound design + mix for Junction: Saboteur Express. Everything is synthesised
here from oscillators and noise; no samples, no third-party audio.

Usage: .venv/bin/python tools/make_audio.py
Reads  script/timeline.json, audio/vo/Lxx.wav
Writes audio/sfx/*.wav (one-shots), audio/stems/{vo,music,sfx}.wav, audio/stems/mix_premaster.wav
Mastering (loudnorm) is done by tools/master.sh with ffmpeg.
"""
import json, os
import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
TL = json.load(open(f"{ROOT}/script/timeline.json"))
DUR = TL["duration"]
N = int(DUR * SR)
BAR = 4 * 60 / TL["bpm"]
BEAT = BAR / 4
rng = np.random.default_rng(7)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def note_num(name):
    names = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n = names[name[0]]; rest = name[1:]
    if rest.startswith("#"): n += 1; rest = rest[1:]
    if rest.startswith("b"): n -= 1; rest = rest[1:]
    return n + 12 * (int(rest) + 1)


def env_ad(n, a, d_tau, sr=SR):
    t = np.arange(n) / sr
    e = np.exp(-t / d_tau)
    ai = int(a * sr)
    if ai > 0:
        e[:ai] *= np.linspace(0, 1, ai)
    return e


def lp(x, fc, order=2):
    b, a = signal.butter(order, min(fc / (SR / 2), 0.99), "low")
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), min(hi / (SR / 2), 0.99)], "band")
    return signal.lfilter(b, a, x)


def noise(n):
    return rng.standard_normal(n)


# ----------------------------------------------------------------- instruments
def pluck(f, dur=0.9, bright=0.6, decay=0.996):
    """Karplus-Strong via lfilter (fast)."""
    n = int(dur * SR)
    P = max(2, int(SR / f))
    exc = noise(P) * np.hanning(P) ** 0.3
    exc = lp(exc, 800 + 7000 * bright)
    x = np.zeros(n); x[:P] = exc
    a = np.zeros(P + 2); a[0] = 1; a[P] = -decay / 2; a[P + 1] = -decay / 2
    y = signal.lfilter([1], a, x)
    y *= env_ad(n, 0.002, dur * 0.5)
    return y / (np.max(np.abs(y)) + 1e-9)


def glock(f, dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR
    y = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
         + 0.35 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.18)
         + 0.15 * np.sin(2 * np.pi * f * 5.40 * t) * np.exp(-t / 0.07))
    y[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return y


def keys(f, dur=1.6):
    """Soft felt-piano-ish tone."""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for h, (amp, tau) in enumerate([(1, 0.9), (0.45, 0.5), (0.2, 0.3), (0.1, 0.2), (0.05, 0.12)], 1):
        y += amp * np.sin(2 * np.pi * f * h * t * (1 + 0.0004 * h)) * np.exp(-t / tau)
    y *= env_ad(n, 0.006, 10)
    return lp(y, 2600)


def bass(f, dur=0.5):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)
    y = np.tanh(1.6 * y) * env_ad(n, 0.004, dur * 0.45)
    rel = int(0.03 * SR); y[-rel:] *= np.linspace(1, 0, rel)
    return lp(y, 900)


def kick():
    n = int(0.32 * SR); t = np.arange(n) / SR
    f = 45 + 85 * np.exp(-t / 0.035)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.11)
    y[:200] += noise(200) * 0.15
    return y


def snap():
    n = int(0.18 * SR)
    y = bp(noise(n), 1200, 4500) * env_ad(n, 0.0008, 0.03)
    y += 0.4 * bp(noise(n), 600, 1500) * env_ad(n, 0.001, 0.05)
    return y


def shaker():
    n = int(0.09 * SR)
    return hp(noise(n), 6000) * env_ad(n, 0.012, 0.025)


def woodblock(f=1400):
    n = int(0.12 * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.4 * t)) * np.exp(-t / 0.025)


def pad(freqs, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.12):
            ph = rng.uniform(0, 2 * np.pi)
            y += signal.sawtooth(2 * np.pi * f * (1 + det / 100) * t + ph)
    y = lp(y, 1100)
    a = int(0.35 * SR); r = int(0.5 * SR)
    e = np.ones(n); e[:a] = np.linspace(0, 1, a); e[-r:] = np.linspace(1, 0, r)
    return y * e / len(freqs)


def reverb_ir(seconds=1.8, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR); t = np.arange(n) / SR
    ir = np.stack([r.standard_normal(n), r.standard_normal(n)], 1) * np.exp(-t / (seconds / 6.5))[:, None]
    ir[:, 0] = lp(ir[:, 0], 6000); ir[:, 1] = lp(ir[:, 1], 6000)
    return ir / np.sqrt(np.sum(ir ** 2, 0))


IR = reverb_ir()


def add(buf, x, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= len(buf) or i + len(x) <= 0:
        return
    if i < 0:
        x = x[-i:]; i = 0
    x = x[: len(buf) - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414
    buf[i:i + len(x), 1] += x * gain * r * 1.414


def wet(buf, amount):
    out = buf.copy()
    for c in range(2):
        out[:, c] += amount * signal.fftconvolve(buf[:, c], IR[:, c])[: len(buf)]
    return out


# ----------------------------------------------------------------- score
def chord_notes(name, octave=3):
    root = note_num(name.rstrip("m") + str(octave)); minor = name.endswith("m")
    return [root, root + (3 if minor else 4), root + 7]


def saw_stack(f, dur, det=(-0.08, 0, 0.08), fc=900, a=0.3, r=0.6):
    """detuned saws through a low-pass: strings / brass pads"""
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n)
    for d in det:
        y += signal.sawtooth(2 * np.pi * f * (1 + d / 100) * t + rng.uniform(0, 6.28))
    y = lp(y, fc) / len(det)
    e = np.ones(n); ai = int(a * SR); ri = int(min(r, dur * 0.5) * SR)
    e[:ai] = np.linspace(0, 1, ai) ** 2; e[-ri:] *= np.linspace(1, 0, ri)
    return y * e


def stacc(f, dur=0.16):
    """a short staccato string note"""
    n = int(dur * SR); t = np.arange(n) / SR
    y = sum(signal.sawtooth(2 * np.pi * f * (1 + d / 100) * t) for d in (-0.1, 0.1)) / 2
    return lp(y, 1800) * env_ad(n, 0.004, dur * 0.35)


def drone(f, dur):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2 * t + 0.3) + 0.25 * lp(signal.sawtooth(2 * np.pi * f * 1.001 * t), 300)
    y *= 1 + 0.15 * np.sin(2 * np.pi * 0.25 * t)
    return y


def tremolo(f, dur, rate=11):
    n = int(dur * SR); t = np.arange(n) / SR
    return saw_stack(f, dur, fc=3200, a=dur * 0.6, r=0.4) * (0.6 + 0.4 * np.abs(np.sin(np.pi * rate * t)))


def heartbeat():
    n = int(0.5 * SR); t = np.arange(n) / SR
    thump = lambda d: np.sin(2 * np.pi * (48 + 40 * np.exp(-np.maximum(t - d, 0) / 0.02)) * (t - d)) * np.exp(-np.maximum(t - d, 0) / 0.07) * (t >= d)
    return thump(0) + 0.7 * thump(0.22)


def tom(f=90):
    n = int(0.5 * SR); t = np.arange(n) / SR; ff = f * (1 + 0.6 * np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / 0.18) + 0.2 * bp(noise(n), 200, 2000) * np.exp(-t / 0.02)


def music():
    dry = np.zeros((N + SR * 4, 2)); drums = np.zeros_like(dry)
    B = TL["beats"]; SC = {s["name"]: s["start"] for s in TL["scenes"]}; SE = {s["name"]: s["end"] for s in TL["scenes"]}
    D1, D2, D3 = midi(note_num("D1")), midi(note_num("D2")), midi(note_num("D3"))

    # --- open + lineup: drone, muffled train rhythm, clock, a lonely piano motif
    add(dry, drone(D2 / 2, SC["build"]) * np.r_[np.linspace(0, 1, int(1.5 * SR)), np.ones(int(SC["build"] * SR) - int(1.5 * SR))], 0, 0.10)
    for i in range(int(B["saboteur"] / (BEAT / 2))):
        tt = i * BEAT / 2
        if tt > B["saboteur"] - 0.35: break
        add(drums, lp(shaker(), 1800) * (1.4 if i % 2 == 0 else 0.8), tt, 0.07 * min(1, tt / 3))
        if i % 2 == 0: add(drums, woodblock(1300), tt, 0.035)
    for nn, tt in [("D5", 0.9), ("F5", 2.2), ("E5", 3.5), ("A4", 4.4)]:
        add(dry, keys(midi(note_num(nn)), 2.6), tt, 0.045, pan=0.2)
    add(dry, tremolo(midi(note_num("A4")), B["saboteur"] - SC["lineup"]) + tremolo(midi(note_num("D5")), B["saboteur"] - SC["lineup"]), SC["lineup"], 0.05)
    for i in range(6):  # heartbeat as the lights die
        add(drums, heartbeat(), B["them"] + 0.1 + i * 0.86, 0.5)
    # after the reveal: low dissonant cluster
    for nn in ("D2", "D#2", "A2"):
        add(dry, saw_stack(midi(note_num(nn)), SC["build"] - B["saboteur"] + 0.3, fc=500, a=0.05, r=0.8), B["saboteur"], 0.09)

    # --- build + tasks: the ostinato, 4 bars at 100 BPM, Dm – Bb – Gm – A
    prog = ["Dm", "A#", "Gm", "A"]
    def ostinato(t0, bars, level=1.0, final_hit=True):
        for bar in range(bars):
            ch = prog[bar % 4]; ns = chord_notes(ch, 2)
            pat = [ns[0], ns[0], ns[2], ns[0], ns[1] + 12, ns[0], ns[2], ns[0]] * 2
            for i, nn in enumerate(pat):
                tt = t0 + bar * BAR + i * BEAT / 4
                add(dry, stacc(midi(nn)), tt, 0.13 * level * (1.25 if i % 4 == 0 else 1), pan=-0.25 if i % 2 else 0.25)
            for b in range(4):
                add(drums, kick(), t0 + bar * BAR + b * BEAT, 0.42 * level if b in (0, 2) else 0.0)
                if b in (1, 3): add(drums, snap(), t0 + bar * BAR + b * BEAT, 0.16 * level, pan=0.1)
            for s16 in range(16):
                add(drums, shaker(), t0 + bar * BAR + s16 * BEAT / 4, (0.05 if s16 % 4 == 0 else 0.025) * level, pan=0.4)
            add(dry, bass(midi(ns[0] - 12), BAR * 0.95), t0 + bar * BAR, 0.32 * level)
            add(dry, saw_stack(midi(ns[0] + 12), BAR + 0.2, fc=1400, a=0.4, r=0.4) + saw_stack(midi(ns[2] + 12), BAR + 0.2, fc=1400, a=0.4, r=0.4), t0 + bar * BAR, 0.035 * level * (1 + bar * 0.25))
            if bar >= 2:
                for k, nn in enumerate(["D6", "F6", "E6", "A5"]):
                    add(dry, glock(midi(note_num(nn))), t0 + bar * BAR + k * BEAT, 0.045 * level, pan=0.35)
        for i in range(6):  # tom fill into what comes next
            add(drums, tom(80 + 25 * (5 - i)), t0 + bars * BAR - 0.75 + i * 0.125, 0.22 * level)
    ostinato(SC["build"], 4)

    # --- sabotage: cut to silence, then distorted pulses under the alarm
    blk = B["fail"]
    for i in range(int((SC["sightings"] - blk) / (BEAT / 2)) + 1):
        add(dry, np.tanh(3 * bass(D1 * 2, BEAT * 0.4)), blk + i * BEAT / 2, 0.30, pan=0)
    add(dry, saw_stack(midi(note_num("A5")), SC["meeting"] - SC["sightings"], fc=4000, a=3, r=0.6) + saw_stack(midi(note_num("A#5")), SC["meeting"] - SC["sightings"], fc=4000, a=3, r=0.6), SC["sightings"], 0.03)
    for i in range(int((SC["meeting"] - SC["sightings"]) / BEAT)):
        add(dry, np.tanh(2 * bass(D1 * 2, BEAT * 0.5)), SC["sightings"] + i * BEAT, 0.20)
        add(drums, woodblock(1600), SC["sightings"] + i * BEAT + BEAT / 2, 0.04)

    # --- meeting: low stabs, then a heartbeat that speeds up toward the vote
    for i in range(3):
        add(dry, saw_stack(D2, 0.9, fc=700, a=0.01, r=0.6) + saw_stack(midi(note_num("A2")), 0.9, fc=700, a=0.01, r=0.6), B["press"] + 0.1 + i * BAR * 0.5, 0.12)
    tt = B["vote"] - 0.3; gap = 0.82
    while tt < B["pick"] - 0.2:
        add(drums, heartbeat(), tt, 0.55); tt += gap; gap = max(0.38, gap * 0.9)
    for nn in ("D5", "D#5", "A5"):
        add(dry, saw_stack(midi(note_num(nn)), B["pick"] - B["vote"], fc=5000, a=B["pick"] - B["vote"] - 0.3, r=0.05), B["vote"], 0.03)

    # --- eject: a sad, slow piano over the receding train
    for nn, tt in [("A4", B["thrown"] + 0.9), ("F4", B["thrown"] + 1.7), ("D4", B["innocent"] - 0.05), ("A#3", B["stillout"] + 0.2), ("A3", B["stillout"] + 1.1)]:
        add(dry, keys(midi(note_num(nn)), 3.2), tt, 0.12, pan=-0.1)
        add(dry, keys(midi(note_num(nn)) / 2, 3.2), tt, 0.05)
    add(dry, saw_stack(midi(note_num("D3")), 3.0, fc=600, a=1.2, r=1.2), B["innocent"], 0.06)

    # --- twist: sub drone + an eerie music-box line
    add(dry, drone(D1, SC["title"] - SC["twist"]), SC["twist"], 0.18)
    for k, nn in enumerate(["D6", "F6", "E6", "C#6", "D6"]):
        add(dry, glock(midi(note_num(nn)) * 1.003, 1.6), B["eye"] + 0.2 + k * 0.42, 0.06, pan=0.3)

    # --- title: the ostinato returns, then the last hit rings out
    t0 = SC["title"]; bars = int(round((B["trustEnd"] - t0) / BAR))
    ostinato(t0, bars, level=1.1)
    endt = t0 + bars * BAR
    for nn in ("D2", "A2", "D3", "F3"):
        add(dry, saw_stack(midi(note_num(nn)), 3.5, fc=900, a=0.02, r=2.5), endt, 0.08)
    add(dry, bass(D1 * 2, 2.5) * 1.3, endt, 0.4)
    add(drums, kick(), endt, 0.6)

    mix = wet(dry, 0.28) + wet(drums, 0.08)
    mix = mix[:N]
    # hard silences: the power cut before "fail", and the beat before the meeting button
    env = np.ones(N); t = np.arange(N) / SR
    for a0, a1 in [(SC["sabotage"], blk), (SC["meeting"], B["press"] + 0.02), (B["saboteur"] - 0.3, B["saboteur"] - 0.02)]:
        m = (t > a0) & (t < a1); env[m] = 0.08
    env = lp(env, 40, 1)
    mix *= env[:, None]
    fade = int(1.5 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
    return mix


# ----------------------------------------------------------------- sound effects
def sweep_bp(x, f0, f1, q=2.0, steps=64):
    out = np.zeros_like(x); seg = len(x) // steps + 1
    zi = None
    for s in range(steps):
        f = f0 * (f1 / f0) ** (s / max(1, steps - 1))
        b, a = signal.butter(2, [max(20, f / (1 + 1 / q)) / (SR / 2), min(f * (1 + 1 / q), SR / 2 - 100) / (SR / 2)], "band")
        if zi is None:
            zi = signal.lfilter_zi(b, a) * 0
        part = x[s * seg:(s + 1) * seg]
        y, zi = signal.lfilter(b, a, part, zi=zi)
        out[s * seg:s * seg + len(y)] = y
    return out


def sfx_lib():
    L = {}
    n = lambda s: int(s * SR)
    t_ = lambda s: np.arange(n(s)) / SR

    t = t_(0.16); f = 300 + 700 * np.exp(-t / 0.025)
    L["pop"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045) + 0.2 * bp(noise(len(t)), 2000, 6000) * np.exp(-t / 0.006)

    x = bp(noise(n(0.6)), 1500, 7000)
    crackle = (rng.random(n(0.6)) < 0.004).astype(float); crackle = lp(crackle, 3000) * 30
    L["rustle"] = x * np.abs(lp(noise(n(0.6)), 18)) * 6 * np.hanning(n(0.6)) + 0.3 * bp(noise(n(0.6)), 2000, 8000) * crackle

    tt = t_(0.9)
    L["flutter"] = bp(noise(n(0.9)), 800, 5000) * (0.5 + 0.5 * np.sin(2 * np.pi * 13 * tt)) ** 2 * np.hanning(n(0.9))

    L["whoosh"] = sweep_bp(noise(n(0.55)), 400, 3500, 1.5) * np.hanning(n(0.55)) ** 1.5 * 2.5

    tt = t_(0.5); f = 220 * (1 + 0.25 * np.sin(2 * np.pi * 14 * tt) * np.exp(-tt / 0.2)) * (1 + 0.6 * np.exp(-tt / 0.05))
    L["boing"] = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.18)

    tt = t_(0.7)
    strokes = np.abs(np.sin(2 * np.pi * 7.5 * tt)) ** 0.6
    L["scribble"] = bp(noise(n(0.7)), 1800, 7000) * strokes * np.hanning(n(0.7)) ** 0.4 * 1.4

    tt = t_(0.7); f = 50 + 90 * np.exp(-tt / 0.03)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.15)
    slap = bp(noise(n(0.7)), 300, 4000) * np.exp(-tt / 0.02)
    L["stamp"] = np.tanh(1.8 * (thump + 0.8 * slap))

    tt = t_(1.1)
    rz = sweep_bp(noise(n(1.1)), 300, 6000, 3) * (tt / 1.1) ** 2.2 * 2
    fr = 200 * 2 ** (3 * tt / 1.1)
    L["riser"] = rz + 0.25 * np.sin(2 * np.pi * np.cumsum(fr) / SR) * (tt / 1.1) ** 2

    tt = t_(0.12)
    L["snap"] = bp(noise(n(0.12)), 2000, 9000) * np.exp(-tt / 0.008) + 0.5 * np.sin(2 * np.pi * 1800 * tt) * np.exp(-tt / 0.01)

    sp = np.zeros(n(1.0))
    for i, fq in enumerate([2093, 2637, 3136, 4186, 3520]):
        g = glock(fq, 0.6) * 0.5; s = int(i * 0.06 * SR); sp[s:s + len(g)] += g[: len(sp) - s]
    L["sparkle"] = sp

    tt = t_(0.18)
    L["tag"] = 0.6 * pluck(520, 0.18, 0.8, 0.98) + 0.4 * bp(noise(n(0.18)), 1500, 5000) * np.exp(-tt / 0.01)

    tt = t_(0.05)
    L["tick"] = bp(noise(n(0.05)), 2500, 8000) * np.exp(-tt / 0.004) + 0.3 * np.sin(2 * np.pi * 3000 * tt) * np.exp(-tt / 0.005)

    L["slide"] = lp(noise(n(0.45)), 2500) * np.hanning(n(0.45)) * 1.2

    tt = t_(1.4)
    L["ding"] = (np.sin(2 * np.pi * 1318.5 * tt) * np.exp(-tt / 0.5) + 0.6 * np.sin(2 * np.pi * 1975.5 * tt) * np.exp(-tt / 0.35)
                 + 0.2 * np.sin(2 * np.pi * 3951 * tt) * np.exp(-tt / 0.1))

    tt = t_(0.5)
    L["coin"] = sum(a * np.sin(2 * np.pi * fq * tt) * np.exp(-tt / d) for fq, a, d in
                    [(2400, 1, 0.12), (3810, 0.6, 0.08), (5230, 0.4, 0.05), (6900, 0.2, 0.03)])

    tt = t_(1.0); fr = 300 * 2 ** (1.6 * tt)
    L["fill"] = (0.5 * np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.5 * bp(noise(n(1.0)), 2000, 6000) * np.abs(np.sin(2 * np.pi * 9 * tt))) * np.hanning(n(1.0))

    tt = t_(0.4)
    L["pencil"] = bp(noise(n(0.4)), 2500, 8000) * np.abs(np.sin(2 * np.pi * 5 * tt)) * np.hanning(n(0.4))

    tt = t_(0.25)
    click = lambda d: bp(noise(n(0.25)), 1500, 9000) * np.exp(-np.maximum(tt - d, 0) / 0.006) * (tt >= d)
    L["lock"] = click(0) + 1.2 * click(0.07) + 0.6 * np.sin(2 * np.pi * 900 * tt) * np.exp(-np.maximum(tt - 0.07, 0) / 0.03) * (tt >= 0.07)

    tt = t_(0.2)
    L["check"] = sweep_bp(noise(n(0.2)), 2000, 6000, 2) * np.hanning(n(0.2)) * 1.5 + 0.3 * pluck(880, 0.2, 0.9, 0.98)


    # ---- Junction-specific
    tt = t_(1.1)  # steam whistle: three pipes, breathy, with a little pitch scoop
    sc = 1 - 0.04 * np.exp(-tt / 0.06)
    wh = sum(a * np.sin(2 * np.pi * np.cumsum(np.full(len(tt), fq) * sc * (1 + 0.004 * np.sin(2 * np.pi * 6 * tt))) / SR) for fq, a in [(587, 1), (740, 0.8), (880, 0.6)])
    wh = wh + 0.35 * bp(noise(len(tt)), 600, 2500)
    e = np.minimum(1, tt / 0.07) * np.where(tt > 0.75, np.exp(-(tt - 0.75) / 0.09), 1)
    L["whistle"] = lp(wh, 3500) * e

    tt = t_(0.9)  # ferry horn: low, two voices
    hn = sum(signal.sawtooth(2 * np.pi * fq * tt) for fq in (155, 196))
    L["horn"] = lp(hn, 700) * np.minimum(1, tt / 0.05) * np.where(tt > 0.6, np.exp(-(tt - 0.6) / 0.08), 1)

    tt = t_(0.25)  # ticket punch: click + thunk
    L["punch"] = bp(noise(n(0.25)), 2000, 8000) * np.exp(-tt / 0.004) + 0.8 * np.sin(2 * np.pi * (180 + 300 * np.exp(-tt / 0.01)) * tt) * np.exp(-tt / 0.04)

    tt = t_(0.18)  # rail clack: two woody knocks
    k1 = (np.sin(2 * np.pi * 950 * tt) + 0.6 * bp(noise(len(tt)), 800, 3000)) * np.exp(-tt / 0.012)
    L["clack"] = k1 + 0.7 * np.roll(k1, int(0.055 * SR)) * (tt > 0.055)

    tt = t_(0.16)  # card deal: a swish ending in a tap
    L["deal"] = sweep_bp(noise(n(0.16)), 5000, 1500, 2) * np.hanning(n(0.16)) * 1.3 + 0.5 * bp(noise(n(0.16)), 1500, 5000) * np.exp(-np.maximum(tt - 0.12, 0) / 0.005) * (tt > 0.12)

    tt = t_(0.12)  # card flip
    L["flip"] = bp(noise(n(0.12)), 1500, 7000) * np.exp(-tt / 0.018) + 0.4 * sweep_bp(noise(n(0.12)), 800, 4000, 2) * np.hanning(n(0.12))

    tt = t_(0.38)  # comedy "nope" buzzer
    L["buzz"] = lp(signal.square(2 * np.pi * 110 * tt) + signal.square(2 * np.pi * 116.5 * tt), 1400) * np.minimum(1, tt / 0.01) * np.where(tt > 0.3, np.exp(-(tt - 0.3) / 0.02), 1)


    # ---- trailer kit
    tt = t_(2.4)  # brass-like braam: detuned saws, filter opening, saturation
    br = sum(signal.sawtooth(2 * np.pi * f * tt * (1 + d)) for f in (36.7, 73.4, 110, 146.8) for d in (-0.004, 0.004))
    fc = 200 + 1600 * np.exp(-tt / 0.6)
    out = np.zeros_like(br); seg = len(br) // 48 + 1
    for k in range(48):
        bb, aa = signal.butter(2, min(0.99, fc[min(k * seg, len(fc) - 1)] / (SR / 2)), "low"); part = br[k * seg:(k + 1) * seg]; out[k * seg:k * seg + len(part)] = signal.lfilter(bb, aa, part)
    L["braam"] = np.tanh(1.6 * out / 4) * np.minimum(1, tt / 0.03) * np.exp(-np.maximum(tt - 0.5, 0) / 0.9)
    tt = t_(2.0); L["boom"] = np.sin(2 * np.pi * np.cumsum(30 + 70 * np.exp(-tt / 0.12)) / SR) * np.exp(-tt / 0.7) + 0.3 * lp(noise(len(tt)), 400) * np.exp(-tt / 0.2)
    tt = t_(0.9); L["hit"] = np.tanh(2 * (np.sin(2 * np.pi * np.cumsum(45 + 90 * np.exp(-tt / 0.05)) / SR) * np.exp(-tt / 0.3) + 0.8 * bp(noise(len(tt)), 300, 6000) * np.exp(-tt / 0.06)))
    tt = t_(3.0); L["rumble"] = lp(noise(len(tt)), 160) * 4 * (0.8 + 0.2 * np.sin(2 * np.pi * 1.6 * tt)) * np.minimum(1, tt / 0.4) * np.minimum(1, (3 - tt) / 0.8) + 0.5 * bp(noise(len(tt)), 900, 3000) * (np.sin(2 * np.pi * 3.33 * tt) > 0.92)
    tt = t_(0.35); L["clunk"] = bp(noise(len(tt)), 400, 2500) * np.exp(-tt / 0.02) + 0.6 * np.sin(2 * np.pi * 140 * tt) * np.exp(-tt / 0.08)
    tt = t_(0.7); L["flicker"] = bp(noise(len(tt)), 2000, 9000) * (np.sin(2 * np.pi * 23 * tt) > 0.3) * np.hanning(len(tt)) + 0.3 * np.sin(2 * np.pi * 120 * tt) * (np.sin(2 * np.pi * 23 * tt) > 0.3)
    tt = t_(0.5); gl = np.zeros(len(tt)); r2 = np.random.default_rng(5)
    for k in range(10): s0 = int(r2.random() * len(tt) * 0.9); gl[s0:s0 + int(0.02 * SR)] += np.sign(np.sin(2 * np.pi * r2.uniform(200, 2000) * tt[:int(0.02 * SR)]))
    L["glitch"] = gl * 0.7 + 0.3 * bp(noise(len(tt)), 3000, 9000) * (r2.random(len(tt)) > 0.6)
    tt = t_(0.25); L["zap"] = np.sin(2 * np.pi * np.cumsum(1800 * np.exp(-tt / 0.05) + 200) / SR) * np.exp(-tt / 0.08)
    tt = t_(0.12); L["blip"] = np.sin(2 * np.pi * 1320 * tt) * np.exp(-tt / 0.04)
    tt = t_(0.4); L["confirm"] = np.sin(2 * np.pi * 880 * tt) * np.exp(-tt / 0.1) * (tt < 0.12) + np.sin(2 * np.pi * 1320 * tt) * np.exp(-np.maximum(tt - 0.1, 0) / 0.15) * (tt >= 0.1)
    tt = t_(1.2); L["power_down"] = np.sin(2 * np.pi * np.cumsum(220 * np.exp(-tt / 0.35) + 30) / SR) * np.exp(-tt / 0.6) + 0.3 * lp(noise(len(tt)), 500) * np.exp(-tt / 0.3)
    tt = t_(1.5); f_al = np.where((tt * 2.5) % 1 < 0.5, 740, 587)  # a two-tone klaxon (original, not any game's)
    L["alarm"] = lp(signal.sawtooth(2 * np.pi * np.cumsum(f_al) / SR), 2500) * np.minimum(1, tt / 0.02) * np.minimum(1, (1.5 - tt) / 0.3)
    tt = t_(1.2); sp = (np.random.default_rng(9).random(len(tt)) < 0.004).astype(float); L["sparks"] = hp(lp(sp, 9000) * 40, 2000) * np.exp(-tt / 0.5) + 0.3 * bp(noise(len(tt)), 3000, 9000) * np.exp(-tt / 0.08)
    tt = t_(0.8); L["ping"] = np.sin(2 * np.pi * 1046 * tt) * np.exp(-tt / 0.25) + 0.4 * np.sin(2 * np.pi * 1568 * tt) * np.exp(-tt / 0.15)
    tt = t_(0.5); L["button"] = 0.8 * bp(noise(len(tt)), 1500, 6000) * np.exp(-tt / 0.006) + np.sin(2 * np.pi * np.cumsum(80 + 120 * np.exp(-tt / 0.02)) / SR) * np.exp(-tt / 0.12)
    tt = t_(0.9); L["door"] = lp(noise(len(tt)), 1200) * np.hanning(len(tt)) * 1.5 + 0.8 * (bp(noise(len(tt)), 200, 1500) * np.exp(-np.maximum(tt - 0.7, 0) / 0.03) * (tt > 0.7))
    tt = t_(0.5); L["thud"] = np.sin(2 * np.pi * np.cumsum(60 + 80 * np.exp(-tt / 0.03)) / SR) * np.exp(-tt / 0.12) + 0.5 * bp(noise(len(tt)), 200, 1500) * np.exp(-tt / 0.03)
    ty = np.zeros(int(1.0 * SR))
    for k in range(18): kk = L["tick"] * (0.6 + 0.4 * rng.random()); s0 = int(k * 0.045 * SR); ty[s0:s0 + len(kk)] += kk[: len(ty) - s0]
    L["type"] = ty
    tt = t_(3.0); L["low"] = np.sin(2 * np.pi * 36.7 * tt) * np.exp(-tt / 1.4) * np.minimum(1, tt / 0.05)
    tt = t_(1.4); L["eye"] = sum(np.sin(2 * np.pi * f * tt) * np.exp(-tt / d) for f, d in [(1760, 0.6), (2637, 0.4), (3520, 0.25)]) * np.minimum(1, tt / 0.15) + 0.4 * sweep_bp(noise(len(tt)), 2000, 8000, 3) * np.hanning(len(tt))

    for k in L:
        L[k] = L[k] / (np.max(np.abs(L[k])) + 1e-9)
    return L


def main():
    os.makedirs(f"{ROOT}/audio/stems", exist_ok=True)
    # VO
    vo = np.zeros((N, 2))
    for v in TL["vo"]:
        a, sr = sf.read(f"{ROOT}/audio/vo/{v['id']}.wav")
        if sr != SR:
            a = signal.resample_poly(a, SR, sr)
        a = hp(a, 60)
        a = a + 0.35 * lp(a, 220)                       # low-shelf warmth for the trailer read
        env = lp(np.abs(a), 20, 1); g = 1 / (1 + 2.0 * np.maximum(env / (np.max(env) + 1e-9) - 0.25, 0))
        a = a * g                                       # gentle compression
        add(vo, a * 1.0, v["start"], 1.0)
    vo = vo + 0.09 * wet(vo, 1.0)                       # a larger, darker room than the cheerful promos

    mus = music()

    L = sfx_lib()
    os.makedirs(f"{ROOT}/audio/sfx", exist_ok=True)
    used = {c["sfx"] for c in TL["sfx"]}
    for k, x in L.items():
        if k in used:
            sf.write(f"{ROOT}/audio/sfx/{k}.wav", (x * 0.8).astype(np.float32), SR)
    fx = np.zeros((N + SR * 2, 2))
    r = np.random.default_rng(11)
    for c in TL["sfx"]:
        add(fx, L[c["sfx"]], c["t"], c["gain"] * 0.32, pan=float(r.uniform(-0.35, 0.35)))
    fx = wet(fx, 0.12)[:N]

    # sidechain duck: music down ~9 dB under speech, SFX down ~4 dB
    venv = np.abs(vo[:, 0]) + np.abs(vo[:, 1])
    venv = lp(venv, 8, 1)
    venv = venv / (np.max(venv) + 1e-9)
    active = np.clip(venv * 12, 0, 1)
    # smooth: fast attack, slow release
    sm = np.zeros_like(active); a_c = np.exp(-1 / (0.03 * SR)); r_c = np.exp(-1 / (0.35 * SR))
    prev = 0.0
    for i in range(0, len(active), 32):  # block-wise for speed
        v = active[i]
        prev = (a_c ** 32) * prev + (1 - a_c ** 32) * v if v > prev else (r_c ** 32) * prev + (1 - r_c ** 32) * v
        sm[i:i + 32] = prev
    duck_m = 10 ** (-10.5 * sm / 20)
    duck_f = 10 ** (-7 * sm / 20)
    mus_d = mus * duck_m[:, None] * 0.9
    fx_d = fx * duck_f[:, None]

    sf.write(f"{ROOT}/audio/stems/vo.wav", vo.astype(np.float32), SR)
    sf.write(f"{ROOT}/audio/stems/music.wav", mus_d.astype(np.float32), SR)
    sf.write(f"{ROOT}/audio/stems/music_unducked.wav", (mus * 0.9).astype(np.float32), SR)
    sf.write(f"{ROOT}/audio/stems/sfx.wav", fx_d.astype(np.float32), SR)
    mix = vo + mus_d + fx_d
    peak = np.max(np.abs(mix))
    print("peak", round(float(peak), 3))
    if peak > 0.98:
        mix *= 0.98 / peak
    sf.write(f"{ROOT}/audio/stems/mix_premaster.wav", mix.astype(np.float32), SR)


if __name__ == "__main__":
    main()
