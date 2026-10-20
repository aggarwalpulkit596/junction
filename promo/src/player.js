/* Junction promo — player. The audio element is the clock while playing; the canvas is redrawn every frame
 * from renderFrame(t). With ?render=1 the page exposes window.draw(t, captions) for the frame exporter. */
(function () {
  const params = new URLSearchParams(location.search);
  const RENDER = params.has('render');
  const canvas = document.getElementById('stage');
  const audio = document.getElementById('audio');
  const ctx = canvas.getContext('2d');
  const D = TL.duration;

  async function boot() {
    await Promise.all([
      document.fonts.load('700 40px Fredoka'), document.fonts.load('600 40px Fredoka'),
      document.fonts.load('700 40px Nunito'), document.fonts.load('800 40px Nunito'), document.fonts.load('600 40px Nunito'),
      document.fonts.load('700 40px Caveat'),
    ]);
    await document.fonts.ready;
    E.initTextures();
    await E.loadImages(window.ASSETS);
    // Simple static servers (python -m http.server) don't do range requests, which makes the audio
    // unseekable. A blob URL is always seekable, from a server or from the inlined data: URI.
    if (!RENDER) {
      try { const blob = await (await fetch(audio.src)).blob(); audio.src = URL.createObjectURL(blob); } catch (e) { /* keep the direct src */ }
    }
  }

  if (RENDER) {
    document.body.classList.add('render');
    window.__ready = boot().then(() => {
      window.draw = (t, captions) => { renderFrame(ctx, t, { captions }); return true; };
      return true;
    });
    return;
  }

  const ui = {
    play: document.getElementById('play'), scrub: document.getElementById('scrub'), time: document.getElementById('time'),
    cc: document.getElementById('cc'), mute: document.getElementById('mute'), restart: document.getElementById('restart'),
    full: document.getElementById('full'), chapters: document.getElementById('chapters'), loading: document.getElementById('loading'),
  };
  let captions = true, playing = false, t = 0, lastPerf = 0, audioOk = true;
  try { const c = localStorage.getItem('junction-promo-cc'); if (c != null) captions = c === '1'; } catch (e) { /* storage unavailable */ }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${String(Math.floor((s % 1) * 10))}`;
  function syncUI() {
    ui.play.textContent = playing ? 'Pause' : t >= D - 0.05 ? 'Replay' : 'Play';
    ui.play.setAttribute('aria-pressed', playing);
    ui.cc.setAttribute('aria-pressed', captions); ui.cc.classList.toggle('on', captions);
    ui.mute.textContent = audio.muted ? 'Unmute' : 'Mute';
    ui.scrub.value = (t / D) * 1000;
    ui.time.textContent = `${fmt(t)} / ${fmt(D)}`;
    [...ui.chapters.children].forEach((b) => b.classList.toggle('active', t >= +b.dataset.start && t < +b.dataset.end));
  }
  function frame(now) {
    if (playing) {
      if (audioOk && !audio.paused) t = audio.currentTime;
      else t += (now - lastPerf) / 1000;
      if (t >= D) { t = D; playing = false; audio.pause(); }
    }
    lastPerf = now;
    renderFrame(ctx, t, { captions });
    syncUI();
    requestAnimationFrame(frame);
  }
  function seek(s) {
    t = Math.max(0, Math.min(D, s));
    try { audio.currentTime = t; } catch (e) { /* not loaded yet */ }
  }
  async function play() {
    if (t >= D - 0.05) seek(0);
    playing = true;
    try { audio.currentTime = t; await audio.play(); audioOk = true; } catch (e) { audioOk = false; }
  }
  function pause() { playing = false; audio.pause(); }

  ui.play.onclick = () => (playing ? pause() : play());
  ui.restart.onclick = () => { seek(0); play(); };
  ui.scrub.oninput = () => { seek((ui.scrub.value / 1000) * D); };
  ui.cc.onclick = () => { captions = !captions; try { localStorage.setItem('junction-promo-cc', captions ? '1' : '0'); } catch (e) { /* ignore */ } };
  ui.mute.onclick = () => { audio.muted = !audio.muted; };
  ui.full.onclick = () => { const el = document.querySelector('.stage-wrap'); (document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.())?.catch?.(() => {}); };
  canvas.onclick = () => (playing ? pause() : play());
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
    if (e.key === 'c') ui.cc.click();
    if (e.key === 'm') ui.mute.click();
    if (e.key === 'f') ui.full.click();
    if (e.key === 'ArrowRight') seek(t + (e.shiftKey ? 1 : 1 / 30));
    if (e.key === 'ArrowLeft') seek(t - (e.shiftKey ? 1 : 1 / 30));
    if (e.key === 'Home') seek(0);
  });
  const NAMES = { hook: 'Hook', title: 'Title', cards: 'Cards', claim: 'Claim + ferry', tunnel: 'Tunnel', rivals: 'Rivals', postcards: 'Postcards', score: 'Score', end: 'End card' };
  SCENE_LIST.forEach((s, i) => {
    const b = document.createElement('button'); b.textContent = NAMES[s.name] || s.name; b.dataset.start = s.start;
    b.dataset.end = SCENE_LIST[i + 1] ? SCENE_LIST[i + 1].start : D; b.onclick = () => seek(s.start + 0.01);
    ui.chapters.appendChild(b);
  });

  boot().then(() => {
    ui.loading.hidden = true;
    const s = parseFloat(params.get('t')); if (!isNaN(s)) seek(s);
    requestAnimationFrame(frame);
  }).catch((err) => { ui.loading.textContent = 'Could not load: ' + err.message + ' — serve this folder over http (see README).'; });
})();
