import { defineConfig, type Plugin } from 'vitest/config';

/** Each game's short address, such as `/ashen-hollow/`, and the folder its build lives in. */
const GAMES: Record<string, string> = {
  'ashen-hollow': 'games/ashen-hollow/',
  unrecalled: 'games/unrecalled/',
};

/** A page that sends the visitor on to the game, keeping any `?query` and `#hash`. */
function redirectPage(to: string): string {
  return `<!doctype html><meta charset="utf-8"><title>Loading…</title>
<script>location.replace(${JSON.stringify(to)} + location.search + location.hash)</script>
<meta http-equiv="refresh" content="0;url=${to}">`;
}

/**
 * Serves each game at a short address. A redirect rather than moving the game's build, since its pages and assets
 * are linked by relative paths from where they're built.
 */
function gameAddresses(): Plugin {
  return {
    name: 'game-addresses',
    generateBundle() {
      for (const [game, folder] of Object.entries(GAMES)) {
        this.emitFile({ type: 'asset', fileName: `${game}/index.html`, source: redirectPage(`../${folder}`) });
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const game = (req.url ?? '').split(/[?#]/)[0]!.replace(/^\/|\/$/g, '');
        const folder = GAMES[game];
        if (!folder) return next();
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(redirectPage(`/${folder}`));
      });
    },
  };
}

export default defineConfig({
  // Relative asset paths, so a build works from any folder, including GitHub Pages under /arpg-forge/.
  base: './',
  plugins: [gameAddresses()],
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        'ashen-hollow': 'games/ashen-hollow/index.html',
        unrecalled: 'games/unrecalled/index.html',
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
