# Sources, licences and product-accuracy notes

## Everything in the film

| element | source | licence / status |
|---|---|---|
| 3D footage | Rendered from `../junction3d-saboteur.html` (Three.js r160) in director mode by `tools/shoot.mjs`: software WebGL in headless Chrome, 1080×1920, 30 fps | Junction's own game. Three.js: MIT. |
| UI screens (`assets/screens/`) | Captured from the same game at phone size (430×932 CSS px ×3) by `tools/capture.mjs`, in one staged game | Junction's own UI. |
| Narration | Kokoro-82M (hexgrad) via `kokoro-onnx` 0.6.1: a 60/40 blend of the `am_onyx` and `am_michael` voices | Apache-2.0 (weights and voices), MIT (kokoro-onnx). The output is free to use commercially. |
| Music and sound effects | Original, synthesized in `tools/make_audio.py` (no samples) | Created for this project. |
| Overlays (titles, grades, alarms, glows) | Original, drawn in `src/engine.js` and `src/scenes.js` | Created for this project. |
| Fredoka, Nunito | The game's fonts, from github.com/google/fonts | SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`). |

Nothing from Among Us is used: no art, sprites, maps, sounds, music or name. The reference repository the project looked at
(Trijeet/among-us-js) informed only general mechanics. Its `assets/` folder holds Innersloth's art and was not used.

These tools were used to build the film, but nothing from them ships in it: faster-whisper (MIT, word alignment and QA),
puppeteer-core (Apache-2.0), Google Chrome, FFmpeg, and NumPy/SciPy/soundfile/Pillow.

## Product claims and where each was checked

| claim on screen or in the narration | verified against |
|---|---|
| Twenty trains, four robots, a railway across Europe | `junction3d-saboteur.html`: Quick game = 20 trains; You plus Rose, Sandy and Mint; 28 cities and 50 routes from `junction.html` |
| "One of them is a saboteur" | `S.sab = 1 + rand(3)`: one of the three robots (never you) |
| Walk the rails and claim routes | 3D walking (`walkable` = land ∪ rail corridors); USE on a route opens the claim sheet |
| Station tasks for locomotives, or a robot's alibi | `QUIZ` + `answer`/`reward` ("Take a locomotive card" / "Check a robot's alibi"); the Eiffel Tower question is real |
| Signals fail; a route goes dark | `botSabotage`: every third round the saboteur walks to an unclaimed route and blocks it for 2 rounds (beacon, dark cars, alarm) |
| Two robots seen nearby; Sandy cleared | The ship log's real sightings line ("Rose at München, Sandy at Amsterdam, Mint at Wien") and the alibi result |
| One emergency meeting, one vote | `openMeeting`/`vote`: once per game, after the first sabotage; red Meeting button (R) |
| Ejection into the sea; "Mint was innocent… −5 pts" | The game's ejection animation and verdict text (−5 for an innocent, +15 for the saboteur) |
| "The saboteur gets away with it"; "+10" | `endGame`: a saboteur who's never caught earns +10; the end screen is a real capture ("Rose wins…") |
| Quick game, 20 trains each, about 10 minutes; plays in your browser | The game's start sheet. It's one HTML file; Three.js and the fonts load from the web |

### Staging and limits

- The trailer follows one staged game. Who the saboteur is, the order of events and the camera work are scripted with the
  game's own functions (`J.dir`, `botSabotage`, `vote`), and every UI screen shown is a real capture. In normal play the
  saboteur is random and strikes every third round.
- The footage's dusk and night look is a colour grade in the overlay; the game itself is daylit. Eye glows, alarm washes,
  pills and titles are overlays too.
- No pricing, store or online-multiplayer claims are made: the game is free-standing, single-player against three bots.
