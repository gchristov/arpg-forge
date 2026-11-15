import type { HeroRules } from '../../../engine/sim/content';

/** The salvager's numbers. The resource is charge, healing items are patch kits, and the skills are an arc bolt and an EMP. */
export const HERO: HeroRules = {
  radius: 0.28,
  speed: 3.7,
  facingX: 0.6,
  facingY: -0.8,
  health: 100,
  resource: 50,
  damage: [8, 13],
  xpForLevel2: 60,
  healingItems: 3,
  resourceRegen: 2.2,
  healthRegen: 2,
  healthRegenDelay: 5,
  levelUp: { xpGrowth: 1.5, health: 12, resource: 6, damage: [2, 3] },
  melee: {
    cooldown: 0.55, swingSeconds: 0.3, reach: 1.35, engageRange: 1.0,
    critChance: 0.12, critMultiplier: 1.8, knockback: 0.18,
  },
  skills: [
    {
      type: 'projectile', id: 'arc-bolt',
      cost: 12, cooldown: 0.6, speed: 10, lifetime: 1.0, radius: 1.5, damage: [22, 32], damagePerLevel: 3,
      critChance: 0.1, critMultiplier: 1.6, autoAimRange: 9,
    },
    // Hits every machine around the salvager at once, for when a floor's alarm brings a crowd.
    {
      type: 'area', id: 'emp',
      cost: 20, cooldown: 7, radius: 2.6, damage: [16, 24], damagePerLevel: 3, critChance: 0.1, critMultiplier: 1.5, knockback: 0.7,
    },
  ],
  heal: { amount: 60, maxItems: 9 },
  attackAssistRange: 7,
  deathGoldLoss: 0.5,
  // The Foundry is four floors deep; getting back up at the floor's entrance keeps a death from costing the walk down.
  respawnAt: 'sameLevel',
};
