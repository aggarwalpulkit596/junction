"""Render a vertical (1080x1920) gameplay teaser of junction.html.

Usage: python video/record.py [path/to/junction.html] [seed]
Needs: playwright (chromium), ffmpeg, and the Fredoka + Nunito fonts installed locally.
Plays a deterministic bot-vs-bot game, screenshots key moments, and stitches them with ffmpeg.
"""
import os, sys, shutil, subprocess
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'junction.html'))
FIXED_SEED = int(sys.argv[2]) if len(sys.argv) > 2 else None
FRAMES = os.path.join(HERE, 'frames')
OUT = os.path.join(HERE, 'junction_teaser.mp4')

SETUP_JS = r"""
(seed) => {
  let s = seed >>> 0;
  Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  window.__pending = null;
  window.setTimeout = (f) => { window.__pending = f; return 0; };
  if (!document.getElementById('vidstyle')) {
    const st = document.createElement('style'); st.id = 'vidstyle';
    st.textContent = `*{animation:none!important;transition:none!important}
      #cap{position:fixed;left:18px;right:18px;bottom:44px;z-index:50;background:#ffc933;color:#1c1d33;border:3px solid #1c1d33;
        border-radius:18px;box-shadow:0 5px 0 #1c1d33;padding:14px 16px;font:700 27px/1.15 Fredoka,sans-serif;text-align:center}
      #cap.top{top:26px;bottom:auto}
      #cap:empty{display:none}
      #card{position:fixed;inset:0;z-index:60;background:#bfe4f6;display:flex;flex-direction:column;align-items:center;
        justify-content:center;gap:10px;text-align:center;padding:30px}
      #card.hide{display:none}
      #card svg{width:130px;height:172px;margin-bottom:8px}
      #card h1{font:700 72px/1 Fredoka,sans-serif;color:#1c1d33}
      #card p{font:800 22px/1.3 Nunito,sans-serif;color:#1c1d33;max-width:330px}
      #card .pill{margin-top:14px;background:#ffc933;border:3px solid #1c1d33;box-shadow:0 5px 0 #1c1d33;border-radius:999px;
        padding:12px 26px;font:700 26px Fredoka,sans-serif;color:#1c1d33}`;
    document.head.appendChild(st);
    const cap = document.createElement('div'); cap.id = 'cap'; document.body.appendChild(cap);
    const card = document.createElement('div'); card.id = 'card'; card.className = 'hide'; document.body.appendChild(card);
  }
  document.getElementById('cap').textContent = '';
  document.getElementById('card').className = 'hide';
  sheetEl.classList.add('hidden');
  newGame(20, true); S.locked = false;
  H().tickets = S.ticketDeck.splice(0, 2);
  window.step = () => {
    if (S.over) return;
    if (window.__pending) { const f = window.__pending; window.__pending = null; f(); }
    else { botTurn(H()); render(); endTurn(); }
  };
  window.cap = (t, top) => { const c = document.getElementById('cap'); c.textContent = t; c.className = top ? 'top' : ''; };
  window.card = (h, p, pill) => {
    const c = document.getElementById('card');
    c.innerHTML = sprocket('#14b8a6') + `<h1>${h}</h1><p>${p}</p>` + (pill ? `<div class="pill">${pill}</div>` : '');
    c.className = '';
  };
  window.hideCard = () => { document.getElementById('card').className = 'hide'; };
  window.claims = () => S.routes.filter(r => r.owner !== null).length;
  window.stagePostcard = () => {
    const mine = IDS.filter(id => S.routes.some(r => r.owner === 0 && (r.a === id || r.b === id)));
    S.busy = true; openCity(mine.includes('PAR') ? 'PAR' : (mine[0] || 'PAR')); S.busy = false;
  };
  window.stageTunnel = () => {
    const r = S.routes.find(x => x.tunnel && x.owner === null && x.len >= 2) || S.routes.find(x => x.tunnel && x.owner === null);
    if (!r) return false;
    const c = r.color === 'gray' ? 'red' : r.color, p = H();
    p.hand[c] = (p.hand[c] || 0) + r.len + 2; p.hand.loco = (p.hand.loco || 0) + 1;
    if (p.trains < r.len) return false;
    S.selected = r.i; render();
    S.deck.push('loco' === c ? 'red' : 'blue', 'green', c);  // stage one matching card so the extra cost shows
    const o = payOptions(p, r).find(x => x.c === c) || payOptions(p, r)[0];
    startClaim(r.i, o); return true;
  };
  window.finishTunnel = () => { if (S.pending) tunnelResolve(!!S.pending.ex || !S.pending.extra); };
}
"""

def play(page, seed, shoot=None):
    """Run one full game. If shoot is given, it is called as shoot(duration, caption, top) at key moments."""
    page.evaluate(SETUP_JS, seed)
    total_est = 70  # typical number of turns in a 20-train game
    turn = 0; staged_card = staged_tunnel = False; last_claims = 0
    if shoot:
        page.evaluate("card('Junction','A rail-building race across 28 European cities')")
        shoot(2.4, '', False)
        page.evaluate("hideCard()")
    while not page.evaluate("S.over") and turn < 400:
        human_turn = page.evaluate("S.turn===0 && !window.__pending")
        if human_turn and not staged_card and turn > total_est * 0.35:
            staged_card = True
            if shoot:
                page.evaluate("stagePostcard()"); shoot(2.8, 'Tap any city to explore its real landmark', True)
                page.evaluate("closeSheet(true)")
        if human_turn and not staged_tunnel and turn > total_est * 0.55:
            staged_tunnel = True
            if page.evaluate("stageTunnel()"):
                if shoot: shoot(2.8, 'Tunnels flip 3 cards. Every match costs you extra', True)
                page.evaluate("finishTunnel()"); turn += 1
                continue
        page.evaluate("step()"); turn += 1
        if shoot and not page.evaluate("S.over"):
            c = page.evaluate("claims()")
            frac = turn / total_est
            caption = ('Collect train cards' if frac < 0.18 else
                       'Claim routes across Europe' if frac < 0.35 else
                       'Race three rivals for the best lines' if frac < 0.55 else
                       'Every route you take blocks a rival' if frac < 0.75 else
                       'Last trains on the board')
            if c != last_claims:
                shoot(0.42, caption, False); last_claims = c
            elif turn % 6 == 0:
                shoot(0.25, caption, False)
    return page.evaluate("""(()=>{const sc=S.players.map(p=>routePts(p.id)+ticketScore(p).s+p.stations*4);
      return {over:S.over, winner:sc.indexOf(Math.max(...sc)), mine:S.routes.filter(r=>r.owner===0).length, turns:S.round}})()""")

def main():
    shutil.rmtree(FRAMES, ignore_errors=True); os.makedirs(FRAMES)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={'width': 432, 'height': 768}, device_scale_factor=2.5, color_scheme='light')
        page.goto('file://' + HTML); page.wait_for_timeout(600)
        seed = FIXED_SEED
        if seed is None:  # find a game the player wins with a busy network
            for s in range(1, 200):
                r = play(page, s)
                if r['over'] and r['winner'] == 0 and r['mine'] >= 7:
                    seed = s; break
            seed = seed or 1
        print('seed', seed)
        frames = []
        def shoot(dur, caption, top):
            page.evaluate("([t,top])=>cap(t,top)", [caption, top])
            path = os.path.join(FRAMES, f'{len(frames):04d}.png'); page.screenshot(path=path)
            frames.append((path, dur))
        play(page, seed, shoot)
        page.evaluate("cap('Connect your tickets. Win the continent.', true)")
        shoot(3.4, 'Connect your tickets. Win the continent.', True)
        page.evaluate("sheetEl.classList.add('hidden'); card('Junction','Claim routes, dig tunnels, and explore Europe city by city','Play the demo')")
        shoot(2.8, '', False)
        b.close()
    lst = os.path.join(FRAMES, 'list.txt')
    with open(lst, 'w') as f:
        for path, d in frames: f.write(f"file '{path}'\nduration {d}\n")
        f.write(f"file '{frames[-1][0]}'\n")
    total = sum(d for _, d in frames)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
                    '-vf', f'fps=30,format=yuv420p,fade=t=in:st=0:d=0.4,fade=t=out:st={total-0.6:.2f}:d=0.6',
                    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-movflags', '+faststart', OUT], check=True)
    print(f'wrote {OUT} ({total:.1f}s, {len(frames)} frames)')

if __name__ == '__main__':
    main()
