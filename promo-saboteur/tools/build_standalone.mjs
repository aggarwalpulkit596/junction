// Inline every script, font, image and the mastered audio into one HTML file that plays from disk.
//   node tools/build_standalone.mjs  →  exports/saboteur-trailer-player.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p));
const b64 = (p, mime) => `data:${mime};base64,${rd(p).toString('base64')}`;
let html = rd('index.html').toString();

html = html.replace(/url\("(assets\/fonts\/[^"]+\.ttf)"\)/g, (_, p) => `url("${b64(p, 'font/ttf')}")`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, p) => `<script>\n${rd(p).toString().replace(/<\/script>/g, '<\\/script>')}\n</script>`);
const assets = Object.fromEntries(Object.entries({ task: '1_task', reward: '2_reward', alibi: '3_alibi', hud: '4_hud', log: '5_log', meeting: '6_meeting', verdict: '7_verdict', end: '8_end' }).map(([k, f]) => [k, b64(`assets/screens/${f}.jpg`, 'image/jpeg')]));
html = html.replace(/<script>\/\*__ASSETS__\*\/[^<]*<\/script>/, `<script>window.ASSETS = ${JSON.stringify(assets)};</script>`);
html = html.replace('src="assets/footage.mp4"', `src="${b64('assets/footage.mp4', 'video/mp4')}"`);
html = html.replace('src="audio/master/saboteur-trailer-mix.m4a"', `src="${b64('audio/master/saboteur-trailer-mix.m4a', 'audio/mp4')}"`);
if (/src="(?!data:)[^"]+"|url\("(?!data:)/.test(html)) throw new Error('an external reference survived inlining');

const out = path.join(ROOT, 'exports/saboteur-trailer-player.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
