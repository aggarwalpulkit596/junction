/* Junction promo — collage engine (vanilla JS, Canvas 2D).
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
  E.FONT = { display: '"Fredoka", "Arial Rounded MT Bold", sans-serif', ui: '"Nunito", "Helvetica Neue", Arial, sans-serif', hand: '"Caveat", "Marker Felt", cursive' };
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

  // ================================================================ JUNCTION: game data (copied verbatim from ../junction.html)
  const proj = (lo, la) => [+((lo + 10) * 7.5 + 14).toFixed(1), +((61 - la) * 11.2 + 12).toFixed(1)];
  E.proj = proj;
  E.HEX = { red: '#ef4f4f', orange: '#ff8c2e', yellow: '#ffd23f', green: '#3fbf5f', blue: '#3d7dfa', purple: '#a35cf0', white: '#f7f7fb', black: '#3a3c55', gray: '#bfc3d2' };
  E.PTS = { 1: 1, 2: 2, 3: 4, 4: 7, 6: 15, 8: 21 };
  E.PLAYERS = [{ name: 'You', col: '#14b8a6' }, { name: 'Rose', col: '#ff4fa3' }, { name: 'Sandy', col: '#c8894a' }, { name: 'Mint', col: '#9be15d' }];
  const CITY_DATA = {
    LIS: ['Lisboa', -9.1, 38.7, 'b'], MAD: ['Madrid', -3.7, 40.4, 'b'], BCN: ['Barcelona', 2.2, 41.4, 'b'], MRS: ['Marseille', 5.4, 43.3, 'b'],
    PAR: ['Paris', 2.35, 48.85, 'l'], LON: ['London', -0.1, 51.5, 'l'], EDI: ['Edinburgh', -3.2, 55.95, 'l'], AMS: ['Amsterdam', 4.9, 52.4, 't'],
    FRA: ['Frankfurt', 8.7, 50.1, 't'], ZUR: ['Zürich', 8.5, 47.4, 'l'], MUN: ['München', 11.6, 48.1, 't'], BER: ['Berlin', 13.4, 52.5, 't'],
    CPH: ['København', 12.6, 55.7, 'r'], STO: ['Stockholm', 18.1, 59.3, 'l'], VEN: ['Venezia', 12.3, 45.4, 'l'], ROM: ['Roma', 12.5, 41.9, 'b'],
    BRI: ['Brindisi', 17.7, 40.5, 'r'], WIE: ['Wien', 16.4, 48.2, 't'], BUD: ['Budapest', 19.0, 47.5, 'r'], WAR: ['Warszawa', 21.0, 52.2, 't'],
    ZAG: ['Zagreb', 16.0, 45.8, 'b'], SOF: ['Sofia', 23.3, 42.7, 'l'], ATH: ['Athína', 23.7, 38.0, 'b'], BUC: ['București', 26.1, 44.4, 'r'],
    IST: ['İstanbul', 29.0, 41.0, 'r'], KYI: ['Kyiv', 30.5, 50.45, 'r'], RIG: ['Rīga', 24.1, 56.95, 't'], MOS: ['Moskva', 37.6, 55.75, 't'],
  };
  const RDATA = [
    ['LIS', 'MAD', 'purple', 3], ['MAD', 'BCN', 'yellow', 2], ['MAD', 'PAR', 'orange', 4, 1], ['BCN', 'MRS', 'gray', 2], ['PAR', 'MRS', 'black', 4],
    ['PAR', 'LON', 'gray', 2, 0, 1], ['LON', 'EDI', 'white', 4], ['LON', 'AMS', 'gray', 2, 0, 2], ['PAR', 'AMS', 'yellow', 3], ['PAR', 'FRA', 'white', 3],
    ['PAR', 'ZUR', 'green', 3], ['AMS', 'FRA', 'blue', 2], ['AMS', 'BER', 'red', 3], ['AMS', 'CPH', 'gray', 3, 0, 1], ['FRA', 'BER', 'black', 3],
    ['FRA', 'MUN', 'purple', 2], ['FRA', 'ZUR', 'orange', 2], ['ZUR', 'MUN', 'yellow', 1, 1], ['ZUR', 'MRS', 'purple', 3, 1], ['ZUR', 'VEN', 'green', 2, 1],
    ['MRS', 'ROM', 'gray', 4], ['MUN', 'VEN', 'blue', 2, 1], ['MUN', 'WIE', 'orange', 3], ['MUN', 'BER', 'green', 3], ['BER', 'CPH', 'gray', 2, 0, 1],
    ['BER', 'WAR', 'yellow', 3], ['BER', 'WIE', 'white', 3], ['CPH', 'STO', 'black', 3], ['STO', 'RIG', 'gray', 3, 0, 1], ['WAR', 'RIG', 'blue', 4],
    ['RIG', 'MOS', 'purple', 4], ['WAR', 'KYI', 'gray', 4], ['KYI', 'MOS', 'red', 4], ['WAR', 'WIE', 'red', 3], ['KYI', 'BUD', 'gray', 4, 1],
    ['KYI', 'BUC', 'white', 4], ['WIE', 'BUD', 'red', 1], ['WIE', 'ZAG', 'gray', 2], ['VEN', 'ZAG', 'gray', 2], ['VEN', 'ROM', 'black', 2],
    ['ROM', 'BRI', 'white', 2], ['BRI', 'ATH', 'gray', 3, 0, 1], ['ZAG', 'BUD', 'orange', 2], ['ZAG', 'SOF', 'gray', 4, 1], ['BUD', 'BUC', 'gray', 4, 1],
    ['BUC', 'SOF', 'gray', 2, 1], ['SOF', 'ATH', 'green', 3], ['SOF', 'IST', 'blue', 3], ['BUC', 'IST', 'yellow', 3], ['ATH', 'IST', 'gray', 2, 0, 1],
  ];
  const LANDS = [
    [[21.4,62.2],[42.5,62.2],[42.5,34.5],[35.9,34.5],[35.9,36],[36.1,36.8],[34.6,36.8],[32.5,36.1],[30.6,36.8],[28.2,36.7],[27.3,37.5],[26.3,38.3],[26.7,39.4],[26.2,40.1],[26,40.6],[24.5,40.9],[23.7,40.3],[22.8,40.5],[22.9,39.4],[23.3,38.9],[24.1,38.2],[24,37.65],[23.4,37.9],[23.2,36.4],[22.5,36.4],[21.7,36.8],[21.1,37.8],[21.6,38.3],[20.7,39],[20,39.7],[19.4,40.4],[19.5,41.8],[18.5,42.5],[17,43.3],[15.9,43.6],[14.5,45.2],[13.7,45.7],[12.4,45.5],[12.3,44.4],[13.5,43.6],[14.2,42.4],[16,41.9],[16.9,41.1],[18.5,40.1],[18.4,39.8],[17.2,40.4],[16.6,39.7],[17.1,39],[16.5,38.4],[15.65,38],[15.8,38.8],[15.6,40.1],[14.3,40.7],[13,41.3],[12.3,41.7],[11,42.5],[10.3,43.5],[9.8,44.1],[8.8,44.4],[7.5,43.8],[6.6,43.2],[5.4,43.2],[4,43.5],[3.1,43.1],[3.2,42.3],[2.2,41.4],[0.9,41],[-0.3,39.5],[0.2,38.8],[-0.7,37.6],[-2.1,36.7],[-4.4,36.7],[-5.6,36],[-6.3,36.5],[-7.4,37.2],[-8.9,37],[-8.8,38.5],[-9.5,38.8],[-8.9,40.2],[-8.7,42],[-9.3,43],[-8,43.7],[-5.8,43.6],[-3.8,43.4],[-1.8,43.4],[-1.2,44.6],[-1.2,46.2],[-2.2,47.1],[-4.5,47.9],[-4.7,48.4],[-3,48.8],[-1.6,48.7],[-1.9,49.7],[-1.2,49.4],[0.1,49.4],[1.5,50.2],[2.5,51.1],[3.6,51.4],[4.2,52],[4.7,52.9],[5.4,53.3],[7,53.5],[8.6,53.9],[8.6,55],[8.1,56.5],[10.6,57.7],[10.4,56.5],[12.6,56],[12.5,55.4],[12.1,54.9],[10.9,54.4],[11.5,54.1],[13.8,54.6],[14.3,53.9],[16.5,54.5],[18.6,54.7],[19.8,54.4],[21.1,55.7],[21,56.8],[21.6,57.5],[22.6,57.7],[23.9,57],[24.3,57.8],[23.5,58.6],[23.4,59.2],[24.8,59.5],[28,59.5],[30.2,59.9],[29,60.2],[26.9,60.4],[24.9,60.15],[22.9,59.8],[21.4,60.6]],
    [[4.9,62.2],[4.9,61],[5,60],[5.5,59],[5.7,58.4],[7,58],[8.5,58.3],[10,59],[10.7,59.6],[11.2,59],[11.8,58.4],[11.9,57.7],[12.6,56.4],[12.9,55.6],[14.3,55.5],[14.7,56.2],[16.4,56.6],[16.8,58],[18.4,59.2],[18.9,59.9],[17.3,60.7],[17.2,62.2]],
    [[-5.7,50.1],[-3.5,50.3],[-1,50.7],[1.4,51.1],[0.9,51.6],[1.7,52.6],[0.3,53.4],[-0.1,54.2],[-1.2,54.6],[-1.6,55.6],[-2.5,56],[-2.1,57.1],[-1.8,57.6],[-3.8,57.7],[-3.1,58.6],[-5,58.6],[-5.7,57.5],[-5.7,56.3],[-5,55.8],[-4.9,54.9],[-3.2,54.9],[-3,53.4],[-4.6,53.3],[-4.1,52.4],[-5.2,51.8],[-3.2,51.5],[-4.2,51.1]],
    [[-6,52.2],[-6.1,53.3],[-5.9,54.2],[-6,55.2],[-7.3,55.4],[-8.3,55.1],[-8.6,54.3],[-10,54.2],[-9.9,53.4],[-9.4,52.6],[-10.3,52.1],[-9.8,51.6],[-8.2,51.8]],
    [[-6.6,34.5],[-6,35.5],[-5.9,35.8],[-5.3,35.9],[-4,35.2],[-2,35.1],[0,35.9],[3,36.8],[6.5,37.1],[8.6,36.9],[9.8,37.3],[11,37],[10.6,36.4],[10.9,35.5],[10.8,34.5]],
    [[12.4,38.1],[13.3,38.2],[15.6,38.3],[15.1,37.3],[15.1,36.7],[14.3,37],[12.6,37.6]],
    [[8.4,39],[8.2,40.9],[9.2,41.2],[9.8,40.9],[9.6,39.2],[9.1,39.2]],
    [[8.6,42.6],[9.4,43],[9.6,42.2],[9.2,41.4],[8.6,41.8]],
    [[23.5,35.5],[24.8,35.4],[26.3,35.25],[25.5,35],[24,35.2]],
  ].map((pts) => pts.map(([lo, la]) => proj(lo, la)));
  const BLACKSEA = [[28.1,41.4],[28,43.2],[28.6,44.2],[29.7,45.2],[30.7,46.5],[32,46.5],[33.5,46],[32.5,45.4],[33.6,44.5],[35.5,45],[36.6,45.4],[38.5,44.5],[39.8,43.6],[41.6,41.6],[40.5,41],[38,40.9],[36,41.7],[35,42],[33,42],[31,41.2],[29.2,41.2]].map(([lo, la]) => proj(lo, la));
  E.CITY = {};
  for (const [id, [n, lo, la, l]] of Object.entries(CITY_DATA)) { const [x, y] = proj(lo, la); E.CITY[id] = { id, n, x, y, l }; }
  E.CITY_IDS = Object.keys(E.CITY);
  E.ROUTES = RDATA.map(([a, b, color, len, tunnel = 0, ferry = 0], i) => {
    const A = E.CITY[a], Bc = E.CITY[b], dx = Bc.x - A.x, dy = Bc.y - A.y, d = Math.hypot(dx, dy), ux = dx / d, uy = dy / d;
    const sh = 6.5, gap = 1.5, w = (d - 2 * sh - gap * (len - 1)) / len, cars = [];
    for (let k = 0; k < len; k++) { const off = sh + k * (w + gap) + w / 2; cars.push([A.x + ux * off, A.y + uy * off]); }
    return { i, a, b, color, len, tunnel: !!tunnel, ferry, cars, w, ang: Math.atan2(dy, dx) };
  });
  E.route = (a, b) => E.ROUTES.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  E.MAPW = 392; E.MAPH = 300;

  // ================================================================ map: paper sprites, cached once
  const MAPK = 8; // sprite resolution: px per map unit
  let MAPSPR = null;
  function jag(pts, seed, step = 1.1, amp = 0.22) {
    const r = E.rnd(seed), out = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / step));
      const nx = -(y1 - y0) / (L || 1), ny = (x1 - x0) / (L || 1);
      for (let k = 0; k < n; k++) { const u = k / n, d = (r() - 0.5) * 2 * amp; out.push([E.lerp(x0, x1, u) + nx * d, E.lerp(y0, y1, u) + ny * d]); }
    }
    return out;
  }
  function buildMapSprites() {
    const sea = makeCanvas(E.MAPW * MAPK, E.MAPH * MAPK), sx = sea.getContext('2d');
    sx.fillStyle = '#7cc6e8'; sx.fillRect(0, 0, sea.width, sea.height);
    sx.globalCompositeOperation = 'soft-light'; sx.globalAlpha = 0.6; sx.fillStyle = sx.createPattern(E.toothCanvas, 'repeat'); sx.fillRect(0, 0, sea.width, sea.height);
    sx.fillStyle = sx.createPattern(E.grainCanvas, 'repeat'); sx.fillRect(0, 0, sea.width, sea.height);
    sx.globalCompositeOperation = 'source-over'; sx.globalAlpha = 1;
    // white-pencil waves, like the game's wave pattern
    const r = E.rnd(5); sx.lineCap = 'round'; sx.strokeStyle = 'rgba(255,255,255,0.5)'; sx.lineWidth = 1.3 * MAPK;
    for (let y = 8; y < E.MAPH; y += 16) for (let x = (y / 16) % 2 ? 0 : 12; x < E.MAPW; x += 24) {
      const X = (x + (r() - 0.5) * 4) * MAPK, Y = (y + (r() - 0.5) * 3) * MAPK;
      sx.beginPath(); sx.moveTo(X, Y); sx.quadraticCurveTo(X + 2 * MAPK, Y - 4 * MAPK, X + 4 * MAPK, Y); sx.quadraticCurveTo(X + 6 * MAPK, Y + 4 * MAPK, X + 8 * MAPK, Y); sx.stroke();
    }
    const lands = LANDS.map((pts, i) => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
      const pad = 6; x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      const c = makeCanvas(Math.ceil((x1 - x0) * MAPK), Math.ceil((y1 - y0) * MAPK)), lx = c.getContext('2d');
      lx.scale(MAPK, MAPK); lx.translate(-x0, -y0);
      const p = E.poly(jag(pts, 300 + i));
      lx.save(); lx.shadowColor = 'rgba(28,29,51,0.35)'; lx.shadowBlur = 2.2 * MAPK; lx.shadowOffsetX = 0.6 * MAPK; lx.shadowOffsetY = 1.2 * MAPK;
      lx.fillStyle = '#FBF5E4'; lx.fill(E.poly(jag(pts, 400 + i, 1.1, 0.5))); lx.restore(); // torn white core
      lx.fillStyle = '#f3df9f'; lx.fill(p);
      lx.save(); lx.clip(p); lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'soft-light'; lx.globalAlpha = 0.85;
      lx.fillStyle = lx.createPattern(E.grainCanvas, 'repeat'); lx.fillRect(0, 0, c.width, c.height);
      lx.fillStyle = lx.createPattern(E.toothCanvas, 'repeat'); lx.fillRect(0, 0, c.width, c.height); lx.restore();
      lx.strokeStyle = '#1c1d33'; lx.lineWidth = 1.15; lx.lineJoin = 'round'; lx.stroke(p);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      return { c, x0, y0, w: x1 - x0, h: y1 - y0, cx, cy };
    });
    // the Black Sea is a cut-out of sea paper pasted on the land
    {
      const p = E.poly(jag(BLACKSEA, 333)); sx.save(); sx.scale(MAPK, MAPK);
      sx.restore();
      lands.blacksea = p;
    }
    MAPSPR = { sea, lands };
  }
  E.MAP_LANDS = LANDS.length;

  /**
   * The paper map. cam = { x, y, z, sy }: map point (x,y) sits at screen (W/2, sy), z = px per map unit.
   * o.land(i) → { dy, rot, s, a } per land piece; o.routes(r) → { owner, prog, show, hl, borrowed } per route;
   * o.city(id) → { show, stamped, station, ring } ; o.labels (0..1).
   */
  E.mapToScreen = (cam, x, y) => [E.W / 2 + (x - cam.x) * cam.z, (cam.sy ?? E.H / 2) + (y - cam.y) * cam.z];
  E.drawMap = (ctx, cam, t, o = {}) => {
    if (!MAPSPR) buildMapSprites();
    const z = cam.z, sy = cam.sy ?? E.H / 2;
    ctx.save();
    ctx.translate(E.W / 2, sy); ctx.scale(z, z); ctx.translate(-cam.x, -cam.y);
    // sheet of sea paper with torn edges
    const sheet = E.tornRect(E.MAPW, E.MAPH, 61, 1.6, 'trbl', 3);
    ctx.save(); ctx.translate(E.MAPW / 2, E.MAPH / 2);
    ctx.shadowColor = 'rgba(52,34,14,0.4)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 10 / z * 3; ctx.fillStyle = '#FBF7EC'; ctx.fill(E.tornRect(E.MAPW + 3, E.MAPH + 3, 62, 1.8, 'trbl', 3));
    ctx.shadowColor = 'transparent'; ctx.clip(sheet); ctx.drawImage(MAPSPR.sea, -E.MAPW / 2, -E.MAPH / 2, E.MAPW, E.MAPH);
    ctx.restore();
    ctx.save(); ctx.translate(E.MAPW / 2, E.MAPH / 2); ctx.clip(sheet); ctx.translate(-E.MAPW / 2, -E.MAPH / 2);
    MAPSPR.lands.forEach((L, i) => {
      const s = o.land ? o.land(i) : null;
      if (s && s.a <= 0) return;
      ctx.save();
      if (s) { ctx.translate(L.cx, L.cy + (s.dy || 0)); ctx.rotate(s.rot || 0); ctx.scale(s.s ?? 1, s.s ?? 1); ctx.translate(-L.cx, -L.cy); if (s.a != null) ctx.globalAlpha = s.a; }
      ctx.drawImage(L.c, L.x0, L.y0, L.w, L.h);
      ctx.restore();
      if (i === 0 && (!s || s.a >= 1) && !(s && (s.dy || s.rot))) {
        ctx.save(); ctx.fillStyle = '#7cc6e8'; ctx.fill(MAPSPR.lands.blacksea); ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.2;
        for (let k = 0; k < 3; k++) { const y = 194 + k * 8, x = 255 + k * 14; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 2, y - 3, x + 4, y); ctx.quadraticCurveTo(x + 6, y + 3, x + 8, y); ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.strokeStyle = '#1c1d33'; ctx.lineWidth = 1.15; ctx.stroke(MAPSPR.lands.blacksea); ctx.restore();
      }
    });
    ctx.restore();
    // routes
    const unit = 1;
    E.ROUTES.forEach((r) => {
      const s = o.routes ? o.routes(r) : {};
      if (s === null || s.show === 0) return;
      const show = s.show ?? 1;
      if (s.hl) { // a yellow glow, like the game's selected route
        ctx.save(); ctx.globalAlpha = s.hl * 0.85; ctx.strokeStyle = '#ffc933'; ctx.lineWidth = 12; ctx.lineCap = 'round';
        const A = E.CITY[r.a], Bc = E.CITY[r.b]; ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(Bc.x, Bc.y); ctx.stroke(); ctx.restore();
      }
      r.cars.forEach(([cx, cy], k) => {
        const appear = show >= 1 ? 1 : E.clamp(show * r.len - k);
        if (appear <= 0) return;
        const own = s.owner != null && (s.prog == null || s.prog * r.len > k);
        const lift = own && s.prog != null ? E.clamp(1 - (s.prog * r.len - k) * 1.5) : 0; // a just-placed car pops up
        ctx.save(); ctx.translate(cx, cy - lift * 3); ctx.rotate(r.ang + (lift ? Math.sin(k * 3 + t * 20) * 0.08 * lift : 0)); const sc = E.ease.outBack(appear) * (1 + lift * 0.25); ctx.scale(sc, sc);
        const fill = own ? E.PLAYERS[s.owner].col : E.HEX[r.color];
        const p = new Path2D(); p.roundRect(-r.w / 2, -3.4, r.w, 6.8, 1.8);
        ctx.shadowColor = 'rgba(28,29,51,0.35)'; ctx.shadowBlur = 3 + lift * 6; ctx.shadowOffsetY = (1.2 + lift * 4) * z * 0.25; ctx.shadowOffsetX = 0.4 * z * 0.25;
        ctx.globalAlpha = own ? 1 : 0.92; ctx.fillStyle = fill; ctx.fill(p); ctx.shadowColor = 'transparent'; ctx.globalAlpha = 1;
        ctx.strokeStyle = '#1c1d33'; ctx.lineWidth = own ? 1.4 : 1.05;
        if (r.tunnel && !own) ctx.setLineDash([2.2, 1.3]);
        ctx.stroke(p); ctx.setLineDash([]);
        if (!own && k < r.ferry) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke(); }
        if (own) { ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.roundRect(-1.3, -1.3, 2.6, 2.6, 0.6); ctx.fill(); }
        ctx.restore();
      });
    });
    if (o.over) o.over(ctx); // extra drawing in map space (pencil marks, stations...)
    // cities
    E.CITY_IDS.forEach((id) => {
      const c = E.CITY[id], s = o.city ? o.city(id) : {};
      const show = s.show ?? 1; if (show <= 0) return;
      ctx.save(); ctx.translate(c.x, c.y); const sc = E.ease.outBack(E.clamp(show)); ctx.scale(sc, sc);
      ctx.fillStyle = s.stamped ? E.mix('#ffffff', '#ffc933', E.clamp(s.stamped)) : '#ffffff'; ctx.strokeStyle = '#1c1d33'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(0, 0, 4.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
    // labels in screen space so they stay legible at any zoom
    const la = o.labels ?? 1;
    if (la > 0) E.CITY_IDS.forEach((id) => {
      const c = E.CITY[id], s = o.city ? o.city(id) : {}; const show = E.clamp(s.show ?? 1); if (show <= 0 || s.label === 0) return;
      const size = E.clamp(7.6 * z, 17, s.big ? 44 : 34);
      const [X, Y] = E.mapToScreen(cam, c.x, c.y);
      const g = 5.5 * z;
      const lx = c.l === 'l' ? X - g : c.l === 'r' ? X + g : X, ly = c.l === 't' ? Y - g * 1.1 : c.l === 'b' ? Y + g * 1.25 + size * 0.35 : Y + size * 0.35;
      ctx.save(); ctx.globalAlpha = la * show * (s.alpha ?? 1);
      E.font(ctx, 800, size, 'ui'); ctx.textAlign = c.l === 'l' ? 'right' : c.l === 'r' ? 'left' : 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round'; ctx.strokeStyle = '#f3df9f'; ctx.lineWidth = size * 0.3; ctx.strokeText(c.n, lx, ly);
      ctx.fillStyle = '#1c1d33'; ctx.fillText(c.n, lx, ly); ctx.restore();
    });
  };

  // ================================================================ Sprocket robots (the game's hex-bodied players), in paper
  /**
   * Draw a Sprocket at (x,y) = the centre of its hex body. s = px per SVG unit (the game's icon is 22×29 units).
   * o: look [dx,dy] (-1..1), blink, squash (stretch on landing), arms {l,r} (radians, 0 = down), mood 'happy'|'o'|'grr',
   * ant (antenna wobble), shadow (bool)
   */
  E.sprocket = (ctx, x, y, s, col, o = {}, t = 0) => {
    const seed = col.charCodeAt(1) + col.charCodeAt(3);
    const sq = o.squash ?? 0;
    E.at(ctx, x, y, (o.rot || 0) + E.boil(seed, t, 0.01), 1, () => {
      ctx.scale(s * (1 + sq * 0.12), s * (1 - sq * 0.12));
      const ink = '#1c1d33';
      // arms (behind the body)
      if (o.arms) [-1, 1].forEach((sd) => {
        const a = sd < 0 ? o.arms.l : o.arms.r; if (a == null) return;
        const sx = sd * 7.6, sy = 2.5, L = 7.5, ex = sx + sd * Math.sin(a) * L, ey = sy + Math.cos(a) * L;
        ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = ink; ctx.lineWidth = 1.7;
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo((sx + ex) / 2 + sd * 0.8, (sy + ey) / 2, ex, ey); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ex, ey, 1.9, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
      });
      // antenna
      const aw = (o.ant || 0);
      ctx.save(); ctx.translate(0, -8); ctx.rotate(aw * 0.35);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1.5, -5); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(1.8, -5.8, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
      ctx.restore();
      // feet
      ctx.fillStyle = ink; ctx.beginPath(); ctx.roundRect(-6, 6.5, 4, 4.4, 1); ctx.roundRect(2, 6.5, 4, 4.4, 1); ctx.fill();
      // hex body: paper fill + ink outline
      const hex = E.poly([[9, 0], [4.5, 7.8], [-4.5, 7.8], [-9, 0], [-4.5, -7.8], [4.5, -7.8]]);
      ctx.save(); ctx.shadowColor = 'rgba(28,29,51,0.35)'; ctx.shadowBlur = 0.6 * s; ctx.shadowOffsetX = 0.06 * s; ctx.shadowOffsetY = 0.1 * s;
      ctx.fillStyle = col; ctx.fill(hex); ctx.restore();
      ctx.save(); ctx.clip(hex); ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.8; ctx.fillStyle = E.grainPattern(ctx, seed); ctx.fill(hex); ctx.restore();
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-4.5, -7.8); ctx.lineTo(4.5, -7.8); ctx.lineTo(6.5, -4.2); ctx.lineTo(-6.5, -4.2); ctx.fill(); ctx.restore();
      ctx.strokeStyle = ink; ctx.lineWidth = 1.9; ctx.lineJoin = 'round'; ctx.stroke(hex);
      // the eye
      const [lx, ly] = o.look || [0.3, 0];
      const bl = o.blink ? 0.12 : 1;
      ctx.save(); ctx.translate(0, -0.5); ctx.scale(1, bl);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, 4.3, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.stroke();
      const pr = o.mood === 'o' ? 1.4 : 2;
      ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(lx * 1.6, ly * 1.6, pr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(lx * 1.6 + 0.7, ly * 1.6 - 0.7, 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (o.mood === 'happy' && !o.blink) { ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 2.2, 3.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); ctx.restore(); }
      if (o.mood === 'grr') { ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-4.6, -5.6); ctx.lineTo(-1, -4.3); ctx.moveTo(4.6, -5.6); ctx.lineTo(1, -4.3); ctx.stroke(); ctx.restore(); }
    });
  };

  // ================================================================ train cards
  const CAR_ICON = (ctx) => { // the game's car icon, 30×20 units centred
    ctx.save(); ctx.translate(-15, -10); ctx.lineWidth = 1.8; ctx.strokeStyle = '#1c1d33';
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.roundRect(2, 3, 26, 11, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1c1d33'; ctx.beginPath(); ctx.roundRect(6, 6, 6, 4, 1); ctx.roundRect(17, 6, 6, 4, 1); ctx.fill();
    ctx.beginPath(); ctx.arc(9, 16.5, 2.5, 0, Math.PI * 2); ctx.arc(21, 16.5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  const LOCO_ICON = (ctx) => {
    ctx.save(); ctx.translate(-15, -10); ctx.lineWidth = 1.8; ctx.strokeStyle = '#1c1d33'; ctx.fillStyle = '#1c1d33';
    ctx.beginPath(); ctx.roundRect(5, 1, 4, 5, 1); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(2, 5, 16, 9, 3); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.roundRect(17, 2, 11, 12, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1c1d33'; ctx.beginPath(); ctx.roundRect(20, 5, 5, 4, 1); ctx.fill();
    ctx.beginPath(); ctx.arc(7, 16.5, 2.5, 0, Math.PI * 2); ctx.arc(15, 16.5, 2.5, 0, Math.PI * 2); ctx.arc(23, 16.5, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  };
  /** A train card centred at 0,0, w wide (3:4). color = a HEX key or 'loco'. o.back draws the deck back; o.flip (-1..1) squashes X. */
  E.trainCard = (ctx, color, w, o = {}) => {
    const h = w * 64 / 48, k = w / 48;
    ctx.save(); if (o.flip != null) ctx.scale(Math.max(0.02, Math.abs(o.flip)), 1);
    const back = o.back || (o.flip != null && o.flip < 0);
    const path = new Path2D(); path.roundRect(-w / 2, -h / 2, w, h, 10 * k);
    ctx.save(); ctx.shadowColor = 'rgba(28,29,51,0.4)'; ctx.shadowBlur = 8 * k * (o.lift ?? 1); ctx.shadowOffsetY = 4 * k * (o.lift ?? 1); ctx.shadowOffsetX = 1.5 * k;
    if (back) ctx.fillStyle = '#eef2fa';
    else if (color === 'loco') { const g = ctx.createConicGradient(Math.PI / 6, 0, 0); ['#ef4f4f', '#ff8c2e', '#ffd23f', '#3fbf5f', '#3d7dfa', '#a35cf0', '#ef4f4f'].forEach((c, i) => g.addColorStop(i / 6, c)); ctx.fillStyle = g; }
    else ctx.fillStyle = E.HEX[color];
    ctx.fill(path); ctx.restore();
    ctx.save(); ctx.clip(path);
    if (back) { ctx.strokeStyle = '#d4d9e8'; ctx.lineWidth = 5 * k; for (let i = -12; i < 12; i++) { ctx.beginPath(); ctx.moveTo(i * 10 * k, -h); ctx.lineTo(i * 10 * k + h * 2, h); ctx.stroke(); } }
    ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = 0.7; ctx.fillStyle = E.grainPattern(ctx, 7); ctx.fill(path); ctx.restore();
    ctx.strokeStyle = '#1c1d33'; ctx.lineWidth = 2.5 * k; ctx.stroke(path);
    if (!back) {
      ctx.save(); ctx.translate(0, -8 * k); ctx.scale(k, k); (color === 'loco' ? LOCO_ICON : CAR_ICON)(ctx); ctx.restore();
      const lab = color === 'loco' ? 'loco' : color, fs = 10 * k;
      E.font(ctx, 800, fs, 'ui'); const lw = ctx.measureText(lab).width + 10 * k;
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.beginPath(); ctx.roundRect(-lw / 2, 9 * k, lw, 15 * k, 6 * k); ctx.fill();
      ctx.fillStyle = '#1c1d33'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(lab, 0, 16.8 * k);
    }
    ctx.restore();
    return [w, h];
  };

  // ================================================================ tickets, stations, postcards
  /** A destination ticket like the game's (dashed border, Long tag, points), as a punched paper stub. */
  E.ticket = (ctx, a, b, pts, o = {}) => {
    const w = o.w || 720, h = o.h || 150, done = E.clamp(o.done || 0);
    const p = E.cutRect(w, h, 31, 22, 1.2);
    E.paper(ctx, p, E.mix('#FFFDF7', '#E4F6F1', done), { lift: o.lift ?? 1.2, seed: 31 });
    ctx.save(); ctx.setLineDash([12, 9]); ctx.lineWidth = 4; ctx.strokeStyle = done > 0.5 ? '#0f9e86' : '#C7CCDD'; ctx.stroke(E.cutRect(w - 22, h - 22, 32, 16, 0.6)); ctx.restore();
    // perforation + stub
    const sx = w / 2 - 150;
    ctx.save(); ctx.fillStyle = '#C7CCDD'; for (let y = -h / 2 + 22; y < h / 2 - 14; y += 16) { ctx.beginPath(); ctx.arc(sx, y, 3.2, 0, Math.PI * 2); ctx.fill(); } ctx.restore();
    const left = -w / 2 + 44;
    E.font(ctx, 800, o.size || 46, 'ui'); ctx.fillStyle = '#1c1d33'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const label = `${a} to ${b}`; ctx.fillText(label, left, 4);
    if (o.long) { const lw = ctx.measureText(label).width; E.font(ctx, 800, 22, 'ui'); const tw = ctx.measureText('Long').width + 18; ctx.fillStyle = '#1c1d33'; ctx.beginPath(); ctx.roundRect(left + lw + 14, -13, tw, 32, 8); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('Long', left + lw + 23, 4); }
    E.text(ctx, String(pts), sx + 75, 4, { fam: 'display', weight: 700, size: 68, color: done > 0.5 ? '#0f9e86' : '#1c1d33' });
    if (o.punch) { ctx.save(); ctx.globalAlpha = E.clamp(o.punch); ctx.fillStyle = '#C9A47E'; ctx.beginPath(); ctx.arc(sx + 75, -h / 2 + 24, 9 * E.clamp(o.punch), 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  };
  /** The game's station marker (a little house) in a player's colour, base centred at 0,0, s px per unit. */
  E.station = (ctx, col, s) => {
    const p = E.poly([[-3.2, 0], [-3.2, -5], [0, -8.2], [3.2, -5], [3.2, 0]]);
    ctx.save(); ctx.scale(s, s); ctx.shadowColor = 'rgba(28,29,51,0.35)'; ctx.shadowBlur = 0.8 * s; ctx.shadowOffsetY = 0.15 * s; ctx.fillStyle = col; ctx.fill(p); ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#1c1d33'; ctx.lineWidth = 1.1; ctx.lineJoin = 'round'; ctx.stroke(p);
    ctx.fillStyle = '#1c1d33'; ctx.fillRect(-0.9, -2.6, 1.8, 2.6); ctx.restore();
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
