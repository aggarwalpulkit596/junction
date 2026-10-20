// Junction online: Cloudflare Worker + one Durable Object per room.
//   POST /api/rooms {mode}        -> {code}            create a room (4-letter code)
//   GET  /api/rooms/:code         -> {exists, phase,…}  peek before joining
//   GET  /api/rooms/:code/ws      -> WebSocket          play (protocol below)
//   anything else                 -> the static site in public/
//
// Protocol (JSON). Client -> server:
//   {t:'join', name, token?}  {t:'mode', mode}  {t:'start'}  {t:'act', a}  {t:'pos', x, z}  {t:'emote', e}  {t:'again'}  {t:'leave'}
// Server -> client:
//   {t:'sync', room, v, ev, now}  room = lobby info; v = the game as this seat may see it (rotated so you are player 0)
//   {t:'pos', s, x, z}  {t:'emote', s, e}  {t:'err', msg}  {t:'bye', msg}
// The server owns the deck, hands and tickets; clients only send intentions. Bots (and humans whose turn timer
// runs out, or who drop) are played by the same engine, paced with Durable Object alarms.
import { DurableObject } from 'cloudflare:workers';
import { makeEngine, MODES, BOT_NAMES, MAX_SEATS } from './rules.gen.js';

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
const IDLE_MS = 30 * 60 * 1000;   // a room nobody has touched for this long is deleted
const EMOTES = ['👋', '👍', '😮', '😅', '🔥', 'GG'];
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const cleanName = (s) => (String(s || '').normalize('NFC').replace(/[^\p{L}\p{N} _.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 14)) || 'Player';
const modeInfo = Object.fromEntries(Object.values(MODES).map((m) => [m.id, { name: m.name, blurb: m.blurb, trains: m.trains, turnSec: m.turnSec, clockMin: m.clockMin }]));

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/api\/rooms(?:\/([A-Za-z]{4}))?(\/ws)?\/?$/);
    if (!m) {
      if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
      return env.ASSETS.fetch(req);
    }
    const stubFor = (code) => env.ROOMS.get(env.ROOMS.idFromName(code));
    if (!m[1]) {
      if (req.method !== 'POST') return json({ modes: modeInfo });
      let body = {};
      try { body = await req.json(); } catch {}
      const mode = MODES[body.mode] ? body.mode : 'blitz';
      for (let k = 0; k < 6; k++) {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => CODE_ABC[b % CODE_ABC.length]).join('');
        const r = await stubFor(code).fetch('https://room/init', { method: 'POST', body: JSON.stringify({ code, mode }) });
        if (r.status === 201) return json({ code, mode });
      }
      return json({ error: 'Could not find a free room code. Try again.' }, 503);
    }
    const code = m[1].toUpperCase();
    if (!CODE_RE.test(code)) return json({ error: 'Room codes are 4 letters.' }, 400);
    if (m[2]) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected a WebSocket.' }, 426);
      return stubFor(code).fetch(req);
    }
    return stubFor(code).fetch('https://room/info');
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.E = makeEngine();
    if (env.BOT_PACE) this.E.setPace(+env.BOT_PACE); // dev/tests only: `wrangler dev --var BOT_PACE:0.1`
    this.room = null;
    this.posAt = new Map(); // last relayed position / emote time (in memory only: a simple rate limit)
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
      if (this.room && this.room.game) this.E.load(this.room.game);
    });
  }

  /* ---------- HTTP: create, peek, connect ---------- */
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/init') {
      const { code, mode } = await req.json();
      if (this.room && Date.now() - this.room.touched < IDLE_MS) return new Response('taken', { status: 409 });
      await this.ctx.storage.deleteAll();
      this.room = { code, mode, phase: 'lobby', seats: [], hostToken: null, game: null, created: Date.now(), touched: Date.now(), games: 0 };
      this.E.load(null);
      await this.save(); await this.schedule(Date.now());
      return new Response('ok', { status: 201 });
    }
    if (url.pathname === '/info') {
      const R = this.room;
      if (!R) return json({ exists: false }, 404);
      return json({ exists: true, code: R.code, mode: R.mode, phase: R.phase, humans: R.seats.filter(Boolean).length, over: !!(this.E.S && this.E.S.over), modes: modeInfo });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /* ---------- WebSocket messages ---------- */
  async webSocketMessage(ws, data) {
    if (typeof data !== 'string' || data.length > 4096) return;
    let m; try { m = JSON.parse(data); } catch { return; }
    const R = this.room;
    if (!R) { this.send(ws, { t: 'bye', msg: 'This room doesn’t exist any more. Create a new one.' }); ws.close(4004, 'no room'); return; }
    const att = ws.deserializeAttachment() || {};
    const now = Date.now();
    if (m.t === 'join') return this.join(ws, m, now);
    if (!att.token) return this.send(ws, { t: 'err', msg: 'Join the room first.' });
    const seat = R.seats.findIndex((s) => s && s.token === att.token);
    if (seat < 0) { this.send(ws, { t: 'bye', msg: 'You’re no longer in this room.' }); ws.close(4001, 'left'); return; }
    const host = att.token === R.hostToken;

    if (m.t === 'pos') {
      const x = +m.x, z = +m.z;
      if (!Number.isFinite(x) || !Number.isFinite(z) || R.phase !== 'game') return;
      const last = this.posAt.get(ws) || 0; if (now - last < 60) return; this.posAt.set(ws, now);
      this.E.setPos(seat, x, z);
      for (const o of this.ctx.getWebSockets()) {
        if (o === ws) continue; const s2 = this.seatOf(o); if (s2 < 0) continue;
        this.send(o, { t: 'pos', s: this.rot(seat, s2), x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 });
      }
      return;
    }
    if (m.t === 'emote') {
      if (!EMOTES.includes(m.e)) return;
      const last = this.posAt.get('e' + seat) || 0; if (now - last < 1500) return; this.posAt.set('e' + seat, now);
      for (const o of this.ctx.getWebSockets()) { const s2 = this.seatOf(o); if (s2 >= 0) this.send(o, { t: 'emote', s: R.phase === 'game' ? this.rot(seat, s2) : seat, e: m.e, name: R.seats[seat].name }); }
      return;
    }
    R.touched = now;
    if (m.t === 'mode') {
      if (!host || R.phase !== 'lobby' || !MODES[m.mode]) return;
      R.mode = m.mode; await this.save(); return this.broadcast([]);
    }
    if (m.t === 'start') {
      if (!host) return this.send(ws, { t: 'err', msg: 'Only the host can start the game.' });
      if (R.phase !== 'lobby') return;
      return this.start(now);
    }
    if (m.t === 'again') {
      if (!host || R.phase !== 'game' || !this.E.S || !this.E.S.over) return;
      R.phase = 'lobby'; R.game = null; this.E.load(null);
      R.seats = R.seats.filter((s) => s && this.online(s.token));
      this.fixHost();
      await this.save(); return this.broadcast([]);
    }
    if (m.t === 'leave') {
      if (R.phase === 'game' && this.E.S && !this.E.S.over) { this.E.toBot(seat); R.seats[seat] = null; }
      else if (R.phase === 'lobby') R.seats.splice(seat, 1);
      else R.seats[seat] = null;
      this.fixHost();
      ws.serializeAttachment({}); this.send(ws, { t: 'bye', msg: 'You left the room.' }); ws.close(1000, 'left');
      const ev = R.phase === 'game' && this.E.S ? this.E.tick(now) : [];
      await this.save(); await this.schedule(now); return this.broadcast(ev);
    }
    if (m.t === 'act') {
      if (R.phase !== 'game' || !this.E.S) return;
      const r = this.E.act(seat, m.a, now);
      if (!r.ok) { this.send(ws, { t: 'err', msg: r.err }); return this.sendSync(ws, []); }
      const ev = r.ev.concat(this.E.tick(now));
      await this.save(); await this.schedule(now);
      return this.broadcast(ev);
    }
  }

  async webSocketClose(ws) { await this.dropped(ws); }
  async webSocketError(ws) { await this.dropped(ws); }

  async dropped(ws) {
    const R = this.room; this.posAt.delete(ws);
    const att = ws.deserializeAttachment() || {};
    if (!R || !att.token) return;
    try { ws.serializeAttachment({}); } catch {}
    if (this.online(att.token)) return; // another tab still holds this seat
    const seat = R.seats.findIndex((s) => s && s.token === att.token);
    if (seat < 0) return;
    const now = Date.now();
    if (R.phase === 'lobby') { R.seats.splice(seat, 1); this.fixHost(); }
    else if (this.E.S && !this.E.S.over) this.E.setAway(seat, true);
    const ev = R.phase === 'game' && this.E.S ? this.E.tick(now) : [];
    await this.save(); await this.schedule(now);
    this.broadcast(ev);
  }

  /* ---------- alarms: bots walk and act, turn timers run out, idle rooms are cleaned up ---------- */
  async alarm() {
    const R = this.room, now = Date.now();
    if (!R) return;
    if (now - R.touched > IDLE_MS && !this.ctx.getWebSockets().length) { await this.ctx.storage.deleteAll(); this.room = null; this.E.load(null); return; }
    let ev = [];
    if (R.phase === 'game' && this.E.S && !this.E.S.over) { ev = this.E.tick(now); R.touched = now; await this.save(); }
    await this.schedule(now);
    if (ev.length) this.broadcast(ev);
  }
  async schedule(now) {
    const S = this.E.S, R = this.room;
    let at = R && R.phase === 'game' && S ? this.E.nextWake(now) : null;
    if (at === null || at === undefined) at = now + IDLE_MS + 1000; // nothing due: wake later for the idle check
    await this.ctx.storage.setAlarm(Math.max(at, now + 20));
  }

  /* ---------- joining and starting ---------- */
  async join(ws, m, now) {
    const R = this.room, name0 = cleanName(m.name);
    let seat = typeof m.token === 'string' ? R.seats.findIndex((s) => s && s.token === m.token) : -1;
    let token;
    if (seat >= 0) {
      token = m.token;
      for (const o of this.ctx.getWebSockets()) if (o !== ws && (o.deserializeAttachment() || {}).token === token) { o.serializeAttachment({}); this.send(o, { t: 'bye', msg: 'You opened this room in another tab.', keep: true }); o.close(4002, 'moved'); }
      if (R.phase === 'game' && this.E.S) this.E.setAway(seat, false);
    } else {
      const taken = new Set(R.seats.filter(Boolean).map((s) => s.name.toLowerCase()));
      if (R.phase === 'game' && this.E.S) this.E.S.players.forEach((p) => taken.add(p.name.toLowerCase()));
      let name = name0; for (let k = 2; taken.has(name.toLowerCase()); k++) name = `${name0.slice(0, 12)} ${k}`;
      token = crypto.randomUUID();
      if (R.phase === 'lobby') {
        if (R.seats.length >= MAX_SEATS) { this.send(ws, { t: 'bye', msg: 'This room is full (4 players).' }); ws.close(4003, 'full'); return; }
        R.seats.push({ name, token }); seat = R.seats.length - 1;
      } else {
        const S = this.E.S;
        const free = S && !S.over ? S.players.findIndex((p, i) => p.bot && !R.seats[i]) : -1;
        if (free < 0) { this.send(ws, { t: 'bye', msg: S && S.over ? 'That game has finished. Ask the host for a new room.' : 'This game is full.' }); ws.close(4003, 'full'); return; }
        R.seats[free] = { name, token }; seat = free;
        this.E.takeOver(free, name);
      }
    }
    ws.serializeAttachment({ token });
    this.fixHost();
    R.touched = now;
    const ev = R.phase === 'game' && this.E.S ? this.E.tick(now) : [];
    await this.save(); await this.schedule(now);
    this.broadcast(ev);
  }
  async start(now) {
    const R = this.room;
    const humans = R.seats.filter(Boolean);
    const used = new Set(humans.map((s) => s.name.toLowerCase()));
    const bots = BOT_NAMES.filter((b) => !used.has(b.toLowerCase()));
    const seats = humans.map((s) => ({ name: s.name, bot: false }));
    while (seats.length < MAX_SEATS) seats.push({ name: bots.shift(), bot: true });
    R.seats = seats.map((s, i) => (i < humans.length ? humans[i] : null));
    this.E.newGame(seats, R.mode, now);
    R.phase = 'game'; R.games++;
    R.seats.forEach((s, i) => { if (s && !this.online(s.token)) this.E.setAway(i, true); });
    const ev = this.E.tick(now);
    await this.save(); await this.schedule(now);
    this.broadcast(ev);
  }

  /* ---------- helpers ---------- */
  n() { return this.E.S ? this.E.S.players.length : MAX_SEATS; }
  rot(s, viewer) { const n = this.n(); return (s - viewer + n) % n; }
  online(token) { return this.ctx.getWebSockets().some((o) => o.readyState === 1 && (o.deserializeAttachment() || {}).token === token); }
  seatOf(ws) { const t = (ws.deserializeAttachment() || {}).token; return t && this.room ? this.room.seats.findIndex((s) => s && s.token === t) : -1; }
  fixHost() {
    const R = this.room;
    if (R.seats.some((s) => s && s.token === R.hostToken && this.online(s.token))) return;
    const h = R.seats.find((s) => s && this.online(s.token)) || R.seats.find(Boolean);
    R.hostToken = h ? h.token : null;
  }
  async save() { if (this.room) { this.room.game = this.E.S; await this.ctx.storage.put('room', this.room); } }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }
  roomInfo(seat, token) {
    const R = this.room;
    return {
      code: R.code, mode: R.mode, phase: R.phase, modes: modeInfo, you: seat, host: token === R.hostToken, games: R.games,
      seats: R.seats.map((s) => s && { name: s.name, online: this.online(s.token), host: s.token === R.hostToken }),
      token,
    };
  }
  sendSync(ws, ev) {
    const t = (ws.deserializeAttachment() || {}).token;
    const seat = this.seatOf(ws);
    if (seat < 0) return;
    const S = this.E.S, game = this.room.phase === 'game' && S;
    this.send(ws, { t: 'sync', room: this.roomInfo(seat, t), v: game ? this.E.view(seat) : null, ev: game ? ev.map((e) => this.E.rotEv(e, seat)) : [], now: Date.now() });
  }
  broadcast(ev) { for (const ws of this.ctx.getWebSockets()) this.sendSync(ws, ev); }
}
