import type { Level } from '../world/level';
import { mapFromRows } from '../world/testing';
import type { EnemyType, GameContent, HeroRules, SpawnPoint } from './content';
import { createGameState } from './setup';
import type { Command, GameState, SimEvent } from './state';
import { step } from './step';

export const DT = 1 / 60;

export const TEST_HERO: HeroRules = {
  radius: 0.28, speed: 3.7, facingX: 1, facingY: 0,
  health: 100, resource: 50, damage: [8, 13], xpForLevel2: 60, healingItems: 3,
  resourceRegen: 2.2, healthRegen: 2, healthRegenDelay: 5,
  levelUp: { xpGrowth: 1.5, health: 12, resource: 6, damage: [2, 3] },
  melee: { cooldown: 0.55, swingSeconds: 0.3, reach: 1.35, engageRange: 1.0, critChance: 0.12, critMultiplier: 1.8, knockback: 0.18 },
  skills: [
    {
      type: 'projectile', id: 'bolt',
      cost: 12, cooldown: 0.6, speed: 9, lifetime: 1.1, radius: 1.5, damage: [22, 32], damagePerLevel: 3,
      critChance: 0.1, critMultiplier: 1.6, autoAimRange: 9,
    },
  ],
  heal: { amount: 60, maxItems: 9 },
  attackAssistRange: 7,
  deathGoldLoss: 0.5,
};

const base = { cooldown: 1, windUp: 0.3, groupSize: 3, radius: 0.3, drops: { gold: [3, 9] as [number, number], healingChance: 0 } };
export const TEST_ENEMIES: Record<string, EnemyType> = {
  brute: { ...base, hp: 30, damage: [4, 7], speed: 2.4, range: 0.85, aggro: 6, xp: 12 },
  worker: { ...base, hp: 30, damage: [4, 7], speed: 2.4, range: 0.85, aggro: 6, xp: 12, calm: true },
  dummy: { ...base, hp: 1000, damage: [1, 1], speed: 0, range: 0, aggro: 0, xp: 0 },
  shooter: { ...base, hp: 32, damage: [5, 9], speed: 1.7, range: 6.5, ranged: true, aggro: 8, xp: 22, windUp: 0.55 },
  lord: {
    ...base, hp: 400, damage: [12, 19], speed: 1.75, range: 1.15, aggro: 8, xp: 250, boss: true, radius: 0.46,
    slam: { everySeconds: [5, 7], reach: 6, radius: 1.7, delay: 1.0, damage: [16, 24] },
    summon: { belowHealthShare: 0.5, kind: 'brute', count: 3, distance: 1.6 },
  },
};

/** An open room with `#` walls, the hero at `start` and the given enemies, plus an empty start level to respawn in. */
export function arena(rows: string[], start: { x: number; y: number }, enemies: SpawnPoint[] = [], seed = 1): GameState {
  const level = (id: string, r: string[], s: { x: number; y: number }): Level => ({
    id, name: id, subtitle: '', outdoor: false, map: mapFromRows(r), start: s, portals: [], lights: [], structures: [],
  });
  const content: GameContent = {
    levels: [
      { level: level('home', ['....', '....'], { x: 1.5, y: 1.5 }), spawns: [], camps: [], npcs: [] },
      { level: level('arena', rows, start), spawns: enemies, camps: [], npcs: [] },
    ],
    startLevel: 'home',
    hero: TEST_HERO,
    enemies: TEST_ENEMIES,
    npcRadius: 0.32,
    npcs: {},
    quest: [{}],
  };
  return createGameState(content, seed, 'arena');
}

export const OPEN_ROOM = Array.from({ length: 20 }, () => '.'.repeat(20));

/** Runs the rules for a while, sending `commands` on the first step, and returns every event. */
export function run(state: GameState, seconds: number, commands: Command[] = []): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    events.push(...step(state, { commands: i === 0 ? commands : [], held: null }, DT));
  }
  return events;
}

export const ofType = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
