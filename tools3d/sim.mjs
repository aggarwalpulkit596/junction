// Headless check: bots play every seat of the 3D build (FAST mode, no walking delays).
//   node tools3d/sim.mjs [games] [trains] [file]   needs puppeteer-core (promo/node_modules) and Google Chrome
//   file defaults to junction3d.html; with junction3d-saboteur.html, odd-numbered games also call an emergency meeting
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'promo/node_modules/'));
const puppeteer = require('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const FILE = process.argv[4] || 'junction3d.html';
await page.goto('file://' + path.join(ROOT, FILE), { waitUntil: 'load' });
await page.waitForFunction(() => !document.getElementById('boot'), { timeout: 30000 });
const res = await page.evaluate(async (N, trains) => {
  J.setFast(true);
  document.getElementById('sheet').classList.add('hidden');
  const out = [];
  for (let g = 0; g < N; g++) {
    J.newGame(trains, true); const S = J.S; S.locked = false; J.H().tickets = S.ticketDeck.splice(0, 2);
    let n = 0;
    while (!J.S.over && n++ < 400) {
      if (J.S.turn !== 0 || J.S.busy) { await new Promise((r) => setTimeout(r, 0)); continue; }
      if (J.humanMeeting && g % 2 && J.S.round >= 6 + (g % 7) && J.meetingOpen()) { const sus = J.S.players.filter((p) => !p.human && p.alive); J.S.autoVote = sus[g % sus.length].id; J.humanMeeting(); }
      await J.botTurn(J.H());
      await J.endTurn();
    }
    const s = J.S;
    out.push({ g, over: s.over, round: s.round, claimed: s.routes.filter((r) => r.owner !== null).length, marketOk: s.market.every((c, i) => !c || !!s.marketCity[i]), sabotages: s.sabotages || 0, caught: !!s.caught, meeting: !!s.meetingUsed, botMeetings: s.botMeetings || 0, ejected: s.players.filter((p) => p.alive === false).length });
  }
  return out;
}, +(process.argv[2] || 100), +(process.argv[3] || 20));
const ok = res.filter((r) => r.over).length, rounds = res.map((r) => r.round);
console.log(JSON.stringify({ trains: +(process.argv[3] || 20), games: res.length, finished: ok, avgRounds: (rounds.reduce((a, b) => a + b, 0) / rounds.length).toFixed(1), maxRounds: Math.max(...rounds), avgClaimed: (res.reduce((a, r) => a + r.claimed, 0) / res.length).toFixed(1), marketCitiesOk: res.every((r) => r.marketOk), avgSabotages: (res.reduce((a, r) => a + r.sabotages, 0) / res.length).toFixed(1), caughtNoHumanMeeting: `${res.filter((r) => r.g % 2 === 0 && r.caught).length}/${res.filter((r) => r.g % 2 === 0).length}`, meetings: res.filter((r) => r.meeting).length, botMeetings: res.reduce((a, r) => a + r.botMeetings, 0), ejected: res.reduce((a, r) => a + r.ejected, 0), caught: res.filter((r) => r.caught).length, errors }));
await browser.close();
