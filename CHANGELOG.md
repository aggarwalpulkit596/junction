# Changelog

Short version of [`docs/ITERATIONS.md`](docs/ITERATIONS.md). Newest first.

## 1.1.0 — Junction: Delhi Metro (2026-10-24)

### Added
- **Junction: Delhi Metro** (`metro.html`): a phone-first 3D route-building game on the Delhi Metro. Line passes in the
  real line colours, drive segments with one tap, depot runs, destination tickets, Signal Failures and one Jam per
  player. Solo against three robots, or online with up to 4 (robots fill the rest), with the same rooms and codes as
  Junction 3D.
- Two lengths: **Rush Hour** (16 trains, 25 s turns, 10 min clock) and **Full Line** (24 trains, 40 s turns, 25 min).
- A tilted 3D toy Delhi (Three.js): drag, pinch, two-finger turn; the camera rides along with your train when you drive.
- `metro/rules.js` (one engine for browser and Worker), `mp/metro-sim.mjs`, `mp/metro-e2e.mjs`.
- The landing page now leads with Delhi Metro; the room-code box opens whichever game the room belongs to.

### Changed
- Rooms carry a `game` (`europe` or `metro`); `POST /api/rooms` takes `{game, mode}`, `GET /api/rooms/:code` returns `game`.
- `npm run sim` and `npm run test:online` cover both games; CI checks `metro.html` is up to date.

## 1.0.0 — Online multiplayer (2026-10-21)

### Added
- Live at https://junction.aggarwalpulkit596.workers.dev
- Online play in Junction 3D for up to 4 people, with robots in any empty seat. Create a room, share the 4-letter code
  or link, pick a length, play. Reload to get your seat back; join mid-game to take over a robot.
- Two game lengths: **Blitz** (5–10 min: 18 trains, 25 s turns, 8 min clock) and **Classic** (~30 min: 40 trains,
  45 s turns, 28 min clock). Solo 3D offers the same two lengths.
- Cloudflare hosting: one Worker serves the site and the API; each room is a Durable Object that runs the rules.
- Room bar with turn timer, game clock and emotes; final scores reveal everyone's tickets; rematch in the same room.
- Landing page (`site/index.html`) linking all four games.
- Checks: `npm run sim` (balance + no-stall), `npm run test:online` (real browsers end to end), GitHub Actions CI.

### Changed
- Solo 3D start screen: Blitz and Classic replace Quick (20) and Long (30). Saboteur 3D keeps Quick and Long.
- The 3D start screen shows the game buttons before the rules.

## 0.x — Before multiplayer
- 2D Europe game, 2D Saboteur Express, the two 3D games, the promo trailers and the teaser (see iteration 0).
