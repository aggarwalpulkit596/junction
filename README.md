# Junction

A walk-around 3D rail game across Europe. Walk your Sprocket robot between 28 cities, grab floating train cards,
claim routes and finish your destination tickets. Play **online with up to 4 friends** (robots fill any empty seat), or
solo against three robots.

**Play now: https://junction.aggarwalpulkit596.workers.dev** (3D game: `/junction3d.html`)

Original name, map and cartoon art. No build step for the games themselves: each one is a single HTML file.

| Game | File | Online |
|---|---|---|
| **Junction 3D** (the main game) | `junction3d.html` (generated) | ✅ up to 4 players |
| Junction 2D | `junction.html` | solo |
| Saboteur Express (2D) | `junction-saboteur.html` | solo |
| Saboteur Express 3D | `junction3d-saboteur.html` (generated) | solo |

## Two game lengths

| | Blitz | Classic |
|---|---|---|
| Length | **5 to 10 minutes** | **about 30 minutes** |
| Trains each | 18 | 40 (fills the map) |
| Turn timer (online) | 25 s | 45 s |
| Game clock (online) | 8 min, then one final round | 28 min, then one final round |
| Starting tickets | 3 short, keep ≥ 1 | 1 long + 3 short, keep ≥ 2 |

The numbers come from `mp/sim.mjs`, which plays thousands of games on a virtual clock with human-paced seats.
Blitz runs about 4.5 min solo with robots and ~9 min with 4 people. Classic runs about 11 min solo and ~29 min with 4.
The game clock caps both, even when nobody moves (`mp/timeout-check.mjs`).

## How online play works

```mermaid
flowchart LR
  A[Browser: junction3d.html] -- "WebSocket: intentions (claim, draw, keep…)" --> W[Cloudflare Worker]
  W -- "/api/rooms/ABCD/ws" --> R[(Room Durable Object<br/>rules engine + SQLite)]
  R -- "sync: the game as you may see it" --> A
  R -- "alarms" --> R
```

- **The server owns the game.** The deck, every hand and every ticket stay on the server. Each player gets a view with
  only their own cards, rotated so they are always player 0 (the 3D client's "You").
- **One rules engine.** `mp/build.mjs` slices payment, bot routing and scoring out of `junction.html` into the server
  engine, the same way `tools3d/build.py` builds the 3D page. Fix a rule once and every version gets it.
- **Robots are never in the way.** They fill empty seats, walk to their target before acting (paced by Durable Object
  alarms), and take over a human's turn when the timer runs out or the player disconnects. Reload the page and you get
  your seat back. A friend who joins mid-game takes over a robot.
- **Hosting** is one Worker that serves the static site in `public/` and the `/api/*` endpoints. It runs on the
  Workers Free plan (SQLite-backed Durable Objects).

Protocol and internals: [`docs/ONLINE.md`](docs/ONLINE.md).

## Run it locally

```bash
npm install                 # wrangler + puppeteer-core (tests use your installed Google Chrome)
npm run dev                 # builds everything, then serves http://localhost:8787 with the multiplayer server
npm run dev:fast            # same, with robots that move ~6x faster (handy for testing)
```

Open `http://localhost:8787/junction3d.html` in two browser windows (or a normal and a private one), create a room
in one and join with the code in the other.

## Deploy to Cloudflare

```bash
npx wrangler login          # once: opens the browser to authorise your Cloudflare account
npm run deploy              # builds and deploys to https://junction.<your-subdomain>.workers.dev
```

To deploy automatically from GitHub on every push to `main`, add two repository secrets: `CLOUDFLARE_API_TOKEN`
(a token from the "Edit Cloudflare Workers" template) and `CLOUDFLARE_ACCOUNT_ID`. See `.github/workflows/deploy.yml`.

## Checks

```bash
npm run build               # rebuild the 3D pages, the server engine and public/
npm run sim                 # online engine: balance for both lengths + no-stall checks (Node only, a few seconds)
node tools3d/sim.mjs 100 18 # solo 3D game in headless Chrome (needs puppeteer-core)
npm run dev:fast            # then, in another terminal:
npm run test:online         # real browsers: create, join, reload, mid-game join, a whole game, rematch
```

## Project layout

```
junction.html                 2D game, and the source of the shared rules
junction-saboteur.html        2D Saboteur Express
tools3d/                      3D template + build scripts (junction3d*.html are generated from here)
mp/                           online: engine template, build, sims, end-to-end test
worker/                       Cloudflare Worker + Room Durable Object (rules.gen.js is generated)
site/                         landing page, favicon, headers
public/                       built site that Cloudflare serves (generated, not committed)
promo/, promo-saboteur/       trailer pipelines (big media is not committed)
video/                        gameplay teaser recorder
docs/                         ONLINE.md (how multiplayer works), ITERATIONS.md (what changed, and why)
```

## History

Every change is a numbered iteration: see [`docs/ITERATIONS.md`](docs/ITERATIONS.md) for the story and
[`CHANGELOG.md`](CHANGELOG.md) for the short version. `git log` has one commit per iteration.
