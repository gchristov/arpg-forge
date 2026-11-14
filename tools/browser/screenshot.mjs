// Serves dist/ and takes screenshots of pages in headless Chromium with WebGL.
// Usage: node screenshot.mjs <page path> <out.png> [width] [height] [script]
//   script: optional JS run in the page after load, e.g. to tap the screen; then waits 1.5 s.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

// Playwright is installed in the Docker image, not in the repo.
const { chromium } = createRequire('/opt/browser-tool/')('playwright');

const [pagePath = '/', out = 'tools/browser/out/shot.png', width = '1280', height = '800', script] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (path.endsWith('/')) path += 'index.html';
  try {
    const body = await readFile(join('dist', path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
