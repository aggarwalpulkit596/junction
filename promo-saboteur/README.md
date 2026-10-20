# Junction 3D: Saboteur Express — "Trust No Robot" (trailer)

A 55-second, 1080×1920 dramatic trailer for `../junction3d-saboteur.html`. Its picture is real footage rendered from the
3D game, plus a vanilla-JS Canvas 2D overlay layer for grading, titles, glows, alarms and the game's real UI screens. Every
frame is a pure function of time. The narration, score and sound design are all generated in this folder.

## What's here

| path | what it is |
|---|---|
| `exports/saboteur-trailer_1080x1920_captioned.mp4` | The finished trailer with burned-in captions (H.264 + AAC, 30 fps) |
| `exports/saboteur-trailer_1080x1920_clean.mp4` | The same trailer without captions |
| `exports/saboteur-trailer_preview_720p.mp4` | A light 720p captioned copy for quick sharing |
| `exports/saboteur-trailer.srt` | The caption file, timed to the narration |
| `exports/saboteur-trailer-player.html` | A self-contained player (footage, audio, fonts and screens inlined) |
| `exports/storyboard.png`, `exports/SCRIPT.md` | One still per scene, and the script and shot list |
| `index.html` + `src/` | The editable trailer with playback controls (the footage plays as a synced `<video>`) |
| `footage/` | The rendered 3D frames (`f#####.jpg`, one per film frame; 257 MB, left out of the ZIP, so re-create them with `node tools/shoot.mjs`) and `meta.json` (projected eye and point positions) |
| `assets/footage.mp4` | The same footage as a 720p video for the player |
| `assets/screens/` | The real UI captures (PNG sources, JPG film copies, `rects.json`) |
| `script/` | `lines.json` (narration), `timeline.json` (generated timing), `SCRIPT.md` |
| `audio/` | Narration per line (`vo/`), stems (`stems/`), the master (`master/`), each sound effect (`sfx/`) |
| `tools/` | Everything that builds the film (see below) |
| `CREDITS.md` | Sources, licences, and where each product claim was checked |

## Watch it

Open `exports/saboteur-trailer-player.html` in Chrome, Safari or Firefox. Controls: Space plays and pauses, the scrubber
seeks, ←/→ steps one frame (hold Shift for 1 s), C toggles captions, M mutes, F goes fullscreen, and the chapter buttons
jump to each scene.

To edit it, serve the folder over http:

```bash
python3 -m http.server 8125      # then open http://localhost:8125/  (add ?t=35 to start at a time)
```

## Rebuild everything

Requirements: Python 3.11, Node 18+, Google Chrome, FFmpeg. In this checkout, `.venv`, `tts/` and `node_modules` are
symlinks to the Achieve promo's copies; `../promo/README.md` explains how to set them up on a fresh machine.

```bash
node tools/capture.mjs                       # 0. real UI screens from ../junction3d-saboteur.html → assets/screens/
.venv/bin/python tools/make_vo.py            # 1. narration (--only L06 to redo one line; --voice am_onyx:0.6,am_michael:0.4)
.venv/bin/python tools/align.py              # 2. word timestamps (Whisper)
.venv/bin/python tools/build_timeline.py     # 3. beats, captions, SRT, SFX cues → src/timeline.js
node tools/shoot.mjs                         # 4. the 3D footage (≈7 min; --only meeting re-shoots one shot) → footage/ + src/footage_meta.js
.venv/bin/python tools/make_audio.py         # 5. score + SFX + mix + stems
./tools/master.sh                            # 6. loudness master → audio/master/
node tools/render.mjs --video                # 7. both MP4s → exports/
node tools/build_standalone.mjs              # 8. self-contained player → exports/
```

After step 4, run `./tools/encode_footage.sh` to re-encode `assets/footage.mp4` for the player.

- **Shots** are defined in `tools/shoot.mjs` (`SHOTS`: setup, events, camera path). They use the game's director API (`J.dir`).
- **Overlays** are in `src/scenes.js`, one function per scene. Footage helpers (`E.drawFootage`, `E.footageSpot`, `E.fmeta`) are in `src/engine.js`.
- **Timing** comes from the narration: change `script/lines.json`, then run steps 1–7.

## Specs

- 55.0 s · 1080×1920 · 30 fps · H.264 High, yuv420p · AAC 256 kb/s 48 kHz stereo
- Mix: about −14 LUFS integrated; master true peak ≤ −3 dBTP. Speech is at least 11.5 dB above the music and 8 dB above the effects on every line (`tools/check_balance.py`).
- Captions sit at y ≈ 1644–1736, above the bottom ~180 px that Reels and TikTok cover.
