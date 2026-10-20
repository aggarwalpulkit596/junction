# Junction: Europe — "One Ticket" (promo film)

A 52-second, 1080×1920 promotional animation for Junction: Europe, the browser rail game in
`../junction.html`. It's made in a hand-made paper-collage style, written in **plain vanilla
JavaScript on a Canvas 2D**, with no frameworks and no animation libraries. Every frame is a pure
function of time. The pipeline is adapted from the Achieve promo.

## What's here

| path | what it is |
|---|---|
| `exports/junction-promo_1080x1920_captioned.mp4` | The finished film with burned-in captions (H.264 + AAC, 30 fps) |
| `exports/junction-promo_1080x1920_clean.mp4` | The same film without captions |
| `exports/junction-promo_preview_720p.mp4` | A light 720×1280 preview with captions, for quick sharing |
| `exports/junction-promo.srt` | The caption file, timed to the narration's word timestamps |
| `exports/junction-promo-player.html` | A self-contained player (everything inlined; opens from disk and works offline) |
| `exports/storyboard.png` | One still per scene |
| `index.html` + `src/` | The editable animation, with synchronized audio and playback controls |
| `script/SCRIPT.md` | Concept, script with timings, shot list, voice direction, music notes |
| `script/lines.json` | The narration text: what's spoken (`say`) and how it's captioned (`cap`) |
| `script/timeline.json`, `src/timeline.js` | Generated timing: narration starts, scene cuts, word-level beats, captions, SFX cues |
| `audio/vo/` | One WAV per narration line, plus word timestamps (`words.json`) |
| `audio/stems/` | `vo.wav`, `music.wav` (ducked), `music_unducked.wav`, `sfx.wav`, `mix_premaster.wav` (48 kHz) |
| `audio/master/` | The mastered mix: `junction-promo-mix.wav` (−14 LUFS, ≤ −3 dBTP before AAC) and `.m4a` |
| `audio/sfx/` | Each synthesized one-shot sound effect |
| `assets/screens/` | Real game captures (`*.png` 1290×2796 sources, `*.jpg` film copies, `rects.json` element positions) |
| `assets/fonts/` | Fredoka, Nunito and Caveat (OFL) |
| `tools/` | Everything that builds the film (see below) |
| `CREDITS.md` | Sources, licences, and where each product claim was checked |

## Watch it

- Open `exports/junction-promo-player.html` in Chrome, Safari or Firefox. It needs nothing else.
- Controls: Play/Pause (Space or click the frame), the scrubber, ←/→ to step one frame (hold
  Shift for 1 s), C for captions, M to mute, F for fullscreen. The chapter buttons jump to each scene.

## Edit it

The editable version loads separate files, so serve the folder over http:

```bash
python3 -m http.server 8123      # then open http://localhost:8123/  (add ?t=24.4 to start at a time)
```

- **Picture:** `src/scenes.js` has one function per scene (`sceneHook`, `sceneTitle`,
  `sceneCards`, `sceneClaim`, `sceneTunnel`, `sceneRivals`, `scenePostcards`, `sceneScore`,
  `sceneEnd`). Map scenes use `E.drawMap(ctx, cam, t, {routes, city, land, over})`. Its callbacks
  set each route's owner and animation and each city's stamp, and `over` draws in map
  coordinates. Map cameras are keyframed with `camAt([[t, x, y, zoom], ...])`. Live marks on a
  real screen (rings, card flips) are drawn in the screenshot's own pixels through the `overlay`
  and `after` callbacks of `E.phone`. The positions come from `assets/screens/rects.json` (CSS px ×2).
  Shared drawing tools are in `src/engine.js`: paper, torn and cut shapes, tape, pencil, the game
  data (cities, routes, coastlines), the paper map, Sprocket robots, train cards, tickets and
  stations. Reload the page to see a change.
- **Timing:** scenes reference beats (`B.tunnels`, `B.blocked`, …) that come from the narration's
  word timestamps. If the voice changes, the picture follows it. Scene cuts and narration starts
  are `SCENES` and `VO_START` in `tools/build_timeline.py`.
- **Words:** edit `script/lines.json`, then run the pipeline below.

## Rebuild everything

Requirements: Python 3.11, Node 18+, Google Chrome, FFmpeg. In this checkout, `.venv`,
`tts/` and `node_modules` are symlinks to the Achieve promo's copies. On a fresh machine, create them:

```bash
python3.11 -m venv .venv && .venv/bin/pip install numpy scipy soundfile pillow kokoro-onnx faster-whisper
npm install
mkdir -p tts/models   # Kokoro model files (≈350 MB)
curl -L -o tts/models/kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
curl -L -o tts/models/voices-v1.0.bin  https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin

node tools/capture.mjs                       # 0. real game screens → assets/screens/ (needs ../junction.html)
.venv/bin/python tools/make_vo.py            # 1. narration, one WAV per line (--only L06 to redo one line)
.venv/bin/python tools/align.py              # 2. word timestamps (Whisper)
.venv/bin/python tools/build_timeline.py     # 3. beats, captions, SRT, SFX cues → src/timeline.js
.venv/bin/python tools/make_audio.py         # 4. music + SFX + mix + stems
./tools/master.sh                            # 5. loudness-master → audio/master/
node tools/render.mjs --video                # 6. both MP4s → exports/   (≈5 min)
node tools/build_standalone.mjs              # 7. self-contained player → exports/
```

To check your work:

- `node tools/render.mjs --stills 3.9,16.6,29.9` writes PNG stills to `scratch/stills/`.
- `node tools/render.mjs --video --from 24 --to 31 --cc-only` renders one section.
- `.venv/bin/python tools/check_balance.py` prints the speech-to-music ratio for each line.
- `node tools/test_player.mjs exports/junction-promo-player.html` smoke-tests a player.

**Changing the voice:** run `tools/make_vo.py --voice af_heart` (any Kokoro voice) or add
`--speed 0.95`, then steps 2–7. If a new line runs long, move the starts in
`tools/build_timeline.py`. The assert there stops any overlap.

## Specs

- 52.0 s · 1080×1920 · 30 fps · H.264 High, yuv420p · AAC 256 kb/s 48 kHz stereo
- Mix: −14 LUFS integrated; master true peak ≤ −3 dBTP, which measures −1.0 dBTP in the MP4s after AAC encoding; music ducked about 10.5 dB under the voice (about 10–17 dB speech-to-music in each line)
- Captions sit at y ≈ 1594–1686, clear of the bottom ~230 px that Reels and TikTok cover
