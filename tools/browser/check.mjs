import { lookup } from 'node:dns/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/browser-tool/')('playwright');
const [, , ...urls] = process.argv.slice(2);
const { address } = await lookup('host.docker.internal');
const browser = await chromium.connectOverCDP(`http://${address}:${process.env.GPU_CHROME_PORT}`);
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
for (const [i, url] of urls.entries()) {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(i, 'PAGEERROR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(i, m.type(), m.text().slice(0, 300)); });
  await page.goto(url);
  await page.waitForTimeout(15000);
  console.log(i, 'title button:', await page.evaluate(() => document.querySelector('#title .go')?.textContent));
  await page.screenshot({ path: `tools/browser/out/check-${i}.png` });
  const go = await page.$('#title .go');
  if (go) { await go.tap().catch((e) => console.log(i, 'tap failed', e.message)); await page.waitForTimeout(3000); }
  console.log(i, 'title visible after tap:', await page.evaluate(() => getComputedStyle(document.querySelector('#title')).display + ' ' + (document.querySelector('#title')?.className ?? '')));
  await page.screenshot({ path: `tools/browser/out/check-${i}b.png` });
  await page.close();
}
await context.close(); await browser.close();
