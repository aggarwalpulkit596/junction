// Headless check of the online rules engine on a virtual clock.
//   node mp/sim.mjs [games] [mode] [humans]
// Bots play every seat. `humans` seats are played by the bot brain but with human-like pacing
// (a few seconds to walk and decide per action), so the reported minutes estimate a real game.
import { makeEngine, MODES } from '../worker/rules.gen.js';

const N = +(process.argv[2] || 200), MODE = process.argv[3] || 'blitz', HUM = +(process.argv[4] ?? 1);
if (process.env.TRAINS) MODES[MODE].trains = +process.env.TRAINS; // tuning: try another train count
const humanDelay = () => 4000 + Math.random() * 6000; // per action: walk to a card or route, then decide
const out = [];
for (let g = 0; g < N; g++) {
  const E = makeEngine();
  let now = 0;
  const seats = [0, 1, 2, 3].map((i) => ({ name: i < HUM ? `Human${i}` : ['Rose', 'Sandy', 'Mint', 'Bolt'][i], bot: i >= HUM }));
  E.newGame(seats, MODE, now);
  let steps = 0, stall = false, errors = 0, humanAt = null;
  while (!E.S.over) {
    if (++steps > 20000) { stall = true; break; }
    E.tick(now);
    if (E.S.over) break;
    const S = E.S;
    // human seats act after a human-ish delay (initial tickets: everyone at once)
    const humanSeat = S.phase === 'tickets' ? Object.keys(S.offers).map(Number).find((s) => !S.players[s].bot)
      : (!S.players[S.turn].bot ? S.turn : undefined);
    const wake = E.nextWake(now);
    if (humanSeat !== undefined) {
      if (humanAt === null) humanAt = now + humanDelay();
      if (humanAt <= (wake ?? Infinity)) {
        now = Math.max(now, humanAt); humanAt = null;
        const a = E.botNext(humanSeat);
        if (a) { const r = E.act(humanSeat, a, now); if (!r.ok) errors++; }
        continue;
      }
    } else humanAt = null;
    if (wake === null) { stall = true; break; }
    now = Math.max(now + 1, wake);
  }
  const S = E.S;
  out.push({ over: S.over, stall, errors, round: S.round, min: now / 60000, claimed: S.routes.filter((r) => r.owner !== null).length,
    clockEnded: S.log.some((l) => /Time’s up/.test(l.t)), win: S.final && S.final[0].s, top: S.final && S.final[0].total,
    tickets: S.players.map((p) => p.tickets.length), marketOk: S.market.every((c, i) => !c || !!S.marketCity[i]) });
}
const avg = (f) => (out.reduce((a, r) => a + f(r), 0) / out.length);
const mins = out.map((r) => r.min).sort((a, b) => a - b);
console.log(JSON.stringify({
  mode: MODE, trains: MODES[MODE].trains, humans: HUM, games: N, finished: out.filter((r) => r.over).length, stalls: out.filter((r) => r.stall).length,
  actionErrors: out.reduce((a, r) => a + r.errors, 0), avgRounds: avg((r) => r.round).toFixed(1), maxRounds: Math.max(...out.map((r) => r.round)),
  minutes: { p10: mins[Math.floor(N * .1)].toFixed(1), median: mins[Math.floor(N / 2)].toFixed(1), p90: mins[Math.floor(N * .9)].toFixed(1), max: mins[N - 1].toFixed(1) },
  clockEndedGames: out.filter((r) => r.clockEnded).length, avgClaimed: avg((r) => r.claimed).toFixed(1), avgTopScore: avg((r) => r.top).toFixed(1),
  avgTicketsPerPlayer: avg((r) => r.tickets.reduce((a, b) => a + b, 0) / 4).toFixed(2), marketCitiesOk: out.every((r) => r.marketOk),
  winsBySeat: [0, 1, 2, 3].map((s) => out.filter((r) => r.win === s).length),
}));
