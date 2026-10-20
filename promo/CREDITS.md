# Sources, licences and product-accuracy notes

## Everything in the film

| element | source | licence / status |
|---|---|---|
| Narration | Generated with **Kokoro-82M** (hexgrad), voice `af_bella`, run locally through `kokoro-onnx` 0.6.1 (model files `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the kokoro-onnx v1.0 release) | Kokoro weights and voices: Apache-2.0. kokoro-onnx: MIT. The output audio is free to use commercially. |
| Music | Original. Composed and synthesized from oscillators and noise in `tools/make_audio.py` (Karplus-Strong plucks, an additive glockenspiel and keys, a musette-style reed, synth bass, drums) | Created for this project. No samples or third-party audio. |
| Sound effects | Original. Synthesized in `tools/make_audio.py` (`sfx_lib()`) | Created for this project. |
| Illustration, paper textures, map collage, landmark postcards | Original. Drawn procedurally in `src/engine.js` and `src/scenes.js`. The map uses the game's own coastline polygons and route table, copied from `junction.html` | Created for this project. |
| Sprocket robots, train cards, tickets, station marker | Redrawn from Junction's own SVG/CSS designs in `junction.html` (`sprocketInner`, `CAR_SVG`, `LOCO_SVG`, `.cardface`, `.ticket`, `.station`) | Junction's own original art. |
| Game screens (`assets/screens/`) | Captured from `../junction.html` by `tools/capture.mjs`: headless Chrome at 430×932 CSS px ×3, light theme, seeded `Math.random`. Win screen: seed 29 | Junction's own UI. |
| Fredoka, Nunito | The game's fonts. Files from github.com/google/fonts (`ofl/fredoka`, `ofl/nunito`) | SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`). |
| Caveat | google/fonts repository | SIL Open Font License 1.1 (`assets/fonts/OFL-Caveat.txt`). |

These tools were used to build the film, but nothing from them ships in it:
faster-whisper (MIT; word alignment and QA transcription), puppeteer-core (Apache-2.0), Google
Chrome (rendering and captures), FFmpeg (encoding and loudness), and NumPy, SciPy, soundfile and
Pillow.

The pipeline (engine, player, renderer, mixing and mastering) is adapted from the Achieve promo
(`~/projects/achieve-promo`). The large shared dependencies (`.venv`, `tts/models`, `node_modules`)
are symlinked from that project here and are not in the ZIP. The README explains how to install them.

## Product claims and where each was checked (all in `../junction.html`)

| claim on screen or in the narration | verified against |
|---|---|
| Ticket "Edinburgh to Athína · Long · 21" | `LONG` tickets: `['EDI','ATH']`; value = `tval` = shortest path (18 trains) + 3 = 21 |
| "Twenty trains" | Quick game = `newGame(20)`, "20 trains each" (`openStart`) |
| "Three robots": Rose, Sandy, Mint | `PLAYERS` (You plus three bots, all drawn with `sprocket()`); bots play automatically (`botTurn`) |
| "A rail race across twenty-eight cities", "50 routes" | `CITY_DATA` (28 entries), `RDATA` (50 routes) |
| "Draw two train cards a turn. Locomotives are wild." Five face-up cards plus a deck | Rules sheet (`rulesHTML`), market of 5 (`fixMarket`), the deck button |
| London–Edinburgh: 4 white = 7 pts | `RDATA ['LON','EDI','white',4]`, `PTS[4] = 7` |
| "Ferries need a locomotive" (London–Paris) | `['PAR','LON','gray',2,0,1]` (one ferry car); rules: "Each dot needs a locomotive" |
| Tunnels flip three cards; each match costs one more card (Zürich–Venezia) | `['ZUR','VEN','green',2,1]`, `startClaim`, `tunnelExtra`; the tunnel sheet is a real capture (staged: three cards flipped, one green match) |
| Rivals claim routes and can block yours | Bots claim routes (`botClaim`); a claimed route can't be claimed again. Which robot takes which route here is illustrative |
| "Build a station, and borrow their line." "station: 1 card" | `buildStation`, `stationOptions(p, 4 - stations)` (1, then 2, then 3 cards); rules: "lets you use one rival's route into that city for your tickets"; `ticketScore` brute-forces the borrowed route |
| Landmark postcards; facts on the four cards | `INFO.EDI/PAR/ROM/ATH` (quoted or shortened from the game's text) |
| "Connect it, and it's stamped" | `openCity` "Stamped" badge and `.node.stamped` amber city nodes for cities on your routes; a real capture |
| "Finish your tickets" (+21), "+10 longest line", "You win!" | `ticketScore` (+ticket value when connected), `longest()` +10 in `endGame`; the win screen is a real capture of a full bot-played game (You 58, longest 15 trains held by you) |
| Player's line uses 16 trains + 1 station | London–Edinburgh 4, London–Paris 2, Paris–Zürich 3, Zürich–Venezia 2, Roma–Brindisi 2, Brindisi–Athína 3, which fits in 20 trains |
| "Pick a quick game. About ten minutes" | Start sheet: "Quick game · 20 trains each, about 10 minutes" (a real capture, ringed in the film) |
| "Right in your browser", "You vs. three robot rivals" | Junction is one HTML file that runs in a browser against three bots |

### Deliberately left out

- The brief's product description (nutrition and training, an assessment, a "first day" preview,
  memberships) doesn't describe Junction, so the film follows the real product. Its real next
  step is to open the game and pick a Quick game. Nothing about pricing is said, and the film
  doesn't claim the game is free.
- No URL or store badge: Junction isn't published anywhere yet.
- No online play with friends: the game is one player against three bots, and multiplayer is
  only an idea in the project notes.
- The classic board game this ruleset follows isn't named, and its art and trade dress aren't
  used (per the project's `CLAUDE.md`). Everything shown is Junction's own.
- The rival claims, the borrowed Venezia–Roma line and the order of events are a dramatized
  single game for storytelling. Every rule they show is real, and the three printed screens are
  real captures.
