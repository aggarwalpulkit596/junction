// Headless check of the Delhi Metro rules engine on a virtual clock.
//   node mp/metro-sim.mjs [games] [mode] [humans]
// Bots play every seat. `humans` seats are played by the bot brain with human-like pacing (a few seconds per action),
// so the reported minutes estimate a real game.
import { makeEngine, MODES, SEGS, TICKETS } from '../metro/rules.js';

const N = +(process.argv[2] || 200), MODE = process.argv[3] || 'rush', HUM = +(process.argv[4] ?? 1);
if (process.env.TRAINS) MODES[MODE].trains = +process.env.TRAINS;
const humanDelay = () => 3000 + Math.random() * 5000;
const out = [];
for (let g = 0; g < N; g++) {
  const E = makeEngine();
  let now = 0;
  const seats = [0, 1, 2, 3].map((i) => ({ name: i < HUM ? `Human${i}` : ['Rose', 'Sandy', 'Mint', 'Bolt'][i], bot: i >= HUM }));
  E.newGame(seats, MODE, now);
  let steps = 0, stall = false, errors = 0, humanAt = null, jams = 0, fails = 0, depots = 0, drives = 0;
  const count = (ev) => ev.forEach((e) => { if (e.k === 'jam') jams++; if (e.k === 'fail') fails++; if (e.k === 'drive') { drives++; if (e.depot) depots++; } });
  while (!E.S.over) {
    if (++steps > 20000) { stall = true; break; }
    count(E.tick(now));
    if (E.S.over) break;
    const S = E.S;
    const humanSeat = S.phase === 'tickets' ? Object.keys(S.offers).map(Number).find((s) => !S.players[s].bot) : (!S.players[S.turn].bot ? S.turn : undefined);
    const wake = E.nextWake(now);
    if (humanSeat !== undefined) {
      if (humanAt === null) humanAt = now + humanDelay();
      if (humanAt <= (wake ?? Infinity)) {
        now = Math.max(now, humanAt); humanAt = null;
        const a = E.botNext(humanSeat);
        if (a) { const r = E.act(humanSeat, a, now); if (!r.ok) errors++; else count(r.ev); }
        continue;
      }
    } else humanAt = null;
    if (wake === null) { stall = true; break; }
    now = Math.max(now + 1, wake);
  }
  const S = E.S;
  out.push({ over: S.over, stall, errors, round: S.round, min: now / 60000, claimed: S.segs.filter((s) => s.owner !== null).length, jams, fails, depots, drives,
    clockEnded: S.log.some((l) => /Time’s up/.test(l.t)), win: S.final && S.final[0].s, top: S.final && S.final[0].total,
    ticketsDone: S.final ? S.final.reduce((a, r) => a + r.det.filter(Boolean).length, 0) : 0, tickets: S.players.reduce((a, p) => a + p.tickets.length, 0) });
}
const avg = (f) => out.reduce((a, r) => a + f(r), 0) / out.length;
const mins = out.map((r) => r.min).sort((a, b) => a - b);
console.log(JSON.stringify({
  mode: MODE, trains: MODES[MODE].trains, humans: HUM, games: N, segments: SEGS.length, units: SEGS.reduce((a, s) => a + s.len, 0), tickets: TICKETS.length,
  finished: out.filter((r) => r.over).length, stalls: out.filter((r) => r.stall).length, actionErrors: out.reduce((a, r) => a + r.errors, 0),
  avgRounds: avg((r) => r.round).toFixed(1), maxRounds: Math.max(...out.map((r) => r.round)),
  minutes: { p10: mins[Math.floor(N * .1)].toFixed(1), median: mins[Math.floor(N / 2)].toFixed(1), p90: mins[Math.floor(N * .9)].toFixed(1), max: mins[N - 1].toFixed(1) },
  clockEndedGames: out.filter((r) => r.clockEnded).length, avgClaimed: avg((r) => r.claimed).toFixed(1), avgTopScore: avg((r) => r.top).toFixed(1),
  avgJams: avg((r) => r.jams).toFixed(2), avgFails: avg((r) => r.fails).toFixed(2), depotShare: (avg((r) => r.depots) / avg((r) => r.drives)).toFixed(2),
  ticketsDoneShare: (avg((r) => r.ticketsDone) / avg((r) => r.tickets)).toFixed(2), winsBySeat: [0, 1, 2, 3].map((s) => out.filter((r) => r.win === s).length),
}));
