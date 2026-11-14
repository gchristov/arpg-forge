import { planRoute } from '../world/pathfinding';
import { tileIndex } from '../world/tile-map';
import { placeAt } from './setup';
import { currentLevel, type Command, type GameState, type SimEvent, type StepInput } from './state';
import { followPath, walkTo } from './walking';

/** While the ground is held, the hero re-targets this often. */
const HOLD_RETARGET_SECONDS = 0.14;
/** The fade between levels. */
const TRANSITION_SECONDS = 0.3;
const PORTAL_COOLDOWN_SECONDS = 0.7;

/**
 * Advances the game by one fixed step and returns what happened. The only function that changes the game state;
 * drawing, sound and the HUD react to the returned events.
 */
export function step(state: GameState, input: StepInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  state.time += dt;
  state.portalCooldown -= dt;
  rememberPositions(state);

  if (state.transition) {
    advanceTransition(state, dt, events);
    return events;
  }
  for (const command of input.commands) applyCommand(state, command, events);
  if (input.held) keepWalkingToHeld(state, input.held, dt);
  const ls = currentLevel(state);
  followPath(ls.level.map, state.hero, state.hero.speed, dt);
  enterPortalUnderHero(state, events);
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

function applyCommand(state: GameState, command: Command, events: SimEvent[]): void {
  const { level } = currentLevel(state);
  const { hero } = state;
  switch (command.type) {
    case 'walk': {
      const spot = walkTo(level.map, hero, command, (i) => isPortalTile(state, i));
      if (spot) events.push({ type: 'WalkTargetSet', x: spot.x, y: spot.y });
      state.holdTimer = 0;
      break;
    }
    case 'enterStructure': {
      const s = level.structures[command.index];
      if (!s) break;
      const route = planRoute(level.map, hero, { x: s.door.tx + 0.5, y: s.door.ty + 0.3 });
      if (route) hero.path = route;
      events.push({ type: 'WalkTargetSet', x: s.door.tx + 0.5, y: s.door.ty + 1 });
      break;
    }
    case 'walkInto': {
      const route = planRoute(level.map, hero, { x: command.tx + 0.5, y: command.ty + 0.6 });
      if (route) hero.path = route;
      break;
    }
  }
}

function keepWalkingToHeld(state: GameState, held: { x: number; y: number }, dt: number): void {
  state.holdTimer -= dt;
  if (state.holdTimer > 0) return;
  state.holdTimer = HOLD_RETARGET_SECONDS;
  walkTo(currentLevel(state).level.map, state.hero, held, (i) => isPortalTile(state, i));
}

function isPortalTile(state: GameState, index: number): boolean {
  const { level } = currentLevel(state);
  return level.portals.some((p) => tileIndex(level.map, p.tx, p.ty) === index);
}

function enterPortalUnderHero(state: GameState, events: SimEvent[]): void {
  if (state.portalCooldown > 0) return;
  const { level } = currentLevel(state);
  const tx = Math.floor(state.hero.x);
  const ty = Math.floor(state.hero.y);
  const portal = level.portals.find((p) => p.tx === tx && p.ty === ty);
  if (!portal) return;
  const destination = state.levels[portal.to];
  if (!destination) return;
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
  hero.moving = false;
  state.portalCooldown = PORTAL_COOLDOWN_SECONDS;
  state.transition = null;
  events.push({ type: 'EnteredLevel', levelId: t.to });
}
