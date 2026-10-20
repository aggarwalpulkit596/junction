# Changelog

Short version of [`docs/ITERATIONS.md`](docs/ITERATIONS.md). Newest first.

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
