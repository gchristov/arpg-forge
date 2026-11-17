import { dist } from '../core/math';
import type { QuestTrigger } from './content';
import type { Enemy, GameState } from './state';

/**
 * Where the hero should head next on the current level: the townsperson to talk to or the enemy to defeat when
 * they're here (`actorId`), or the thing to use or open, otherwise the doorway that leads towards them, or towards the
 * place to reach; never through a door the story keeps locked. While that
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
  const goal = goalIn(trigger, state.levelId, state);
  if (goal) return goal;

  const targets = new Set(trigger.type === 'enter'
    ? [trigger.levelId]
    : Object.keys(state.levels).filter((id) => goalIn(trigger, id, state)));
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

/** Where on a level the trigger is met: the townsperson or enemy, the thing to use, or the container holding the weapon. */
function goalIn(trigger: QuestTrigger, levelId: string, state: GameState): QuestGoal | null {
  const ls = state.levels[levelId]!;
  const actor = trigger.type === 'talk'
    ? ls.npcs.find((n) => n.kind === trigger.npcKind)
    : trigger.type === 'kill' ? ls.enemies.find((e) => e.kind === trigger.enemyKind && !e.dead)
      : trigger.type === 'defeat' ? ls.enemies.find((e) => e.tag === trigger.tag && !e.dead) : undefined;
  if (actor) return { x: actor.x, y: actor.y, actorId: actor.id };
  const tile = trigger.type === 'use'
    ? ls.readables.find((r) => r.id === trigger.id)
    : trigger.type === 'arm' ? ls.containers.find((c) => c.weapon === trigger.weapon && !c.opened) : undefined;
  return tile ? { x: tile.tx + 0.5, y: tile.ty + 0.5 } : null;
}

/** Index of the current level's portal that starts the shortest walk through portals to one of `targets`. */
function firstPortalTowards(state: GameState, targets: Set<string>): number | null {
  const firstStep = new Map<string, number>([[state.levelId, -1]]);
  const queue = [state.levelId];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]!;
    const portals = state.levels[id]?.level.portals ?? [];
    for (let p = 0; p < portals.length; p++) {
      const { to, lockedUntilStep } = portals[p]!;
      if (firstStep.has(to) || !state.levels[to]) continue;
      if (lockedUntilStep !== undefined && state.quest < lockedUntilStep) continue;
      const first = id === state.levelId ? p : firstStep.get(id)!;
      if (targets.has(to)) return first;
      firstStep.set(to, first);
      queue.push(to);
    }
  }
  return null;
}
