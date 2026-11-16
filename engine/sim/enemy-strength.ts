import type { Enemy, GameState } from './state';

/**
 * How much stronger every enemy is for the levels the hero has gained, so fights keep their bite as the hero grows:
 * 1 at level 1, then `enemyGrowthPerHeroLevel` more for each level after.
 */
export function heroLevelGrowth(state: GameState): number {
  return 1 + (state.rules.enemyGrowthPerHeroLevel ?? 0) * (state.hero.level - 1);
}

/** The strength an enemy of `kind` takes from where it stands. Bosses are tuned on their own and ignore it. */
export function areaStrength(state: GameState, kind: string, strength: number): number {
  return state.rules.enemies[kind]?.boss ? 1 : strength;
}

/** An enemy's health at full: its kind's, times its strength and the hero's level growth. */
export function enemyMaxHp(state: GameState, enemy: Pick<Enemy, 'kind' | 'strength'>): number {
  return Math.round(state.rules.enemies[enemy.kind]!.hp * enemy.strength * heroLevelGrowth(state));
}

/** A hit of `amount` from an enemy, scaled by its strength and the hero's level growth. */
export function enemyDamage(state: GameState, enemy: Pick<Enemy, 'strength'>, amount: number): number {
  return Math.round(amount * enemy.strength * heroLevelGrowth(state));
}

/** After the hero levels up, every enemy still standing grows to match, keeping the share of health it had left. */
export function regrowEnemies(state: GameState): void {
  for (const ls of Object.values(state.levels)) {
    for (const e of ls.enemies) {
      if (e.dead) continue;
      const maxHp = enemyMaxHp(state, e);
      e.hp = Math.max(1, Math.round((e.hp / e.maxHp) * maxHp));
      e.maxHp = maxHp;
    }
  }
}
