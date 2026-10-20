# Junction: Europe

A single-file browser rail game: the Europe-edition ruleset of a classic route-building board game, with an
original name, map, and cartoon art. Four players: the human ("You") and three bots (Rose, Sandy, Mint),
drawn as original hex-bodied "Sprocket" robots.

Do not use the original board game's name, board art, or trade dress, or art from Among Us. Keep everything original.

## Files
- `junction.html`: the whole game (HTML + CSS + JS, no build step). Open it in a browser.
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
Quick = 20 trains, Long = 30 trains (the board holds ~130 trains of routes, so 45 would never end).

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
- Bots that use stations and block rivals; online multiplayer with a server-authoritative deck.
