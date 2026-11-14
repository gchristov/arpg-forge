import type { Platform } from './platform';

/**
 * The browser: settings in local storage under a per-game prefix, and the Fullscreen API. Storage can be missing or
 * blocked (private windows, embedded players), in which case settings simply aren't kept.
 */
export function webPlatform(gameId: string): Platform {
  const key = (name: string): string => `${gameId}:${name}`;
  return {
    id: 'web',
    load(name) {
      try {
        return localStorage.getItem(key(name));
      } catch {
        return null;
      }
    },
    save(name, value) {
      try {
        localStorage.setItem(key(name), value);
      } catch {
        // Storage is blocked: the setting lasts until the page closes.
      }
    },
    canFullscreen: typeof document !== 'undefined' && Boolean(document.documentElement.requestFullscreen),
    async setFullscreen(on) {
      try {
        if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen();
        else if (!on && document.fullscreenElement) await document.exitFullscreen();
      } catch {
        // Some browsers refuse full screen outside a direct tap; the game carries on windowed.
      }
    },
  };
}
