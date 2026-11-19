import { useAbilities } from './abilities';
import { useStepActions } from './step-actions';
import { useWeaponAttacks } from './weapon-attacks';
import { createRng } from '../core/rng';
import type { GameContent, HeroRules } from './content';
import { spawnCamp, spawnEnemy } from './spawning';
import type { GameState, Hero, LevelState } from './state';
import { castForStep } from './story-cast';

/**
 * A new game from the game's content: every level populated, the hero at the start of `startLevel` (by default
 * the game's own start level).
 */
export function createGameState(content: GameContent, seed: number, startLevel = content.startLevel): GameState {
  useAbilities(content.abilities);
  useStepActions(content.stepActions);
  useWeaponAttacks(content.weaponAttacks);
  const state: GameState = {
    rng: createRng(seed),
    time: 0,
    nextId: 1,
    rules: {
      hero: content.hero, enemies: content.enemies, npcRadius: content.npcRadius, npcs: content.npcs, quest: content.quest,
      ...(content.enemyGrowthPerHeroLevel === undefined ? {} : { enemyGrowthPerHeroLevel: content.enemyGrowthPerHeroLevel }),
      watch: content.watch ?? [],
    },
    quest: 0,
    flags: {},
    near: [],
    inLockedDoor: null,
    levels: {},
    levelId: startLevel,
    startLevelId: content.startLevel,
    hero: newHero(content.hero),
    projectiles: [],
    telegraphs: [],
    holdTimer: 0,
    portalCooldown: 0,
    transition: null,
  };
  for (const lc of content.levels) {
    const ls: LevelState = {
      level: lc.level, enemies: [], npcs: [], npcPlacements: lc.npcs, camps: lc.camps, items: [],
      containers: (lc.containers ?? []).map((c) => ({ ...c, opened: false })),
      readables: [], readablePlacements: lc.readables ?? [],
      storySpawns: lc.spawns.filter((s) => s.fromStep),
      memory: {},
      ...(lc.campRespawns ? { campRespawns: lc.campRespawns } : {}),
      campTimer: lc.campRespawns?.everySeconds ?? 0,
      enemyStrength: lc.enemyStrength ?? 1,
    };
    for (const s of lc.spawns) if (!s.fromStep) spawnEnemy(state, ls, s);
    for (const camp of lc.camps) spawnCamp(state, ls, camp.kind, camp);
    state.levels[lc.level.id] = ls;
  }
  castForStep(state);
  const start = state.levels[startLevel]?.level.start;
  if (!start) throw new Error(`unknown level: ${startLevel}`);
  placeAt(state.hero, start.x, start.y);
  return state;
}

function newHero(rules: HeroRules): Hero {
  return {
    id: 0, kind: 'hero', x: 0, y: 0, prevX: 0, prevY: 0, r: rules.radius,
    facingX: rules.facingX, facingY: rules.facingY, moving: false, path: null,
    speed: rules.speed,
    hp: rules.health, maxHp: rules.health, resource: rules.resource, maxResource: rules.resource,
    level: 1, xp: 0, xpNext: rules.xpForLevel2, gold: 0, healingItems: rules.healingItems,
    damage: [...rules.damage], bonusDamage: 0,
    attackCooldown: 0, skillCooldowns: rules.skills.map(() => 0), swing: -1, struck: true, engagedId: null, attackMemory: {}, weapon: null,
    lastHurtAt: -Infinity, dead: false, targetId: null, repathTimer: 0,
    interact: null, meleeUpgrades: 0,
  };
}

export function placeAt(actor: { x: number; y: number; prevX: number; prevY: number }, x: number, y: number): void {
  actor.x = actor.prevX = x;
  actor.y = actor.prevY = y;
}
