// Headless check of Rush Hour Live on a virtual clock: robots drive every seat.
//   node mp/live-sim.mjs [commutes]
import { makeEngine, MODES } from '../metro/live.js';
const N = +(process.argv[2] || 100);
const out = [];
for (let g = 0; g < N; g++) {
  const E = makeEngine(); let now = 0, steps = 0, stall = false;
  const seats = ['Rose', 'Sandy', 'Mint', 'Bolt'].map((name) => ({ name, bot: true }));
  E.newGame(seats, 'live', now);
  const c = { drives: 0, depots: 0, grabs: 0, jams: 0, fails: 0, goes: 0, incomes: 0 }, rounds = [];
  while (!E.S.over) {
    if (++steps > 200000) { stall = true; break; }
    const ev = E.tick(now);
    for (const e of ev) { if (e.k === 'drive') { c.drives++; if (e.depot) c.depots++; } else if (e.k === 'grab') c.grabs++; else if (e.k === 'jam') c.jams++; else if (e.k === 'fail') c.fails++; else if (e.k === 'go') c.goes++; else if (e.k === 'income') c.incomes++; else if (e.k === 'roundEnd') rounds.push({ len: (now - E.S.roundStart) / 1000, trainsLeft: E.S.players.map((p) => p.trains), claimed: E.S.segs.filter((s) => s.owner !== null).length, top: E.S.final.rows[0].total, bottom: E.S.final.rows[3].total, tix: E.S.final.rows.reduce((a, r) => a + r.det.filter(Boolean).length, 0) }); }
    const w = E.nextWake(now); if (w === null) break; now = Math.max(now + 1, w);
  }
  out.push({ over: E.S.over, stall, minutes: now / 60000, steps, ...c, rounds, win: E.S.commute && E.S.commute[0].s });
}
const avg = (f) => (out.reduce((a, r) => a + f(r), 0) / out.length);
const rnds = out.flatMap((r) => r.rounds);
console.log(JSON.stringify({
  commutes: N, finished: out.filter((r) => r.over).length, stalls: out.filter((r) => r.stall).length,
  minutesPerCommute: avg((r) => r.minutes).toFixed(1), ticksPerCommute: Math.round(avg((r) => r.steps)),
  roundSeconds: (rnds.reduce((a, r) => a + r.len, 0) / rnds.length).toFixed(0), roundsEndedByTime: rnds.filter((r) => r.len >= MODES.live.roundSec - .5).length + '/' + rnds.length,
  avgTrainsLeftAtEnd: (rnds.reduce((a, r) => a + r.trainsLeft.reduce((x, y) => x + y, 0) / 4, 0) / rnds.length).toFixed(1),
  avgClaimedOf66: (rnds.reduce((a, r) => a + r.claimed, 0) / rnds.length).toFixed(1), avgTopRound: (rnds.reduce((a, r) => a + r.top, 0) / rnds.length).toFixed(1), avgBottomRound: (rnds.reduce((a, r) => a + r.bottom, 0) / rnds.length).toFixed(1),
  ticketsDoneOf8: (rnds.reduce((a, r) => a + r.tix, 0) / rnds.length).toFixed(1),
  perCommute: { drives: avg((r) => r.drives).toFixed(1), depotShare: (avg((r) => r.depots) / avg((r) => r.drives)).toFixed(2), grabs: avg((r) => r.grabs).toFixed(1), goes: avg((r) => r.goes).toFixed(1), jams: avg((r) => r.jams).toFixed(1), fails: avg((r) => r.fails).toFixed(1), incomes: avg((r) => r.incomes).toFixed(0) },
  winsBySeat: [0, 1, 2, 3].map((s) => out.filter((r) => r.win === s).length),
}));
