import type { EnemyAbility } from '../../../engine/sim/abilities';
import { makeEnemy } from '../../../engine/sim/spawning';
import { isBlocked } from '../../../engine/world/collision';

export interface SummonSettings {
  /** It calls once, when its health first drops below this share. */
  belowHealthShare: number;
  /** The kind of enemy it calls. */
  kind: string;
  count: number;
  /** How far from it they appear, in a ring. */
  distance: number;
}

/** The Bone Lord calling the dead to its side, once, when it's badly hurt: they come straight for the hero. */
export const summon: EnemyAbility<SummonSettings> = {
  fight({ state, level, enemy, events, settings, memory }) {
    if (memory.summoned || enemy.hp >= enemy.maxHp * settings.belowHealthShare) return;
    memory.summoned = 1;
    const summonedIds: number[] = [];
    const body = state.rules.enemies[settings.kind]!;
    for (let k = 0; k < settings.count; k++) {
      const a = (k / settings.count) * Math.PI * 2;
      const x = enemy.x + Math.cos(a) * settings.distance;
      const y = enemy.y + Math.sin(a) * settings.distance;
      if (isBlocked(level.level.map, x, y, body.radius)) continue;
      const s = makeEnemy(state, settings.kind, x, y, level.enemyStrength);
      s.mode = 'chase';
      s.provoked = true;
      s.homeX = enemy.homeX;
      s.homeY = enemy.homeY + 2;
      level.enemies.push(s);
      summonedIds.push(s.id);
    }
    events.push({ type: 'Summoned', enemyId: enemy.id, summonedIds });
  },
  bringsIn: (settings) => [settings.kind],
};
