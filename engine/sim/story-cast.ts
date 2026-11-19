import type { StorySpan } from './content';
import { spawnEnemy } from './spawning';
import type { GameState, LevelState, Npc } from './state';
import { holds, reached } from './story-steps';

/** Whether the story is at a step where something with this span is in the world. */
export const inStory = (state: GameState, span: StorySpan): boolean => holds(state, { from: span.fromStep, until: span.untilStep });

/**
 * Puts the townspeople and the things to read where the story has them at its current step, and takes away those it
 * has moved on from, on every level, and brings in the enemies it has reached. Someone staying where they were is left
 * as they are.
 */
export function castForStep(state: GameState): void {
  for (const ls of Object.values(state.levels)) {
    castNpcs(state, ls);
    const due = ls.storySpawns.filter((s) => reached(state, s.fromStep!));
    for (const spawn of due) spawnEnemy(state, ls, spawn);
    if (due.length) ls.storySpawns = ls.storySpawns.filter((s) => !due.includes(s));
    const readables = ls.readablePlacements.filter((r) => inStory(state, r));
    if (readables.length !== ls.readables.length || readables.some((r, i) => r !== ls.readables[i])) {
      ls.readables = readables;
      // The hero walks up to a readable by its index, which may now be another one.
      if (state.hero.interact?.type === 'readable' && ls === state.levels[state.levelId]) state.hero.interact = null;
    }
  }
}

function castNpcs(state: GameState, ls: LevelState): void {
  ls.npcPlacements.forEach((placement, index) => {
    const at = ls.npcs.findIndex((n) => n.placement === index);
    const wanted = inStory(state, placement);
    if (wanted && at < 0) ls.npcs.push(makeNpc(state, placement.kind, placement.name, placement.x, placement.y, index));
    if (!wanted && at >= 0) {
      const [gone] = ls.npcs.splice(at, 1);
      const it = state.hero.interact;
      if (it?.type === 'npc' && it.npcId === gone!.id) state.hero.interact = null;
    }
  });
}

function makeNpc(state: GameState, kind: string, name: string, x: number, y: number, placement: number): Npc {
  return {
    id: state.nextId++, kind, name, x, y, prevX: x, prevY: y, r: state.rules.npcRadius,
    facingX: 0, facingY: 1, moving: false, path: null, placement,
  };
}
