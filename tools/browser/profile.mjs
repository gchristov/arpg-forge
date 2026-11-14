// Finds where a game page spends its CPU time: plays each variant with the CPU slowed down (4 is roughly a mid-range
// phone), records a CPU profile and prints the functions taking the most time. Runs against the Chrome that
// tools/browser/gpu.sh starts. Build with `npx vite build --minify false` first so the names are readable.
// Usage: MEASURE_SCRIPT=tools/browser/profile.mjs ./tools/browser/gpu.sh <page URL> <seconds> <slowdown> <query>...
import { lookup } from 'node:dns/promises';
import { createRequire } from 'node:module';
const { chromium } = createRequire('/opt/browser-tool/')('playwright');
const [url, seconds, throttle, ...variants] = process.argv.slice(2);
const { address } = await lookup('host.docker.internal');
const browser = await chromium.connectOverCDP(`http://${address}:${process.env.GPU_CHROME_PORT}`);
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
for (const query of variants) {
  const page = await context.newPage();
  await page.goto(`${url}?debug${query}`);
  await page.waitForFunction(() => document.querySelector('#title .go')?.textContent !== 'Loading…', null, { timeout: 60000 });
  await page.evaluate(() => window.game.start());
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(throttle) });
  await page.waitForTimeout(4000);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(Number(seconds) * 1000);
  const { profile } = await cdp.send('Profiler.stop');
  const overlay = await page.evaluate(() => document.querySelector('pre')?.textContent ?? '');
  console.log(`\n=== ${query}  ${overlay.replace(/\n/g, ' | ')}`);
  const self = new Map();
  const dt = profile.timeDeltas; const counts = new Map();
  profile.samples.forEach((id, i) => counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0)));
  let total = 0;
  for (const n of profile.nodes) {
    const t = (counts.get(n.id) ?? 0) / 1000; total += t;
    const f = n.callFrame; const key = `${f.functionName || '(anon)'} ${f.url.split('/').pop()}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + t);
  }
  console.log(`total ${total.toFixed(0)} ms`);
  [...self].sort((a, b) => b[1] - a[1]).slice(0, 40).forEach(([k, t]) => console.log(`${(100 * t / total).toFixed(1).padStart(5)}%  ${k}`));
  await page.close();
}
await browser.close();
