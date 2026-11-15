import { lookup } from 'node:dns/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/browser-tool/')('playwright');
const [base] = process.argv.slice(2);
const { address } = await lookup('host.docker.internal');
const browser = await chromium.connectOverCDP(`http://${address}:${process.env.GPU_CHROME_PORT}`);
for (const game of ['unrecalled', 'ashen-hollow']) {
  const page = await (await browser.newContext()).newPage();
  const seen = new Set();
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('PACE') && !seen.has(t)) { seen.add(t); console.log(game, t); } });
  await page.goto(`${base}/games/${game}/?debug`);
  await page.waitForFunction(() => document.querySelector('#title .go')?.textContent !== 'Loading…', null, { timeout: 60000 });
  await page.evaluate(() => window.game.start());
  await page.waitForTimeout(1500);
}
await browser.close();
