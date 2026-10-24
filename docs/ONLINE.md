# Online play: how it works

## Pieces

| File | What it is |
|---|---|
| `mp/engine.template.js` | The Europe online rules engine (setup, actions, turn flow, bots, clock, per-seat views). Edit this. |
| `metro/rules.js` | The Delhi Metro engine, same shape (`makeEngine`, `MODES`, `BOT_NAMES`). Imported by the Worker as is and inlined into `metro.html`. |
| `metro/metro.template.html` | The Delhi Metro client (3D board + phone HUD); `metro.html` is generated from it. |
| `mp/build.mjs` | Splices slices of `junction.html` into the template → `worker/rules.gen.js`; assembles `public/`. |
| `worker/index.js` | Cloudflare Worker (routing, room creation) and the `Room` Durable Object (one per room). |
| `tools3d/junction3d.template.html` | The 3D client. The `ONLINE` section is the multiplayer client. |
| `wrangler.toml` | Worker + static assets + Durable Object binding (`ROOMS`, SQLite storage). |

## Shared rules

`mp/build.mjs` copies these slices of `junction.html` into the engine, verbatim:

- `/* ===== data ===== */` … `/* ===== state ===== */`: cities, routes, tickets, Dijkstra
- `/* ===== payment ===== */` … `/* ===== turn flow ===== */`: `payOptions`, `payPlan`, tunnels, `claim`, stations
- `function wanted(p){` … `function botTurn(p){`: the robots' route planner
- `/* ===== scoring ===== */` … `/* ===== sheets ===== */`: `ticketScore`, `longest`

It fails loudly if a marker disappears. The engine adds what the 2D page does in its UI: the market with cities (cards
float above cities as in 3D), the turn flow, the game clock, and a bot that returns *actions* instead of mutating state.

## Two games, one Room

A room is created for one game, `europe` (Junction 3D) or `metro` (Delhi Metro), and keeps it: `POST /api/rooms {game, mode}`.
The `Room` object picks the matching engine (`GAMES[gameId].makeEngine()`), stores `gameId` in the room and reports it in
`GET /api/rooms/:code` and in every `sync`'s `room.game`. Each page joins rooms of its own game and sends you to the other
page when a code belongs to the other game. The landing page's code box peeks first and opens the right page.

## Modes

Defined once in each engine's `MODES`. The server sends them to the lobby; the client only keeps labels.

| | trains | turn | tickets phase | clock | starting tickets | bot speed |
|---|---|---|---|---|---|---|
| `blitz` | 18 | 25 s | 30 s | 8 min | 3 short, keep ≥ 1 | 1.5× |
| `classic` | 40 | 45 s | 60 s | 28 min | 1 long + 3 short, keep ≥ 2 | 1× |

Delhi Metro:

| | trains | turn | tickets phase | clock | starting tickets |
|---|---|---|---|---|---|
| `rush` | 16 | 25 s | 30 s | 10 min | 3 short, keep ≥ 1 |
| `full` | 24 | 40 s | 50 s | 25 min | 1 long + 3 short, keep ≥ 2 |

The final round starts when someone has ≤ 2 trains, every route is taken, or the clock runs out.

## A room's life

1. `POST /api/rooms {mode}` picks a free 4-letter code (no I or O) and initialises that Durable Object.
2. Players connect to `/api/rooms/ABCD/ws` and send `join {name, token?}`. A new player gets a token (stored in
   `localStorage['junction-online']`). Reconnecting with it returns the same seat.
3. Lobby: up to 4 humans; the first is host (passed on if they leave). The host picks the length and starts.
4. Game: empty seats become robots (Rose, Sandy, Mint, Bolt). Everyone chooses starting tickets at once.
5. Turns: the server validates every action against the real hand. After each change it broadcasts a `sync` to each
   socket with that seat's view and the events (who walked where, who took which card, who claimed what).
6. Robots: `tick(now)` plans a robot's next action, emits `goto` (the client walks the robot there), and applies the
   action when the walk time is up. `nextWake(now)` says when to come back, and the Durable Object sets an alarm.
7. A human whose turn timer runs out is played once by the robot brain. A human who disconnects is marked away and
   auto-played after 3 s. When they come back, they take over again.
8. Game over: final scores (with everyone's tickets) go to all players. The host can start a rematch in the same room.
9. A room nobody has touched for 30 minutes deletes itself.

## Protocol

Client → server

| message | when |
|---|---|
| `{t:'join', name, token?}` | first message on every connection |
| `{t:'mode', mode}` | host, lobby |
| `{t:'start'}` | host, lobby |
| `{t:'act', a}` | Europe: `a` = `{t:'market',i}` `{t:'deck'}` `{t:'tickets'}` `{t:'keep',idx:[…]}` `{t:'claim',ri,o:{c,n,w}}` `{t:'tunnel',go}` `{t:'station',city,o}`. Metro: `{t:'market',i}` `{t:'deck'}` `{t:'tickets'}` `{t:'keep',idx}` `{t:'drive',si,o:{c,n,w,e}}` (`e` = the extra pass of a depot run, or null) `{t:'jam',si}` |
| `{t:'pos', x, z}` | your robot moved (relayed to others, ~10/s max) |
| `{t:'emote', e}` | 👋 👍 😮 😅 🔥 GG |
| `{t:'again'}` | host, after game over |
| `{t:'leave'}` | a robot takes your seat |

Server → client

| message | meaning |
|---|---|
| `{t:'sync', room, v, ev, now}` | `room` = lobby info; `v` = your view of the game (or null in the lobby); `ev` = events since the last sync; `now` = server time (for timers) |
| `{t:'pos', s, x, z}` | another player's robot position (seat already rotated) |
| `{t:'emote', s, e, name}` | an emote |
| `{t:'err', msg}` | your action was refused (a fresh sync follows) |
| `{t:'bye', msg, keep?}` | you're out of the room (`keep`: you opened it in another tab) |

Metro events in `ev`: `drive {s, si, path:[stations], depot}` (the client animates the train along `path`), `pick`, `deck`,
`tix`, `jam {s, si}`, `fail {si}`, `turn`, `final`, `over`.

## What a view hides

Other players' hands (only the count), other players' tickets (only the count, revealed at game over), the deck and
ticket deck order, and the details of someone else's tunnel payment. Seats are rotated so you are player 0. Every
seat index in the view and in events is rotated the same way.

## Trust

The server checks every action: turn order, draw rules, exact payment options, tunnel costs, station costs. Robot
positions are cosmetic and not checked. A player could take a floating card without walking to it by sending a crafted
message. That's fine among friends, and it's the next thing to tighten if this goes public.

## Costs

The Workers Free plan covers casual play. Hibernating WebSockets mean an idle room costs nothing while players think.
Each action is one Durable Object request plus one storage write of the room (a few KB).
