// Frame-accurate export: drives index.html?render=1 in headless Chrome and pipes frames to ffmpeg.
//
//   node tools/render.mjs --stills 0.5,3.9,14.2      PNG stills → scratch/stills/
//   node tools/render.mjs --video                     both MP4s (captioned + clean) → exports/
//   node tools/render.mjs --video --from 16 --to 22   a section only (preview)
//
// Needs Google Chrome (set CHROME=/path/to/chrome to override) and ffmpeg on PATH.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--force-color-profile=srgb', '--disable-gpu-vsync', '--font-render-hinting=none'] });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.error('[page]', m.text()); });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?render=1`, { waitUntil: 'load' });
await page.evaluate(() => window.__ready);
const TL = await page.evaluate(() => window.TL);

async function grab(t, captions, type = 'image/jpeg') {
  const url = await page.evaluate((t, c, type) => { window.draw(t, c); return document.getElementById('stage').toDataURL(type, 0.95); }, t, captions, type);
  return Buffer.from(url.split(',')[1], 'base64');
}

if (args.includes('--stills')) {
  const times = (arg('--stills', '') || '').split(',').filter(Boolean).map(Number);
  const dir = path.join(ROOT, arg('--out', 'scratch/stills'));
  fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const f = path.join(dir, `t${t.toFixed(2).padStart(6, '0')}${args.includes('--clean') ? '' : '_cc'}.png`);
    fs.writeFileSync(f, await grab(t, !args.includes('--clean'), 'image/png'));
    console.log(f);
  }
} else if (args.includes('--video')) {
  const fps = TL.fps, from = +arg('--from', 0), to = +arg('--to', TL.duration);
  const n = Math.round((to - from) * fps);
  const audio = path.join(ROOT, 'audio/master/junction-promo-mix.wav');
  const outDir = path.join(ROOT, arg('--outdir', 'exports'));
  fs.mkdirSync(outDir, { recursive: true });
  const suffix = from > 0 || to < TL.duration ? `_${from}-${to}` : '';
  const variants = args.includes('--clean-only') ? [false] : args.includes('--cc-only') ? [true] : [true, false];
  const procs = variants.map((cc) => {
    const out = path.join(outDir, `junction-promo_1080x1920_${cc ? 'captioned' : 'clean'}${suffix}.mp4`);
    const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-ss', String(from), '-t', String(to - from), '-i', audio,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps),
      '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart',
      '-metadata', 'title=Junction: Europe', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    return { cc, out, ff };
  });
  const t0 = Date.now();
  for (let i = 0; i < n; i++) {
    const t = from + i / fps;
    for (const p of procs) {
      const buf = await grab(t, p.cc);
      if (!p.ff.stdin.write(buf)) await new Promise((r) => p.ff.stdin.once('drain', r));
    }
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
  }
  await Promise.all(procs.map((p) => new Promise((r) => { p.ff.on('close', r); p.ff.stdin.end(); })));
  procs.forEach((p) => console.log('wrote', p.out));
}
await browser.close();
server.close();
