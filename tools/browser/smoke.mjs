// End-to-end smoke test of the built site (dist/) in headless Chromium with WebGL. Every page must load
// without errors, and on each engine game a tap on the ground must move the hero, after tapping through the
// title screen. Screenshots go to
// tools/browser/out/smoke-*.png. Exits non-zero on any failure.
import { serveDist, launchBrowser } from './browser.mjs';

const PAGES = [
  { path: '/', name: 'home' },
  { path: '/ashen-hollow/', name: 'ashen-hollow', tapMovesHero: true },
];
const SIZES = [
  { width: 1280, height: 800, label: 'desktop' },
  { width: 390, height: 844, label: 'phone' },
];

const { server, port } = await serveDist();
const browser = await launchBrowser();
const failures = [];

for (const size of SIZES) {
  for (const p of PAGES) {
    const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const label = `${p.name} (${size.label})`;
    try {
      const response = await page.goto(`http://localhost:${port}${p.path}`);
      if (!response?.ok()) failures.push(`${label}: HTTP ${response?.status()}`);
      await page.waitForTimeout(1500);
      if (await page.locator('#title').isVisible().catch(() => false)) {
        await page.waitForFunction(() => document.querySelector('#title .go')?.textContent !== 'Loading…', null, { timeout: 30000 });
        await page.locator('#title').dispatchEvent('pointerdown');
        await page.waitForTimeout(800);
      }
      if (p.tapMovesHero) {
        const before = await page.screenshot();
        await page.evaluate(([x, y]) => {
          const canvas = document.querySelector('canvas');
          for (const type of ['pointerdown', 'pointerup']) {
            canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true }));
          }
        }, [size.width * 0.7, size.height * 0.4]);
        await page.waitForTimeout(1500);
        const after = await page.screenshot();
        if (before.equals(after)) failures.push(`${label}: a tap didn't change the view`);
      }
      await page.screenshot({ path: `tools/browser/out/smoke-${p.name}-${size.label}.png` });
    } catch (e) {
      failures.push(`${label}: ${e.message}`);
    }
    for (const e of errors) failures.push(`${label}: ${e}`);
    await page.close();
    console.log(`${failures.length ? '…' : '✓'} ${label}`);
  }
}

await browser.close();
server.close();
if (failures.length) {
  console.error('\nFailures:\n' + failures.map((f) => `  ${f}`).join('\n'));
  process.exit(1);
}
console.log('\nAll pages passed.');
