/* Saboteur Express trailer — engine (vanilla JS, Canvas 2D).
 * Everything is a pure function of time: render(t) draws frame t from scratch.
 * Paper textures are generated procedurally once at start-up. */
(function () {
  const E = (window.E = {});
  E.W = 1080; E.H = 1920;

  E.PAL = {
    yellow: '#FEC629', yellowDeep: '#EDB20F', ink: '#141413', ink2: '#2A2723', bone: '#EFEAE0',
    cream: '#F7F1E3', paper: '#FFFDF7', green: '#2FA56E', greenSoft: '#D7F0E2', kraft: '#C9A47E',
    kraftDark: '#A47E58', terracotta: '#E07A5F', teal: '#3D9A8B', sky: '#8FC7E8', skyPale: '#DCEBF1',
    pink: '#F2A7B8', navy: '#2B3A55', red: '#D9412B', grey: '#8B857A', grey2: '#B9B2A5', night: '#1B1916',
    // Junction's own palette (junction.html :root and PLAYERS)
    jInk: '#1c1d33', jSea: '#7cc6e8', jSky: '#bfe4f6', jLand: '#f3df9f', jAccent: '#ffc933', jGood: '#0f9e86', jCard: '#eef2fa',
    you: '#14b8a6', rose: '#ff4fa3', sandy: '#c8894a', mint: '#9be15d',
  };

  // ---------------------------------------------------------------- math
  E.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  E.lerp = (a, b, t) => a + (b - a) * t;
  E.p = (t, a, b) => E.clamp((t - a) / (b - a));
  E.ease = {
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    out: (x) => 1 - Math.pow(1 - x, 3),
    out5: (x) => 1 - Math.pow(1 - x, 5),
    in: (x) => x * x * x,
    in2: (x) => x * x,
    outBack: (x, s = 1.9) => (x <= 0 ? 0 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2)),
    outElastic: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  };
  /** 0 before t0, overshooting pop to 1 over dur. */
  E.pop = (t, t0, dur = 0.42) => E.ease.outBack(E.p(t, t0, t0 + dur));
  /** smooth 0→1 between a and b */
  E.sm = (t, a, b, f = E.ease.inOut) => f(E.p(t, a, b));
  /** damped wobble after an impact at t0 (returns ~0 when settled) */
  E.wobble = (t, t0, amp = 1, freq = 9, damp = 6) => (t < t0 ? 0 : amp * Math.exp(-(t - t0) * damp) * Math.sin((t - t0) * freq * 2 * Math.PI));
  E.hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  E.rnd = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  /** stop-motion time: animation advances "on twos" (15 fps) */
  E.STEP = 15;
  E.st = (t) => Math.floor(t * E.STEP + 1e-6) / E.STEP;
  /** hand-made "boil": a value that re-rolls 8 times a second */
  E.boil = (seed, t, amp = 1) => (E.hash(seed * 13.37 + Math.floor(t * 8)) - 0.5) * 2 * amp;
  E.mix = (c1, c2, k) => {
    const a = E.rgb(c1), b = E.rgb(c2);
    return `rgb(${Math.round(E.lerp(a[0], b[0], k))},${Math.round(E.lerp(a[1], b[1], k))},${Math.round(E.lerp(a[2], b[2], k))})`;
  };
  E.rgb = (hex) => { if (hex.startsWith('rgb')) return hex.match(/\d+/g).map(Number); const h = hex.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16)); };

  // ---------------------------------------------------------------- assets
  E.images = {};
  E.loadImages = (map) => Promise.all(Object.entries(map).map(([k, src]) => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => { E.images[k] = im; res(); }; im.onerror = () => rej(new Error('image ' + src)); im.src = src;
  })));
  const tintCache = new Map();
  E.tinted = (img, color) => {
    const key = img.src.length + ':' + img.width + color;
    if (tintCache.has(key)) return tintCache.get(key);
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    tintCache.set(key, c); return c;
  };

  // ---------------------------------------------------------------- textures
  function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  E.initTextures = () => {
    // fine paper grain around mid-grey, used with soft-light
    const g = makeCanvas(512, 512), gx = g.getContext('2d');
    const id = gx.createImageData(512, 512); const r = E.rnd(42);
    for (let i = 0; i < id.data.length; i += 4) {
      const v = 128 + (r() - 0.5) * 70 + (r() < 0.01 ? (r() - 0.5) * 120 : 0);
      id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255;
    }
    gx.putImageData(id, 0, 0);
    // soft cloudy blotches
    for (let i = 0; i < 90; i++) {
      const x = r() * 512, y = r() * 512, rad = 20 + r() * 90, v = r() < 0.5 ? 0 : 255;
      const gr = gx.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${v},${v},${v},0.06)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
      gx.fillStyle = gr; gx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // fibres
    gx.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = r() * 512, y = r() * 512, a = r() * Math.PI * 2, l = 4 + r() * 16, v = r() < 0.6 ? 70 : 230;
      gx.strokeStyle = `rgba(${v},${v},${v},${0.18 + r() * 0.25})`; gx.lineWidth = 0.6 + r() * 0.8;
      gx.beginPath(); gx.moveTo(x, y); gx.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.6, y + Math.sin(a + 0.6) * l * 0.6, x + Math.cos(a) * l, y + Math.sin(a) * l); gx.stroke();
    }
    E.grainCanvas = g;
    // a coarser "construction paper" tooth for backdrops
    const t2 = makeCanvas(512, 512), tx = t2.getContext('2d'); const id2 = tx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4; const v = 128 + (r() - 0.5) * 34 + Math.sin(x * 0.9 + r()) * 3;
      id2.data[i] = id2.data[i + 1] = id2.data[i + 2] = v; id2.data[i + 3] = 255;
    }
    tx.putImageData(id2, 0, 0);
    E.toothCanvas = t2;
  };

  let grainPat = null, toothPat = null;
  E.grainPattern = (ctx, seed = 0) => {
    if (!grainPat) grainPat = ctx.createPattern(E.grainCanvas, 'repeat');
    grainPat.setTransform(new DOMMatrix().translate((seed * 97) % 512, (seed * 53) % 512));
    return grainPat;
  };
  E.toothPattern = (ctx) => { if (!toothPat) toothPat = ctx.createPattern(E.toothCanvas, 'repeat'); return toothPat; };

  const backdropCache = new Map();
  /** A full-frame sheet of coloured paper with blotches, grain and a soft vignette. */
  E.backdrop = (color, seed = 1, opts = {}) => {
    const key = color + seed + JSON.stringify(opts);
    if (backdropCache.has(key)) return backdropCache.get(key);
    const c = makeCanvas(E.W, E.H), x = c.getContext('2d');
    x.fillStyle = color; x.fillRect(0, 0, E.W, E.H);
    const r = E.rnd(seed);
    for (let i = 0; i < 40; i++) {
      const px = r() * E.W, py = r() * E.H, rad = 200 + r() * 600, light = r() < 0.5;
      const gr = x.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, light ? 'rgba(255,255,255,0.06)' : 'rgba(80,50,20,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, E.W, E.H);
    }
    x.globalCompositeOperation = 'soft-light'; x.globalAlpha = opts.dark ? 0.5 : 0.75;
    x.fillStyle = x.createPattern(E.toothCanvas, 'repeat'); x.fillRect(0, 0, E.W, E.H);
    x.fillStyle = x.createPattern(E.grainCanvas, 'repeat'); x.fillRect(0, 0, E.W, E.H);
    x.globalCompositeOperation = 'multiply'; x.globalAlpha = 1;
    const v = x.createRadialGradient(E.W / 2, E.H * 0.45, E.H * 0.3, E.W / 2, E.H * 0.5, E.H * 0.75);
    v.addColorStop(0, 'rgba(255,255,255,1)'); v.addColorStop(1, opts.dark ? 'rgba(120,110,100,1)' : 'rgba(205,190,170,1)');
    x.fillStyle = v; x.fillRect(0, 0, E.W, E.H);
    backdropCache.set(key, c);
    return c;
  };

  // ---------------------------------------------------------------- shapes
  /** jittered polygon → Path2D */
  E.poly = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };

  /** Scissor-cut rounded rectangle centred on 0,0 with a slightly imperfect outline. */
  E.cutRect = (w, h, seed = 1, rad = 18, wob = 1.6) => {
    const r = E.rnd(seed), pts = [];
    const rr = Math.min(rad, w / 2, h / 2);
    const corners = [[w / 2 - rr, -h / 2 + rr, -Math.PI / 2], [w / 2 - rr, h / 2 - rr, 0], [-w / 2 + rr, h / 2 - rr, Math.PI / 2], [-w / 2 + rr, -h / 2 + rr, Math.PI]];
    corners.forEach(([cx, cy, a0]) => {
      const steps = rr > 2 ? 5 : 1;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + (i / steps) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * rr + (r() - 0.5) * wob, cy + Math.sin(a) * rr + (r() - 0.5) * wob]);
      }
      // a couple of points along the following edge so long edges aren't ruler-straight
      const nxt = corners[(corners.findIndex((c) => c[2] === a0) + 1) % 4];
      const ex = cx + Math.cos(a0 + Math.PI / 2) * rr, ey = cy + Math.sin(a0 + Math.PI / 2) * rr;
      const fx = nxt[0] + Math.cos(nxt[2]) * rr, fy = nxt[1] + Math.sin(nxt[2]) * rr;
      for (let k = 1; k < 3; k++) pts.push([E.lerp(ex, fx, k / 3) + (r() - 0.5) * wob * 1.5, E.lerp(ey, fy, k / 3) + (r() - 0.5) * wob * 1.5]);
    });
    return E.poly(pts);
  };

  /** Hand-torn rectangle: jagged edges. `edges` picks which sides are torn (t,r,b,l). */
  E.tornRect = (w, h, seed = 1, rough = 7, edges = 'trbl', step = 13) => {
    const r = E.rnd(seed), pts = [];
    const side = (x0, y0, x1, y1, torn, nx, ny) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / step));
      for (let i = 0; i < n; i++) {
        const k = i / n; let d = torn ? (r() - 0.5) * rough * 2 + (r() < 0.12 ? (r() - 0.5) * rough * 2 : 0) : (r() - 0.5) * 1.2;
        pts.push([E.lerp(x0, x1, k) + nx * d, E.lerp(y0, y1, k) + ny * d]);
      }
    };
    side(-w / 2, -h / 2, w / 2, -h / 2, edges.includes('t'), 0, -1);
    side(w / 2, -h / 2, w / 2, h / 2, edges.includes('r'), 1, 0);
    side(w / 2, h / 2, -w / 2, h / 2, edges.includes('b'), 0, 1);
    side(-w / 2, h / 2, -w / 2, -h / 2, edges.includes('l'), -1, 0);
    return E.poly(pts);
  };

  E.wobCircle = (rad, seed = 1, wob = 1.5, n = 40) => {
    const r = E.rnd(seed), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, d = rad + (r() - 0.5) * wob * 2; pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
    return E.poly(pts);
  };
  E.wobEllipse = (rx, ry, seed = 1, wob = 1.5, n = 44) => {
    const r = E.rnd(seed), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 1 + (r() - 0.5) * wob * 0.02; pts.push([Math.cos(a) * rx * k, Math.sin(a) * ry * k]); }
    return E.poly(pts);
  };
  /** Torn circle (for the colour-change discs). */
  E.tornCircle = (rad, seed = 1, rough = 10, n = 120) => {
    const r = E.rnd(seed), pts = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, d = rad + (r() - 0.5) * rough * 2; pts.push([Math.cos(a) * d, Math.sin(a) * d]); }
    return E.poly(pts);
  };

  // ---------------------------------------------------------------- the cut-paper primitive
  const SHADOW = 'rgba(52,34,14,0.32)';
  /**
   * Fill a path as a piece of paper: drop shadow, colour, grain, a faint highlight.
   * o.lift (0..2) raises the shadow; o.grain alpha; o.seed offsets the grain.
   */
  E.paper = (ctx, path, fill, o = {}) => {
    const lift = o.lift ?? 1, seed = o.seed ?? 0;
    ctx.save();
    if (lift > 0) {
      ctx.shadowColor = o.shadow || SHADOW;
      ctx.shadowBlur = (5 + 13 * lift) * (o.shadowScale || 1);
      ctx.shadowOffsetX = (2 + 4 * lift) * (o.shadowScale || 1);
      ctx.shadowOffsetY = (4 + 9 * lift) * (o.shadowScale || 1);
    }
    ctx.fillStyle = fill; ctx.fill(path);
    ctx.restore();
    if (o.grain !== 0) {
      ctx.save(); ctx.clip(path);
      ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = o.grain ?? 0.7;
      ctx.fillStyle = E.grainPattern(ctx, seed); ctx.fill(path);
      ctx.restore();
    }
    if (o.edge) { ctx.save(); ctx.strokeStyle = o.edge; ctx.lineWidth = o.edgeW || 1.5; ctx.globalAlpha = 0.5; ctx.stroke(path); ctx.restore(); }
  };

  /** Torn paper with a visible white fibre core along the tear. */
  E.torn = (ctx, w, h, fill, seed, o = {}) => {
    const core = E.tornRect(w + 6, h + 6, seed * 7 + 1, o.rough ?? 7, o.edges ?? 'trbl');
    E.paper(ctx, core, o.coreColor || '#FBF8F0', { lift: o.lift ?? 1, seed, grain: 0.4, shadowScale: o.shadowScale });
    const face = E.tornRect(w, h, seed * 7 + 2, (o.rough ?? 7) * 0.8, o.edges ?? 'trbl');
    E.paper(ctx, face, fill, { lift: 0, seed: seed + 3, grain: o.grain });
    return face;
  };

  /** Translucent washi tape strip, centred at 0,0. */
  E.tape = (ctx, w, h, color = 'rgba(250,236,190,0.78)', seed = 1, stripes = null) => {
    const path = E.tornRect(w, h, seed, 3, 'lr', 6);
    ctx.save();
    ctx.shadowColor = 'rgba(52,34,14,0.18)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillStyle = color; ctx.fill(path); ctx.restore();
    ctx.save(); ctx.clip(path);
    if (stripes) { ctx.fillStyle = stripes; for (let x = -w; x < w; x += 18) { ctx.beginPath(); ctx.moveTo(x, -h); ctx.lineTo(x + 8, -h); ctx.lineTo(x + 8 + h, h); ctx.lineTo(x + h, h); ctx.fill(); } }
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.6; ctx.fillStyle = E.grainPattern(ctx, seed); ctx.fill(path);
    ctx.restore();
  };

  // ---------------------------------------------------------------- pen & pencil
  /**
   * Hand-drawn stroke through points with draw-on progress (0..1) and boil.
   * o: color, w, seed, t (for boil), prog, jitter, alpha, pencil(bool)
   */
  E.pen = (ctx, pts, o = {}) => {
    const prog = o.prog ?? 1; if (prog <= 0) return;
    const jit = o.jitter ?? 1.6, seed = o.seed ?? 1, t = o.t ?? 0;
    const q = pts.map(([x, y], i) => [x + E.boil(seed + i * 3.1, t, jit), y + E.boil(seed + i * 5.7 + 1, t, jit)]);
    // resample to a smooth curve (Catmull-Rom)
    const sm = [];
    for (let i = 0; i < q.length - 1; i++) {
      const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)];
      for (let s = 0; s < 8; s++) {
        const u = s / 8, u2 = u * u, u3 = u2 * u;
        sm.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)]);
      }
    }
    sm.push(q[q.length - 1]);
    let total = 0; const L = [0];
    for (let i = 1; i < sm.length; i++) { total += Math.hypot(sm[i][0] - sm[i - 1][0], sm[i][1] - sm[i - 1][1]); L.push(total); }
    const lim = total * prog;
    const passes = o.pencil ? [[0, 0, 1], [0.8, -0.6, 0.45]] : [[0, 0, 1]];
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = o.color || E.PAL.ink; ctx.lineWidth = o.w || 6;
    for (const [dx, dy, a] of passes) {
      ctx.globalAlpha = (o.alpha ?? 1) * a;
      ctx.beginPath(); ctx.moveTo(sm[0][0] + dx, sm[0][1] + dy);
      for (let i = 1; i < sm.length; i++) {
        if (L[i] > lim) { const k = (lim - L[i - 1]) / (L[i] - L[i - 1] || 1); ctx.lineTo(E.lerp(sm[i - 1][0], sm[i][0], k) + dx, E.lerp(sm[i - 1][1], sm[i][1], k) + dy); break; }
        ctx.lineTo(sm[i][0] + dx, sm[i][1] + dy);
      }
      ctx.stroke();
    }
    ctx.restore();
    return sm[Math.max(0, L.findIndex((l) => l >= lim))] || sm[sm.length - 1];
  };

  /** Hand-drawn arrow from a to b with a curve bend; head drawn after the shaft. */
  E.arrow = (ctx, a, b, o = {}) => {
    const prog = o.prog ?? 1; if (prog <= 0) return;
    const bend = o.bend ?? 0.25;
    const mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bend, my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bend;
    const pts = []; for (let i = 0; i <= 10; i++) { const u = i / 10; pts.push([(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * mx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * my + u * u * b[1]]); }
    E.pen(ctx, pts, { ...o, prog: E.clamp(prog / 0.8) });
    if (prog > 0.8) {
      const k = E.clamp((prog - 0.8) / 0.2), ang = Math.atan2(b[1] - pts[8][1], b[0] - pts[8][0]), hl = (o.head || 26) * k;
      E.pen(ctx, [[b[0] - Math.cos(ang - 0.5) * hl, b[1] - Math.sin(ang - 0.5) * hl], b, [b[0] - Math.cos(ang + 0.5) * hl, b[1] - Math.sin(ang + 0.5) * hl]], { ...o, prog: 1, seed: (o.seed || 1) + 9 });
    }
  };

  /** Back-and-forth scribble over a box (crossing out). */
  E.scribble = (ctx, x, y, w, h, o = {}) => {
    const r = E.rnd(o.seed || 3), pts = []; const n = o.n || 9;
    for (let i = 0; i <= n; i++) pts.push([x + (i / n) * w + (r() - 0.5) * 10, y + (i % 2 ? h : 0) + (r() - 0.5) * 12]);
    E.pen(ctx, pts, o);
  };

  E.check = (ctx, x, y, s, o = {}) => E.pen(ctx, [[x - s * 0.5, y], [x - s * 0.15, y + s * 0.38], [x + s * 0.55, y - s * 0.45]], { w: s * 0.16, ...o });

  // ---------------------------------------------------------------- type
  E.FONT = { display: '"Fredoka", "Arial Rounded MT Bold", sans-serif', ui: '"Nunito", "Helvetica Neue", Arial, sans-serif', hand: '"Nunito", sans-serif' };
  E.font = (ctx, w, size, fam = 'ui') => { ctx.font = `${w} ${size}px ${E.FONT[fam]}`; };
  E.text = (ctx, s, x, y, o = {}) => {
    ctx.save();
    E.font(ctx, o.weight || 600, o.size || 48, o.fam || 'ui');
    ctx.fillStyle = o.color || E.PAL.ink; ctx.textAlign = o.align || 'center'; ctx.textBaseline = o.base || 'middle';
    if (o.ls != null) ctx.letterSpacing = o.ls + 'px';
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.fillText(s, x, y);
    ctx.restore();
  };
  E.measure = (ctx, s, o = {}) => { ctx.save(); E.font(ctx, o.weight || 600, o.size || 48, o.fam || 'ui'); if (o.ls != null) ctx.letterSpacing = o.ls + 'px'; const m = ctx.measureText(s).width; ctx.restore(); return m; };

  /** A word on its own scrap of paper. */
  E.wordTile = (ctx, s, o = {}) => {
    const w = E.measure(ctx, s, o) + (o.padX ?? 36), h = (o.size || 48) * (o.hk ?? 1.25);
    const path = o.torn ? E.tornRect(w, h, o.seed || 1, 5) : E.cutRect(w, h, o.seed || 1, o.rad ?? 8);
    E.paper(ctx, path, o.bg || E.PAL.paper, { lift: o.lift ?? 0.8, seed: o.seed });
    E.text(ctx, s, 0, (o.size || 48) * 0.04, o);
    return [w, h];
  };

  // ---------------------------------------------------------------- transforms
  E.at = (ctx, x, y, rot = 0, s = 1, fn) => { if (s <= 0.001) return; ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (s !== 1) ctx.scale(s, s); fn(); ctx.restore(); };

  // ================================================================ SABOTEUR EXPRESS: game data (verbatim from "../Junction — Saboteur Express, India.html")
  E.HEX = { red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308', purple: '#a855f7', orange: '#f97316', gray: '#94a3b8' };
  E.CITY = {
    AMR: { n: 'Amritsar', x: 90, y: 70, l: 'l' }, DEL: { n: 'Delhi', x: 120, y: 106, l: 't' },
    JAI: { n: 'Jaipur', x: 98, y: 131, l: 'l' }, AGR: { n: 'Agra', x: 140, y: 128, l: 'r' },
    VAR: { n: 'Varanasi', x: 195, y: 152, l: 'r' }, KOL: { n: 'Kolkata', x: 262, y: 186, l: 'r' },
    BHU: { n: 'Bhubaneswar', x: 226, y: 214, l: 'r' }, AHM: { n: 'Ahmedabad', x: 66, y: 180, l: 'l' },
    BHO: { n: 'Bhopal', x: 122, y: 178, l: 'r' }, MUM: { n: 'Mumbai', x: 70, y: 232, l: 'l' },
    HYD: { n: 'Hyderabad', x: 137, y: 255, l: 'r' }, GOA: { n: 'Goa', x: 82, y: 280, l: 'l' },
    BLR: { n: 'Bengaluru', x: 124, y: 312, l: 'l' }, CHE: { n: 'Chennai', x: 158, y: 310, l: 'r' },
    KOC: { n: 'Kochi', x: 110, y: 348, l: 'l' },
  };
  E.ROUTES = [
    ['AMR', 'DEL', 'red', 2], ['AMR', 'JAI', 'blue', 3], ['DEL', 'JAI', 'green', 1], ['DEL', 'AGR', 'orange', 1],
    ['JAI', 'AGR', 'gray', 1], ['DEL', 'VAR', 'gray', 4], ['AGR', 'VAR', 'purple', 3], ['VAR', 'KOL', 'green', 3],
    ['JAI', 'AHM', 'red', 3], ['AHM', 'MUM', 'yellow', 2], ['AHM', 'BHO', 'gray', 2], ['AGR', 'BHO', 'blue', 2],
    ['BHO', 'VAR', 'orange', 3], ['BHO', 'HYD', 'green', 3], ['MUM', 'BHO', 'purple', 3], ['MUM', 'GOA', 'blue', 2],
    ['MUM', 'HYD', 'red', 3], ['KOL', 'BHU', 'yellow', 2], ['BHU', 'HYD', 'blue', 4], ['BHU', 'CHE', 'gray', 4],
    ['HYD', 'CHE', 'purple', 2], ['HYD', 'BLR', 'orange', 2], ['GOA', 'BLR', 'green', 2], ['BLR', 'CHE', 'yellow', 1],
    ['BLR', 'KOC', 'red', 2], ['GOA', 'KOC', 'purple', 3], ['VAR', 'BHU', 'red', 3],
  ].map(([a, b, color, len], i) => ({ i, a, b, color, len }));
  E.route = (a, b) => E.ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const OUT = [[74.5,37],[77,35.5],[79,33],[78.8,31.5],[81,30],[84,28.3],[88,27],[89,26.5],[92,27],[96,28.5],[96.5,27],[94.5,24],[93,22],[91.5,23.5],[91,25],[89.5,25.5],[89,22],[87,21.5],[86.5,20],[84.5,18.5],[82.5,17],[81,15.5],[80.2,13.5],[79.8,11],[79,10],[77.5,8.1],[76.5,9],[75.8,11.5],[74.8,13],[74,15],[73.3,17],[72.8,19],[72.8,21],[72.5,22.3],[70.5,20.8],[69,22.3],[68.3,23.6],[70.2,25],[70.5,26.5],[69.6,27.2],[72,29],[73.5,30],[74.6,31.2],[73.8,33],[74,34.5]];
  E.INDIA = OUT.map(([lo, la]) => [(lo - 68) * 13, (37 - la) * 13]);
  E.P = { You: '#2dd4bf', Rose: '#f472b6', Sandy: '#d6a86a', Frost: '#e2e8f0' };
  E.N = { night: '#070a1f', navy: '#12163a', panel: '#1a2050', land: '#222a5e', edge: '#3a4690', ink: '#eef1ff', muted: '#9aa3cc',
    amber: '#ffb020', red: '#ff4d5e', teal: '#2fd1bd', dark: '#0b1030' };
  E.FONT.tech = '"Fredoka", "Arial Rounded MT Bold", sans-serif';
  E.FONT.body = '"Nunito", "Helvetica Neue", Arial, sans-serif';
  // the cast of the 3D game
  E.P = { You: '#14b8a6', Rose: '#ff4fa3', Sandy: '#c8894a', Mint: '#9be15d' };

  // ================================================================ footage: real frames rendered from the 3D game (tools/shoot.mjs)
  // Export: one JPEG per film frame (footage/f#####.jpg), loaded by prep(t). Player: a synced <video> of the same frames.
  E.FOOT = { meta: window.FMETA || {}, imgs: new Map(), video: null };
  E.frameOf = (t) => Math.min(Math.round(t * 30), Math.round(TL.duration * 30) - 1);
  E.fmeta = (t) => E.FOOT.meta[E.frameOf(t)] || null;
  E.loadFootage = (t) => {
    const f = E.frameOf(t); if (!E.FOOT.meta[f] || E.FOOT.imgs.has(f)) return Promise.resolve();
    return new Promise((res) => { const im = new Image(); im.onload = () => { E.FOOT.imgs.set(f, im); if (E.FOOT.imgs.size > 8) E.FOOT.imgs.delete(E.FOOT.imgs.keys().next().value); res(); }; im.onerror = () => res(); im.src = `footage/f${String(f).padStart(5, '0')}.jpg`; });
  };
  /** draw the 3D footage for time t, graded: o.dark (0..1 night), o.tint ('r,g,b' multiply strength o.tintK), o.blur px */
  E.drawFootage = (ctx, t, o = {}) => {
    const v = E.FOOT.video, img = v && v.readyState >= 2 ? v : E.FOOT.imgs.get(E.frameOf(t));
    ctx.fillStyle = '#05061a'; ctx.fillRect(0, 0, E.W, E.H);
    if (!img) return;
    ctx.save(); if (o.blur) ctx.filter = `blur(${o.blur}px)`; ctx.drawImage(img, 0, 0, E.W, E.H); ctx.restore();
    if (o.tintK) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(${o.tint || '70,90,170'},${o.tintK})`; ctx.fillRect(0, 0, E.W, E.H); ctx.restore(); }
    if (o.dark) { ctx.fillStyle = `rgba(4,5,20,${o.dark})`; ctx.fillRect(0, 0, E.W, E.H); }
  };
  /** re-light a round region of the footage (an eye in the dark): draws the frame again inside a soft circle */
  E.footageSpot = (ctx, t, x, y, r, k = 1, glow = '#ffffff') => {
    const v = E.FOOT.video, img = v && v.readyState >= 2 ? v : E.FOOT.imgs.get(E.frameOf(t)); if (!img || k <= 0) return;
    ctx.save(); ctx.globalAlpha = k; ctx.shadowColor = glow; ctx.shadowBlur = r * 0.8; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill(); ctx.shadowBlur = 0;
    ctx.clip(); ctx.drawImage(img, 0, 0, E.W, E.H); ctx.restore();
  };

  // ================================================================ noir kit
  /** a night sky: deep gradient, stars that twinkle, a faint nebula; cached per seed */
  const skyCache = new Map();
  E.sky = (ctx, t, seed = 1, o = {}) => {
    const key = seed + ':' + (o.tint || '');
    let c = skyCache.get(key);
    if (!c) {
      c = makeCanvas(E.W, E.H); const x = c.getContext('2d');
      const g = x.createLinearGradient(0, 0, 0, E.H); g.addColorStop(0, '#050716'); g.addColorStop(0.55, o.tint || '#0d1236'); g.addColorStop(1, '#070a1f');
      x.fillStyle = g; x.fillRect(0, 0, E.W, E.H);
      const r = E.rnd(seed);
      for (let i = 0; i < 6; i++) { const px = r() * E.W, py = r() * E.H, rad = 300 + r() * 500; const gr = x.createRadialGradient(px, py, 0, px, py, rad); gr.addColorStop(0, `rgba(${80 + r() * 60 | 0},${60 + r() * 40 | 0},${160 + r() * 60 | 0},0.10)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, E.W, E.H); }
      c.stars = []; for (let i = 0; i < 260; i++) c.stars.push([r() * E.W, r() * E.H, r() * 1.8 + 0.3, r() * 6]);
      skyCache.set(key, c);
    }
    ctx.drawImage(c, 0, 0);
    ctx.save(); ctx.fillStyle = '#ffffff';
    const drift = o.drift || 0;
    c.stars.forEach(([x, y, s, ph]) => { const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.3 + ph)); ctx.globalAlpha = a * (o.alpha ?? 1); const X = ((x - drift * s * 30) % E.W + E.W) % E.W; ctx.fillRect(X, y, s, s); });
    ctx.restore();
  };
  /** glow helper: run fn with a coloured shadow-glow */
  E.glow = (ctx, color, blur, fn) => { ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = blur; fn(); ctx.restore(); };
  /** tracked uppercase tech title; o.glitch (0..1) splits it into RGB ghosts */
  E.title = (ctx, s, x, y, o = {}) => {
    const size = o.size || 96, ls = o.ls ?? size * 0.12;
    const draw = (dx, dy, col, a) => E.text(ctx, s, x + dx, y + dy, { fam: 'tech', weight: o.weight || 700, size, color: col, ls, alpha: a, align: o.align || 'center' });
    ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (o.glitch) {
      const g = o.glitch, j = (E.hash(Math.floor((o.t || 0) * 24) + (o.seed || 0)) - 0.5) * 2;
      ctx.globalCompositeOperation = 'lighter';
      draw(-8 * g - j * 10 * g, 0, 'rgba(255,40,80,0.8)', 1); draw(8 * g + j * 6 * g, 2 * g, 'rgba(40,200,255,0.75)', 1);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o.glowColor) E.glow(ctx, o.glowColor, o.glowBlur || 30, () => draw(0, 0, o.color || E.N.ink, 1)); else draw(0, 0, o.color || E.N.ink, 1);
    ctx.restore();
  };
  /** horizontal glitch slices: copies bands of the frame sideways */
  E.glitchSlices = (ctx, t, amt, seed = 1) => {
    if (amt <= 0) return;
    const r = E.rnd(Math.floor(t * 20) + seed * 99);
    for (let i = 0; i < 6; i++) { const y = r() * E.H, h = 8 + r() * 60, dx = (r() - 0.5) * 120 * amt; ctx.drawImage(ctx.canvas, 0, y, E.W, h, dx, y, E.W, h); }
  };
  E.vignette = (ctx, k = 0.75, col = '0,0,0') => {
    const g = ctx.createRadialGradient(E.W / 2, E.H * 0.48, E.H * 0.22, E.W / 2, E.H * 0.5, E.H * 0.78);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${k})`); ctx.fillStyle = g; ctx.fillRect(0, 0, E.W, E.H);
  };
  /** red emergency lighting: a pulsing wash + a rotating beacon sweep */
  E.alarm = (ctx, t, k) => {
    if (k <= 0) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.6);
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255,30,60,${(0.10 + 0.22 * pulse) * k})`; ctx.fillRect(0, 0, E.W, E.H);
    ctx.globalCompositeOperation = 'lighter';
    const a = t * 3.2, cx = E.W / 2, cy = -200;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, E.H * 1.2); g.addColorStop(0, `rgba(255,60,80,${0.35 * k})`); g.addColorStop(1, 'rgba(255,0,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, E.H * 1.3, a, a + 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, E.H * 1.3, a + Math.PI, a + Math.PI + 0.5); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  E.scanlines = (ctx, x, y, w, h, a = 0.12) => { ctx.save(); ctx.fillStyle = `rgba(0,0,0,${a})`; for (let yy = y; yy < y + h; yy += 4) ctx.fillRect(x, yy, w, 2); ctx.restore(); };

  // ---------------------------------------------------------------- Sprocket robots, lit for night scenes
  /**
   * A Sprocket at (x,y) = hex centre; s = px per SVG unit (the game's icon is 22×29 units).
   * o: look [dx,dy], blink (0..1 closed), light (0..1, how lit the body is), rim colour, eyeGlow (0..1),
   *    squash, rot, ant (antenna wobble), sweat, mood 'o'|'narrow', alpha, shadowEye (only the eye shows)
   */
  E.robot = (ctx, x, y, s, col, o = {}, t = 0) => {
    const ink = '#0b1030', light = o.light ?? 1, sq = o.squash || 0;
    E.at(ctx, x, y, o.rot || 0, 1, () => {
      ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.scale(s * (1 + sq * 0.12), s * (1 - sq * 0.12));
      const body = E.mix(E.mix(col, '#05061a', 0.88), col, light);
      if (!o.shadowEye) {
        // antenna
        ctx.save(); ctx.translate(0, -8); ctx.rotate((o.ant || 0) * 0.35);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.5, -5); ctx.stroke();
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(1.8, -5.8, 2.1, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
        if (o.rim) { ctx.strokeStyle = o.rim; ctx.globalAlpha *= 0.9; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(1.8, -5.8, 2.6, -2.4, -0.6); ctx.stroke(); ctx.globalAlpha /= 0.9; }
        ctx.restore();
        ctx.fillStyle = ink; ctx.beginPath(); ctx.roundRect(-6, 6.5, 4, 4.2, 1); ctx.roundRect(2, 6.5, 4, 4.2, 1); ctx.fill();
        const hex = E.poly([[9, 0], [4.5, 7.8], [-4.5, 7.8], [-9, 0], [-4.5, -7.8], [4.5, -7.8]]);
        ctx.fillStyle = body; ctx.fill(hex);
        // soft top light + bottom shade
        const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, `rgba(255,255,255,${0.18 * light})`); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(0,0,20,${0.35})`);
        ctx.fillStyle = g; ctx.fill(hex);
        ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke(hex);
        if (o.rim) { ctx.save(); ctx.strokeStyle = o.rim; ctx.lineWidth = 0.9; ctx.shadowColor = o.rim; ctx.shadowBlur = 8; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-4.5, -7.8); ctx.lineTo(4.5, -7.8); ctx.lineTo(9, 0); ctx.stroke(); ctx.restore(); }
        if (o.sweat) { ctx.fillStyle = '#9fe3ff'; ctx.globalAlpha *= o.sweat; ctx.beginPath(); ctx.moveTo(-7.4, -4.5); ctx.quadraticCurveTo(-8.6, -2.2, -7.4, -1.6); ctx.quadraticCurveTo(-6.2, -2.2, -7.4, -4.5); ctx.fill(); ctx.globalAlpha /= o.sweat; }
      }
      // the eye
      const [lx, ly] = o.look || [0.3, 0];
      const bl = 1 - E.clamp(o.blink || 0) * 0.92, eg = o.eyeGlow ?? 0;
      ctx.save(); ctx.translate(0, -0.5); ctx.scale(1, bl);
      if (eg > 0) { ctx.shadowColor = o.eyeColor || '#ffffff'; ctx.shadowBlur = 14 * eg * s / 6; }
      ctx.fillStyle = o.eyeColor || '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4.3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = ink; ctx.lineWidth = 1.2; if (!o.shadowEye) ctx.stroke();
      const pr = o.mood === 'o' ? 1.3 : 2;
      ctx.fillStyle = o.pupil || ink; ctx.beginPath(); ctx.arc(lx * 1.7, ly * 1.7, pr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx * 1.7 + 0.7, ly * 1.7 - 0.7, 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (o.mood === 'narrow') { ctx.fillStyle = o.lidColor || body; ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(5, -6); ctx.lineTo(5, -2.6); ctx.quadraticCurveTo(0, -1.4, -5, -2.6); ctx.closePath(); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-4.4, -2.5); ctx.quadraticCurveTo(0, -1.5, 4.4, -2.5); ctx.stroke(); }
      ctx.restore();
    });
  };

  // ---------------------------------------------------------------- the India map (game projection, translate(6,6))
  /** cam {x,y,z}: map point (x,y) appears at screen (W/2, cam.sy ?? H/2), z px per map unit */
  E.mapPt = (cam, x, y) => [E.W / 2 + (x + 6 - cam.x) * cam.z, (cam.sy ?? E.H / 2) + (y + 6 - cam.y) * cam.z];
  E.drawIndia = (ctx, cam, t, o = {}) => {
    const z = cam.z, A0 = ctx.globalAlpha; // every alpha below is relative to the caller's
    ctx.save(); ctx.translate(E.W / 2, cam.sy ?? E.H / 2); ctx.scale(z, z); ctx.translate(-cam.x + 6, -cam.y + 6);
    // land with a glowing edge
    const land = E.poly(E.INDIA);
    E.glow(ctx, `rgba(90,120,255,${0.55 * (o.edgeGlow ?? 1)})`, 30, () => { ctx.fillStyle = E.N.land; ctx.fill(land); });
    ctx.save(); ctx.clip(land); const lg = ctx.createLinearGradient(0, 0, 0, 380); lg.addColorStop(0, 'rgba(120,140,255,0.10)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = lg; ctx.fill(land); ctx.restore();
    ctx.strokeStyle = E.N.edge; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke(land);
    ctx.fillStyle = E.N.land; ctx.beginPath(); ctx.ellipse(165, 378, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // routes, drawn the way the game draws them
    E.ROUTES.forEach((r) => {
      const s = o.routes ? o.routes(r) : {}; if (s === null) return;
      const A = E.CITY[r.a], Bc = E.CITY[r.b], dx = Bc.x - A.x, dy = Bc.y - A.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
      const x1 = A.x + ux * 8, y1 = A.y + uy * 8, x2 = Bc.x - ux * 8, y2 = Bc.y - uy * 8, L = d - 16, gap = 2.4, dash = (L - gap * (r.len - 1)) / r.len;
      const prog = s.prog ?? 1, ex = x1 + (x2 - x1) * prog, ey = y1 + (y2 - y1) * prog;
      ctx.save(); ctx.lineCap = 'round';
      if (s.owner) {
        const oc = E.P[s.owner];
        ctx.globalAlpha = A0 * 0.55; ctx.strokeStyle = '#0b1030'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke(); ctx.globalAlpha = A0;
        ctx.shadowColor = oc; ctx.shadowBlur = (s.glow ?? 0.5) * 18; ctx.strokeStyle = oc; ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke(); ctx.shadowBlur = 0;
        if (prog >= 1) { ctx.fillStyle = oc; ctx.strokeStyle = '#0b1030'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc((x1 + x2) / 2, (y1 + y2) / 2, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      } else {
        ctx.globalAlpha = A0 * (s.alpha ?? 0.9) * (s.dim ?? 1); ctx.lineCap = 'butt'; ctx.setLineDash([dash, gap]); ctx.strokeStyle = s.dead ? '#3a2030' : E.HEX[r.color]; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (s.blocked) {
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, b = s.blocked;
        ctx.globalAlpha = A0 * b; ctx.setLineDash([3, 3]); ctx.strokeStyle = E.N.red; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
        ctx.shadowColor = E.N.red; ctx.shadowBlur = 16 + 10 * Math.sin(t * 9); ctx.fillStyle = E.N.red; ctx.beginPath(); ctx.arc(mx, my, 7 * (1 + 0.15 * Math.sin(t * 9)), 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff'; ctx.font = `700 11px ${E.FONT.body}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', mx, my + 0.5);
      }
      ctx.restore();
    });
    if (o.over) o.over(ctx);
    // cities
    Object.entries(E.CITY).forEach(([id, c]) => {
      const s = o.city ? o.city(id) : {}; const show = s.show ?? 1; if (show <= 0) return;
      ctx.save(); ctx.translate(c.x, c.y); ctx.scale(show, show);
      if (s.pulse) { const u = (t * 0.8) % 1; ctx.strokeStyle = E.N.amber; ctx.globalAlpha = A0 * (1 - u) * 0.9; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 6 + u * 10, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = A0; }
      ctx.fillStyle = s.fill || E.N.panel; ctx.strokeStyle = E.N.ink; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    // labels in screen space
    if ((o.labels ?? 1) > 0) Object.entries(E.CITY).forEach(([id, c]) => {
      const s = o.city ? o.city(id) : {}; if ((s.show ?? 1) <= 0 || s.label === 0) return;
      const size = E.clamp(9.5 * z, 18, 40), [X, Y] = E.mapPt(cam, c.x, c.y), g = 9 * z;
      const lx = c.l === 'l' ? X - g : c.l === 'r' ? X + g : X, ly = c.l === 't' ? Y - 10 * z : Y + size * 0.36;
      ctx.save(); ctx.globalAlpha = A0 * (o.labels ?? 1) * (s.labelAlpha ?? 1);
      ctx.font = `700 ${size}px ${E.FONT.body}`; ctx.textAlign = c.l === 'l' ? 'right' : c.l === 'r' ? 'left' : 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.strokeStyle = E.N.navy; ctx.lineWidth = size * 0.3; ctx.strokeText(c.n, lx, ly); ctx.fillStyle = E.N.ink; ctx.fillText(c.n, lx, ly); ctx.restore();
    });
  };

  // ---------------------------------------------------------------- the night train (side view)
  /**
   * A train running along y (rail level), carriages trailing to the right of the locomotive's nose at x.
   * o: cars (number of carriages), wheelT (wheel spin), doorOpen (0..1 on the last car), windowsLit (0..1), riders [{col,car,slot}]
   * returns { lastCarX, lastCarY } (rear door position)
   */
  E.train = (ctx, x, y, o = {}, t = 0) => {
    const cars = o.cars ?? 3, carW = 420, carH = 190, gap = 26, s = o.s || 1;
    let rear = null;
    E.at(ctx, x, y, 0, s, () => {
      const sway = Math.sin(t * 7) * 1.5;
      // locomotive
      ctx.save(); ctx.translate(0, sway * 0.5);
      const loco = new Path2D(); loco.moveTo(0, -carH + 60); loco.quadraticCurveTo(0, -carH - 10, 90, -carH - 10); loco.lineTo(380, -carH - 10); loco.lineTo(380, -22); loco.lineTo(-10, -22); loco.quadraticCurveTo(-40, -22, -40, -60); loco.closePath();
      ctx.fillStyle = '#1b2257'; ctx.fill(loco); ctx.strokeStyle = '#0b1030'; ctx.lineWidth = 6; ctx.stroke(loco);
      ctx.fillStyle = E.N.amber; ctx.fillRect(-10, -86, 390, 12);
      E.glow(ctx, '#fff6c8', 60, () => { ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(-26, -70, 14, 0, Math.PI * 2); ctx.fill(); });
      // headlight beam
      const bg = ctx.createLinearGradient(-30, 0, -900, 0); bg.addColorStop(0, 'rgba(255,240,190,0.45)'); bg.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(-30, -78); ctx.lineTo(-900, -200); ctx.lineTo(-900, 40); ctx.lineTo(-30, -62); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#9fd8ff'; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.roundRect(40, -carH + 14, 90, 60, 10); ctx.fill(); ctx.globalAlpha = 1;
      ctx.restore();
      wheels(ctx, 30, 320, t, o.wheelT ?? t);
      for (let k = 0; k < cars; k++) {
        const cx = 380 + gap + k * (carW + gap);
        ctx.save(); ctx.translate(cx, Math.sin(t * 7 + k) * 1.5);
        ctx.fillStyle = '#2a2f5e'; ctx.fillRect(-gap, -70, gap, 12); // coupling
        const body = new Path2D(); body.roundRect(0, -carH - 10, carW, carH - 12, 18);
        ctx.fillStyle = '#20275c'; ctx.fill(body); ctx.strokeStyle = '#0b1030'; ctx.lineWidth = 6; ctx.stroke(body);
        ctx.fillStyle = E.N.amber; ctx.fillRect(4, -60, carW - 8, 8);
        // windows
        for (let w = 0; w < 4; w++) {
          const wx = 26 + w * 98, lit = o.windowsLit ?? 1, flick = 0.85 + 0.15 * Math.sin(t * 13 + w * 2 + k);
          ctx.fillStyle = `rgba(255,214,140,${0.85 * lit * flick})`; ctx.beginPath(); ctx.roundRect(wx, -carH + 20, 74, 66, 8); ctx.fill();
          const rider = (o.riders || []).find((r) => r.car === k && r.slot === w);
          if (rider) { ctx.save(); ctx.beginPath(); ctx.roundRect(wx, -carH + 20, 74, 66, 8); ctx.clip(); E.robot(ctx, wx + 37, -carH + 66, 3.2, rider.col, { light: 0.5, look: rider.look || [-0.6, 0] }, t); ctx.restore(); }
        }
        if (k === cars - 1) {
          // the rear door: slides open, light spills out
          const d = E.clamp(o.doorOpen || 0), dx0 = carW - 70;
          ctx.fillStyle = `rgba(255,236,190,${0.95 * d})`; ctx.fillRect(dx0, -carH + 10, 56, carH - 40);
          ctx.fillStyle = '#161c4a'; ctx.fillRect(dx0 + d * 52, -carH + 10, 56 - d * 52, carH - 40); ctx.strokeStyle = '#0b1030'; ctx.lineWidth = 4; ctx.strokeRect(dx0, -carH + 10, 56, carH - 40);
          rear = { x: cx + dx0 + 28, y: -carH / 2 };
        }
        ctx.restore();
        wheels(ctx, cx + 40, cx + carW - 40, t, o.wheelT ?? t);
      }
    });
    return rear && { x: x + rear.x * s, y: y + rear.y * s };
  };
  function wheels(ctx, x0, x1, t, wt) {
    [x0, x1].forEach((wx) => {
      ctx.save(); ctx.translate(wx, -14); ctx.fillStyle = '#0b1030'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a5590'; ctx.lineWidth = 3; ctx.rotate(-wt * 14); for (let i = 0; i < 3; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.stroke(); } ctx.restore();
    });
  }

  // ---------------------------------------------------------------- a real game screen on a glowing glass panel
  /** crop = [sx,sy,sw,sh] of the image; overlay/after draw in image pixels (crop-aware). o.glow colour, o.scan scanlines */
  E.holo = (ctx, img, x, y, w, o = {}) => {
    const cr = o.crop || [0, 0, img.width, img.height], h = w * cr[3] / cr[2];
    const toImg = () => { ctx.translate(-w / 2, -h / 2); ctx.scale(w / cr[2], w / cr[2]); ctx.translate(-cr[0], -cr[1]); };
    E.at(ctx, x, y, o.rot || 0, o.s ?? 1, () => {
      ctx.save(); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      const frame = new Path2D(); frame.roundRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 30);
      E.glow(ctx, o.glow || 'rgba(80,130,255,0.7)', 50, () => { ctx.fillStyle = '#0d1236'; ctx.fill(frame); });
      ctx.strokeStyle = o.glow || 'rgba(110,150,255,0.8)'; ctx.lineWidth = 3; ctx.stroke(frame);
      const scr = new Path2D(); scr.roundRect(-w / 2, -h / 2, w, h, 22);
      ctx.save(); ctx.clip(scr);
      ctx.drawImage(img, cr[0], cr[1], cr[2], cr[3], -w / 2, -h / 2, w, h);
      if (o.overlay) { ctx.save(); toImg(); o.overlay(ctx); ctx.restore(); }
      if (o.scan !== false) E.scanlines(ctx, -w / 2, -h / 2, w, h, 0.10);
      const gl = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gl.addColorStop(0, 'rgba(255,255,255,0.08)'); gl.addColorStop(0.4, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fill(scr);
      ctx.restore();
      if (o.after) { ctx.save(); toImg(); o.after(ctx); ctx.restore(); }
      ctx.restore();
    });
    return [w + 20, h + 20];
  };
  /** a glowing selection ring around an image-space rect (inside o.after) */
  E.selRing = (ctx, x, y, w, h, prog, col = '#ffb020', pad = 10) => {
    if (prog <= 0) return;
    ctx.save(); ctx.globalAlpha *= E.clamp(prog * 2); ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.shadowColor = col; ctx.shadowBlur = 24;
    const p = new Path2D(); p.roundRect(x - pad, y - pad, w + pad * 2, h + pad * 2, 22); ctx.setLineDash([]); ctx.stroke(p); ctx.restore();
  };

  // ---------------------------------------------------------------- phone
  /**
   * A screenshot pasted in: on a phone cut from black card, or (o.print) printed on white paper and taped down.
   * o.crop = [sx, sy, sw, sh] in image pixels shows only that region. o.overlay(ctx) draws live UI on top
   * in the image's own pixel coordinates (crop-aware); o.after(ctx) does the same above the paper finish.
   */
  E.phone = (ctx, img, x, y, w, rot, o = {}) => {
    const cr = o.crop || [0, 0, img.width, img.height];
    const sw = w, shh = w * cr[3] / cr[2], bz = o.print ? 22 : 16, W = sw + bz * 2, H = shh + bz * 2;
    const toImg = () => { ctx.translate(-sw / 2, -shh / 2); ctx.scale(sw / cr[2], sw / cr[2]); ctx.translate(-cr[0], -cr[1]); };
    E.at(ctx, x, y, rot, o.s ?? 1, () => {
      if (o.print) E.paper(ctx, E.tornRect(W, H, o.seed || 77, 3, 'tb', 9), '#FFFFFF', { lift: o.lift ?? 1.3, seed: 5 });
      else E.paper(ctx, E.cutRect(W, H, 77, 58, 1.2), E.PAL.ink, { lift: o.lift ?? 1.4, seed: 5 });
      const scr = o.print ? E.cutRect(sw, shh, 78, 4, 0.3) : E.cutRect(sw, shh, 78, 44, 0.6);
      ctx.save(); ctx.clip(scr);
      ctx.drawImage(img, cr[0], cr[1], cr[2], cr[3], -sw / 2, -shh / 2, sw, shh);
      if (o.overlay) { ctx.save(); toImg(); o.overlay(ctx); ctx.restore(); }
      ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.45; ctx.fillStyle = E.grainPattern(ctx, 3); ctx.fill(scr);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      const gl = ctx.createLinearGradient(-sw / 2, -shh / 2, sw / 2, shh / 2);
      gl.addColorStop(0, 'rgba(255,255,255,0.10)'); gl.addColorStop(0.45, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = gl; ctx.fill(scr);
      ctx.restore();
      if (o.after) { ctx.save(); toImg(); o.after(ctx); ctx.restore(); }
      if (o.tape !== false) {
        E.at(ctx, -W / 2 + 30, -H / 2 + 18, -0.6, 1, () => E.tape(ctx, 130, 40, 'rgba(255,214,90,0.82)', 4));
        E.at(ctx, W / 2 - 30, H / 2 - 18, -0.6, 1, () => E.tape(ctx, 130, 40, 'rgba(160,220,210,0.8)', 6));
      }
    });
    return [W, H];
  };

  /** a pencil ring around a screenshot region (in overlay coordinates) */
  E.ring = (ctx, cx, cy, rx, ry, prog, o = {}) => {
    if (prog <= 0) return;
    const pts = []; for (let a = 0; a <= 1.12; a += 0.04) pts.push([cx + Math.cos(a * Math.PI * 2 - 2.2) * rx * (1 + 0.04 * Math.sin(a * 9)), cy + Math.sin(a * Math.PI * 2 - 2.2) * ry]);
    E.pen(ctx, pts, { w: 10, color: E.PAL.red, prog, pencil: true, ...o });
  };

  // ---------------------------------------------------------------- transitions
  /** clip to the region a torn-edged sheet has covered; prog 0..1; dir 'left'|'right'|'up'|'down' */
  E.wipeClip = (ctx, prog, dir, seed = 1) => {
    const r = E.rnd(seed), pts = []; const n = 40, rough = 18;
    const horiz = dir === 'left' || dir === 'right';
    const span = horiz ? E.W : E.H, cross = horiz ? E.H : E.W;
    const pos = E.lerp(-80, span + 80, prog);
    for (let i = 0; i <= n; i++) {
      const c = (i / n) * cross, d = (r() - 0.5) * rough * 2 + Math.sin(i * 0.7 + seed) * 10;
      pts.push(horiz ? [pos + d, c] : [c, pos + d]);
    }
    let poly;
    if (dir === 'left') poly = [[-10, -10], ...pts.map(([a, b]) => [a, b]), [-10, E.H + 10]]; // covers from the left
    if (dir === 'right') poly = [[E.W + 10, -10], ...pts.map(([a, b]) => [E.W - a, b]), [E.W + 10, E.H + 10]];
    if (dir === 'down') poly = [[-10, -10], ...pts, [E.W + 10, -10]];
    if (dir === 'up') poly = [[-10, E.H + 10], ...pts.map(([a, b]) => [a, E.H - b]), [E.W + 10, E.H + 10]];
    return { path: E.poly(poly), edge: dir === 'right' ? pts.map(([a, b]) => [E.W - a, b]) : dir === 'up' ? pts.map(([a, b]) => [a, E.H - b]) : pts };
  };

  // ---------------------------------------------------------------- whole-frame finishing
  E.finish = (ctx, t) => {
    // a little exposure flicker, stepped like the animation, plus grain that shifts each step
    const step = Math.floor(t * E.STEP);
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.28;
    const pat = E.grainPattern(ctx, Math.floor(t * 2) * 31); // grain drifts twice a second (cheap to encode)
    ctx.fillStyle = pat; ctx.fillRect(0, 0, E.W, E.H);
    ctx.globalCompositeOperation = 'source-over';
    const fl = (E.hash(step) - 0.5) * 0.025;
    ctx.globalAlpha = Math.abs(fl); ctx.fillStyle = fl > 0 ? '#fff8e8' : '#3a2a10'; ctx.fillRect(0, 0, E.W, E.H);
    ctx.restore();
  };
})();
