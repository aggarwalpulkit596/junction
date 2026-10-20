/* Junction 3D: Saboteur Express trailer — the scenes.
 * Every frame starts from real footage of the 3D game (rendered by tools/shoot.mjs), then adds grading, titles, eye glows,
 * alarms and the game's own UI screens. Timing comes from window.TL (generated from the narration).
 * Story: one staged game. Rose is the saboteur; the vote ejects Mint, who is innocent. */
(function () {
  const B = TL.beats, W = E.W, H = E.H, ease = E.ease, N = E.N, P = E.P;
  const SCN = Object.fromEntries(TL.scenes.map((s) => [s.name, s.start]));
  const SEND = Object.fromEntries(TL.scenes.map((s) => [s.name, s.end]));
  const sm = E.sm, pop = E.pop;
  const RED = '#ff4d5e', AMBER = '#ffc933', TEAL = '#2fd1bd', INK = '#eef1ff', MUTED = '#b4bad8';
  const shake = (t, t0, amp, d = 0.5) => { const k = t < t0 ? 0 : Math.max(0, 1 - (t - t0) / d); return k ? [(E.hash(Math.floor(t * 60)) - 0.5) * 2 * amp * k, (E.hash(Math.floor(t * 60) + 7) - 0.5) * 2 * amp * k] : [0, 0]; };
  const black = (ctx, a) => { if (a > 0) { ctx.save(); ctx.globalAlpha = E.clamp(a); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); } };
  const flash = (ctx, t, t0, col = '255,255,255', d = 0.25, k = 0.9) => { const a = t < t0 ? 0 : Math.max(0, 1 - (t - t0) / d) * k; if (a > 0) { ctx.save(); ctx.fillStyle = `rgba(${col},${a})`; ctx.fillRect(0, 0, W, H); ctx.restore(); } };
  const typed = (s, t, t0, cps = 26) => s.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
  const label = (ctx, s, x, y, o = {}) => E.text(ctx, s, x, y, { fam: o.fam || 'ui', weight: o.weight || 800, size: o.size || 40, color: o.color || INK, align: o.align || 'center', ls: o.ls, alpha: o.alpha });
  const title = (ctx, s, x, y, o = {}) => E.title(ctx, s, x, y, { weight: 700, ls: o.ls ?? 4, ...o });
  function pill(ctx, s, x, y, col, a, size = 32) {
    if (a <= 0) return; const w = E.measure(ctx, s, { fam: 'ui', size, weight: 800 }) + 52;
    ctx.save(); ctx.globalAlpha *= a; const p = new Path2D(); p.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95);
    ctx.fillStyle = 'rgba(6,8,28,0.88)'; ctx.fill(p); ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(p); ctx.restore();
    label(ctx, s, x, y + 2, { size, color: col, alpha: a });
  }
  // crops of the real UI captures (pixels in the 860-wide film copies = CSS px × 2)
  const CROP = { task: [0, 444, 860, 770], reward: [0, 1440, 860, 410], alibi: [0, 1560, 860, 200], meet: [470, 1650, 390, 214], log: [0, 1232, 860, 476],
    vote: [0, 1282, 860, 444], verdict: [0, 1522, 860, 236], end: [0, 990, 860, 262] };
  const IMG = { task: 'task', reward: 'reward', alibi: 'alibi', meet: 'hud', log: 'log', vote: 'meeting', verdict: 'verdict', end: 'end' };
  const holo = (ctx, k, x, y, w, o = {}) => E.holo(ctx, E.images[IMG[k]], x, y, w, { crop: CROP[k], scan: false, ...o });
  const eye = (t, pid) => { const m = E.fmeta(t); return m && m.eyes && m.eyes[pid]; };
  const pt = (t, k) => { const m = E.fmeta(t); return m && m.pts && m.pts[k]; };

  // ================================================================ 1. OPEN (0–5.6): over Europe at dusk
  function sceneOpen(ctx, t) {
    E.drawFootage(ctx, t, { tintK: 0.35, dark: 0.18 });
    const lines = [['20 TRAINS', B.rounds], ['4 ROBOTS', B.conductors], ['1 RAILWAY', B.railway]];
    lines.forEach(([s, b], i) => {
      const a = sm(t, b - 0.05, b + 0.2), dim = i < 2 && t > lines[i + 1][1] ? 0.45 : 1;
      if (a > 0) title(ctx, s, 540, 230 + i * 112, { size: 92, alpha: a * dim, glitch: E.clamp(1 - (t - b) / 0.35) * 0.7, t, seed: i, glowColor: 'rgba(10,12,40,0.9)', glowBlur: 30, color: i === 2 ? AMBER : INK });
    });
    label(ctx, 'ACROSS EUROPE', 540, 560, { fam: 'tech', weight: 600, size: 40, ls: 10, color: INK, alpha: sm(t, B.india - 0.1, B.india + 0.3) });
    E.vignette(ctx, 0.7);
    black(ctx, 1 - sm(t, 0, 0.6)); black(ctx, sm(t, SEND.open - 0.3, SEND.open));
  }

  // ================================================================ 2. LINEUP (5.6–11.2): four robots… one is a saboteur
  function sceneLineup(ctx, t) {
    const out = sm(t, B.them + 0.1, B.them + 0.7), flick = t > B.them && t < B.them + 0.7 ? (E.hash(Math.floor(t * 18)) > 0.5 ? 0.35 : 0) : 0;
    const [sx, sy] = shake(t, B.saboteur, 16, 0.6);
    ctx.save(); ctx.translate(sx, sy);
    E.drawFootage(ctx, t, { tintK: 0.25, dark: Math.min(0.93, 0.12 + out * 0.82 - flick) });
    // in the dark only their eyes stay lit
    if (out > 0.2) [0, 1, 2, 3].forEach((i) => { const e = eye(t, i); if (!e) return; const r = E.lerp(62, 72, sm(t, SCN.lineup, SEND.lineup)); E.footageSpot(ctx, t, e[0], e[1], r, out, i === 0 ? '#bff7ef' : '#ffffff'); });
    ctx.restore();
    const s1 = sm(t, B.saboteur - 0.5, B.saboteur - 0.2), s2 = sm(t, B.saboteur - 0.05, B.saboteur + 0.15);
    label(ctx, 'ONE OF THEM IS A', 540, 420, { fam: 'tech', weight: 600, size: 46, ls: 12, color: MUTED, alpha: s1 });
    if (s2 > 0) title(ctx, 'SABOTEUR', 540 + sx * 0.5, 545, { size: 150, color: RED, glowColor: 'rgba(255,40,70,0.9)', glowBlur: 60, alpha: s2, glitch: 0.25 + E.clamp(1 - (t - B.saboteur) / 0.5) * 0.8, t, seed: 3 });
    flash(ctx, t, B.saboteur - 0.04, '255,40,70', 0.35, 0.55);
    E.vignette(ctx, 0.8);
    black(ctx, 1 - sm(t, SCN.lineup, SCN.lineup + 0.3));
  }

  // ================================================================ 3. BUILD (11.2–14.6): walk the rails, claim the routes
  function sceneBuild(ctx, t) {
    E.drawFootage(ctx, t, { tintK: 0.12 });
    const c = sm(t, B.tickets + 0.05, B.tickets + 0.3);
    if (c > 0) pill(ctx, 'Paris – Zürich · claimed', 540, 1340, '#7ff0dd', c);
    E.vignette(ctx, 0.55);
    E.glitchSlices(ctx, t, t < SCN.build + 0.12 ? 0.8 : 0, 2);
  }

  // ================================================================ 4. TASKS (14.6–20.8): the real station task → reward → alibi
  const OPT = [[68, 844, 724, 100], [68, 960, 724, 100], [68, 1075, 724, 100]]; // in the capture: 1889 World's Fair, A royal wedding, 1924 Olympic Games
  function sceneTasks(ctx, t) {
    E.drawFootage(ctx, t, { blur: 6, dark: 0.45, tintK: 0.2 });
    label(ctx, 'STATION TASK · PARIS', 540, 175, { fam: 'tech', weight: 600, size: 38, ls: 8, color: AMBER, alpha: sm(t, SCN.tasks, SCN.tasks + 0.3) });
    const swap = B.check - 0.2, sw2 = B.alibi - 0.2;
    if (t < swap) {
      const a = sm(t, SCN.tasks, SCN.tasks + 0.35);
      holo(ctx, 'task', 540, 900 + (1 - a) * 80, 960, { alpha: a, glow: 'rgba(255,201,51,0.6)', after: (c) => {
        const hop = t < B.wild - 0.25 ? Math.floor((t - SCN.tasks) * 4) % 3 : 0, k = OPT[hop];
        E.selRing(c, k[0], k[1], k[2], k[3], sm(t, SCN.tasks + 0.6, SCN.tasks + 0.8), t > B.wild - 0.25 ? TEAL : AMBER, 8);
      } });
      label(ctx, '✓ CORRECT', 540, 1500, { fam: 'tech', size: 50, ls: 6, color: TEAL, alpha: sm(t, B.wild + 0.2, B.wild + 0.45) });
    } else if (t < sw2) {
      holo(ctx, 'reward', 540, 880, 960, { glow: 'rgba(255,201,51,0.6)', after: (c) => E.selRing(c, 40, 1728, 780, 100, sm(t, B.check, B.check + 0.2), AMBER, 8) });
    } else {
      const a = sm(t, sw2, sw2 + 0.25);
      holo(ctx, 'alibi', 540, 880, 960, { alpha: a, glow: 'rgba(47,209,189,0.7)', after: (c) => E.selRing(c, 40, 1652, 780, 60, sm(t, B.alibi + 0.1, B.alibi + 0.4), TEAL, 12) });
      const st = sm(t, B.alibi + 0.25, B.alibi + 0.45);
      if (st > 0) E.at(ctx, 540, 1150, -0.08, 1.6 - 0.6 * st, () => { ctx.globalAlpha = st; ctx.strokeStyle = TEAL; ctx.lineWidth = 8; ctx.beginPath(); ctx.roundRect(-300, -60, 600, 120, 18); ctx.stroke(); E.text(ctx, 'SANDY: CLEARED ✓', 0, 4, { fam: 'tech', size: 62, weight: 700, color: TEAL, ls: 4 }); });
    }
    flash(ctx, t, swap, '255,230,170', 0.15, 0.35); flash(ctx, t, sw2, '170,255,240', 0.15, 0.35);
    E.vignette(ctx, 0.6);
  }

  // ================================================================ 5. SABOTAGE (20.8–23.6): the signals fail
  function sceneSabotage(ctx, t) {
    const [sx, sy] = shake(t, B.fail, 22, 0.7);
    const pre = t < B.fail, flick = pre ? (E.hash(Math.floor(t * 11)) > 0.62 ? 0.25 : 0) : 0;
    ctx.save(); ctx.translate(sx, sy);
    E.drawFootage(ctx, t, { tintK: pre ? 0.45 : 0.3, tint: pre ? '60,70,140' : '120,40,60', dark: pre ? 0.6 - flick : 0.25 });
    ctx.restore();
    E.alarm(ctx, t, sm(t, B.fail, B.fail + 0.1));
    const tp = sm(t, B.fail + 0.05, B.fail + 0.2);
    if (tp > 0) {
      title(ctx, '⚠ SABOTAGE', 540 + sx, 300 + sy, { size: 118, color: '#ffffff', glowColor: 'rgba(255,40,70,1)', glowBlur: 50, glitch: 0.3 + E.clamp(1 - (t - B.fail) / 0.6), t, seed: 5, alpha: tp });
      label(ctx, 'SIGNAL FAULT · MÜNCHEN – WIEN', 540, 405, { fam: 'tech', weight: 600, size: 40, ls: 3, color: '#ffd0d6', alpha: sm(t, B.fail + 0.3, B.fail + 0.55) });
    }
    E.vignette(ctx, 0.8, pre ? '0,0,0' : '40,0,10');
    E.glitchSlices(ctx, t, (t > B.fail && t < B.fail + 0.35 ? 1 : 0) + (pre && E.hash(Math.floor(t * 9)) > 0.8 ? 0.6 : 0), 5);
  }

  // ================================================================ 6. SIGHTINGS (23.6–28.8): two robots were seen nearby
  function sceneSightings(ctx, t) {
    E.drawFootage(ctx, t, { tintK: 0.3, tint: '120,50,70', dark: 0.12 });
    E.alarm(ctx, t, 0.3);
    [['Rose', 'MUN', 'München', B.two + 0.05, -1], ['Mint', 'WIE', 'Wien', B.two + 0.55, 1]].forEach(([who, k, city, tb, side]) => {
      const p = pt(t, k); if (!p) return; const a = pop(t, tb, 0.4); if (a <= 0) return;
      const u = ((t - tb) * 1.2) % 1; ctx.save(); ctx.strokeStyle = P[who]; ctx.globalAlpha = (1 - u) * 0.85; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(p[0], p[1], 40 + u * 140, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      pill(ctx, `${who.toUpperCase()} · SEEN IN ${city.toUpperCase()}`, E.clamp(p[0] + side * 60, 270, 810), p[1] + 140, P[who], E.clamp(a), 30);
    });
    pill(ctx, 'Sandy was in Amsterdam · cleared ✓', 540, 190, TEAL, sm(t, B.seen - 0.1, B.seen + 0.2), 30);
    const la = sm(t, B.dark + 0.2, B.dark + 0.6);
    if (la > 0) holo(ctx, 'log', 540, 1360, 960, { alpha: la, glow: 'rgba(255,77,94,0.75)' });
    E.vignette(ctx, 0.7, '30,0,10');
    E.glitchSlices(ctx, t, t < SCN.sightings + 0.12 ? 0.8 : 0, 6);
  }

  // ================================================================ 7. MEETING (28.8–36): the red button, then one vote
  const VOTE = { Rose: [40, 1482, 248, 226], Sandy: [306, 1482, 248, 226], Mint: [572, 1482, 248, 226] };
  const HOPS = [[B.vote + 0.4, 'Rose'], [B.vote + 1.15, 'Mint'], [B.vote + 1.9, 'Rose'], [B.pick - 0.65, 'Mint']];
  const focusAt = (t) => { let f = null; HOPS.forEach(([tb, who]) => { if (t >= tb) f = who; }); return f; };
  const PID = { Rose: 1, Sandy: 2, Mint: 3 };
  function sceneMeeting(ctx, t) {
    const vin = sm(t, B.emergency + 0.6, B.emergency + 1.0);
    const [sx, sy] = shake(t, B.press + 0.1, 26, 0.6), [px, py] = shake(t, B.pick, 30, 0.6);
    if (vin < 1) {
      ctx.fillStyle = '#05061a'; ctx.fillRect(0, 0, W, H);
      E.alarm(ctx, t, sm(t, B.press + 0.05, B.press + 0.15) * (1 - vin));
      const press = t > B.press ? 1 - 0.1 * Math.max(0, 1 - (t - B.press) / 0.2) : 1;
      ctx.save(); ctx.globalAlpha = 1 - vin;
      holo(ctx, 'meet', 540 + sx, 1080 + sy, 700, { s: press, glow: 'rgba(255,77,94,0.95)' });
      title(ctx, 'EMERGENCY', 540 + sx, 520 + sy, { size: 130, color: '#fff', glowColor: 'rgba(255,40,70,1)', glowBlur: 50, glitch: E.clamp(1 - (t - B.press) / 0.5) * 0.9, t, seed: 7, alpha: sm(t, B.press + 0.05, B.press + 0.2) });
      title(ctx, 'MEETING', 540 + sx, 660 + sy, { size: 130, color: RED, glowColor: 'rgba(255,40,70,1)', glowBlur: 50, glitch: E.clamp(1 - (t - B.press - 0.1) / 0.5) * 0.9, t, seed: 8, alpha: sm(t, B.press + 0.12, B.press + 0.3) });
      ctx.restore();
      flash(ctx, t, B.press + 0.08, '255,40,70', 0.3, 0.7);
    }
    if (vin > 0) {
      const f = focusAt(t), picked = t >= B.pick;
      ctx.save(); ctx.globalAlpha = vin; ctx.translate(picked ? px : 0, picked ? py : 0);
      E.drawFootage(ctx, t, { tintK: 0.35, dark: 0.62 });
      // the suspect under consideration is in the light
      ['Rose', 'Sandy', 'Mint'].forEach((who) => {
        const e = eye(t, PID[who]); if (!e) return;
        const on = who === f, k = who === 'Sandy' ? 0.35 : on ? 1 : 0.4;
        E.footageSpot(ctx, t, e[0], e[1] + 40, 175, k, picked && who === 'Mint' ? RED : '#ffe7b0');
      });
      ctx.restore();
      ['Rose', 'Sandy', 'Mint'].forEach((who) => { const e = eye(t, PID[who]); if (e) label(ctx, who === 'Sandy' ? 'cleared ✓' : '', e[0], e[1] + 250, { size: 30, color: TEAL, alpha: vin }); });
      holo(ctx, 'vote', 540, 1380, 940, { alpha: vin, glow: 'rgba(255,77,94,0.6)', after: (c) => { if (!f) return; const k = VOTE[f]; E.selRing(c, k[0], k[1], k[2], k[3], 1, picked ? RED : AMBER, 8); } });
      if (picked) {
        const st = sm(t, B.pick, B.pick + 0.12), e = eye(t, 3) || [830, 700];
        E.at(ctx, Math.min(e[0], 860) + px, e[1] - 150 + py, -0.18, 2 - st, () => { ctx.globalAlpha = st; ctx.strokeStyle = RED; ctx.lineWidth = 10; ctx.beginPath(); ctx.roundRect(-160, -60, 320, 120, 14); ctx.stroke(); E.text(ctx, 'EJECT', 0, 6, { fam: 'tech', size: 84, weight: 700, color: RED, ls: 8 }); });
        flash(ctx, t, B.pick, '255,40,70', 0.3, 0.6);
      }
      const hb = Math.pow(Math.max(0, Math.sin((t - B.vote) * Math.PI * 2 * 1.35)), 8) * sm(t, B.vote, B.vote + 0.5);
      E.vignette(ctx, 0.7 + 0.25 * hb, '40,0,10');
    } else E.vignette(ctx, 0.8);
    black(ctx, sm(t, SEND.meeting - 0.2, SEND.meeting));
  }

  // ================================================================ 8. EJECT (36–42.2): launched off the map
  function sceneEject(ctx, t) {
    E.drawFootage(ctx, t, { tintK: 0.3, dark: 0.1 + 0.35 * sm(t, B.innocent - 0.6, B.innocent) });
    const tv = typed('Mint was innocent.', t, B.innocent, 22), ts2 = typed('The saboteur is still out there.', t, B.stillout, 30);
    if (tv) title(ctx, tv, 540, 1420, { size: 84, ls: 1, color: '#fff', glowColor: 'rgba(10,12,40,0.9)', glowBlur: 30 });
    if (ts2) label(ctx, ts2, 540, 1515, { size: 46, weight: 700, color: INK });
    label(ctx, '−5 pts', 540, 1590, { fam: 'tech', size: 42, color: AMBER, alpha: sm(t, B.stillout + 1.0, B.stillout + 1.3) });
    E.vignette(ctx, 0.7);
    black(ctx, 1 - sm(t, SCN.eject, SCN.eject + 0.15)); black(ctx, sm(t, SEND.eject - 0.5, SEND.eject));
  }

  // ================================================================ 9. TWIST (42.2–46.8): Rose's eye opens in the dark
  function sceneTwist(ctx, t) {
    const open = sm(t, B.eye, B.eye + 0.5);
    E.drawFootage(ctx, t, { tintK: 0.5, tint: '120,40,90', dark: 0.9 - 0.18 * open });
    const e = eye(t, 1);
    if (e && open > 0) {
      const g = ctx.createRadialGradient(e[0], e[1], 30, e[0], e[1], 600); g.addColorStop(0, `rgba(255,79,163,${0.22 * open})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      E.footageSpot(ctx, t, e[0], e[1], 260, open, '#ff9fd0');
    }
    const ea = t > B.endshot && t < B.endshot + 0.8 ? (E.hash(Math.floor(t * 30)) > 0.25 ? 1 : 0.3) : 0;
    if (ea) { holo(ctx, 'end', 540, 1360, 960, { alpha: ea, glow: 'rgba(255,79,163,0.85)' }); E.glitchSlices(ctx, t, 0.7, 9); }
    E.vignette(ctx, 0.9);
    black(ctx, 1 - sm(t, SCN.twist, SCN.twist + 0.3));
  }

  // ================================================================ 10. TITLE (46.8–55)
  function sceneTitle(ctx, t) {
    E.drawFootage(ctx, t, { tintK: 0.45, dark: 0.55 });
    const [sx, sy] = shake(t, B.smash, 20, 0.5);
    title(ctx, 'JUNCTION', 540 + sx, 560 + sy, { size: 176, ls: 10, color: '#fff', glowColor: 'rgba(20,184,166,0.9)', glowBlur: 50, glitch: E.clamp(1 - (t - B.smash) / 0.4) });
    const ex = sm(t, B.express - 0.1, B.express + 0.15);
    title(ctx, 'SABOTEUR EXPRESS', 540, 700, { size: 74, ls: 6, color: AMBER, glowColor: 'rgba(10,12,40,0.9)', alpha: ex, glitch: E.clamp(1 - (t - B.express) / 0.35) * 0.6, t, seed: 11 });
    label(ctx, '3D · ACROSS EUROPE', 540, 790, { fam: 'tech', weight: 600, size: 36, ls: 10, color: MUTED, alpha: ex });
    const tr = sm(t, B.trust - 0.05, B.trust + 0.2);
    title(ctx, 'TRUST NO ROBOT', 540, 950, { size: 70, ls: 5, color: RED, glowColor: 'rgba(255,40,70,0.8)', alpha: tr, glitch: E.clamp(1 - (t - B.trust) / 0.4) * 0.7, t, seed: 12 });
    const cp = pop(t, B.shift - 0.1, 0.45);
    if (cp > 0) E.at(ctx, 540, 1130, 0, cp, () => {
      const w = 600, h = 132, path = new Path2D(); path.roundRect(-w / 2, -h / 2, w, h, 28);
      E.glow(ctx, 'rgba(255,201,51,0.8)', 40, () => { ctx.fillStyle = AMBER; ctx.fill(path); });
      ctx.strokeStyle = '#1c1d33'; ctx.lineWidth = 6; ctx.stroke(path);
      E.text(ctx, 'Quick game', 0, -14, { fam: 'tech', size: 56, weight: 700, color: '#1c1d33' });
      E.text(ctx, '20 trains each, about 10 minutes', 0, 36, { size: 28, weight: 700, color: '#1c1d33' });
    });
    label(ctx, 'You vs. three robots · plays in your browser', 540, 1265, { size: 34, weight: 700, color: MUTED, alpha: sm(t, B.shift + 0.4, B.shift + 0.8) });
    E.vignette(ctx, 0.7);
    flash(ctx, t, B.smash, '255,255,255', 0.35, 0.85);
    black(ctx, sm(t, TL.duration - 0.9, TL.duration - 0.1));
  }

  // ================================================================ sequence (hard cuts; flashes and glitches live inside the scenes)
  const SC = { open: sceneOpen, lineup: sceneLineup, build: sceneBuild, tasks: sceneTasks, sabotage: sceneSabotage, sightings: sceneSightings, meeting: sceneMeeting, eject: sceneEject, twist: sceneTwist, title: sceneTitle };
  const SEQ = TL.scenes.map((s) => ({ draw: s.name, start: s.start, end: s.end }));
  const sceneAt = (t) => SEQ.find((s) => t >= s.start && t < s.end) || SEQ[SEQ.length - 1];

  function drawCaption(ctx, t) {
    const c = TL.captions.find((c) => t >= c.start - 0.05 && t < c.end + 0.1);
    if (!c) return;
    const a = E.clamp(Math.min((t - c.start + 0.05) / 0.12, (c.end + 0.1 - t) / 0.12));
    const size = Math.max(40, Math.min(48, (48 * 930) / E.measure(ctx, c.text, { size: 48, weight: 800 })));
    const w = Math.min(1010, E.measure(ctx, c.text, { size, weight: 800 }) + 70);
    ctx.save(); ctx.globalAlpha = a;
    const path = new Path2D(); path.roundRect(540 - w / 2, 1690 - 46, w, 92, 46);
    ctx.fillStyle = 'rgba(8,10,34,0.86)'; ctx.fill(path); ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 2; ctx.stroke(path);
    E.text(ctx, c.text, 540, 1692, { size, weight: 800, color: '#ffffff' });
    ctx.restore();
  }

  window.renderFrame = function (ctx, t, opts = {}) {
    t = E.clamp(t, 0, TL.duration - 1e-3);
    ctx.save(); SC[sceneAt(t).draw](ctx, t); ctx.restore();
    E.finish(ctx, t);
    if (opts.captions) drawCaption(ctx, t);
  };
  window.SCENE_LIST = SEQ.map((s) => ({ name: s.draw, start: s.start }));
})();
