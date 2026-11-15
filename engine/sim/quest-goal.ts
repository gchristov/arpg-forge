import { dist } from '../core/math';
import type { QuestTrigger } from './content';
import type { Enemy, GameState } from './state';

/**
 * Where the hero should head next on the current level: the townsperson to talk to or the enemy to defeat when
 * they're here (`actorId`), otherwise the doorway that leads towards them, or towards the place to reach. While that
 * doorway is sealed, the nearest enemy still standing, since they keep it shut.
 */
export interface QuestGoal {
  x: number;
  y: number;
  actorId?: number;
}

/**
 * The goal of the quest's next step, worked out from what reaches it, or null when nothing does (the story is done)
 * or no way leads there. A goal on another level is reached through the fewest doorways.
 */
export function questGoal(state: GameState): QuestGoal | null {
  const trigger = state.rules.quest[state.quest + 1]?.reachedBy;
  if (!trigger) return null;
  const here = state.levels[state.levelId]!;
  const actor = actorFor(trigger, state.levelId, state);
  if (actor) return { x: actor.x, y: actor.y, actorId: actor.id };

  const targets = new Set(trigger.type === 'enter'
    ? [trigger.levelId]
    : Object.keys(state.levels).filter((id) => actorFor(trigger, id, state)));
  targets.delete(state.levelId);
  if (!targets.size) return null;
  const first = firstPortalTowards(state, targets);
  if (first === null) return null;
  const portal = here.level.portals[first]!;
  const keeper = portal.sealed ? nearestStanding(state) : null;
  if (keeper) return { x: keeper.x, y: keeper.y, actorId: keeper.id };
  return { x: portal.tx + 0.5, y: portal.ty + 0.5 };
}

function nearestStanding(state: GameState): Enemy | null {
  const { hero } = state;
  let nearest: Enemy | null = null;
  for (const e of state.levels[state.levelId]!.enemies) {
    if (e.dead) continue;
    if (!nearest || dist(e.x, e.y, hero.x, hero.y) < dist(nearest.x, nearest.y, hero.x, hero.y)) nearest = e;
  }
  return nearest;
}

function actorFor(trigger: QuestTrigger, levelId: string, state: GameState): { id: number; x: number; y: number } | null {
  const ls = state.levels[levelId]!;
  if (trigger.type === 'talk') return ls.npcs.find((n) => n.kind === trigger.npcKind) ?? null;
  if (trigger.type === 'kill') return ls.enemies.find((e) => e.kind === trigger.enemyKind && !e.dead) ?? null;
  return null;
}

/** Index of the current level's portal that starts the shortest walk through portals to one of `targets`. */
function firstPortalTowards(state: GameState, targets: Set<string>): number | null {
  const firstStep = new Map<string, number>([[state.levelId, -1]]);
  const queue = [state.levelId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    const portals = state.levels[id]?.level.portals ?? [];
    for (let p = 0; p < portals.length; p++) {
      const to = portals[p]!.to;
      if (firstStep.has(to) || !state.levels[to]) continue;
      const first = id === state.levelId ? p : firstStep.get(id)!;
      if (targets.has(to)) return first;
      firstStep.set(to, first);
      queue.push(to);
    }
  }
  return null;
}
