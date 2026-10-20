"""Original score + sound design + mix for the Junction: Europe promo. Everything is synthesised
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
def chord_notes(name, octave=4):
    root = note_num(name.rstrip("m") + str(octave))
    minor = name.endswith("m")
    return [root, root + (3 if minor else 4), root + 7]


def reed(f, dur, vib=5.6):
    """Accordion-ish musette reed: two detuned saw/pulse voices with a bellows tremolo."""
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    for det in (-0.0045, 0.0045):
        ph = 2 * np.pi * f * (1 + det) * t
        y += 0.6 * signal.sawtooth(ph) + 0.4 * signal.square(ph, 0.3)
    y *= 1 + 0.18 * np.sin(2 * np.pi * vib * t)
    y = lp(bp(y, 180, 4200), 2600)
    a = int(0.035 * SR); r = int(min(0.12, dur * 0.3) * SR)
    e = np.ones(n); e[:a] = np.linspace(0, 1, a); e[-r:] = np.linspace(1, 0, r)
    return y * e * 0.5


def chug(accent):
    """one brushed 16th of the train rhythm"""
    n = int(0.11 * SR)
    return bp(noise(n), 2500, 9000) * env_ad(n, 0.004, 0.03 + 0.02 * accent)


def music():
    dry = np.zeros((N + SR * 3, 2))   # instruments that get reverb
    drums = np.zeros_like(dry)
    T = lambda bar, beat=0.0: bar * BAR + beat * BEAT
    B = TL["beats"]
    END = int(round(next(s["start"] for s in TL["scenes"] if s["name"] == "end") / BAR))  # end-card bar (20)

    # --- A: the ticket, bars 0-2. Curious E-minor pizzicato over a train rhythm that gathers speed.
    progA = ["Em", "C", "D"]
    for bar, ch in enumerate(progA):
        ns = chord_notes(ch, 3)
        pattern = [ns[0], ns[2], ns[1] + 12, ns[2], ns[0] + 12, ns[2], ns[1] + 12, ns[2] + 12]
        for i, nn in enumerate(pattern):
            add(dry, pluck(midi(nn), 0.5, 0.4, 0.990), T(bar, i * 0.5), 0.15 + 0.03 * (i == 0), pan=-0.35 + 0.1 * (i % 3))
        add(dry, bass(midi(ns[0] - 12), BAR * 0.45), T(bar), 0.28)
        add(dry, bass(midi(ns[0] - 12), BAR * 0.4), T(bar, 2.5), 0.22)
        for s16 in range(16):  # chugga-chugga, louder each bar
            add(drums, chug(1 if s16 % 4 == 0 else 0), T(bar, s16 * 0.25), (0.03 + 0.025 * bar) * (1.6 if s16 % 4 == 0 else 1), pan=0.35)
    for nn, beat in [("B5", 0), ("E6", 1), ("D6", 1.5), ("B5", 2)]:
        add(dry, glock(midi(note_num(nn))), T(1, beat), 0.09, pan=0.4)
    for i in range(8):  # snare roll into the drop
        add(drums, snap(), T(2, 2 + i * 0.25), 0.06 + i * 0.02, pan=0.1)

    # --- B: the journey, bars 3..END-1. G major, I-vi-IV-V, strum + bass + kick/snap + train chug, glock and reed hooks.
    progB = ["G", "Em", "C", "D"]
    strum_hits = [(0, 1.0, "D"), (1.0, 0.6, "D"), (1.5, 0.5, "U"), (2.5, 0.55, "U"), (3.0, 0.8, "D"), (3.5, 0.5, "U")]
    hook = [("B4", 0), ("D5", 0.5), ("G5", 1), ("F#5", 2), ("E5", 2.5), ("D5", 3), ("B4", 3.5), ("A4", 4), ("B4", 4.5), ("D5", 5), ("E5", 6)]
    reed_line = [("D5", 0, 1.0), ("E5", 1, 0.5), ("G5", 1.5, 1.5), ("F#5", 3, 1.0), ("E5", 4, 1.0), ("D5", 5, 0.5), ("B4", 5.5, 1.5), ("D5", 7, 1.0)]
    for bar in range(3, END):
        ch = progB[(bar - 3) % 4]
        ns = chord_notes(ch, 4 if ch in ("G", "Em") else 4)
        if ch in ("G",): ns = [n - 12 for n in ns] if ns[0] > 66 else ns
        voicing = [ns[0] - 12, ns[2] - 12, ns[0], ns[1], ns[2]]
        for beat, vel, d in strum_hits:
            t = T(bar, beat)
            order = voicing if d == "D" else voicing[::-1]
            for k, nn in enumerate(order):
                add(dry, pluck(midi(nn), 0.7, 0.55, 0.993), t + k * 0.009, 0.07 * vel, pan=-0.25 + 0.12 * k)
        root = midi(ns[0] - 24)
        for beat, f in [(0, root), (1.5, root), (2, root * 1.5), (3, root), (3.5, root * 1.5)]:
            add(dry, bass(f, BEAT * 0.8), T(bar, beat), 0.30)
        for b in (0, 2):
            add(drums, kick(), T(bar, b), 0.40)
        for b in (1, 3):
            add(drums, snap(), T(bar, b), 0.20, pan=0.15)
        for s16 in range(16):
            add(drums, chug(1 if s16 % 4 == 0 else 0), T(bar, s16 * 0.25), 0.05 if s16 % 4 == 0 else 0.028, pan=0.4)
        add(dry, pad([midi(n) for n in ns], BAR + 0.4), T(bar), 0.045)
        if (bar - 3) % 8 == 0:     # glock hook, two bars
            for nn, beat in hook:
                add(dry, glock(midi(note_num(nn) + 12)), T(bar, beat), 0.075, pan=0.35)
        if (bar - 3) % 8 == 4:     # the reed answers, two bars
            for nn, beat, d in reed_line:
                add(dry, reed(midi(note_num(nn)), d * BEAT * 0.95), T(bar, beat), 0.085, pan=-0.3)
    # stop-time on "Blocked?": a low bonk, then the band drops out for a beat and a half
    blk = B["blocked"]
    add(dry, bass(midi(31), 0.6) * 1.2, blk - 0.04, 0.4)
    # fill into the win and into the end card
    for i in range(6):
        add(drums, snap(), T(END - 1, 2.5 + i * 0.25), 0.12 + i * 0.03, pan=0.1)

    # --- C: end card, bars END..END+2 then a ringing final chord
    endprog = [("G", END, 0), ("C", END + 1, 0), ("D", END + 1, 2), ("G", END + 2, 0)]
    for ch, bar, beat in endprog:
        ns = chord_notes(ch, 4)
        if ns[0] > 66: ns = [n - 12 for n in ns]
        voicing = [ns[0] - 12, ns[2] - 12, ns[0], ns[1], ns[2], ns[0] + 12]
        final = (bar, beat) == (END + 2, 0)
        for k, nn in enumerate(voicing):
            add(dry, pluck(midi(nn), 3.0 if final else 1.4, 0.6, 0.997 if final else 0.994), T(bar, beat) + k * 0.014, 0.07, pan=-0.3 + 0.12 * k)
            add(dry, keys(midi(nn), 3.8 if final else 2.0), T(bar, beat), 0.035)
        add(dry, bass(midi(ns[0] - 24), 2.4 if final else 1.0), T(bar, beat), 0.27)
        add(drums, kick(), T(bar, beat), 0.3)
        if final:
            add(dry, pad([midi(n) for n in ns], 4.0), T(bar, beat), 0.07)
            add(dry, reed(midi(ns[0] + 12), 2.6), T(bar, beat) + 0.02, 0.06, pan=-0.3)
    for i in range(16):
        add(drums, chug(i % 4 == 0), T(END, i * 0.25), 0.022, pan=0.45)
    for b in (1, 3):
        add(drums, snap(), T(END, b), 0.14)
    for nn, beat in hook[:6]:
        add(dry, glock(midi(note_num(nn) + 12)), T(END, beat), 0.045, pan=0.35)
    for nn, beat in [("D6", 0), ("G6", 0.5), ("B6", 1), ("D7", 1.5)]:
        add(dry, glock(midi(note_num(nn))), T(END + 2, beat * 0.5) + 1.5, 0.05, pan=0.4)

    mix = wet(dry, 0.22) + wet(drums, 0.06)
    mix = mix[:N]
    # the stop-time dip on "Blocked?"
    env = np.ones(N); t = np.arange(N) / SR
    d0, d1 = blk + 0.05, blk + 1.5 * BEAT
    env[(t > d0) & (t < d1)] = 0.12
    ramp = int(0.04 * SR); i0, i1 = int(d0 * SR), int(d1 * SR)
    env[i0:i0 + ramp] = np.linspace(1, 0.12, ramp); env[i1 - ramp:i1] = np.linspace(0.12, 1, ramp)
    mix *= env[:, None]
    fade = int(1.4 * SR); mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
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
        a = hp(a, 80)
        add(vo, a * 1.0, v["start"], 1.0)
    # gentle room on VO so it sits in the paper world (very light)
    vo = vo + 0.04 * wet(vo, 1.0) - 0.04 * vo

    mus = music()

    L = sfx_lib()
    os.makedirs(f"{ROOT}/audio/sfx", exist_ok=True)
    for k, x in L.items():
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
    duck_f = 10 ** (-4 * sm / 20)
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
