// End-to-end online test: real browsers against `wrangler dev`.
//   npx wrangler dev --port 8787 --var BOT_PACE:0.15     (in another terminal; BOT_PACE speeds the robots up)
//   node mp/e2e.mjs [base] [mode]                        default http://localhost:8787 blitz
// Two players create and join a room, play a whole game through the real 3D page (deck draws, claims, tunnels,
// tickets), one reloads mid-game and must get its seat back, and a third joins mid-game and takes over a robot.
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:8787', MODE = process.argv[3] || 'blitz';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { if (!ok) { console.error('FAIL:', msg); errors.push(msg); } else console.log('ok:', msg); };

async function player(name, url) {
  const ctx = await browser.createBrowserContext(); // separate localStorage per player
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  await page.evaluateOnNewDocument((n) => localStorage.setItem('junction-name', JSON.stringify(n)), name);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('boot'), { timeout: 30000 });
  return page;
}
const click = (page, sel) => page.$eval(sel, (b) => b.click());
const net = (page) => page.evaluate(() => { const N = JN.NET; return { on: N.on, room: N.room, v: N.v && { phase: N.v.phase, turn: N.v.turn, over: N.v.over, round: N.v.round, owners: N.v.owners, players: N.v.players.map((p) => p.name), seat: N.v.players[0].seat, final: N.v.final } }; });

// one step of a simple player brain driven through the page's own UI functions
const brain = () => {
  const S = JN.S, N = JN.NET; if (!N.v || N.v.over) return 'idle';
  if (S.offer) { const keep = S.offer.keep; keep.clear(); for (let i = 0; i < S.offer.min; i++) keep.add(i); JN.confirmTickets(); return 'keep'; }
  if (S.pending) { JN.tunnelResolve(true); return 'tunnel'; }
  if (!JN.canAct()) return 'wait';
  const me = JN.H();
  if (!S.drawn) {
    let best = null;
    S.routes.forEach((r) => { if (r.owner !== null) return; const o = JN.payOptions(me, r)[0]; if (o && (!best || r.len > best.r.len)) best = { r, o }; });
    if (best && (best.r.len >= 2 || me.trains <= 3)) { JN.openRoute(best.r.i); JN.startClaim(best.r.i, best.o); return 'claim ' + best.r.i; }
    if (Math.random() < 0.08 && S.ticketDeck.length && me.trains > 8) { JN.drawTickets(); return 'tickets'; }
  }
  if (S.deck.length + S.discard.length) { JN.takeDeck(); return 'deck'; }
  const i = S.market.findIndex((c) => c && c !== 'loco'); if (i >= 0) { JN.takeMarket(i); return 'market'; }
  return 'stuck';
};

try {
  // ---- host creates a room
  const host = await player('Ada', BASE + '/junction3d.html');
  await click(host, '[data-net="online"]');
  await host.waitForSelector('#netName');
  await host.evaluate((m) => { document.querySelector(`[data-pickmode="${m}"]`).click(); }, MODE);
  await click(host, '[data-net="create"]');
  await host.waitForFunction(() => JN.NET.room && JN.NET.room.code, { timeout: 15000 });
  const code = (await net(host)).room.code;
  check(/^[A-Z]{4}$/.test(code), `host created room ${code}`);
  check(await host.evaluate(() => location.search === '?room=' + JN.NET.code), 'room code is in the address bar');

  // ---- guest joins by link
  const guest = await player('Bea', `${BASE}/junction3d.html?room=${code}`);
  await guest.waitForSelector('#netCode');
  check(await guest.$eval('#netCode', (i) => i.value) === code, 'invite link pre-fills the code');
  await click(guest, '[data-net="join"]');
  await guest.waitForFunction(() => JN.NET.room && JN.NET.room.seats.filter(Boolean).length === 2, { timeout: 15000 });
  await host.waitForFunction(() => JN.NET.room.seats.filter(Boolean).length === 2, { timeout: 15000 });
  check(true, 'both players see 2 seats in the lobby');
  check(await guest.$('[data-net="start"]') === null && await host.$('[data-net="start"]') !== null, 'only the host has a Start button');

  // ---- start
  await click(host, '[data-net="start"]');
  await Promise.all([host, guest].map((p) => p.waitForFunction(() => JN.NET.v && JN.S && JN.S.offer, { timeout: 15000 })));
  const hv = await net(host), gv = await net(guest);
  check(hv.v.players[0] === 'Ada' && gv.v.players[0] === 'Bea', 'each player sees themself as player 0');
  check(hv.v.players.length === 4 && hv.v.players.slice(2).every((n) => ['Rose', 'Sandy', 'Mint', 'Bolt'].includes(n)), `robots fill the empty seats: ${hv.v.players.join(', ')}`);
  check(await host.evaluate(() => !!document.querySelector('#sheetBody [data-keep]')), 'ticket choice sheet is open');
  check(await host.evaluate(() => JN.S.players[1].hand._ !== undefined && !JN.S.players[1].tickets.length), 'rivals’ hands and tickets are hidden');

  // ---- play; reload the guest mid-game; a third player joins mid-game
  let reloaded = false, third = null, lastRound = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 8 * 60 * 1000) {
    const pages = third ? [host, guest, third] : [host, guest];
    for (const p of pages) await p.evaluate(brain).catch(() => {});
    const h = await net(host);
    if (h.v && h.v.over) break;
    if (h.v && h.v.round !== lastRound) { lastRound = h.v.round; process.stdout.write(`round ${lastRound} `); }
    if (!reloaded && h.v && h.v.round >= 3) {
      reloaded = true;
      const before = await guest.evaluate(() => JN.H().trains);
      await guest.reload({ waitUntil: 'load' });
      await guest.waitForFunction(() => JN.NET.v && JN.NET.v.players[0].name === 'Bea', { timeout: 20000 });
      check(await guest.evaluate(() => JN.H().trains) <= before, 'guest reloaded mid-game and got the same seat back');
    }
    if (!third && h.v && h.v.round >= 5) {
      third = await player('Cy', `${BASE}/junction3d.html?room=${code}`);
      await third.waitForSelector('#netCode');
      await click(third, '[data-net="join"]');
      await third.waitForFunction(() => JN.NET.v && JN.NET.v.players[0].name === 'Cy', { timeout: 20000 });
      check(true, 'a third player joined mid-game and took over a robot');
    }
    await sleep(120);
  }
  console.log();
  const H = await net(host), G = await net(guest);
  check(H.v.over && G.v.over, `game finished (round ${H.v.round}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  // both players must agree on the board: un-rotate the route owners to real seats
  const real = (o, seat) => o.map((x) => (x === null ? null : (x + seat) % 4));
  check(JSON.stringify(real(H.v.owners, H.v.seat)) === JSON.stringify(real(G.v.owners, G.v.seat)), 'host and guest see the same board');
  check(H.v.final && H.v.final.length === 4, `final scores: ${H.v.final.map((r) => `${H.v.players[r.s]} ${r.total}`).join(', ')}`);
  await host.waitForFunction(() => /Final scores/.test(document.getElementById('sheetBody').textContent), { timeout: 10000 });
  check(true, 'final score sheet shown');
  if (process.env.SHOT) await host.screenshot({ path: process.env.SHOT });
  check(await host.$('[data-net="again"]') !== null, 'host can start another game');
  await click(host, '[data-net="again"]');
  await guest.waitForFunction(() => JN.NET.room && JN.NET.room.phase === 'lobby', { timeout: 10000 });
  check(true, 'everyone is back in the lobby for a rematch');
} catch (e) {
  errors.push('exception: ' + e.message);
  console.error(e);
}
await browser.close();
const real = errors.filter((e) => !/WebSocket connection to .* failed|ERR_INTERNET_DISCONNECTED/.test(e));
console.log(real.length ? `\n${real.length} problem(s):\n` + real.join('\n') : '\nall online checks passed');
process.exit(real.length ? 1 : 0);
