/* Junction promo — the scenes. Each scene draws a whole frame for time t (seconds, film time).
 * Timing comes from window.TL (generated from the narration), so retiming the voice retimes the picture.
 * The story follows one real long ticket from the game, Edinburgh to Athína (21 points, 18 trains of track). */
(function () {
  const { PAL } = E;
  const B = TL.beats;
  const W = E.W, H = E.H;
  const ease = E.ease;
  const SCN = Object.fromEntries(TL.scenes.map((s) => [s.name, s.start]));
  const SEND = Object.fromEntries(TL.scenes.map((s) => [s.name, s.end]));
  const INK = PAL.jInk, YOU = PAL.you, ROSE = PAL.rose, SANDY = PAL.sandy, MINT = PAL.mint, AMBER = PAL.jAccent, GOOD = PAL.jGood;
  const C = E.CITY;
  const R = (a, b) => E.route(a, b);

  // ---------------------------------------------------------------- shared helpers
  /** camera keyframes [[t, x, y, z], ...] with smooth in-out between them */
  function camAt(keys, t, sy) {
    let k = 0; while (k < keys.length - 1 && t > keys[k + 1][0]) k++;
    const a = keys[k], b = keys[Math.min(k + 1, keys.length - 1)];
    const u = b === a ? 0 : ease.inOut(E.p(t, a[0], b[0]));
    return { x: E.lerp(a[1], b[1], u), y: E.lerp(a[2], b[2], u), z: E.lerp(a[3], b[3], u), sy: sy ?? H / 2 };
  }
  /** handwritten note with an optional arrow */
  function note(ctx, s, x, y, o = {}) {
    const a = o.prog ?? 1; if (a <= 0) return;
    E.at(ctx, x, y, o.rot ?? -0.04, E.ease.outBack(E.clamp(a * 1.6)), () => {
      if (o.bg) { const w = E.measure(ctx, s, { fam: 'hand', size: o.size || 54, weight: 700 }) + 44; E.paper(ctx, E.tornRect(w, (o.size || 54) * 1.25, o.seed || 3, 4), o.bg, { lift: 0.7, seed: o.seed || 3 }); }
      E.text(ctx, s, 0, 2, { fam: 'hand', size: o.size || 54, weight: 700, color: o.color || INK });
    });
  }
  /** a paper tag with typed text (like a label pinned onto the collage) */
  function tag(ctx, s, x, y, prog, o = {}) {
    if (prog <= 0) return;
    E.at(ctx, x, y, (o.rot ?? -0.03) + E.wobble(o.t ?? 0, o.t0 ?? -9, 0.05, 3, 5), E.ease.outBack(E.clamp(prog)), () => {
      E.wordTile(ctx, s, { size: o.size || 40, weight: 800, fam: o.fam || 'ui', bg: o.bg || '#FFFDF7', color: o.color || INK, seed: o.seed || 5, padX: 40, rad: 12 });
    });
  }
  const ringPx = (ctx, x, y, w, h, prog, o = {}) => E.ring(ctx, x + w / 2, y + h / 2, w / 2 + (o.pad ?? 26), h / 2 + (o.pad ?? 22), prog, { w: o.w ?? 9, seed: o.seed || 4, t: o.t || 0, color: o.color });
  function confetti(ctx, t, t0, n = 40, seed = 1) {
    if (t < t0) return;
    const r = E.rnd(seed), cols = [YOU, ROSE, AMBER, MINT, '#3d7dfa', '#ff8c2e'];
    for (let i = 0; i < n; i++) {
      const x0 = 540 + (r() - 0.5) * 300, vx = (r() - 0.5) * 1300, vy = -900 - r() * 900, spin = (r() - 0.5) * 12, col = cols[i % cols.length];
      const dt = t - t0 - r() * 0.15; if (dt < 0) continue;
      const x = x0 + vx * dt, y = 900 + vy * dt + 1500 * dt * dt;
      if (y > H + 50) continue;
      E.at(ctx, x, y, spin * dt, 1, () => E.paper(ctx, E.cutRect(26, 16, 400 + i, 2), col, { lift: 0.6, seed: i }));
    }
  }
  /** the ticket we follow, as a small header strip */
  function hudTicket(ctx, t, x, y, s, o = {}) {
    E.at(ctx, x, y, (o.rot ?? -0.025) + E.boil(31, t, 0.004), s, () => {
      E.ticket(ctx, 'Edinburgh', 'Athína', 21, { long: true, done: o.done || 0, lift: 1 });
      E.at(ctx, -330, -62, -0.5, 1, () => E.tape(ctx, 120, 40, 'rgba(255,214,90,0.82)', 9));
    });
  }
  // the player's line, Edinburgh → Athína (London–Paris is a ferry, Zürich–Venezia a tunnel, Venezia–Roma is Rose's)
  const MY_LINE = [['LON', 'EDI'], ['PAR', 'LON'], ['PAR', 'ZUR'], ['ZUR', 'VEN'], ['ROM', 'BRI'], ['BRI', 'ATH']];
  const PATH = ['EDI', 'LON', 'PAR', 'ZUR', 'VEN', 'ROM', 'BRI', 'ATH'];

  // ================================================================ 1. HOOK (0–6.4): the ticket, twenty trains, three rivals
  function sceneHook(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop('#D8B98F', 11), 0, 0);
    // a faint pencil-sketched Europe in the background, like a notebook page
    ctx.save(); ctx.globalAlpha = 0.16;
    E.drawMap(ctx, { x: 150, y: 140, z: 6.6, sy: 960 }, ts, { routes: () => null, city: () => ({ show: 0 }), labels: 0 });
    ctx.restore();
    note(ctx, 'your ticket', 300, 300, { prog: E.p(ts, 0.35, 0.7), size: 58, rot: -0.06 });
    // the ticket slides in from the right and is punched
    const u = ease.out5(E.p(t, 0.12, 0.62));
    const tx = E.lerp(1500, 540, u), punch = E.p(ts, B.edinburgh + 0.35, B.edinburgh + 0.5);
    E.at(ctx, tx, 470 + E.wobble(t, B.edinburgh + 0.35, 6, 6, 7), -0.035 + (1 - u) * 0.2, 1.22, () => {
      E.ticket(ctx, 'Edinburgh', 'Athína', 21, { long: true, punch });
      E.at(ctx, -340, -66, -0.55, 1, () => E.tape(ctx, 130, 42, 'rgba(255,214,90,0.82)', 9));
      E.at(ctx, 350, 66, -0.55, 1, () => E.tape(ctx, 130, 42, 'rgba(160,220,210,0.8)', 10));
      // "Athína" underlined on "Athens"
      const ul = E.p(ts, B.athens - 0.05, B.athens + 0.35);
      if (ul > 0) E.pen(ctx, [[-82, 36], [40, 40], [150, 34]], { color: PAL.red, w: 7, prog: ul, t: ts, seed: 12, pencil: true });
    });
    note(ctx, '21 points · 18 trains of track', 560, 640, { prog: E.p(ts, B.athens + 0.25, B.athens + 0.6), size: 46, color: '#5A3E1E' });
    // twenty little cars clatter into two rows
    const n0 = B.twenty - 0.12;
    for (let i = 0; i < 20; i++) {
      const row = Math.floor(i / 10), col = i % 10, x = 205 + col * 74 + row * 18, y = 790 + row * 66;
      const p = E.pop(ts, n0 + i * 0.03, 0.3); if (p <= 0) continue;
      E.at(ctx, x, y - (1 - E.clamp(p)) * 120, E.boil(i + 20, ts, 0.04), p, () => {
        const c = new Path2D(); c.roundRect(-30, -20, 60, 40, 10);
        ctx.save(); ctx.shadowColor = 'rgba(52,34,14,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5; ctx.fillStyle = YOU; ctx.fill(c); ctx.restore();
        ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(c); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(-8, -8, 16, 16, 3); ctx.fill();
      });
    }
    const cnt = Math.round(E.clamp((ts - n0) / 0.6) * 20);
    if (cnt > 0) E.at(ctx, 120, 820, -0.08, E.pop(ts, n0, 0.3), () => { E.paper(ctx, E.wobCircle(62, 4), AMBER, { lift: 1, seed: 4 }); E.text(ctx, String(cnt), 0, 4, { fam: 'display', weight: 700, size: 62, color: INK }); });
    note(ctx, 'trains', 120, 905, { prog: E.p(ts, n0 + 0.3, n0 + 0.6), size: 40 });
    // three robots pop up from the bottom, then lean in on "racing"
    const bots = [[ROSE, 215, 'Rose'], [SANDY, 540, 'Sandy'], [MINT, 865, 'Mint']];
    bots.forEach(([col, x, name], i) => {
      const t0 = B.robots + 0.05 + i * 0.16, p = E.pop(ts, t0, 0.45); if (p <= 0) return;
      const lean = ease.inOut(E.p(ts, B.racing, B.racing + 0.3)) * (i - 1) * -0.12;
      const hop = B.track < ts ? Math.abs(Math.sin((ts - B.track) * 9 + i)) * -26 * E.clamp(1 - (ts - B.track) * 0.8) : 0;
      const y = 1215 + (1 - p) * 800 + hop;
      E.sprocket(ctx, x, y, 15.5, col, { look: [(540 - x) / 500, -0.9], squash: E.wobble(ts, t0 + 0.3, 0.6, 3, 5), ant: E.wobble(ts, t0 + 0.2, 1, 4, 3) + Math.sin(ts * 7 + i) * 0.15, mood: ts > B.racing + 0.1 ? 'grr' : null, rot: lean, arms: { l: 0.25, r: 0.25 }, blink: E.hash(Math.floor(ts * 4) + i * 7) < 0.06 }, ts);
      tag(ctx, name, x, y + 245, E.p(ts, t0 + 0.15, t0 + 0.45), { size: 38, bg: col, color: INK, seed: 40 + i, rot: (i - 1) * 0.04 });
    });
    // speed lines behind them on "track"
    const sp = E.p(ts, B.track - 0.1, B.track + 0.4);
    if (sp > 0) for (let i = 0; i < 6; i++) E.pen(ctx, [[80 + i * 170, 960], [60 + i * 170, 910]], { color: INK, w: 6, prog: sp, t: ts, seed: 90 + i, alpha: 0.6 });
  }

  // ================================================================ 2. TITLE (6.4–11.6): the paper map slams down, routes and cities appear
  const TITLE_CAM = { x: 196, y: 150, z: 2.66, sy: 1070 };
  function sceneTitle(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop(PAL.jSky, 21), 0, 0);
    const drop = B.drop;
    const sheet = E.p(t, drop - 0.05, drop + 0.25);
    const cam = { ...TITLE_CAM, z: TITLE_CAM.z * (1 + (1 - ease.out(sheet)) * 0.25), sy: TITLE_CAM.sy + E.wobble(t, drop + 0.25, 12, 5, 6) };
    ctx.save(); ctx.globalAlpha = E.clamp(sheet * 3);
    E.drawMap(ctx, cam, ts, {
      land: (i) => { const t0 = drop + 0.05 + i * 0.06, u = E.p(ts, t0, t0 + 0.3); return { a: u > 0 ? 1 : 0, dy: (1 - ease.outBack(u)) * -40, rot: (1 - u) * (i % 2 ? 0.15 : -0.15), s: 1 + (1 - u) * 0.3 }; },
      routes: (r) => { const A = C[r.a], t0 = B.rail - 0.15 + (A.x / 392) * 0.9; return { show: E.clamp((ts - t0) / 0.35) }; },
      city: (id) => { const t0 = B.cities - 0.35 + (C[id].x / 392) * 0.75; return { show: E.p(ts, t0, t0 + 0.3) * 1.0001 }; },
      labels: 1,
    });
    ctx.restore();
    // the logo and title
    const lp = E.pop(ts, B.junction - 0.35, 0.5);
    if (lp > 0) E.sprocket(ctx, 540, 250 - (1 - E.clamp(lp)) * 300, 11 * lp, YOU, { look: [0.2, 0.3], squash: E.wobble(ts, B.junction + 0.1, 0.7, 3, 5), ant: E.wobble(ts, B.junction, 1.2, 4, 3), mood: 'happy', blink: ts > B.junction + 1 && E.hash(Math.floor(ts * 4)) < 0.05 }, ts);
    const tp = E.pop(ts, B.junction - 0.05, 0.4);
    E.at(ctx, 540, 470 + E.wobble(ts, B.junction + 0.3, 6, 4, 6), -0.02, tp, () => {
      ctx.save(); ctx.shadowColor = 'rgba(28,29,51,0.3)'; ctx.shadowOffsetY = 8; ctx.shadowBlur = 0;
      E.text(ctx, 'Junction', 0, 0, { fam: 'display', weight: 700, size: 172, color: INK });
      ctx.restore();
    });
    const ep = E.pop(ts, B.europe - 0.05, 0.4);
    E.at(ctx, 540, 590, 0.03, ep, () => { E.wordTile(ctx, 'Europe', { fam: 'display', weight: 600, size: 66, bg: AMBER, color: INK, torn: true, seed: 8, padX: 60 }); });
    // "28 cities" scribbled note with an arrow at Moskva
    const np = E.p(ts, B.cities + 0.3, B.cities + 0.7);
    if (np > 0) {
      const [mx, my] = E.mapToScreen(cam, C.MOS.x, C.MOS.y);
      note(ctx, '28 cities!', 880, my - 150, { prog: np, size: 56, rot: 0.05, bg: '#FFFDF7', seed: 6 });
      E.arrow(ctx, [890, my - 110], [mx - 6, my - 20], { prog: E.p(ts, B.cities + 0.45, B.cities + 0.8), w: 6, t: ts, seed: 7, bend: -0.25 });
    }
    note(ctx, '50 routes', 205, 1560, { prog: E.p(ts, B.rail + 0.6, B.rail + 0.95), size: 52, rot: -0.05, bg: '#FFFDF7', seed: 9 });
  }

  // ================================================================ 3. CARDS (11.6–15.35): draw two, locomotives are wild
  const MARKET = ['white', 'blue', 'white', 'loco', 'orange'];
  const REFILL = ['red', 'green'];
  const cardX = (i) => 540 + (i - 2.5) * 166;
  const MKT_Y = 470, HAND_Y = 1300;
  function sceneCards(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop('#CFE9F5', 31), 0, 0);
    // two paper panels like the game's "Train cards" and "Your hand"
    E.at(ctx, 540, 470, -0.01, 1, () => E.paper(ctx, E.cutRect(1030, 420, 33, 30), '#FFFFFF', { lift: 1, seed: 33, edge: INK, edgeW: 5 }));
    E.text(ctx, 'Train cards', 78, 302, { fam: 'display', weight: 600, size: 46, align: 'left' });
    E.text(ctx, '2 draws a turn', 1000, 304, { size: 32, weight: 700, color: '#575b78', align: 'right' });
    E.at(ctx, 540, 1290, 0.01, 1, () => E.paper(ctx, E.cutRect(1030, 470, 34, 30), '#FFFFFF', { lift: 1, seed: 34, edge: INK, edgeW: 5 }));
    E.text(ctx, 'Your hand', 78, 1098, { fam: 'display', weight: 600, size: 46, align: 'left' });
    const s0 = SCN.cards;
    // deck (index 5)
    E.at(ctx, cardX(5), MKT_Y + 20, 0.02, 1, () => { E.trainCard(ctx, 'white', 140, { back: true }); E.text(ctx, 'deck', 0, 0, { size: 30, weight: 800, color: INK }); });
    // hand: starts with two white cards; the drawn ones join it
    const flyOf = [[0, B.two + 0.02], [2, B.turn + 0.02]];
    const handCards = ['white', 'white'];
    const inHand = flyOf.filter(([, t0]) => ts > t0 + 0.42).length;
    const fanN = 2 + inHand;
    const handPos = (k, n) => [540 + (k - (n - 1) / 2) * 150 - 120, HAND_Y + 30 + Math.abs(k - (n - 1) / 2) * 8, (k - (n - 1) / 2) * 0.06];
    for (let k = 0; k < fanN; k++) { const [x, y, r] = handPos(k, fanN); E.at(ctx, x, y, r, 1, () => E.trainCard(ctx, handCards[0], 150)); }
    E.at(ctx, handPos(fanN - 1, fanN)[0] + 62, HAND_Y - 70, 0, E.pop(ts, s0 + 0.2, 0.3), () => { E.paper(ctx, E.wobCircle(30, 3), INK, { lift: 0.5 }); E.text(ctx, String(fanN), 0, 2, { size: 32, weight: 800, color: '#fff' }); });
    // the market
    MARKET.forEach((c, i) => {
      const fly = flyOf.find(([k]) => k === i);
      const deal = E.p(ts, s0 + 0.05 + i * 0.06, s0 + 0.3 + i * 0.06);
      if (!fly || ts < fly[1]) {
        if (c === 'loco' && ts > B.loco - 0.12) return; // the loco jumps to centre stage below
        const flip = deal < 1 ? Math.cos((1 - deal) * Math.PI) : 1;
        const lift = fly ? E.clamp((ts - fly[1] + 0.25) / 0.25) : 0;
        E.at(ctx, cardX(i), MKT_Y + 20 - lift * 40, E.boil(i, ts, 0.01), 1, () => E.trainCard(ctx, c, 140, { flip, lift: 1 + lift }));
      } else {
        // fly into the hand, then a replacement deals in face down and flips
        const u = ease.inOut(E.p(ts, fly[1], fly[1] + 0.42));
        if (u < 1) {
          const [hx, hy] = handPos(fanN, fanN + 1);
          const x = E.lerp(cardX(i), hx, u), y = E.lerp(MKT_Y + 20, hy, u) - Math.sin(u * Math.PI) * 160;
          E.at(ctx, x, y, u * 0.4 * (i ? -1 : 1), 1 + Math.sin(u * Math.PI) * 0.15, () => E.trainCard(ctx, c, E.lerp(140, 150, u), { lift: 2 }));
        }
        const rf = E.p(ts, fly[1] + 0.3, fly[1] + 0.6);
        if (rf > 0) E.at(ctx, cardX(i), MKT_Y + 20, 0, 1, () => E.trainCard(ctx, REFILL[flyOf.indexOf(fly)], 140, { flip: Math.cos((1 - rf) * Math.PI) }));
      }
    });
    // pencil ticks "1", "2" on each draw
    [[0, B.two], [2, B.turn]].forEach(([i, b], k) => note(ctx, String(k + 1), cardX(i), MKT_Y + 150, { prog: E.p(ts, b + 0.05, b + 0.3), size: 64, color: PAL.red }));
    // the locomotive: centre stage, spinning, with rays
    const lp = E.p(ts, B.loco - 0.12, B.loco + 0.4);
    if (lp > 0) {
      const u = ease.out5(lp);
      const x = E.lerp(cardX(3), 540, u), y = E.lerp(MKT_Y + 20, 880, u), sc = E.lerp(140, 300, u);
      const rays = E.p(ts, B.loco + 0.2, B.loco + 0.6);
      if (rays > 0) {
        ctx.save(); ctx.translate(540, 880); ctx.rotate(ts * 0.6); const cols = ['#ef4f4f', '#ff8c2e', '#ffd23f', '#3fbf5f', '#3d7dfa', '#a35cf0'];
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.globalAlpha = 0.55 * rays; ctx.fillStyle = cols[i % 6]; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -420 * rays); ctx.lineTo(40, -420 * rays); ctx.fill(); }
        ctx.restore();
      }
      const spin = Math.cos(E.clamp(lp * 1.4) * Math.PI * 2);
      E.at(ctx, x, y + E.wobble(ts, B.loco + 0.4, 10, 3, 4), (1 - u) * 0.3, 1, () => E.trainCard(ctx, 'loco', sc, { flip: spin < 0 ? Math.max(spin, -1) : Math.max(spin, 0.05), lift: 2.5 }));
      for (let i = 0; i < 5; i++) { const a = i * 1.3 + ts * 2, rr = 230 + 20 * Math.sin(ts * 5 + i); const sp = E.pop(ts, B.wild + i * 0.05, 0.3); if (sp > 0) E.at(ctx, 540 + Math.cos(a) * rr, 880 + Math.sin(a) * rr * 0.8, a, sp, () => sparkle(ctx, 22, AMBER)); }
      note(ctx, 'wild = any colour', 540, 1120, { prog: E.p(ts, B.wild - 0.05, B.wild + 0.3), size: 64, rot: -0.03, bg: AMBER, seed: 12 });
    }
    // You peeks in from the side, eyes following the cards
    const yp = E.pop(ts, s0 + 0.3, 0.5);
    E.sprocket(ctx, 960, 1570 + (1 - E.clamp(yp)) * 400, 8, YOU, { look: lp > 0.3 ? [-0.9, -0.6] : [-0.5, -1], mood: lp > 0.3 ? 'o' : 'happy', ant: Math.sin(ts * 6) * 0.2 }, ts);
  }
  function sparkle(ctx, r, col) {
    ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, rr = i % 2 ? r * 0.38 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // ================================================================ 4. CLAIM + FERRY (15.35–20.45): London–Edinburgh, then the Channel
  const CLAIM_CAM = [[SCN.claim - 0.4, 78, 98, 7.6], [B.yours + 0.3, 80, 100, 7.4], [B.ferries + 0.1, 96, 128, 7.2], [SEND.claim + 0.2, 98, 132, 7.3]];
  function sceneClaim(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop('#A9D7EE', 41), 0, 0);
    const cam = camAt(CLAIM_CAM, t, 1000);
    const le = R('LON', 'EDI'), lp = R('PAR', 'LON');
    const leProg = E.clamp((ts - (B.colour + 0.2)) / (0.13 * 4)), lpProg = E.clamp((ts - (B.ferryloco + 0.45)) / 0.26);
    E.drawMap(ctx, cam, ts, {
      routes: (r) => {
        if (r === le) return { owner: leProg > 0 ? 0 : null, prog: leProg, hl: E.p(ts, B.match, B.match + 0.2) * (1 - E.p(ts, B.yours, B.yours + 0.3)) };
        if (r === lp) return { owner: lpProg > 0 ? 0 : null, prog: lpProg, hl: E.p(ts, B.ferries, B.ferries + 0.2) * (1 - E.p(ts, B.ferryloco + 0.8, B.ferryloco + 1.0)) };
        return {};
      },
      city: (id) => ({ stamped: (id === 'EDI' || id === 'LON') ? E.p(ts, B.yours, B.yours + 0.3) : id === 'PAR' ? E.p(ts, B.ferryloco + 0.7, B.ferryloco + 1) : 0, big: true }),
      over: (mc) => {
        // a little paper ferry bobbing in the Channel
        const fp = E.pop(ts, B.ferries - 0.05, 0.4);
        if (fp > 0) { const [fx, fy] = [92, 137]; mc.save(); mc.translate(fx + Math.sin(ts * 2) * 1.5, fy + Math.sin(ts * 3) * 0.8); mc.rotate(Math.sin(ts * 2.5) * 0.08); mc.scale(fp * 0.32, fp * 0.32); ferry(mc, ts); mc.restore(); }
      },
    });
    // the four white cards drop from the hand onto the cars
    le.cars.forEach(([mx, my], k) => {
      const t0 = B.colour - 0.25 + k * 0.13, u = E.p(ts, t0, t0 + 0.45); if (u <= 0 || u >= 1) return;
      const [X, Y] = E.mapToScreen(cam, mx, my), e = ease.in2(u);
      E.at(ctx, E.lerp(540 + (k - 1.5) * 170, X, e), E.lerp(1900, Y, e), (1 - e) * (k - 1.5) * 0.3 + le.ang * e, E.lerp(1, 0.35, e), () => E.trainCard(ctx, 'white', 150, { lift: 2 }));
    });
    // loco + one white for the ferry
    lp.cars.forEach(([mx, my], k) => {
      const t0 = B.ferryloco + 0.05 + k * 0.13, u = E.p(ts, t0, t0 + 0.4); if (u <= 0 || u >= 1) return;
      const [X, Y] = E.mapToScreen(cam, mx, my), e = ease.in2(u);
      E.at(ctx, E.lerp(400 + k * 280, X, e), E.lerp(1900, Y, e), lp.ang * e, E.lerp(1, 0.35, e), () => E.trainCard(ctx, k === 0 ? 'loco' : 'white', 150, { lift: 2 }));
    });
    const mid = E.mapToScreen(cam, (C.LON.x + C.EDI.x) / 2, (C.LON.y + C.EDI.y) / 2);
    tag(ctx, '4 white = 7 pts', mid[0] - 250, mid[1] + 150, E.p(ts, B.yours - 0.05, B.yours + 0.3), { t: ts, t0: B.yours, rot: 0.04, bg: '#FFFDF7', seed: 21 });
    if (ts > B.yours) E.check(ctx, mid[0] + 60, mid[1] - 120, 70, { prog: E.p(ts, B.yours + 0.1, B.yours + 0.4), t: ts, color: GOOD, seed: 22 });
    const fm = E.mapToScreen(cam, 92, 137);
    tag(ctx, 'ferry: needs a loco', fm[0] + 40, fm[1] + 190, E.p(ts, B.ferryloco - 0.05, B.ferryloco + 0.3), { t: ts, rot: -0.04, bg: AMBER, seed: 23 });
    hudTicket(ctx, ts, 540, 230, 0.82);
    // You rides along at the bottom
    E.sprocket(ctx, 150, 1450 + E.wobble(ts, B.yours, 20, 3, 4), 8.5, YOU, { look: [0.6, -0.8], mood: ts > B.yours ? 'happy' : null, arms: { l: 0.4, r: ts > B.yours && ts < B.ferries ? 2.7 : 0.5 }, ant: E.wobble(ts, B.yours, 1, 4, 3) }, ts);
  }
  function ferry(ctx, t) {
    // hull, cabin, funnel, in the map's ink style (drawn ~60 units wide, centred)
    const hull = new Path2D(); hull.moveTo(-30, 0); hull.lineTo(30, 0); hull.lineTo(22, 12); hull.lineTo(-24, 12); hull.closePath();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
    ctx.fillRect(-16, -12, 30, 12); ctx.strokeRect(-16, -12, 30, 12);
    ctx.fillStyle = PAL.red; ctx.fillRect(4, -24, 8, 12); ctx.strokeRect(4, -24, 8, 12);
    ctx.fillStyle = '#3d7dfa'; ctx.fill(hull); ctx.stroke(hull);
    ctx.fillStyle = INK; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-10 + i * 8, -6, 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-36, 15); ctx.quadraticCurveTo(-30, 12 + Math.sin(t * 6) * 2, -24, 16); ctx.stroke();
  }

  // ================================================================ 5. TUNNEL (20.45–24.4): the real tunnel sheet, three cards flip
  const TUN_CROP = [0, 1214, 860, 650]; // css y 607–932 of 3_tunnel
  const TUN_CARDS = [[40, 1389.6], [156, 1389.6], [272, 1389.6]]; // img px; each 96×128
  function sceneTunnel(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop('#E9E3D2', 51), 0, 0);
    // paper Alps with a tunnel mouth; a dashed green track runs in from Zürich and out to Venezia
    const mp = ease.outBack(E.p(ts, SCN.tunnel - 0.1, SCN.tunnel + 0.35));
    E.at(ctx, 540, 640 + (1 - mp) * 500, 0, 1, () => alps(ctx, ts));
    E.at(ctx, 540, 600, 0, 1, () => {
      note(ctx, 'Zürich', -380, -360, { prog: E.p(ts, SCN.tunnel + 0.2, SCN.tunnel + 0.5), size: 52, bg: '#FFFDF7', seed: 51 });
      note(ctx, 'Venezia', 380, -360, { prog: E.p(ts, SCN.tunnel + 0.3, SCN.tunnel + 0.6), size: 52, bg: '#FFFDF7', seed: 52 });
    });
    // the printed tunnel sheet from the game
    const pp = ease.out5(E.p(t, SCN.tunnel + 0.05, SCN.tunnel + 0.45));
    const img = E.images.tunnel;
    E.phone(ctx, img, 540, 1235 + (1 - pp) * 900, 920, -0.015, {
      print: true, crop: TUN_CROP, seed: 53,
      overlay: (c) => {
        // card backs cover the three cards until they flip over
        TUN_CARDS.forEach(([x, y], i) => {
          const f = E.p(ts, B.flip + 0.05 + i * 0.22, B.flip + 0.27 + i * 0.22);
          if (f >= 1) return;
          const cosv = Math.cos(f * Math.PI); // 1 → -1
          c.save(); c.fillStyle = '#ffffff'; c.fillRect(x - 10, y - 10, 116, 148); c.translate(x + 48, y + 64);
          if (cosv > 0) E.trainCard(c, 'white', 96, { back: true, flip: cosv, lift: 0.5 });
          else { // second half of the flip shows the face (the real card art is underneath; we only need the squash)
            c.scale(-cosv, 1); c.translate(-(x + 48), -(y + 64)); c.drawImage(img, x - 4, y - 4, 104, 136, x - 4, y - 4, 104, 136);
          }
          c.restore();
        });
        // message and pay button fade in after the flip, as in the game
        const msg = E.p(ts, B.match2 - 0.3, B.match2);
        if (msg < 1) { c.fillStyle = `rgba(255,255,255,${1 - msg})`; c.fillRect(30, 1530, 800, 340); }
      },
      after: (c) => {
        ringPx(c, 156, 1389.6, 96, 128, E.p(ts, B.match2, B.match2 + 0.35), { pad: 22, t: ts, seed: 54 });
        ringPx(c, 40, 1609, 780, 99.6, E.p(ts, B.more - 0.05, B.more + 0.35), { pad: 18, t: ts, seed: 55, w: 8 });
      },
    });
    note(ctx, 'a match!', 780, 1080, { prog: E.p(ts, B.match2 + 0.15, B.match2 + 0.45), size: 64, color: PAL.red, rot: 0.06 });
    tag(ctx, '+1 card', 860, 1580, E.p(ts, B.more, B.more + 0.3), { t: ts, t0: B.more, bg: AMBER, seed: 56, rot: 0.05, size: 46 });
  }
  function alps(ctx, t) {
    // three torn paper peaks with snowcaps, a tunnel mouth in the middle one
    const peaks = [[-300, 60, 330, 420, '#9AA6B8'], [300, 70, 360, 440, '#8D9AAE'], [0, 0, 460, 560, '#A9B4C4']];
    peaks.forEach(([x, y, w, h, col], i) => {
      E.at(ctx, x, y, 0, 1, () => {
        const p = E.poly([[-w / 2, 160], [-w * 0.18, -h + 180], [-w * 0.05, -h + 150], [w * 0.08, -h + 175], [w / 2, 160]]);
        E.paper(ctx, p, col, { lift: 1.2, seed: 60 + i, edge: INK, edgeW: 4 });
        const cap = E.poly([[-w * 0.18 - 40, -h + 260], [-w * 0.18, -h + 180], [-w * 0.05, -h + 150], [w * 0.08, -h + 175], [w * 0.08 + 60, -h + 255], [w * 0.0, -h + 230], [-w * 0.1, -h + 265]]);
        E.paper(ctx, cap, '#FFFDF7', { lift: 0.3, seed: 70 + i });
      });
    });
    // tunnel mouth + dashed green track
    const mouth = new Path2D(); mouth.moveTo(-90, 160); mouth.lineTo(-90, 80); mouth.arc(0, 80, 90, Math.PI, 0); mouth.lineTo(90, 160); mouth.closePath();
    E.paper(ctx, mouth, '#2A2B44', { lift: 0, seed: 80 });
    ctx.save(); ctx.strokeStyle = '#7A6A58'; ctx.lineWidth = 16; ctx.stroke(mouth); ctx.restore();
    ctx.save(); ctx.setLineDash([36, 18]); ctx.lineDashOffset = -t * 120; ctx.strokeStyle = '#3fbf5f'; ctx.lineWidth = 18; ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(-560, 200); ctx.quadraticCurveTo(-300, 210, -60, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(60, 150); ctx.quadraticCurveTo(300, 210, 560, 200); ctx.stroke(); ctx.restore();
    // a teal train rolls into the tunnel, loops round
    const u = ((t - SCN.tunnel) * 0.35) % 1;
    for (let k = 0; k < 3; k++) {
      const v = u - k * 0.07; if (v < 0 || v > 0.5) continue;
      const q = v / 0.5, x = E.lerp(-520, -40, q), y = E.lerp(196, 152, q * q);
      E.at(ctx, x, y - 16, -0.12 * q, 1, () => { const c = new Path2D(); c.roundRect(-34, -18, 68, 36, 9); E.paper(ctx, c, YOU, { lift: 0.6, seed: 90 + k }); ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.stroke(c); ctx.fillStyle = '#fff'; ctx.fillRect(-8, -8, 16, 16); });
    }
  }

  // ================================================================ 6. RIVALS (24.4–30.8): routes vanish to rivals; a station borrows Rose's line
  const RIV_CAM = [[SCN.rivals - 0.4, 200, 196, 5.2], [B.blocked - 0.2, 196, 196, 5.4], [SEND.rivals + 0.2, 190, 200, 5.9]];
  const RIVAL_CLAIMS = [[1, 'VEN', 'ROM', 'rose'], [2, 'MUN', 'WIE', 'sandy'], [3, 'ZAG', 'SOF', 'mint']];
  function sceneRivals(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop('#A9D7EE', 61), 0, 0);
    const cam = camAt(RIV_CAM, t, 920);
    const owned = new Map(RIVAL_CLAIMS.map(([p, a, b, beat]) => [R(a, b), [p, E.clamp((ts - B[beat] - 0.3) / 0.35)]]));
    const vr = R('VEN', 'ROM');
    E.drawMap(ctx, cam, ts, {
      routes: (r) => {
        if (r === R('PAR', 'ZUR') || r === R('ZUR', 'VEN')) return { owner: 0 };
        const o = owned.get(r); if (o && o[1] > 0) return { owner: o[0], prog: o[1] };
        return {};
      },
      city: (id) => ({ stamped: ['PAR', 'ZUR', 'VEN'].includes(id) ? 1 : 0, big: true }),
      over: (mc) => {
        const A = C.VEN, Bc = C.ROM;
        // blocked: a red pencil cross over Rose's cars
        const bx = E.p(ts, B.blocked, B.blocked + 0.3);
        if (bx > 0) { const mx = (A.x + Bc.x) / 2, my = (A.y + Bc.y) / 2; E.pen(mc, [[mx - 7, my - 7], [mx + 7, my + 7]], { color: PAL.red, w: 2.6, prog: E.clamp(bx * 2), t: ts, seed: 61, jitter: 0.3 }); E.pen(mc, [[mx + 7, my - 7], [mx - 7, my + 7]], { color: PAL.red, w: 2.6, prog: E.clamp(bx * 2 - 1), t: ts, seed: 62, jitter: 0.3 }); }
        // borrow: a dotted teal pencil line along Rose's route
        const bp = E.p(ts, B.borrow, B.borrow + 0.6);
        if (bp > 0) { mc.save(); mc.setLineDash([2.5, 3]); E.pen(mc, [[A.x - 5, A.y + 1], [(A.x + Bc.x) / 2 - 6.5, (A.y + Bc.y) / 2], [Bc.x - 5, Bc.y - 1]], { color: YOU, w: 2.4, prog: bp, t: ts, seed: 63, jitter: 0.2 }); mc.restore(); }
        // the station drops into Roma
        const sp = E.p(ts, B.station - 0.05, B.station + 0.25);
        if (sp > 0) { mc.save(); mc.translate(Bc.x + 3, Bc.y - 3 - (1 - ease.in2(sp)) * 30); const sq = 1 + E.wobble(ts, B.station + 0.25, 0.25, 4, 6); mc.scale(2.3 / sq, 2.3 * sq); E.station(mc, YOU, 1); mc.restore(); }
      },
    });
    // rivals pop up at the bottom; each one's cars snap onto a route as they're named
    RIVAL_CLAIMS.forEach(([p, , , beat], i) => {
      const col = E.PLAYERS[p].col, x = 200 + i * 340, t0 = B[beat] - 0.1, pp = E.pop(ts, t0, 0.4);
      if (pp <= 0) return;
      const smug = p === 1 && ts > B.blocked;
      const surprised = p === 1 && ts > B.borrow + 0.3;
      E.sprocket(ctx, x, 1440 + (1 - E.clamp(pp)) * 500, 8.5, col, { look: surprised ? [0, -1] : [0.2, -0.9], mood: surprised ? 'o' : smug ? 'happy' : 'grr', ant: E.wobble(ts, t0 + 0.2, 1, 4, 3), squash: E.wobble(ts, t0 + 0.35, 0.5, 3, 5), arms: { l: 0.5, r: smug && !surprised ? 2.6 + Math.sin(ts * 9) * 0.3 : 0.5 } }, ts);
      tag(ctx, E.PLAYERS[p].name, x, 1300 + (1 - E.clamp(pp)) * 500, E.p(ts, t0 + 0.15, t0 + 0.4), { size: 34, bg: col, seed: 64 + i, rot: (i - 1) * 0.05 });
    });
    const [vx, vy] = E.mapToScreen(cam, (C.VEN.x + C.ROM.x) / 2, (C.VEN.y + C.ROM.y) / 2);
    note(ctx, 'blocked!', vx - 270, vy - 230, { prog: E.p(ts, B.blocked + 0.1, B.blocked + 0.4), size: 70, color: PAL.red, rot: -0.08, bg: '#FFFDF7', seed: 68 });
    const [rx, ry] = E.mapToScreen(cam, C.ROM.x, C.ROM.y);
    tag(ctx, 'station: 1 card', rx + 210, ry + 120, E.p(ts, B.station + 0.15, B.station + 0.45), { t: ts, t0: B.station + 0.15, bg: '#FFFDF7', seed: 66, rot: 0.04 });
    tag(ctx, 'borrowed ✓', vx - 290, vy + 150, E.p(ts, B.borrow + 0.45, B.borrow + 0.75), { t: ts, bg: YOU, color: '#fff', seed: 67, rot: -0.05 });
    hudTicket(ctx, ts, 540, 230, 0.82);
  }

  // ================================================================ 7. POSTCARDS (30.8–35.6): every city has a landmark; connect it and it's stamped
  const CARDS = [
    { id: 'EDI', city: 'Edinburgh', title: 'Edinburgh Castle', fact: ['On the plug of an', 'extinct volcano.'], col: '#CFE3C4', art: castle, x: 285, y: 430, r: -0.07 },
    { id: 'PAR', city: 'Paris', title: 'Eiffel Tower', fact: ['Built for the 1889', 'World’s Fair.'], col: '#F6D7C8', art: eiffel, x: 800, y: 540, r: 0.06 },
    { id: 'ROM', city: 'Roma', title: 'Colosseum', fact: ['Opened in AD 80.'], col: '#F5E2B8', art: colosseum, x: 285, y: 860, r: 0.05 },
    { id: 'ATH', city: 'Athína', title: 'Parthenon', fact: ['Completed in', '432 BC.'], col: '#D7E6F5', art: parthenon, x: 800, y: 960, r: -0.05 },
  ];
  const PC_CROP = [0, 1436, 860, 300]; // css y 718–868 of 4_postcard
  function scenePostcards(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop('#C9A47E', 71), 0, 0);
    CARDS.forEach((c, i) => {
      const t0 = B.city - 0.3 + i * 0.3, u = ease.out5(E.p(ts, t0, t0 + 0.35));
      if (u <= 0) return;
      const fromX = i % 2 ? 1500 : -420, fromY = c.y - 300;
      E.at(ctx, E.lerp(fromX, c.x, u), E.lerp(fromY, c.y, u), c.r + (1 - u) * (i % 2 ? 0.6 : -0.6), 1, () => {
        postcard(ctx, c, ts);
        // stamped: an amber rubber stamp lands on each card in turn
        const st = E.p(ts, B.stamped + i * 0.12, B.stamped + 0.12 + i * 0.12);
        if (st > 0) E.at(ctx, -95, 75, -0.22, 0.85 + (1 - st) * 0.6, () => { ctx.globalAlpha = E.clamp(st * 2); stampMark(ctx, ts, 400 + i); ctx.globalAlpha = 1; });
      });
    });
    // the real postcard sheet from the game, taped under the pile
    const pp = ease.out5(E.p(ts, B.postcard + 0.1, B.postcard + 0.5));
    E.phone(ctx, E.images.postcard, 540, 1400 + (1 - pp) * 700, 900, 0.012, {
      print: true, crop: PC_CROP, seed: 72,
      after: (c) => ringPx(c, 265.4, 1470.2, 128, 48.6, E.p(ts, B.connect + 0.1, B.connect + 0.45), { pad: 20, t: ts, seed: 73, w: 7 }),
    });
    note(ctx, 'in the game: tap any city', 540, 1180, { prog: E.p(ts, B.postcard + 0.4, B.postcard + 0.7), size: 50, rot: -0.02, color: '#3A2810' });
  }
  function postcard(ctx, c, t) {
    const w = 500, h = 320;
    E.paper(ctx, E.cutRect(w, h, c.id.charCodeAt(0), 8), '#FFFDF7', { lift: 1.3, seed: c.id.charCodeAt(1) });
    // picture half
    ctx.save(); const pic = E.cutRect(210, 270, c.id.charCodeAt(2), 6); ctx.translate(-w / 2 + 125, 0); E.paper(ctx, pic, c.col, { lift: 0, seed: 3 }); ctx.clip(pic); c.art(ctx, t); ctx.restore();
    // text half
    const x0 = 22;
    E.text(ctx, c.city.toUpperCase(), x0, -104, { size: 22, weight: 800, color: '#575b78', align: 'left', ls: 2 });
    E.text(ctx, c.title, x0, -64, { fam: 'display', size: c.title.length > 13 ? 30 : 36, weight: 700, align: 'left' });
    c.fact.forEach((l, k) => E.text(ctx, l, x0, -14 + k * 34, { size: 25, weight: 700, align: 'left', color: '#3b3d55' }));
    ctx.save(); ctx.strokeStyle = '#C7CCDD'; ctx.lineWidth = 2.5; for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(x0, 88 + k * 32); ctx.lineTo(228, 88 + k * 32); ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = '#B9B2A5'; ctx.lineWidth = 2; ctx.strokeRect(178, -136, 52, 62); ctx.restore();
  }
  function stampMark(ctx, t, seed) {
    ctx.save(); ctx.strokeStyle = '#E8A400'; ctx.fillStyle = '#E8A400'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(0, 0, 100, 62, 0, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 86, 50, 0, 0, Math.PI * 2); ctx.stroke();
    E.font(ctx, 800, 34, 'ui'); ctx.letterSpacing = '3px'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('STAMPED', 0, 2); ctx.letterSpacing = '0px';
    ctx.globalCompositeOperation = 'destination-out'; const r = E.rnd(seed); for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc((r() - 0.5) * 200, (r() - 0.5) * 120, r() * 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }
  // ---- landmark illustrations (drawn in a 200×250 frame centred on 0,0)
  function castle(ctx, t) {
    const hill = new Path2D(); hill.moveTo(-110, 130); hill.quadraticCurveTo(-60, 10, 0, 20); hill.quadraticCurveTo(70, 0, 110, 130); hill.closePath();
    E.paper(ctx, hill, '#6E9E5E', { lift: 0.4, seed: 1 });
    ctx.fillStyle = '#8B857A'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    const wall = new Path2D(); wall.moveTo(-60, 30); for (let i = 0; i < 6; i++) { wall.lineTo(-60 + i * 20, -10); wall.lineTo(-50 + i * 20, -10); wall.lineTo(-50 + i * 20, -2); wall.lineTo(-40 + i * 20, -2); }
    wall.lineTo(60, -10); wall.lineTo(60, 30); wall.closePath(); ctx.fill(wall); ctx.stroke(wall);
    ctx.beginPath(); ctx.rect(-30, -60, 34, 52); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.moveTo(-13, -60); ctx.lineTo(-13, -90); ctx.lineTo(10, -82 + Math.sin(t * 6) * 3); ctx.lineTo(-13, -74); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; ctx.fillRect(-18, -40, 10, 14); ctx.fillRect(10, 6, 14, 24);
  }
  function eiffel(ctx) {
    ctx.fillStyle = '#9DD0EA'; ctx.beginPath(); ctx.arc(55, -80, 26, 0, Math.PI * 2); ctx.fill();
    E.pen(ctx, [[-70, 120], [-28, 10], [-8, -70], [0, -115]], { w: 6, seed: 2 }); E.pen(ctx, [[70, 120], [28, 10], [8, -70], [0, -115]], { w: 6, seed: 3 });
    E.pen(ctx, [[-36, 30], [36, 30]], { w: 6, seed: 4 }); E.pen(ctx, [[-20, -30], [20, -30]], { w: 5, seed: 5 });
    E.pen(ctx, [[-50, 120], [-30, 80], [0, 66], [30, 80], [50, 120]], { w: 5, seed: 6 });
    for (let i = 0; i < 4; i++) E.pen(ctx, [[-60 + i * 6, 110 - i * 24], [-20 + i * 3, 30 - i * 2]], { w: 2, seed: 7 + i, alpha: 0.5 });
  }
  function colosseum(ctx) {
    ctx.fillStyle = '#D9B98A'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    const body = new Path2D(); body.moveTo(-90, 90); body.lineTo(-90, -30); body.quadraticCurveTo(0, -70, 90, -60); body.lineTo(90, 90); body.closePath(); ctx.fill(body); ctx.stroke(body);
    ctx.fillStyle = '#7A5A3A';
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6; i++) { const x = -78 + i * 28, y = 60 - row * 40 - (i * 4 - row * 2); ctx.beginPath(); ctx.moveTo(x, y + 18); ctx.lineTo(x, y); ctx.arc(x + 8, y, 8, Math.PI, 0); ctx.lineTo(x + 16, y + 18); ctx.fill(); }
    E.pen(ctx, [[-90, 50], [90, 46]], { w: 3, seed: 8 }); E.pen(ctx, [[-90, 10], [90, 4]], { w: 3, seed: 9 });
  }
  function parthenon(ctx) {
    ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    const ped = new Path2D(); ped.moveTo(-95, -40); ped.lineTo(0, -95); ped.lineTo(95, -40); ped.closePath(); ctx.fill(ped); ctx.stroke(ped);
    ctx.fillRect(-95, -40, 190, 18); ctx.strokeRect(-95, -40, 190, 18);
    for (let i = 0; i < 6; i++) { ctx.fillRect(-85 + i * 32, -22, 18, 100); ctx.strokeRect(-85 + i * 32, -22, 18, 100); }
    ctx.fillRect(-105, 78, 210, 16); ctx.strokeRect(-105, 78, 210, 16);
    const hill = new Path2D(); hill.moveTo(-110, 130); hill.quadraticCurveTo(0, 80, 110, 130); hill.closePath(); E.paper(ctx, hill, '#C9A47E', { lift: 0.3, seed: 4 });
  }

  // ================================================================ 8. SCORE (35.6–42.67): ticket complete, longest line, You win
  const SCORE_CAM = [[SCN.score - 0.4, 196, 152, 2.7], [B.take, 192, 150, 2.75], [SEND.score + 0.2, 192, 150, 2.6]];
  const RIVAL_LATE = [['AMS', 'BER', 1], ['BER', 'CPH', 1], ['CPH', 'STO', 1], ['VEN', 'ROM', 1], ['MUN', 'WIE', 2], ['WIE', 'BUD', 2], ['BUD', 'BUC', 2], ['FRA', 'MUN', 2],
    ['ZAG', 'SOF', 3], ['SOF', 'IST', 3], ['WAR', 'KYI', 3], ['KYI', 'MOS', 3], ['LIS', 'MAD', 1], ['MAD', 'BCN', 3], ['BER', 'WAR', 2]];
  const SCORE_CROP = [0, 1040, 860, 640]; // css y 520–840 of 5_scores
  function sceneScore(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop(PAL.jSky, 81), 0, 0);
    const cam = camAt(SCORE_CAM, t, 1040);
    const mine = new Set(MY_LINE.map(([a, b]) => R(a, b))), late = new Map(RIVAL_LATE.map(([a, b, p]) => [R(a, b), p]));
    const lng = E.p(ts, B.longest - 0.05, B.longest + 0.75);
    E.drawMap(ctx, cam, ts, {
      routes: (r) => (mine.has(r) ? { owner: 0 } : late.has(r) ? { owner: late.get(r) } : {}),
      city: (id) => { const k = PATH.indexOf(id); return { stamped: k >= 0 ? (k < 5 ? 1 : E.p(ts, B.take + (k - 5) * 0.12, B.take + 0.2 + (k - 5) * 0.12)) : 0 }; },
      over: (mc) => {
        mc.save(); mc.translate(C.ROM.x + 3, C.ROM.y - 3); E.station(mc, YOU, 1); mc.restore();
        if (lng > 0) { const pts = ['EDI', 'LON', 'PAR', 'ZUR', 'VEN'].map((id) => [C[id].x, C[id].y]); E.pen(mc, pts, { color: PAL.red, w: 3.2, prog: lng, t: ts, seed: 81, jitter: 0.3, pencil: true }); }
      },
    });
    const [lx, ly] = E.mapToScreen(cam, C.PAR.x, C.PAR.y);
    tag(ctx, '+10 longest line', lx - 40, ly + 200, E.p(ts, B.longest + 0.5, B.longest + 0.8), { t: ts, t0: B.longest + 0.5, bg: AMBER, seed: 82, rot: -0.05, size: 44 });
    // the ticket, completed
    const done = E.p(ts, B.tickets + 0.2, B.tickets + 0.45);
    hudTicket(ctx, ts, 540, 330 + E.wobble(ts, B.tickets + 0.3, 8, 5, 6), 1.02, { done });
    if (done > 0) { E.check(ctx, 900, 250, 90, { prog: done, t: ts, color: GOOD, seed: 83 }); tag(ctx, '+21', 960, 420, done, { t: ts, t0: B.tickets + 0.3, bg: GOOD, color: '#fff', size: 48, seed: 84, fam: 'display' }); }
    // the real final-score sheet slides up; "You win!" gets ringed
    const sp = ease.out5(E.p(t, B.win - 0.25, B.win + 0.3));
    if (sp > 0) E.phone(ctx, E.images.scores, 540, 1280 + (1 - sp) * 900, 900, -0.012, {
      print: true, crop: SCORE_CROP, seed: 85,
      after: (c) => { ringPx(c, 40, 1127.4, 200, 55.2, E.p(ts, B.win + 0.35, B.win + 0.75), { pad: 20, t: ts, seed: 86, w: 8 }); ringPx(c, 729.8, 1317.6, 90.2, 88.2, E.p(ts, B.win + 0.8, B.win + 1.1), { pad: 6, t: ts, seed: 87, w: 7 }); },
    });
    confetti(ctx, ts, B.win + 0.3, 46, 5);
    const yp = E.pop(ts, B.win + 0.2, 0.45);
    if (yp > 0) E.sprocket(ctx, 920, 920 + (1 - E.clamp(yp)) * 300 - Math.abs(Math.sin((ts - B.win) * 7)) * 50, 9, YOU, { look: [-0.4, -0.5], mood: 'happy', arms: { l: 2.6 + Math.sin(ts * 9) * 0.3, r: 2.6 - Math.sin(ts * 9) * 0.3 }, ant: Math.sin(ts * 10) * 0.6 }, ts);
  }

  // ================================================================ 9. END (42.67–52): logo, title, the real start screen, CTA
  const START_CROP = [0, 1626, 860, 214]; // css y 813–920 of 1_start: the Quick game / Long game buttons
  function sceneEnd(ctx, t) {
    const ts = E.st(t);
    ctx.drawImage(E.backdrop(AMBER, 91), 0, 0);
    const lp = E.pop(ts, B.junction2 - 0.45, 0.5);
    if (lp > 0) E.sprocket(ctx, 540, 330 - (1 - E.clamp(lp)) * 500, 13 * Math.min(1, lp), YOU, { look: [0, 0.4], mood: 'happy', squash: E.wobble(ts, B.junction2 + 0.05, 0.7, 3, 5), ant: E.wobble(ts, B.junction2, 1.2, 4, 3) + Math.sin(ts * 3) * 0.1, blink: ts > B.junction2 + 1.2 && E.hash(Math.floor(ts * 4)) < 0.05 }, ts);
    const tp = E.pop(ts, B.junction2 - 0.05, 0.4);
    E.at(ctx, 540, 640, -0.015, tp, () => { ctx.save(); ctx.shadowColor = 'rgba(120,80,0,0.35)'; ctx.shadowOffsetY = 9; E.text(ctx, 'Junction', 0, 0, { fam: 'display', weight: 700, size: 196, color: INK }); ctx.restore(); });
    const ep = E.pop(ts, B.europe2 - 0.1, 0.4);
    E.at(ctx, 540, 770, 0.02, ep, () => E.wordTile(ctx, 'Europe', { fam: 'display', weight: 600, size: 70, bg: '#FFFDF7', color: INK, torn: true, seed: 9, padX: 60 }));
    // the game's own first screen: Quick game / Long game
    const sp = ease.out5(E.p(t, B.quick - 0.35, B.quick + 0.1));
    if (sp > 0) E.phone(ctx, E.images.start, 540, 1010 + (1 - sp) * 900, 900, -0.01, {
      print: true, crop: START_CROP, seed: 93,
      after: (c) => ringPx(c, 40, 1652, 380, 176, E.p(ts, B.quick + 0.1, B.quick + 0.5), { pad: 16, t: ts, seed: 94, w: 8 }),
    });
    note(ctx, '≈ 10 minutes', 300, 1180, { prog: E.p(ts, B.minutes - 0.1, B.minutes + 0.25), size: 60, color: PAL.red, rot: -0.05 });
    const cp = E.pop(ts, B.browser - 0.2, 0.45);
    E.at(ctx, 540, 1350, -0.012 + E.boil(9, ts, 0.006), cp, () => {
      E.paper(ctx, E.cutRect(820, 132, 171, 66), INK, { lift: 1.5, seed: 171 });
      E.text(ctx, 'Play a Quick game', 0, 4, { fam: 'display', size: 64, weight: 700, color: AMBER });
      E.at(ctx, -390, -52, -0.6, 1, () => E.tape(ctx, 120, 40, 'rgba(160,220,210,0.85)', 4));
    });
    const fp = E.p(ts, B.browser + 0.2, B.browser + 0.55);
    if (fp > 0) E.text(ctx, 'Runs in your browser · You vs. three robot rivals', 540, 1475, { size: 34, weight: 700, color: '#5A4300', alpha: fp });
    // the four players pop up to wave
    const L10 = TL.vo.find((v) => v.id === 'L10'), famT = L10.start + L10.dur + 0.1;
    E.PLAYERS.forEach((pl, i) => {
      const u = E.pop(ts, famT + i * 0.1, 0.5); if (u <= 0) return;
      const x = 165 + i * 250;
      E.sprocket(ctx, x, 1800 + (1 - E.clamp(u)) * 400, 8, pl.col, { look: [(540 - x) / 700, -0.5], mood: 'happy', arms: { l: 0.4, r: 2.5 + Math.sin(ts * 8 + i) * 0.35 }, ant: Math.sin(ts * 7 + i) * 0.4 }, ts);
    });
  }

  // ================================================================ sequence + transitions
  const SC = { hook: sceneHook, title: sceneTitle, cards: sceneCards, claim: sceneClaim, tunnel: sceneTunnel, rivals: sceneRivals, postcards: scenePostcards, score: sceneScore, end: sceneEnd };
  const SEQ = TL.scenes.map((s) => ({ draw: s.name, start: s.start }));
  SEQ.forEach((s, i) => { s.end = SEQ[i + 1] ? SEQ[i + 1].start : TL.duration + 1; });
  const WIPE = { cards: 'up', claim: 'left', tunnel: 'right', rivals: 'left', postcards: 'up', score: 'right' };
  const TRANS = SEQ.slice(1).map((s, i) => s.draw === 'title' ? { at: s.start, kind: 'disc', from: s.start - 0.42, to: s.start, cx: 540, cy: 1000, seed: 3 }
    : s.draw === 'end' ? { at: s.start, kind: 'disc', from: s.start - 0.4, to: s.start + 0.02, cx: 540, cy: 600, seed: 9 }
    : { at: s.start, kind: 'wipe', dir: WIPE[s.draw], from: s.start - 0.28, to: s.start + 0.12, seed: 4 + i });
  const sceneAt = (t) => SEQ.find((s) => t >= s.start && t < s.end) || SEQ[SEQ.length - 1];
  const sceneBefore = (at) => SEQ.find((s) => s.end === at);
  const sceneAfter = (at) => SEQ.find((s) => s.start === at);

  function drawTransition(ctx, tr, t) {
    const prog = ease.inOut(E.p(t, tr.from, tr.to));
    const prev = sceneBefore(tr.at), next = sceneAfter(tr.at);
    SC[prev.draw](ctx, t);
    if (tr.kind === 'disc') {
      const r = 1500 * ease.in2(E.p(t, tr.from, tr.to));
      if (r > 2) {
        ctx.save(); ctx.translate(tr.cx, tr.cy);
        E.paper(ctx, E.tornCircle(r + 10, tr.seed + 1, 12), '#FBF7EC', { lift: 1.6 });
        const clip = E.tornCircle(r, tr.seed, 10); ctx.clip(clip); ctx.translate(-tr.cx, -tr.cy);
        SC[next.draw](ctx, t); ctx.restore();
      }
    } else {
      const { path } = E.wipeClip(ctx, prog, tr.dir, tr.seed);
      ctx.save(); ctx.shadowColor = 'rgba(52,34,14,0.45)'; ctx.shadowBlur = 30; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 8; ctx.fillStyle = '#FBF7EC'; ctx.fill(path); ctx.restore();
      ctx.save(); ctx.clip(path);
      const inner = E.wipeClip(ctx, E.clamp(prog - 0.012), tr.dir, tr.seed + 1).path; ctx.clip(inner);
      SC[next.draw](ctx, t); ctx.restore();
    }
  }

  // ================================================================ captions
  function drawCaption(ctx, t) {
    const c = TL.captions.find((c) => t >= c.start - 0.05 && t < c.end + 0.1);
    if (!c) return;
    const a = E.clamp(Math.min((t - c.start + 0.05) / 0.12, (c.end + 0.1 - t) / 0.12));
    const size = Math.max(40, Math.min(50, (50 * 930) / E.measure(ctx, c.text, { size: 50, weight: 800 })));
    const w = Math.min(1010, E.measure(ctx, c.text, { size, weight: 800 }) + 64);
    ctx.save(); ctx.globalAlpha = a;
    E.at(ctx, 540, 1640, 0, 1, () => {
      E.paper(ctx, E.cutRect(w, 92, 7, 18, 0.8), 'rgba(255,255,255,0.97)', { lift: 0.8, seed: 2, grain: 0.3, edge: INK, edgeW: 4 });
      E.text(ctx, c.text, 0, 2, { size, weight: 800, color: INK });
    });
    ctx.restore();
  }

  // ================================================================ public: render(t)
  window.renderFrame = function (ctx, t, opts = {}) {
    t = E.clamp(t, 0, TL.duration - 1e-3);
    ctx.save();
    const tr = TRANS.find((tr) => t >= tr.from && t < tr.to);
    if (tr) drawTransition(ctx, tr, t);
    else SC[sceneAt(t).draw](ctx, t);
    ctx.restore();
    E.finish(ctx, t);
    if (opts.captions) drawCaption(ctx, t);
  };
  window.SCENE_LIST = SEQ.map((s) => ({ name: s.draw, start: s.start }));
})();
