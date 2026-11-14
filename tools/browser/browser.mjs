import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

// Playwright comes from the Docker image locally. On CI, where Google Chrome is already installed, the test-web job
// installs just playwright-core and sets BROWSER_CHANNEL=chrome, which skips building the image.
const CHANNEL = process.env.BROWSER_CHANNEL;
const { chromium } = CHANNEL ? createRequire(import.meta.url)('playwright-core') : createRequire('/opt/browser-tool/')('playwright');

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/** Serves dist/ on a free local port. */
export function serveDist() {
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
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, port: server.address().port })));
}

/** Chromium with WebGL through SwiftShader, which works without a GPU, in Docker and on CI. */
export function launchBrowser() {
  return chromium.launch({
    ...(CHANNEL ? { channel: CHANNEL } : {}),
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}
