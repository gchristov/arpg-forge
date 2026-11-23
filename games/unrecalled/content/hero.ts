import type { AreaSkill, HeroRules } from '../../../engine/sim/content';
import type { BlastSettings } from '../extensions/blaster';
import type { CutSettings } from '../extensions/cutting';

/**
 * Hits every machine around U-7 at once, throws them back and knocks them down, and sends U-7 after one to finish it:
 * for when machines close in. U-7 gets it from its old charging station.
 */
export const EMP: AreaSkill = {
  type: 'area', id: 'emp',
  cost: 30, cooldown: 5, radius: 3, damage: [10, 16], damagePerLevel: 2, critChance: 0.1, critMultiplier: 1.5, knockback: 2,
  stun: 2.5, chaseStunned: true,
};

/**
 * U-7's numbers. It fights with its blaster, and Pell's chainsaw once it gets it back; the resource is charge, for
 * the blaster and the EMP, and healing items are patch kits.
 */
export const HERO: HeroRules = {
  radius: 0.28,
  speed: 3.7,
  facingX: 0.6,
  facingY: -0.8,
  health: 100,
  resource: 60,
  damage: [5, 9],
  xpForLevel2: 60,
  healingItems: 3,
  // Charge comes from tearing at downed machines' cores (the blaster's strikes); it only trickles back on its own, so
  // U-7 is never left with nothing at all.
  resourceRegen: 1,
  healthRegen: 2,
  healthRegenDelay: 5,
  levelUp: { xpGrowth: 1.5, health: 12, resource: 6, damage: [2, 3] },
  melee: {
    cooldown: 0.55, swingSeconds: 0.3, reach: 1.35, engageRange: 1.0,
    critChance: 0.12, critMultiplier: 1.8, knockback: 0.18,
  },
  startingWeapon: 'blaster',
  weapons: {
    // A beam held on a machine from up to 6 tiles, at the damage a second of shooting every 0.4 s at 1.4 times a swing,
    // and a dash in to finish one that's down. It walks into range itself, so it takes over from further out.
    blaster: {
      engageRange: 9, reach: 9,
      attack: {
        blast: {
          range: 6, power: 3.5, cost: 5, reportSeconds: 0.4,
          strike: { reach: 0.6, power: 2.5, seconds: 0.35, dash: 2, charge: 5, killCharge: 10 },
        } satisfies BlastSettings,
      },
    },
    // Keeps cutting for as long as it's in contact, at nearly four times the damage a second of punching.
    chainsaw: { attack: { cut: { tickSeconds: 0.1, power: 3.7 } satisfies CutSettings } },
  },
  skills: [{ ...EMP, fromStep: 'charged' }],
  heal: { amount: 60, maxItems: 9 },
  attackAssistRange: 7,
  deathGoldLoss: 0.5,
  // The Foundry is four floors deep; getting back up at the floor's entrance keeps a death from costing the walk down.
  respawnAt: 'sameLevel',
};
