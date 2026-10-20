// Real UI captures from ../junction3d-saboteur.html (phone portrait, 430×932 CSS px ×3), staged as one consistent game:
// Rose is the saboteur; you hold Paris–Zürich; a task in Paris clears Sandy; Rose blacks out München–Wien (Mint sighted
// in Wien); you call the meeting and eject Mint (innocent); Rose wins.
//   node tools/capture.mjs   →  assets/screens/*.png (1290×2796) + *.jpg (860 wide film copies) + rects.json
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.resolve(ROOT, '..', 'junction3d-saboteur.html');
const OUT = path.join(ROOT, 'assets/screens');
fs.mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--force-color-profile=srgb', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 430, height: 932, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const font = (f) => 'file://' + path.join(ROOT, 'assets/fonts', f);
await page.evaluateOnNewDocument((fr, nu) => {
  let s = 11; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `@font-face{font-family:Fredoka;src:url("${fr}");font-weight:300 700}@font-face{font-family:Nunito;src:url("${nu}");font-weight:200 1000}*{animation:none!important;transition:none!important}`; document.head.appendChild(st); });
}, font('Fredoka.ttf'), font('Nunito.ttf'));
await page.goto('file://' + GAME, { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('boot') && window.J, { timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RECTS = {};
async function shot(name, sels = {}) {
  await sleep(350);
  RECTS[name] = await page.evaluate((sels) => Object.fromEntries(Object.entries(sels).map(([k, q]) => [k, [...document.querySelectorAll(q)].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); })])), sels);
  const png = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: png });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-vf', 'scale=860:-1:flags=lanczos', '-q:v', '2', path.join(OUT, `${name}.jpg`)]);
  console.log('wrote', name);
}

// stage the game with the real game functions
await page.evaluate(() => {
  document.getElementById('sheet').classList.add('hidden');
  J.setFast(true); J.newGame(20, true); const S = J.S; S.locked = false; S.sab = 1;
  J.H().tickets = [{ a: 'EDI', b: 'ATH', p: 21, long: true }, { a: 'PAR', b: 'WIE', p: 7 }];
  const own = (a, b, pid) => { const r = S.routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)); r.owner = pid; S.players[pid].trains -= r.len; };
  own('PAR', 'ZUR', 0); own('PAR', 'LON', 0);
  own('BER', 'WIE', 1); own('CPH', 'STO', 1); own('AMS', 'BER', 1); own('BER', 'CPH', 1);
  own('MAD', 'BCN', 2); own('LIS', 'MAD', 2); own('WIE', 'ZAG', 3); own('ZAG', 'BUD', 3);
  S.players[1].tickets = [];
  const at = (pid, id, dx = 0, dz = 0) => { const [x, z] = J.W(id); Object.assign(J.ACT[pid], { x: x + dx, z: z + dz, path: null, still: true }); };
  at(0, 'PAR', 0, 2); at(1, 'MUN'); at(2, 'AMS'); at(3, 'WIE');
  J.H().hand = { red: 2, blue: 1, green: 3, purple: 2, white: 1, loco: 1 };
  S.round = 5; J.render();
});
// 1. the station task in Paris
await page.evaluate(() => J.openCity('PAR'));
await shot('1_task', { q: '.task .q', opts: '.task .btn', title: '.sheet h3', task: '.task' });
await page.evaluate(() => J.answer(0));
await shot('2_reward', { loco: '[data-reward="loco"]', clue: '[data-reward="clue"]', title: '.sheet h3' });
await page.evaluate(() => { const S = J.S; S.players[3].cleared = true; J.reward('clue'); S.players[3].cleared = false; J.render(); });
await shot('3_alibi', { title: '.sheet h3', msg: '.sheet p' });
// 2. round 6: Rose blacks out München–Wien (the real botSabotage, with its random picks pinned)
await page.evaluate(async () => {
  document.querySelector('[data-close]').click();
  const S = J.S; S.round = 6; S.turn = 1; S.busy = true;
  const keep = Math.random; let k = 0; Math.random = () => [0.9, 0, 0][k++] ?? keep();
  await J.botSabotage(S.players[1]); Math.random = keep;
  const [x, z] = J.W('MUN'); Object.assign(J.ACT[1], { x, z });
  S.routes.forEach((r) => { if (r.blocked) r.blocked = 2; });
  S.turn = 0; S.busy = false; J.render();
});
await shot('4_hud', { meet: '#meetBtn', use: '#useBtn', roster: '.mate', status: '#status' });
await page.evaluate(() => J.openLog());
await shot('5_log', { items: '#logList li', title: '.sheet h3' });
await page.evaluate(() => { document.querySelector('[data-close]').click(); J.openMeeting(); });
await shot('6_meeting', { votes: '.vote', title: '.sheet h3' });
await page.evaluate(() => J.vote(3));
await shot('7_verdict', { title: '.sheet h3', msg: '.sheet p', kicker: '.kicker' });
await page.evaluate(() => { document.querySelector('[data-close]').click(); J.S.lastTurns = null; });
await page.evaluate(() => { const S = J.S; S.over = false; document.getElementById('sheet').classList.add('hidden'); });
await page.evaluate(() => { J.S.players.forEach((p) => p.tickets = p.human ? p.tickets : []); });
await page.evaluate(() => { window.__end = true; });
await page.evaluate(() => { const S = J.S; S.turn = 0; });
await page.evaluate(() => { J.S.lastTurns = 1; J.endTurn(); });
await shot('8_end', { title: '.sheet h3', p: '.sheet p', rows: 'table.score tr' });
const log = await page.evaluate(() => J.S.log.slice(0, 6).map((l) => l.t));
fs.writeFileSync(path.join(OUT, 'rects.json'), JSON.stringify(RECTS, null, 1));
console.log(JSON.stringify({ log, errors }, null, 1));
await browser.close();
