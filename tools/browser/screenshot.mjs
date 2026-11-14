// Takes a screenshot of a page from dist/ in headless Chromium with WebGL.
// Usage: node screenshot.mjs <page path> <out.png> [width] [height] [script]
//   script: optional JS run in the page after load, e.g. to tap the screen; then waits 1.5 s.
import { launchBrowser, serveDist } from './browser.mjs';

const [pagePath = '/', out = 'tools/browser/out/shot.png', width = '1280', height = '800', script] = process.argv.slice(2);

const { server, port } = await serveDist();
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${port}${pagePath}`);
await page.waitForTimeout(1500);
if (script) {
  await page.evaluate(script);
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
await browser.close();
server.close();
if (errors.length) {
  console.error('Page errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`Saved ${out}`);
