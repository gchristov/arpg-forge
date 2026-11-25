import type { AreaSkill, HeroRules, ProjectileSkill } from '../../../engine/sim/content';
import type { BlastSettings } from '../extensions/blaster';
import type { CutSettings } from '../extensions/cutting';

/**
 * Hits every machine around U-7 at once, throws them back and knocks them down, for U-7's blaster to finish them:
 * for when machines close in. Expensive, so it's earned by holding the beam. U-7 gets it from its old charging station.
 */
export const EMP: AreaSkill = {
  type: 'area', id: 'emp',
  // Only charge holds it back: the short cooldown just stops a double tap from spending twice.
  cost: 50, cooldown: 0.5, radius: 3.5, damage: [18, 26], damagePerLevel: 3, critChance: 0.1, critMultiplier: 1.5, knockback: 2,
  stun: 3,
};

/** A bolt of charge the blaster fires straight ahead when there's no machine near to hold its beam on. */
export const BOLT: ProjectileSkill = {
  type: 'projectile', id: 'bolt',
  cost: 0, cooldown: 0.35, speed: 13, lifetime: 0.75, autoAimRange: 0,
  radius: 0.7, damage: [8, 12], damagePerLevel: 1, critChance: 0.1, critMultiplier: 1.5,
};

/**
 * U-7's numbers. It fights with its blaster, and Pell's chainsaw too once it has it, swapping between them; the
 * resource is charge, for the EMP, and healing items are patch kits.
 */
/** What U-7's weapons are called, and what attacking with each is called, on the HUD and over a dropped one. */
export const WEAPON_NAMES: Record<string, { name: string; attack: string }> = {
  blaster: { name: 'Blaster', attack: 'Blast' },
  chainsaw: { name: 'Chainsaw', attack: 'Cut' },
};

export const HERO: HeroRules = {
  radius: 0.28,
  speed: 3.7,
  facingX: 0.6,
  facingY: -0.8,
  health: 100,
  resource: 100,
  damage: [5, 9],
  xpForLevel2: 60,
  healingItems: 3,
  // Holding the blaster's beam on a machine siphons charge out of it; on its own charge only trickles back.
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
    // A beam held on a machine from up to 4.5 tiles that builds charge as it burns, a dash in to finish one that's down,
    // and a free bolt straight ahead with nothing near. It walks into range itself, so it takes over from further out.
    blaster: {
      engageRange: 9, reach: 9,
      attack: {
        blast: {
          range: 4.5, power: 3.5, charge: 5, reportSeconds: 0.4, shot: 'bolt',
          // Left, right, a beat, then a one-armed blast into the core that knocks the machine back.
          strike: {
            reach: 0.6, dash: 2,
            combo: [{ power: 1.8, seconds: 0.12 }, { power: 1.8, seconds: 0.5 }, { power: 4.5, seconds: 0.5, knockback: 1.2 }],
          },
        } satisfies BlastSettings,
      },
    },
    // Keeps cutting for as long as it's in contact, at nearly four times the damage a second of punching, building
    // charge more slowly than the beam, and tearing twice as hard into a machine the EMP has knocked down.
    chainsaw: { attack: { cut: { tickSeconds: 0.1, power: 3.7, charge: 3, downedPower: 2 } satisfies CutSettings } },
  },
  // The EMP first: the HUD's button is for slot 0.
  skills: [{ ...EMP, fromStep: 'charged' }, BOLT],
  heal: { amount: 60, maxItems: 9 },
  attackAssistRange: 7,
  deathGoldLoss: 0.5,
  // The Foundry is four floors deep; getting back up at the floor's entrance keeps a death from costing the walk down.
  respawnAt: 'sameLevel',
};
