// End-to-end smoke test of the built site (dist/) in headless Chromium with WebGL. Every page must load without
// errors; on each game page the models must load, the title must start the game, and a tap on the ground must move
// the hero (read through `?debug`'s `window.game`). Desktop and phone sizes run side by side. One screenshot per
// page goes to tools/browser/out/smoke-*.png. Exits non-zero on any failure.
import { launchBrowser, serveDist } from './browser.mjs';

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/ashen-hollow/?debug', name: 'ashen-hollow', game: true },
  { path: '/unrecalled/?debug', name: 'unrecalled', game: true },
];
const SIZES = [
  { width: 1280, height: 800, label: 'desktop' },
  { width: 390, height: 844, label: 'phone' },
];

const { server, port } = await serveDist();
const browser = await launchBrowser();
const started = Date.now();

/** Waits for a condition in the page, failing with `what` rather than a bare timeout. */
async function expectSoon(page, what, condition, arg, timeout) {
  try {
    await page.waitForFunction(condition, arg, { timeout });
  } catch {
    throw new Error(`${what} (waited ${timeout / 1000} s)`);
  }
}

/** Plays one game page: waits for the models, taps through the title, taps the ground and checks the hero moved. */
async function playGame(page, size) {
  await expectSoon(page, 'models never finished loading', () => document.querySelector('#title .go')?.textContent !== 'Loading…', null, 60000);
  await page.locator('#title').dispatchEvent('pointerdown');
  await expectSoon(page, 'tapping the title did not start the game', () => window.game && !document.querySelector('#title').checkVisibility(), null, 10000);
  const start = await page.evaluate(() => ({ x: window.game.state.hero.x, y: window.game.state.hero.y }));
  await page.evaluate(([x, y]) => {
    const canvas = document.querySelector('canvas');
    for (const type of ['pointerdown', 'pointerup']) {
      canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
    }
  }, [size.width * 0.7, size.height * 0.4]);
  await expectSoon(
    page,
    'a tap on the ground did not move the hero',
    ([x, y]) => Math.hypot(window.game.state.hero.x - x, window.game.state.hero.y - y) > 0.5,
    [start.x, start.y],
    15000,
  );
}

async function checkSize(size) {
  const failures = [];
  const context = await browser.newContext({ viewport: { width: size.width, height: size.height } });
  for (const p of PAGES) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const label = `${p.name} (${size.label})`;
    try {
      const response = await page.goto(`http://localhost:${port}${p.path}`, { waitUntil: 'load' });
      if (!response?.ok()) failures.push(`${label}: HTTP ${response?.status()}`);
      if (p.game) await playGame(page, size);
      await page.screenshot({ path: `tools/browser/out/smoke-${p.name}-${size.label}.png` });
    } catch (e) {
      failures.push(`${label}: ${e.message.split('\n')[0]}`);
    }
    for (const e of errors) failures.push(`${label}: ${e}`);
    await page.close();
    console.log(`${failures.length ? '…' : '✓'} ${label} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  await context.close();
  return failures;
}

const failures = (await Promise.all(SIZES.map(checkSize))).flat();
await browser.close();
server.close();
if (failures.length) {
  console.error('\nFailures:\n' + failures.map((f) => `  ${f}`).join('\n'));
  process.exit(1);
}
console.log(`\nAll pages passed in ${((Date.now() - started) / 1000).toFixed(1)} s.`);
