// Real product captures: drives ../junction.html in headless Chrome with a seeded Math.random and
// screenshots the screens the film shows on a paper phone.
//   node tools/capture.mjs   →  assets/screens/*.png (1290×2796 sources) + *.jpg (film copies)
// Fonts: the game loads Fredoka + Nunito from Google Fonts; we inject the same OFL files from assets/fonts
// so captures are identical offline.
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.resolve(ROOT, '..', 'junction.html');
const OUT = path.join(ROOT, 'assets/screens');
fs.mkdirSync(OUT, { recursive: true });
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
const fontUrl = (f) => 'file://' + path.join(ROOT, 'assets/fonts', f);

async function load(seed) {
  await page.goto('file://' + GAME, { waitUntil: 'load' });
  await page.evaluate((seed, fr, nu) => {
    const st = document.createElement('style');
    st.textContent = `@font-face{font-family:Fredoka;src:url("${fr}");font-weight:300 700}@font-face{font-family:Nunito;src:url("${nu}");font-weight:200 900}*{animation:none!important;transition:none!important}`;
    document.head.appendChild(st);
    let s = seed >>> 0;
    Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    window.setTimeout = (f) => { window.__pending = f; return 0; };
  }, seed, fontUrl('Fredoka.ttf'), fontUrl('Nunito.ttf'));
  await page.evaluate(() => document.fonts.ready);
}
// element rectangles in CSS px (×2 = pixels in the 860-wide film copy), for live overlays drawn on the phone
const RECTS = {};
async function shot(name, sels = {}) {
  await page.evaluate(() => document.fonts.ready);
  RECTS[name] = await page.evaluate((sels) => Object.fromEntries(Object.entries(sels).map(([k, q]) =>
    [k, [...document.querySelectorAll(q)].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); })])), sels);
  await new Promise((r) => setTimeout(r, 150));
  const png = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: png });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=860:-1:flags=lanczos', '-q:v', '2', path.join(OUT, `${name}.jpg`)]);
  console.log('wrote', name);
}

// 1. the first screen: rules + Quick game / Long game
await load(1);
await page.evaluate(() => { newGame(20, true); openStart(); });
await shot('1_start', { quick: '.modes .btn.primary', title: '.sheet h3' });

// play a full bot-vs-bot game (the "You" seat played by the bot brain) and report the winner
const playJS = () => {
  sheetEl.classList.add('hidden'); newGame(20, true); S.locked = false; H().tickets = S.ticketDeck.splice(0, 2);
  let n = 0;
  while (!S.over && n++ < 600) { if (window.__pending) { const f = window.__pending; window.__pending = null; f(); } else { botTurn(H()); render(); endTurn(); } }
    // the game's own verdict (includes the +10 longest-route bonus)
  return { over: S.over, youWin: document.querySelector('#sheetBody h3').textContent === 'You win!' && /held by you/.test(document.querySelector('#sheetBody p').textContent), mine: S.routes.filter((r) => r.owner === 0).length, round: S.round };
};

// 2. a mid-game board on the player's turn (hand, market, rivals' routes on the map)
let seed = 0, res = null;
for (let s = 1; s < 600; s++) {
  await load(s);
  res = await page.evaluate(playJS);
  if (res.over && res.youWin && res.mine >= 8) { seed = s; break; }
}
console.log('winning seed', seed, res);
await load(seed);
await page.evaluate(() => {
  sheetEl.classList.add('hidden'); newGame(20, true); S.locked = false; H().tickets = S.ticketDeck.splice(0, 2);
  let n = 0;
  while (n++ < 400 && !(S.round >= 7 && S.turn === 0 && !window.__pending)) { if (window.__pending) { const f = window.__pending; window.__pending = null; f(); } else { botTurn(H()); render(); endTurn(); } }
  S.busy = false; render(); scrollTo(0, 0);
});
await shot('2_board', { market: '#market .cardface', hand: '#hand .cardface', map: '#map', roster: '.mate' });

// 3. the Zürich–Venezia tunnel: pay 2 green, three cards flip, one green matches
await page.evaluate(() => {
  const r = S.routes.find((x) => x.a === 'ZUR' && x.b === 'VEN');
  r.owner = null; const p = H(); p.trains = Math.max(p.trains, 4);
  p.hand.green = 3; p.hand.loco = 1;
  S.deck.push('blue', 'green', 'orange');
  S.selected = r.i; render();
  const o = payOptions(p, r).find((x) => x.c === 'green');
  startClaim(r.i, o);
});
await shot('3_tunnel', { cards: '.reveal .cardface', pay: '.sheet .btn.primary', msg: '.sheet p', title: '.sheet h3' });

// 4. a landmark postcard (Roma, stamped)
await page.evaluate(() => {
  closeSheet(true); S.pending = null; S.locked = false;
  const r = S.routes.find((x) => x.a === 'VEN' && x.b === 'ROM'); r.owner = 0; render();
  S.busy = true; openCity('ROM'); S.busy = false;
});
await shot('4_postcard', { stamp: '.stamp', title: '.sheet h3', icon: '.pcE', fact: '.sheet p' });

// 5. final scores of the winning game
await load(seed);
await page.evaluate(playJS);
await shot('5_scores', { title: '.sheet h3', longest: '.sheet p', rows: 'table.score tr', tot: 'td.tot' });

fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify(RECTS, null, 1));
await browser.close();
