# Junction

Browser rail games with original names, maps and art. The lead game is now **Junction: Delhi Metro** (`metro.html`, 3D,
phone-first). The older games are the Europe-edition ruleset of a classic route-building board game (2D, 3D, Saboteur).
Four players: the human ("You") and three bots (Rose, Sandy, Mint), drawn as original hex-bodied "Sprocket" robots.

Do not use the original board game's name, board art, or trade dress, or art from Among Us. Keep everything original.

## Files
- **`metro/rules.js`**: the Delhi Metro rules engine, a plain ES module with no DOM (map data `STATION_DATA`/`SEG_DATA`, `TICKETS`
  generated from shortest paths, `MODES` rush/full, `makeEngine()` with `act`/`tick`/`nextWake`/`view`/`botNext`). The Worker imports
  it directly; `mp/build.mjs` inlines it (exports stripped) at `/*@@RULES@@*/` in `metro/metro.template.html` → **`metro.html` (generated)**.
  Rules in one breath: take 2 passes or **drive** one free segment touching your network (`payOptions`, Smart Card = wild, grey/aqua/rapid
  segments take any one colour); a non-touching segment is a **depot run** (+1 pass of any kind, `drivePath` returns `depot`); segments score
  `PTS` 1/2/4/7; tickets ±; longest line +10; final round at ≤2 trains. Disruption: `S.fail` (Signal Failure every `FAIL_EVERY`=3 rounds)
  and one `jam` per player (`JAM_ROUNDS`=2). Bots: `wanted` (Dijkstra over unfinished tickets), `bestDrive`, `botJam`, `botNext`.
- **`metro/live.js`**: **Rush Hour Live**, the real-time engine (game id `live`, the default way to play). Imports map data from `rules.js`;
  exports `makeLiveEngine`/`LIVE_MODES` (aliased to `makeEngine`/`MODES` for the Worker; `mp/build.mjs` strips the import/export lines
  when inlining both files into `metro.html`, so names must not clash with `rules.js`). No turns: `tick(now)` hands out income every
  `incomeMs`, spawns `S.floats` (grabbed by the first train standing there, `grabAt`), moves trains (`p.moving {path,t0,t1,si}`, `arrive`),
  runs Signal Failures/Jams on millisecond timers and the robots (`botNext` every `botThinkMs`). Actions `drive` (claims at once, train
  travels `carMs` per car, shuttling along own track `shuttleCarMs` per car), `go` (shuttle to a station on your line), `jam`. Rounds:
  `newRound` → `endRound` (`S.final` {round, rows, maxL}) → `between` (`breakEnds`) → … → `S.commute` standings and `S.over`.
  `mp/live-sim.mjs 100`: ~165 s rounds, ~44/66 segments claimed, 0 stalls.
- **`metro/metro.template.html`**: the client. Renders only from a view `V` (local engine in solo via `E.tick(Date.now())` every 80 ms,
  or the server's `sync` online), so solo and online share every screen. Three.js r160 (jsDelivr) 3D board: `buildMap` (viaduct ribbons,
  car slots, station cylinders, label sprites that rescale with zoom), `CAM` (drag pan, pinch/wheel zoom, two-finger or shift-drag turn,
  `CAM.ride` follows your train during a drive, toggle `RIDE.on`), raycast taps → `tapSeg`/`tapStation`. HUD: market, chips, Jam button, sheets.
  `LIVE()` branches: train motion is time-based (`startAnim {path,t0,t1}`, interpolated in `frame()` from `nowT()` = server time + skew),
  floating passes are sprites (`syncFloats`), the market strip becomes the live strip (`liveStrip`: round clock, next-pass meter, score),
  one-tap `drive` (cheapest payment), tap a station on your line → `go`, `roundSheet` (auto-closes on the `round` event) and `commuteSheet`.
  Wide screens (≥900px) put the board beside the controls. Test hooks on `window.J` (`V`, `send`, `newSolo`, `keepAll`, `payOptionsV`…).
- `mp/metro-sim.mjs` (balance, virtual clock), `mp/metro-e2e.mjs` (two real browsers against `wrangler dev`).
- `junction.html`: the 2D Europe game (HTML + CSS + JS, no build step). Open it in a browser.
- `junction-saboteur.html`: "Saboteur Express", the 2D Europe game plus a hidden-saboteur layer (single file, no build step).
  Same rules and bots as `junction.html`, plus: `S.sab` (Rose, Sandy or Mint) runs `sabotage()` on its turn every third round, which blocks
  (`r.blocked`, 3 → 0 as rounds wrap) an unclaimed route at its city and prefers routes in `wanted(H())`. `payOptions` refuses blocked routes and
  `wanted` routes around them. Robot positions `p.pos` show on the map; sightings go in the log. Station tasks (`QUIZ`, `answer`, `reward`) unlock
  in connected cities, one per turn, and reward a loco card or an alibi. `openMeeting`/`vote`: one per game; ejected robots are skipped in `endTurn`.
  Scoring: +15/−5 for the meeting, +10 to a saboteur who's never caught. 200 headless games: Quick about 18.6 rounds with about 5 sabotages; Long about 28 rounds.
- `junction3d-saboteur.html`: **Junction 3D: Saboteur Express**, the walk-around 3D game with the saboteur layer. **Generated**: don't hand-edit it.
  Rules come from `junction-saboteur.html`; the 3D parts come from `tools3d/junction3d-saboteur.template.html`, which `tools3d/make_saboteur_template.py`
  derives from the plain 3D template. In 3D the saboteur walks to the route (`botSabotage`), sparks fly, the cars go dark red under a beacon,
  the alarm flashes, and you witness it if you're within 32 units. The red Meeting button (R) and the ship log (L) are in the HUD; ejected
  robots are launched off the map. `J.dir` is a director API (fixed-step clock, scripted camera, HUD toggle, frame grab) used by the trailer.
  Rebuild: `python3 tools3d/make_saboteur_template.py && python3 tools3d/build.py junction-saboteur.html tools3d/junction3d-saboteur.template.html junction3d-saboteur.html`.
  Check: `node tools3d/sim.mjs 100 20 junction3d-saboteur.html` (200 games: Quick about 18.4 rounds with about 5 sabotages, Long about 28.3; no stalls).
  **Talking robots** (in `make_saboteur_template.py`): each robot keeps `S.sus[b][q]` from what it witnessed (within 21 units),
  where the robots were sighted, and accusations it hears (weighted by how much it trusts the speaker). A robot that saw something calls
  a meeting (`botWantsMeeting`, at most 2 per game). The saboteur sometimes reports its own sabotage to frame someone. `discussion()`:
  innocent robots tell the truth; the saboteur frames a scapegoat and may give a fake location that the ship log contradicts.
  `botVotes`/`tally`: an ejection needs ≥2 votes with a clear lead over the others and over skips. Bots that vote out the saboteur get `p.bonus` +5.
  Balance (`sim.mjs`): with no help from you the robots catch the saboteur in about 60–68% of Quick games; innocents are ejected in about 5%.
- **Shared 3D additions** (in `tools3d/junction3d.template.html`, so both 3D games get them; `add_sound.py` and `add_navigation.py` already applied them and refuse to run twice):
  `SND`: synthesized Web Audio effects plus adaptive music (calm, tense, meeting), with 🔊 and ♪ toggles; ⏩ / F for fast bots (`FF`);
  a live minimap (tap to walk), ticket rows you tap to walk to, coastline sliding, wider rail and city corridors, and labels that scale with zoom.
- `promo-saboteur/`: the dramatic "Trust No Robot" trailer for `junction3d-saboteur.html`, built from real 3D footage of the game
  (`tools/shoot.mjs`) plus the canvas overlay pipeline from `promo/`. See `promo-saboteur/README.md`.
- `junction3d.html`: the walk-around 3D version (Three.js r160 from jsDelivr, so it needs a connection). **Generated**: don't hand-edit it.
  It is also the **online multiplayer** client (see "Online" below).
- `mp/`, `worker/`, `wrangler.toml`, `site/`: online play on Cloudflare (Worker + one Durable Object per room). See "Online" below
  and `docs/ONLINE.md`.
- `docs/ITERATIONS.md` + `CHANGELOG.md`: the project history. Every change is an iteration: commit messages start with
  `Iteration N:` and each iteration gets a section in `docs/ITERATIONS.md` (what, why, how it was checked).
- `tools3d/`: `junction3d.template.html` (the 3D world, robots, input, HUD, walking bots), `build.py` (splices the rules engine from `junction.html` into the template), `sim.mjs` (headless bot-vs-bot check).
- `promo/`: the "One Ticket" promo film (vanilla JS canvas animation, narration, music, exports). See `promo/README.md`.
- `video/record.py`: renders a 1080x1920 gameplay teaser (`video/junction_teaser.mp4`) with Playwright + ffmpeg.

## Code map (junction.html `<script>`)
- **Data:** `CITY_DATA` (28 cities, lon/lat, label side), `INFO` (landmark postcards), `RDATA` (50 routes:
  `[a, b, colour, length, tunnel?, ferryLocos]`), `LONG`/`SHORT` tickets (values = shortest path + 3 for long),
  `LANDS`/`BLACKSEA` (coastline polygons in lon/lat, projected by `proj`).
- **State:** global `S` built by `newGame(trains, silent)`. Players have `hand`, `trains`, `stations`, `tickets`.
- **Rules:** `payOptions` (ferries need locos), `startClaim`/`tunnelResolve` (tunnels flip 3 cards),
  `buildStation` (costs 1/2/3), `fixMarket` (3 face-up locos → redeal), `endTurn` (final round when a player has ≤2 trains
  or every route is claimed), `ticketScore` (brute-forces the best station route choice), `longest` (+10 bonus).
- **Bots:** `wanted` (Dijkstra paths for unfinished tickets), `botTurn`, `botClaim`, `botDraw`, `botTickets`. Bots do not build stations.
- **UI:** `render`, `renderMap` (SVG cars per route segment), bottom sheets via `sheet()`.

## 3D version (junction3d.html)
- Rebuild after editing the template or any shared rule in `junction.html`:
  `python3 tools3d/build.py junction.html tools3d/junction3d.template.html junction3d.html`.
  `build.py` copies these verbatim from `junction.html`: the data/helpers, payment, `afterDraw`…`drawTicketsHuman`, `wanted`,
  `botTickets`, scoring, sheets, `openRoute`/`openCity`. It fails loudly if a slice marker disappears.
- Same rules, different presentation. You walk your Sprocket (WASD/arrows or tap the ground) on land and along rail lines (no
  swimming; ferries and bridges are how you reach islands). USE/E acts on whatever is in reach (`interactions()`).
  Face-up cards float above cities (`S.marketCity[i]`, placed by `setSlot`/`pickCity`); the deck and tickets work anywhere.
- Bots are async: `botTurn`/`botClaim`/`botDraw` `await walkTo()` along the rail graph (`planTo`, `cityPath`) before acting.
  `GEN` cancels stale awaits on a new game. Idle bots wander between turns.
- World coords: map units minus (196,150); land is extruded from `LANDS`; `walkable()` = land ∪ track corridors ∪ city pads.
- Test hooks: `window.J` (`setFast`, `newGame`, `botTurn`, `endTurn`, `ACT`, `interactions`, …). `node tools3d/sim.mjs 100 20`:
  100 games finish, about 18 rounds for Quick and 28 for Long, the same as the 2D game.
- No Among Us art: the robots are our own Sprockets in 3D. The Phaser reference repo (Trijeet/among-us-js) was only used for ideas
  (follow camera, walkable mask, walk cycle); its sprites and ship map are Innersloth's and must not be copied.

## Modes
- Delhi Metro: **Rush Hour** = 16 trains (25 s turns, 10 min clock online) and **Full Line** = 24 trains (40 s turns, 25 min clock, long tickets).
  Solo has no timers. `mp/metro-sim.mjs 200 rush 1` ≈ 15.7 rounds, 3.7 min; with 4 humans ≈ 9.6 min; `full` ≈ 23.7 rounds, ≈ 14 min with 4 humans.
- 2D games and Saboteur (2D and 3D): Quick = 20 trains, Long = 30 trains.
- Junction 3D (solo and online): **Blitz** = 18 trains (5–10 min online: 25 s turns, 8 min clock) and **Classic** = 40 trains
  (~30 min online: 45 s turns, 28 min clock; fills ~48 of 50 routes). Online modes live in `MODES` in `mp/engine.template.js`.

## Online (Junction 3D and Delhi Metro multiplayer)
- **Server-authoritative.** `worker/index.js`: the Worker routes `POST /api/rooms {game, mode}`, `GET /api/rooms/:code`, `/api/rooms/:code/ws` and serves
  `public/` for everything else. `Room` is a SQLite-backed Durable Object with hibernating WebSockets. It stores one key `room`
  (`{code, gameId, mode, phase, seats:[{name,token}], hostToken, game}`) and paces robots with alarms. `GAMES={europe, metro}`: the room's
  `gameId` picks the engine (`setGame`); both engines expose the same API (`newGame, act, tick, nextWake, view, rotEv, botNext, load, setAway, takeOver, toBot`).
- **Engine.** `mp/engine.template.js` → `worker/rules.gen.js` (**generated** by `node mp/build.mjs`, which splices junction.html's data,
  payment, `wanted` and scoring slices in, just like `build.py`). `act(seat,a,now)` validates every action; `botNext` returns a robot's
  action (also used for timed-out or away humans); `tick(now)`/`nextWake(now)` run the clock; `view(seat)` hides other hands and tickets and
  rotates seats so the viewer is player 0. Time is always passed in, so `mp/sim.mjs` runs on a virtual clock.
- **Client.** The `ONLINE` section of `tools3d/junction3d.template.html` (`NET`, `netApply`, `netLobby`, …). Each `sync` rebuilds `S` from
  the view, so the existing HUD and 3D code work unchanged. `takeMarket`/`startClaim`/`confirmTickets`/… are wrapped to send actions
  when `NET.on`. `ONLINE_OK=false` in the saboteur build (`make_saboteur_template.py` flips it and restores Quick/Long).
- **Commands.** `npm run build` (3D pages + Europe engine + `metro.html` + `public/`), `npm run sim` (both engines: balance + `mp/timeout-check.mjs`),
  `npm run dev:fast` (`wrangler dev` with `BOT_PACE=0.15`) then `npm run test:online` (`mp/metro-e2e.mjs` then `mp/e2e.mjs`, real Chrome), `npm run deploy` (needs `wrangler login`).
- **Numbers to keep.** `mp/sim.mjs 200 blitz 1` ≈ 16.6 rounds, 4.4 min; `classic 1` ≈ 38.9 rounds, 11 min; with 4 humans both hit their clocks
  (≈ 8.8 and 29 min). No stalls, no refused robot actions.

## Testing
Bots can play every seat headlessly: stub `document`, override `setTimeout` to run immediately, loop
`botTurn(H()); endTurn();` until `S.over`. 200 simulated games: Quick ≈ 18 rounds, Long ≈ 28 rounds, no stalls.

## Video
```
pip install playwright && playwright install chromium   # plus ffmpeg
# install Fredoka + Nunito fonts locally (github.com/google/fonts, ofl/fredoka, ofl/nunito)
python video/record.py            # searches for a seed where "You" win
python video/record.py junction.html 2   # fixed seed used for the current cut
```
The script seeds `Math.random`, steps turns one at a time, stages a landmark postcard and a tunnel flip,
overlays captions, screenshots key moments, and stitches them with ffmpeg (27s, no audio).

## Ideas for next steps
- Add music/SFX to the teaser; make a 16:9 cut for YouTube.
- Split into modules (rules engine / bots / UI) with unit tests for the rules engine.
- Bots that use stations and block rivals.
- Saboteur Express online (hidden human saboteur); proximity checks for online actions; spectators.
