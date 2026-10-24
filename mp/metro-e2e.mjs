// End-to-end online test for Junction: Delhi Metro, in real browsers against `wrangler dev`.
//   npx wrangler dev --port 8787 --var BOT_PACE:0.15     (in another terminal)
//   node mp/metro-e2e.mjs [base] [mode]                  default http://localhost:8787 rush; mode 'live' plays Rush Hour Live
// Two players create and join a metro room, play a whole game through the real page (passes, drives, tickets, a jam),
// one reloads mid-game and gets its seat back, a third joins mid-game and takes over a robot, then a rematch.
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:8787', MODE = process.argv[3] || 'rush', LIVE_TEST = MODE === 'live';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, msg) => { if (!ok) { console.error('FAIL:', msg); errors.push(msg); } else console.log('ok:', msg); };

async function player(name, url) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 420, height: 860 });
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|WebGL/.test(m.text())) errors.push(`${name} console: ${m.text()}`); });
  await page.evaluateOnNewDocument((n) => { localStorage.setItem('metro-name', JSON.stringify(n)); localStorage.setItem('metro-help-seen', '1'); }, name);
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !document.getElementById('boot'), { timeout: 30000 });
  return page;
}
const click = (page, sel) => page.$eval(sel, (b) => b.click());
const net = (page) => page.evaluate(() => { const N = J.NET, V = J.V; return { on: N.on, room: N.room, v: V && { phase: V.phase, turn: V.turn, over: V.over, round: V.round, owners: V.owners, players: V.players.map((p) => p.name), seat: V.players[0].seat, final: V.game === 'live' ? null : V.final } }; });

// a simple player brain driven through the page's own functions
const liveBrain = () => {
  const V = J.V; if (!V || V.over || V.game !== 'live' || V.phase !== 'play') return 'idle';
  const me = V.players[0]; if (me.moving) return 'moving';
  if (me.jam && V.round >= 2 && Math.random() < .05) { const free = J.SEGS.find((s) => V.owners[s.i] === null && !J.blockedV(s.i)); if (free) { J.send({ t: 'jam', si: free.i }); return 'jam'; } }
  let best = null;
  J.SEGS.forEach((s) => { if (V.owners[s.i] !== null || J.blockedV(s.i)) return; const dep = !J.touchesV(s); const o = J.payOptionsV(s, dep)[0]; if (o && (!best || (!dep && best.dep) || s.len > best.s.len)) best = { s, o, dep }; });
  if (best) { J.send({ t: 'drive', si: best.s.i, o: best.o }); return 'drive'; }
  const f = (V.floats || []).find((f) => J.onMyLine(f.id) && f.id !== me.at); if (f && me.at) { J.send({ t: 'go', id: f.id }); return 'go'; }
  return 'wait';
};
const brain = () => {
  const V = J.V; if (!V || V.over) return 'idle';
  if (V.game === 'live') return liveBrain();
  if (V.offer) { J.keepAll(); return 'keep'; }
  if (!J.myTurn()) return 'wait';
  const me = V.players[0];
  if (!V.drawn) {
    if (me.jam && V.round >= 3 && Math.random() < .3) { const free = J.SEGS.find((s) => V.owners[s.i] === null && !J.blockedV(s.i)); if (free) { J.send({ t: 'jam', si: free.i }); return 'jam'; } }
    let best = null;
    J.SEGS.forEach((s) => { if (V.owners[s.i] !== null || J.blockedV(s.i)) return; const dep = !J.touchesV(s); const o = J.payOptionsV(s, dep)[0]; if (o && (!best || s.len > best.s.len)) best = { s, o }; });
    if (best && (best.s.len >= 2 || me.trains <= 3)) { J.send({ t: 'drive', si: best.s.i, o: best.o }); return 'drive ' + best.s.i; }
    if (Math.random() < 0.06 && V.ticketDeckN && me.trains > 8) { J.send({ t: 'tickets' }); return 'tickets'; }
  }
  if (V.deckN + V.discardN) { J.send({ t: 'deck' }); return 'deck'; }
  const i = V.market.findIndex((c) => c && c !== 'W'); if (i >= 0) { J.send({ t: 'market', i }); return 'market'; }
  return 'stuck';
};

try {
  const host = await player('Asha', BASE + '/metro.html');
  await click(host, '[data-x="online"]');
  await host.waitForSelector('#netName');
  await host.evaluate((m) => { document.querySelector(`[data-pickmode="${m}"]`).click(); }, MODE);
  await click(host, '[data-x="create"]');
  await host.waitForFunction(() => J.NET.room && J.NET.room.code, { timeout: 15000 });
  const code = (await net(host)).room.code;
  check(/^[A-Z]{4}$/.test(code), `host created room ${code}`);
  check((await net(host)).room.game === (LIVE_TEST ? 'live' : 'metro'), LIVE_TEST ? 'the room is a Rush Hour Live room' : 'the room is a metro room');
  check(await host.evaluate(() => location.search === '?room=' + J.NET.code), 'room code is in the address bar');

  const guest = await player('Bikram', `${BASE}/metro.html?room=${code}`);
  await guest.waitForSelector('#netCode');
  check(await guest.$eval('#netCode', (i) => i.value) === code, 'invite link pre-fills the code');
  await click(guest, '[data-x="join"]');
  await guest.waitForFunction(() => J.NET.room && J.NET.room.seats.filter(Boolean).length === 2, { timeout: 15000 });
  await host.waitForFunction(() => J.NET.room.seats.filter(Boolean).length === 2, { timeout: 15000 });
  check(true, 'both players see 2 seats in the lobby');
  check(await guest.$('[data-x="netstart"]') === null && await host.$('[data-x="netstart"]') !== null, 'only the host has a Start button');

  await click(host, '[data-x="netstart"]');
  await Promise.all([host, guest].map((p) => p.waitForFunction(() => J.V && (J.V.offer || J.V.game === 'live'), { timeout: 15000 })));
  const hv = await net(host), gv = await net(guest);
  check(hv.v.players[0] === 'Asha' && gv.v.players[0] === 'Bikram', 'each player sees themself as player 0');
  check(hv.v.players.length === 4 && hv.v.players.slice(2).every((n) => ['Rose', 'Sandy', 'Mint', 'Bolt'].includes(n)), `robots fill the empty seats: ${hv.v.players.join(', ')}`);
  if (LIVE_TEST) check(await host.evaluate(() => J.V.game === 'live' && J.V.phase === 'play' && J.V.floats.length > 0), 'live round 1 is running with floating passes');
  else check(await host.evaluate(() => !!document.querySelector('#sheetBody [data-keep]')), 'ticket choice sheet is open');
  check(await host.evaluate(() => J.V.players[1].hand === null && J.V.players[1].tickets === null), 'rivals’ hands and tickets are hidden');

  let reloaded = false, third = null, lastRound = 0, jams = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 12 * 60 * 1000) {
    const pages = third ? [host, guest, third] : [host, guest];
    for (const p of pages) { const r = await p.evaluate(brain).catch(() => ''); if (r === 'jam') jams++; }
    const h = await net(host);
    if (h.v && h.v.over) break;
    if (h.v && h.v.round !== lastRound) { lastRound = h.v.round; process.stdout.write(`round ${lastRound} `); }
    if (!reloaded && h.v && (LIVE_TEST ? h.v.round >= 2 : h.v.round >= 3)) {
      reloaded = true;
      const before = await guest.evaluate(() => J.V.players[0].trains);
      await guest.reload({ waitUntil: 'load' });
      await guest.waitForFunction(() => J.V && J.V.players[0].name === 'Bikram', { timeout: 20000 });
      check(await guest.evaluate(() => J.V.players[0].trains) <= before, 'guest reloaded mid-game and got the same seat back');
    }
    if (!third && h.v && (LIVE_TEST ? h.v.round >= 2 && reloaded : h.v.round >= 5)) {
      third = await player('Chitra', `${BASE}/metro.html?room=${code}`);
      await third.waitForSelector('#netCode');
      await click(third, '[data-x="join"]');
      await third.waitForFunction(() => J.V && J.V.players[0].name === 'Chitra', { timeout: 20000 });
      check(true, 'a third player joined mid-game and took over a robot');
    }
    await sleep(120);
  }
  console.log();
  const H = await net(host), G = await net(guest);
  check(H.v.over && G.v.over, `game finished (round ${H.v.round}, ${Math.round((Date.now() - t0) / 1000)}s, ${jams} jams by test players)`);
  const real = (o, seat) => o.map((x) => (x === null ? null : (x + seat) % 4));
  check(JSON.stringify(real(H.v.owners, H.v.seat)) === JSON.stringify(real(G.v.owners, G.v.seat)), 'host and guest see the same board');
  if (LIVE_TEST) { const c = await host.evaluate(() => J.V.commute); check(c && c.length === 4 && c[0].totals.length === 3, `commute standings after 3 rounds: ${c.map((r) => `${H.v.players[r.s]} ${r.total}`).join(', ')}`); }
  else check(H.v.final && H.v.final.length === 4, `final scores: ${H.v.final.map((r) => `${H.v.players[r.s]} ${r.total}`).join(', ')}`);
  await host.waitForFunction(() => /Final scores|Commute standings/.test(document.getElementById('sheetBody').textContent), { timeout: 10000 });
  check(true, LIVE_TEST ? 'commute standings sheet shown' : 'final score sheet shown');
  if (process.env.SHOT) await host.screenshot({ path: process.env.SHOT });
  check(await host.$('[data-x="again"]') !== null, 'host can start another game');
  await click(host, '[data-x="again"]');
  await guest.waitForFunction(() => J.NET.room && J.NET.room.phase === 'lobby', { timeout: 10000 });
  check(true, 'everyone is back in the lobby for a rematch');
} catch (e) {
  errors.push('exception: ' + e.message);
  console.error(e);
}
await browser.close();
const real = errors.filter((e) => !/WebSocket connection to .* failed|ERR_INTERNET_DISCONNECTED/.test(e));
console.log(real.length ? `\n${real.length} problem(s):\n` + real.join('\n') : '\nall metro online checks passed');
process.exit(real.length ? 1 : 0);
