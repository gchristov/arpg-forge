import type { AreaSkill, HeroRules } from '../../../engine/sim/content';
import type { BlastSettings } from '../extensions/blaster';
import type { CutSettings } from '../extensions/cutting';

/**
 * Hits every machine around U-7 at once and throws them back, for when a floor's alarm brings a crowd. The
 * U-7 gets it from its old charging station.
 */
export const EMP: AreaSkill = {
  type: 'area', id: 'emp',
  cost: 20, cooldown: 12, radius: 2.6, damage: [16, 24], damagePerLevel: 3, critChance: 0.1, critMultiplier: 1.5, knockback: 1.6,
  stun: 3, chaseStunned: true,
};

/** Both palms at once: throws the machines in front of U-7 back and knocks them down, for when they close in. */
export const REPEL: AreaSkill = {
  type: 'area', id: 'repel', arc: 55,
  cost: 15, cooldown: 3, radius: 3, damage: [4, 7], damagePerLevel: 1, critChance: 0.05, critMultiplier: 1.5, knockback: 2.2,
  stun: 2.5, chaseStunned: true,
};

/**
 * U-7's numbers. It fights with its hands until it gets Pell's chainsaw back; the resource is charge,
 * for the EMP once they have it, and healing items are patch kits.
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
  // Charge refills on its own for now; draining beaten machines' cores comes later.
  resourceRegen: 6,
  healthRegen: 2,
  healthRegenDelay: 5,
  levelUp: { xpGrowth: 1.5, health: 12, resource: 6, damage: [2, 3] },
  melee: {
    cooldown: 0.55, swingSeconds: 0.3, reach: 1.35, engageRange: 1.0,
    critChance: 0.12, critMultiplier: 1.8, knockback: 0.18,
  },
  startingWeapon: 'blaster',
  weapons: {
    // Shoots from out of a machine's reach, punches one that gets within 2 tiles back out to shooting distance, and
    // dashes in to finish one that's down; holding still while it strikes, so the strikes land one after another. It walks into range itself, so it takes over from further out than it shoots.
    blaster: {
      engageRange: 9, reach: 9,
      attack: {
        blast: {
          range: 6, shotSeconds: 0.4, cost: 2, power: 1.4, knockback: 0.08,
          punch: { within: 2, reach: 0.6, power: 0.5, knockback: 3, seconds: 0.55 },
          strike: { reach: 0.6, power: 2.5, knockback: 0, seconds: 0.35, dash: 2 },
        } satisfies BlastSettings,
      },
    },
    // Keeps cutting for as long as it's in contact, at nearly four times the damage a second of punching.
    chainsaw: { attack: { cut: { tickSeconds: 0.1, power: 3.7 } satisfies CutSettings } },
  },
  skills: [{ ...EMP, fromStep: 'charged' }, REPEL],
  heal: { amount: 60, maxItems: 9 },
  attackAssistRange: 7,
  deathGoldLoss: 0.5,
  // The Foundry is four floors deep; getting back up at the floor's entrance keeps a death from costing the walk down.
  respawnAt: 'sameLevel',
};
