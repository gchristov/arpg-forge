// Measures a game page on the Mac's own GPU: connects to the Chrome that tools/browser/gpu.sh starts, plays each
// variant for a while with ?debug on, and prints the debug overlay (fps, frame times, draw calls, triangles).
// Saves a screenshot per variant to tools/browser/out/gpu-<n>.png.
// Usage (inside the browser tool's Docker image): node measure.mjs <page URL> <seconds> <query>...
import { lookup } from 'node:dns/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire('/opt/browser-tool/')('playwright');
const [url, seconds, ...variants] = process.argv.slice(2);
const { address } = await lookup('host.docker.internal');
const browser = await chromium.connectOverCDP(`http://${address}:${process.env.GPU_CHROME_PORT}`);
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

let gpuShown = false;
for (const [n, query] of variants.entries()) {
  const page = await context.newPage();
  await page.goto(`${url}?debug${query}`);
  if (!gpuShown) {
    gpuShown = true;
    const gpu = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER);
    });
    console.log(`GPU: ${gpu}`);
  }
  await page.waitForFunction(() => document.querySelector('#title .go')?.textContent !== 'Loading…', null, { timeout: 60000 });
  await page.evaluate(() => window.game.start());
  await page.waitForTimeout(Number(seconds) * 1000);
  const overlay = await page.evaluate(() => document.querySelector('pre')?.textContent ?? '');
  await page.screenshot({ path: `tools/browser/out/gpu-${n + 1}.png` });
  console.log(`${(query || '(plain)').padEnd(24)} ${overlay.replace(/\n/g, ' | ')}`);
  await page.close();
}
await context.close();
await browser.close();
