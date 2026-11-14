import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

const prototypes = ['prototypes/ashen-hollow.html'];

// Prototypes are frozen references, so the build copies them byte for byte instead of bundling them.
function copyPrototypes(): Plugin {
  return {
    name: 'copy-prototypes',
    apply: 'build',
    generateBundle() {
      for (const fileName of prototypes) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(fileName) });
      }
    },
  };
}

export default defineConfig({
  // Relative asset paths, so a build works from any folder, including GitHub Pages under /arpg-forge/.
  base: './',
  plugins: [copyPrototypes()],
  test: {
    include: ['engine/**/*.test.ts', 'games/**/*.test.ts', 'tools/**/*.test.ts', 'tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
