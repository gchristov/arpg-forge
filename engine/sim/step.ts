import { updateProjectiles, updateTelegraphs } from './combat';
import { updateCampRespawns, updateEnemies, updateNpcs } from './enemies';
import { applyCommand, updateHeroMovement, updateHeroTimers } from './hero';
import { advanceQuest } from './interaction';
import { updateItems } from './loot';
import { separateBodies } from './separation';
import { placeAt } from './setup';
import { currentLevel, type GameState, type SimEvent, type StepInput } from './state';

/** The fade between levels. */
const TRANSITION_SECONDS = 0.3;
const PORTAL_COOLDOWN_SECONDS = 0.7;
/** A sealed portal says so again only after this long, rather than every step the hero stands on it. */
const SEALED_REMINDER_SECONDS = 1.5;

/**
 * Advances the game by one fixed step and returns what happened. The only function that changes the game state;
 * drawing, sound and the HUD react to the returned events. Systems run in a fixed order: the hero, portals,
 * enemies, NPCs, bodies pushing apart, projectiles, slams, then camps refilling.
 */
export function step(state: GameState, input: StepInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  state.time += dt;
  state.portalCooldown -= dt;
  rememberPositions(state);

  updateHeroTimers(state, dt, events);
  if (state.transition) advanceTransition(state, dt, events);
  else {
    for (const command of input.commands) applyCommand(state, command, events);
    updateHeroMovement(state, input.held, dt, events);
    enterPortalUnderHero(state, events);
  }
  updateEnemies(state, dt, events);
  updateNpcs(state);
  separateBodies(state);
  updateProjectiles(state, dt, events);
  updateTelegraphs(state, dt, events);
  updateItems(state, dt, events);
  updateCampRespawns(state, dt);
  return events;
}

function rememberPositions(state: GameState): void {
  const { hero } = state;
  hero.prevX = hero.x;
  hero.prevY = hero.y;
  const ls = currentLevel(state);
  for (const e of ls.enemies) {
    e.prevX = e.x;
    e.prevY = e.y;
  }
  for (const n of ls.npcs) {
    n.prevX = n.x;
    n.prevY = n.y;
  }
}

function enterPortalUnderHero(state: GameState, events: SimEvent[]): void {
  if (state.portalCooldown > 0 || state.hero.dead) return;
  const { level } = currentLevel(state);
  const tx = Math.floor(state.hero.x);
  const ty = Math.floor(state.hero.y);
  const portal = level.portals.find((p) => p.tx === tx && p.ty === ty);
  if (!portal) return;
  const destination = state.levels[portal.to];
  if (!destination) return;
  if (portal.sealed && currentLevel(state).enemies.some((e) => !e.dead)) {
    state.portalCooldown = SEALED_REMINDER_SECONDS;
    events.push({ type: 'PortalSealed', x: portal.tx + 0.5, y: portal.ty + 0.5 });
    return;
  }
  const back = destination.level.portals.find((p) => p.to === level.id);
  const arrival = back
    ? { x: back.tx + 0.5 + back.stepOut.x, y: back.ty + 0.5 + back.stepOut.y }
    : destination.level.start;
  state.transition = { to: portal.to, x: arrival.x, y: arrival.y, remaining: TRANSITION_SECONDS };
  events.push({ type: 'TransitionStarted', to: portal.to });
}

function advanceTransition(state: GameState, dt: number, events: SimEvent[]): void {
  const t = state.transition!;
  t.remaining -= dt;
  if (t.remaining > 0) return;
  state.levelId = t.to;
  const { hero } = state;
  placeAt(hero, t.x, t.y);
  hero.path = null;
  hero.targetId = null;
  hero.interact = null;
  hero.moving = false;
  state.projectiles.length = 0;
  state.telegraphs.length = 0;
  state.portalCooldown = PORTAL_COOLDOWN_SECONDS;
  state.transition = null;
  events.push({ type: 'EnteredLevel', levelId: t.to });
  advanceQuest(state, { type: 'enter', levelId: t.to }, events);
}
