/**
 * What the engine needs from wherever the game runs: the web, a desktop wrapper for Steam, or a phone app. Game and
 * engine code go through this, never straight to browser storage or a store's API, so each target only swaps the
 * implementation.
 */
export interface Platform {
  readonly id: 'web' | 'steam' | 'mobile';
  /** A small saved value, such as a setting, or null if there's none. */
  load(key: string): string | null;
  save(key: string, value: string): void;
  /** Whether the game can go full screen here. */
  readonly canFullscreen: boolean;
  setFullscreen(on: boolean): Promise<void>;
}
