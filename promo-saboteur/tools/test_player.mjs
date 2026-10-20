// Smoke test for a player page: loads it, presses Play, checks the audio clock drives the canvas,
// then seeks, toggles captions and pauses. Usage: node tools/test_player.mjs <file-or-url> [shot.png]
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const target = process.argv[2];
const url = target.startsWith('http') ? target : 'file://' + path.resolve(target);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setViewport({ width: 900, height: 1100 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => document.getElementById('loading').hidden, { timeout: 20000 });
const sum = () => page.evaluate(() => { const c = document.getElementById('stage'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4097) s += d[i]; return s; });
const before = await sum();
await page.click('#play');
await new Promise((r) => setTimeout(r, 2500));
const st = await page.evaluate(() => ({ cur: document.getElementById('audio').currentTime, paused: document.getElementById('audio').paused, time: document.getElementById('time').textContent, dur: document.getElementById('audio').duration }));
const after = await sum();
await page.evaluate(() => { const s = document.getElementById('scrub'); s.value = 800; s.dispatchEvent(new Event('input')); });
await new Promise((r) => setTimeout(r, 400));
const seek = await page.evaluate(() => document.getElementById('audio').currentTime);
await page.click('#cc'); await new Promise((r) => setTimeout(r, 300));
const cc = await page.evaluate(() => document.getElementById('cc').getAttribute('aria-pressed'));
await page.click('#play');
const paused = await page.evaluate(() => document.getElementById('audio').paused);
if (process.argv[3]) await page.screenshot({ path: process.argv[3] });
console.log(JSON.stringify({ audioTimeAfter2_5s: st.cur.toFixed(2), audioDuration: st.dur, playing: !st.paused, timeLabel: st.time, canvasChanged: before !== after, seekTo80pct: seek.toFixed(2), captionsPressedAfterToggle: cc, pausedAfterSecondClick: paused, errors }, null, 1));
await browser.close();
