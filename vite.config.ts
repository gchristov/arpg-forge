import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

// Published path → frozen prototype file. Each game has its own path, which serves its prototype until the
// game has an engine entry under games/<name>.
const prototypePages: Record<string, string> = {
  'prototypes/ashen-hollow.html': 'prototypes/ashen-hollow.html',
  'ashen-hollow/index.html': 'prototypes/ashen-hollow.html',
};

// Prototypes are frozen references, so the build copies them byte for byte instead of bundling them, and
// the dev server serves the same paths.
function prototypes(): Plugin {
  return {
    name: 'prototypes',
    generateBundle() {
      for (const [fileName, source] of Object.entries(prototypePages)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(source) });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]!.replace(/^\//, '').replace(/\/$/, '/index.html');
        const source = prototypePages[path];
        if (!source || path === source) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(readFileSync(source));
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so a build works from any folder, including GitHub Pages under /arpg-forge/.
  base: './',
  plugins: [prototypes()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        'ashen-hollow-engine': 'games/ashen-hollow/index.html',
      },
    },
  },
  // Listen on all interfaces, so the servers are reachable from outside the Docker container.
  server: { host: true, port: 5173, strictPort: true },
  preview: { host: true, port: 4173, strictPort: true },
  test: {
    include: ['engine/**/*.test.ts', 'games/**/*.test.ts', 'tools/**/*.test.ts', 'tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
