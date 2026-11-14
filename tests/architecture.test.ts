import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The rules layers run headless, so they can be tested, replayed and run at a fixed rate. */
const PURE_LAYERS = ['engine/core', 'engine/world', 'engine/sim'];
const FORBIDDEN = [
  { pattern: /from ['"]three/, what: 'Three.js' },
  { pattern: /\b(window|document|navigator|localStorage|requestAnimationFrame)\b/, what: 'browser APIs' },
  { pattern: /\b(Math\.random|Date\.now|performance\.now)\b/, what: 'unseeded randomness or the clock' },
  { pattern: /from ['"]\.\.\/(render|ui|input|audio|shell|platform)\b/, what: 'presentation or platform code' },
];

function sourceFiles(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(path);
    return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('architecture', () => {
  it('keeps browser storage behind the Platform interface', () => {
    const problems = ['engine', 'games'].flatMap(sourceFiles)
      .filter((file) => !file.startsWith(join('engine', 'platform')))
      .filter((file) => /\b(localStorage|sessionStorage|indexedDB)\b/.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
      .map((file) => `${file} uses browser storage directly`);
    expect(problems).toEqual([]);
  });

  for (const layer of PURE_LAYERS) {
    it(`keeps ${layer} free of the browser, Three.js, the clock and outer layers`, () => {
      const problems = sourceFiles(layer).flatMap((file) => {
        const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        return FORBIDDEN.filter((f) => f.pattern.test(text)).map((f) => `${file} uses ${f.what}`);
      });
      expect(problems).toEqual([]);
    });
  }
});
