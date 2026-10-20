// Shoots the trailer's 3D footage from the real game (../junction3d-saboteur.html) in director mode:
// fixed 1/30 s steps, scripted cameras, HUD hidden. One JPEG per film frame that has footage, plus per-frame
// screen positions of robot eyes and key points (for glows and labels drawn by the 2D trailer layer).
//   node tools/shoot.mjs [--only shotName]   →  footage/f#####.jpg + footage/meta.json  (≈15 min with software WebGL)
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.resolve(ROOT, '..', 'junction3d-saboteur.html');
const OUT = path.join(ROOT, 'footage');
fs.mkdirSync(OUT, { recursive: true });
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'script/timeline.json'), 'utf8'));
const args = process.argv.slice(2), only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
  args: ['--force-color-profile=srgb', '--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const font = (f) => 'file://' + path.join(ROOT, 'assets/fonts', f);
await page.evaluateOnNewDocument((fr, nu) => {
  let s = 23; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = `@font-face{font-family:Fredoka;src:url("${fr}");font-weight:300 700}@font-face{font-family:Nunito;src:url("${nu}");font-weight:200 1000}`; document.head.appendChild(st); });
}, font('Fredoka.ttf'), font('Nunito.ttf'));
await page.goto('file://' + GAME, { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('boot') && window.J, { timeout: 90000 });

// ---- the shot list lives in the page: setup(), events [[t, fn]], cam(t) → [pos, look, fov]
await page.evaluate((TLj) => {
  const B = TLj.beats, SC = Object.fromEntries(TLj.scenes.map((s) => [s.name, [s.start, s.end]]));
  const TOP = 1.7, EYE = TOP + 5.8;
  const W = J.W, A = J.ACT, S = () => J.S;
  const lerp = (a, b, u) => a + (b - a) * u, sm = (t, a, b) => { const x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
  const L3 = (p, q, u) => p.map((v, i) => lerp(v, q[i], u));
  const R = (a, b) => S().routes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const place = (pid, x, z, o = {}) => Object.assign(A[pid], { x, z, path: null, onArrive: null, still: o.still ?? true, spd: o.spd ?? null, pose: o.pose ?? null, ejectT: null, splashed: false });
  const at = (pid, id, dx = 0, dz = 0, o) => { const [x, z] = W(id); place(pid, x + dx, z + dz, o); };
  // base state: one staged game (Rose is the saboteur)
  document.getElementById('sheet').classList.add('hidden');
  J.setFast(false); J.newGame(20, true); const s = S(); s.locked = false; s.sab = 1; s.turn = 0; s.busy = false;
  J.H().tickets = [{ a: 'EDI', b: 'ATH', p: 21, long: true }, { a: 'PAR', b: 'WIE', p: 7 }];
  const own = (a, b, pid) => { R(a, b).owner = pid; };
  own('PAR', 'LON', 0); own('BER', 'WIE', 1); own('CPH', 'STO', 1); own('AMS', 'BER', 1); own('MAD', 'BCN', 2); own('LIS', 'MAD', 2); own('WIE', 'ZAG', 3); own('ZAG', 'BUD', 3);
  J.render(); J.dir.start(0); J.dir.hud(false);
  const tags = (pid, v) => J.ROBOTS[pid].root.children.filter((c) => c.isSprite).forEach((c) => { c.visible = v; });
  const reset = () => { [0, 1, 2, 3].forEach((i) => tags(i, true)); const s = S(); s.players.forEach((p) => { p.alive = true; }); s.routes.forEach((r) => { r.blocked = 0; }); R('PAR', 'ZUR').owner = null; J.ROBOTS.forEach((r) => { r.root.visible = true; }); J.render(); };
  const STAGE = [95, -46]; // open ground east of Warszawa, away from the rails
  const MUN = W('MUN'), WIE = W('WIE'), PAR = W('PAR'), MW = J.routeMid(R('MUN', 'WIE')), PZ = J.routeMid(R('PAR', 'ZUR'));
  const ejectPos = (u) => { const a = A[3]; if (!a.ej) return [WIE[0], WIE[1]]; return [lerp(a.ej[0], a.ej[2], u), lerp(a.ej[1], a.ej[3], u)]; };
  window.SHOTS = {
    open: { range: SC.open, setup() { reset(); at(0, 'PAR', 0, 0, { still: false }); at(1, 'MUN', 0, 0, { still: false }); at(2, 'AMS', 0, 0, { still: false }); at(3, 'WIE', 0, 0, { still: false }); R('PAR', 'ZUR').owner = 0; J.render(); },
      cam: (t) => { const u = sm(t, 0, 5.6); return [L3([-150, 175, 175], [30, 150, 150], u), L3([-60, 0, -20], [20, 0, -25], u), 55]; } },
    lineup: { range: SC.lineup, setup() { reset(); const V = [[-8.4, 2.5], [-2.8, -.5], [2.8, -.5], [8.4, 2.5]]; V.forEach(([dx, dz], i) => place(i, STAGE[0] + dx, STAGE[1] + dz, { pose: { face: 0 } })); },
      events: [[B.saboteur, () => { [1, 2, 3].forEach((i) => { A[i].pose = { face: 0, squint: .55, lookX: i === 1 ? .25 : -.25 }; }); A[0].pose = { face: 0, lookX: 0, lookY: .1 }; }]],
      cam: (t) => { const u = sm(t, SC.lineup[0], SC.lineup[1]); return [[STAGE[0] + lerp(-1.5, 1, u), EYE + 7, STAGE[1] + lerp(37, 31, u)], [STAGE[0], EYE - 1.5, STAGE[1]], 62]; } },
    build: { range: SC.build, setup() { reset(); at(0, 'PAR', 1, 1, { still: true, spd: 9 }); at(1, 'MUN'); at(2, 'AMS'); at(3, 'WIE'); A[0].path = [[lerp(PAR[0], W('ZUR')[0], .42), lerp(PAR[1], W('ZUR')[1], .42)]]; },
      events: [[B.tickets, () => { R('PAR', 'ZUR').owner = 0; J.render(); J.fx.hop(0); }]],
      cam: (t) => { const p = [A[0].x, A[0].z]; return [[p[0] - 13, TOP + 17, p[1] + 25], [p[0] + 7, TOP + 2, p[1] - 4], 58]; } },
    tasks: { range: SC.tasks, setup() { reset(); R('PAR', 'ZUR').owner = 0; J.render(); at(0, 'PAR', 0, 1); at(1, 'MUN'); at(2, 'AMS'); at(3, 'WIE'); },
      cam: (t) => { const a = lerp(-.5, .5, sm(t, SC.tasks[0], SC.tasks[1])); return [[PAR[0] + 30 * Math.sin(a), TOP + 15, PAR[1] + 30 * Math.cos(a)], [PAR[0], TOP + 4, PAR[1]], 55]; } },
    sabotage: { range: SC.sabotage, setup() { reset(); R('PAR', 'ZUR').owner = 0; at(0, 'PAR'); at(1, 'MUN', 0, 0, { spd: 15 }); at(2, 'AMS'); at(3, 'WIE', 2, 3); A[1].path = [MW]; J.render(); },
      events: [[B.fail, () => { R('MUN', 'WIE').blocked = 3; S().sabotages = 1; J.fx.sparks(MW[0], MW[1]); J.render(); }]],
      cam: (t) => { const u = sm(t, SC.sabotage[0], SC.sabotage[1]); return [[MW[0] - 9 + 3 * u, TOP + 10, MW[1] + 30 - 4 * u], [MW[0] - 4, TOP + 3.5, MW[1] - 1], 60]; } },
    sightings: { range: SC.sightings, setup() { reset(); R('PAR', 'ZUR').owner = 0; R('MUN', 'WIE').blocked = 2; at(0, 'PAR'); at(1, 'MUN', -1, 1.5); at(2, 'AMS'); at(3, 'WIE', 1, 1.5); J.render(); },
      cam: (t) => { const u = sm(t, SC.sightings[0], SC.sightings[1]); return [[MW[0], lerp(78, 62, u), MW[1] + lerp(52, 40, u)], [MW[0], 0, MW[1] + 2], 55]; } },
    meeting: { range: [B.emergency + .6, SC.meeting[1]], setup() { reset(); R('PAR', 'ZUR').owner = 0; R('MUN', 'WIE').blocked = 2; J.render(); at(0, 'PAR');
        [[1, -6.2, 2], [2, 0, -1], [3, 6.2, 2]].forEach(([pid, dx, dz]) => place(pid, STAGE[0] + dx, STAGE[1] + dz, { pose: { face: 0 } })); },
      step(t) { // Mint can't keep still; Rose watches Mint
        A[3].pose = { face: Math.sin(t * 3) * .12, lookX: Math.sin(t * 5.5) * .32, squint: t > B.pick ? 1.25 : null };
        A[1].pose = { face: 0, lookX: .3, squint: t > B.vote ? .6 : null }; A[2].pose = { face: 0, lookY: .15 }; },
      cam: (t) => { const u = sm(t, B.emergency, SC.meeting[1]); return [[STAGE[0], EYE + 4, STAGE[1] + lerp(36, 31, u)], [STAGE[0], EYE - 6.5, STAGE[1] + .5], 58]; } },
    eject: { range: SC.eject, setup() { reset(); R('PAR', 'ZUR').owner = 0; R('MUN', 'WIE').blocked = 2; J.render(); at(0, 'PAR'); at(1, 'MUN'); at(2, 'AMS'); at(3, 'WIE', 0, 1, { pose: { face: 0, squint: 1.25 } }); },
      events: [[B.thrown - .2, () => { S().players[3].alive = false; }]],
      cam: (t) => {
        const a = A[3];
        if (!a.ejectT) return [[WIE[0], EYE + 3, WIE[1] + 24], [WIE[0], EYE - .5, WIE[1] + 1], 60];
        const u = Math.min(1, (J.dir.t - a.ejectT) / 2.6), [x, z] = ejectPos(u), y = TOP + Math.sin(u * Math.PI) * 38 - u * TOP;
        const k = sm(J.dir.t, a.ejectT, a.ejectT + 3);
        return [[lerp(WIE[0], x, .55) - 6, lerp(EYE + 3, 46, k), lerp(WIE[1] + 24, z + 52, k)], [x, Math.max(0, y * .8), z], 60];
      } },
    twist: { range: SC.twist, setup() { reset(); tags(1, false); place(1, STAGE[0], STAGE[1], { pose: { face: 0, squint: .05, lookX: 0, lookY: 0 } }); at(0, 'PAR'); at(2, 'AMS'); at(3, 'WIE'); },
      step(t) { const open = sm(t, B.eye, B.eye + .5); A[1].pose = { face: 0, lookX: t > B.away ? 0 : .28 * open, lookY: 0, squint: t > B.away - .3 ? .5 : .05 + .95 * open }; },
      cam: (t) => { const u = sm(t, SC.twist[0], SC.twist[1]); return [[STAGE[0], EYE + .6, STAGE[1] + lerp(15, 10.5, u)], [STAGE[0], EYE + .1, STAGE[1]], 50]; } },
    title: { range: SC.title, setup() { reset(); R('PAR', 'ZUR').owner = 0; J.render(); at(0, 'PAR', 0, 0, { still: false }); at(1, 'MUN', 0, 0, { still: false }); at(2, 'AMS', 0, 0, { still: false }); S().players[3].alive = false; J.ROBOTS[3].root.visible = false; },
      cam: (t) => { const u = sm(t, SC.title[0], SC.title[1]); return [[lerp(-20, 20, u), 230, lerp(215, 200, u)], [0, 0, -15], 50]; } },
  };
  window.SHOOT = {
    begin(name) { const sh = SHOTS[name]; sh.setup(); sh.fired = new Set(); J.dir.start(sh.range[0] - 0.6); for (let i = 0; i < 18; i++) { this.prep(name, J.dir.t + 1 / 30); J.dir.step(1 / 30); } },
    prep(name, t) { const sh = SHOTS[name]; (sh.events || []).forEach(([te, fn], i) => { if (t >= te && !sh.fired.has(i)) { sh.fired.add(i); fn(); } }); if (sh.step) sh.step(t); const [p, l, f] = sh.cam(t); J.dir.cam(p, l, f); },
    frame(name, t) { this.prep(name, t); J.dir.step(t - J.dir.t); const eyes = {}; [0, 1, 2, 3].forEach((i) => { eyes[i] = J.ROBOTS[i].root.visible && S().players[i].alive ? J.dir.project(i) : null; });
      const pts = { MUN: J.dir.projectXZ(MUN[0], TOP, MUN[1]), WIE: J.dir.projectXZ(WIE[0], TOP, WIE[1]), MW: J.dir.projectXZ(MW[0], TOP + 6, MW[1]) };
      return { img: J.dir.grab('image/jpeg', 0.9), eyes, pts }; },
  };
}, TL);

const shots = await page.evaluate(() => Object.entries(SHOTS).map(([k, v]) => [k, v.range]));
const META = fs.existsSync(path.join(OUT, 'meta.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'meta.json'), 'utf8')) : {};
const t0 = Date.now(); let n = 0;
for (const [name, [a, b]] of shots) {
  if (only && name !== only) continue;
  await page.evaluate((nm) => SHOOT.begin(nm), name);
  for (let f = Math.ceil(a * 30 - 1e-6); f < Math.round(b * 30); f++) {
    const r = await page.evaluate((nm, t) => SHOOT.frame(nm, t), name, f / 30);
    fs.writeFileSync(path.join(OUT, `f${String(f).padStart(5, '0')}.jpg`), Buffer.from(r.img.split(',')[1], 'base64'));
    META[f] = { shot: name, eyes: r.eyes, pts: r.pts }; n++;
    if (n % 60 === 0) console.log(`${name} frame ${f} · ${n} frames · ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
fs.writeFileSync(path.join(OUT, 'meta.json'), JSON.stringify(META));
fs.writeFileSync(path.join(ROOT, 'src/footage_meta.js'), '// Generated by tools/shoot.mjs: per film frame, the shot and screen positions of robot eyes and key points.\nwindow.FMETA = ' + JSON.stringify(META) + ';\n');
console.log('done', n, 'frames', JSON.stringify(errors));
await browser.close();
