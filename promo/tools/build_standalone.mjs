// Inline every script, font, image and the mastered audio into one HTML file that plays from disk.
//   node tools/build_standalone.mjs  →  exports/junction-promo-player.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => fs.readFileSync(path.join(ROOT, p));
const b64 = (p, mime) => `data:${mime};base64,${rd(p).toString('base64')}`;
let html = rd('index.html').toString();

html = html.replace(/url\("(assets\/fonts\/[^"]+\.ttf)"\)/g, (_, p) => `url("${b64(p, 'font/ttf')}")`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, p) => `<script>\n${rd(p).toString().replace(/<\/script>/g, '<\\/script>')}\n</script>`);
const assets = Object.fromEntries(Object.entries({ start: '1_start', board: '2_board', tunnel: '3_tunnel', postcard: '4_postcard', scores: '5_scores' }).map(([k, f]) => [k, b64(`assets/screens/${f}.jpg`, 'image/jpeg')]));
html = html.replace(/<script>\/\*__ASSETS__\*\/[^<]*<\/script>/, `<script>window.ASSETS = ${JSON.stringify(assets)};</script>`);
html = html.replace('src="audio/master/junction-promo-mix.m4a"', `src="${b64('audio/master/junction-promo-mix.m4a', 'audio/mp4')}"`);
if (/src="(?!data:)[^"]+"|url\("(?!data:)/.test(html)) throw new Error('an external reference survived inlining');

const out = path.join(ROOT, 'exports/junction-promo-player.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log('wrote', out, (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
