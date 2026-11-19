import { currentLevel, type GameState, type SimEvent } from './state';

/**
 * Tells when the hero comes within reach of a watched thing to read or use on their level, once each time they come
 * near; only the things the story watches are checked.
 */
export function noticeApproaches(state: GameState, events: SimEvent[]): void {
  const { watch } = state.rules;
  if (!watch.length) return;
  const ls = currentLevel(state);
  const { hero } = state;
  const near: string[] = [];
  for (const r of ls.readables) {
    for (const w of watch) {
      if (w.id !== r.id || Math.hypot(hero.x - (r.tx + 0.5), hero.y - (r.ty + 0.5)) > w.within) continue;
      const key = `${state.levelId}:${r.id}:${w.within}`;
      near.push(key);
      if (!state.near.includes(key)) events.push({ type: 'Approached', id: r.id, within: w.within });
    }
  }
  state.near = near;
}
