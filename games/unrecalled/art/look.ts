import { hash2, valueNoise } from '../../../engine/core/math';
import type { ActorLook, Look, Mood, PropLook } from '../../../engine/render/look';
import { Ground, Prop } from '../content/tiles';

/** Unrecalled's look: KayKit people and Quaternius machines under cold workshop light. */

const FOUNDRY: Mood = {
  background: 0x040507, ambient: 0x2a3440, ambientIntensity: 0.45, heroLightRadius: 4.6,
  fill: { sky: 0xa8d8ff, ground: 0x181410, intensity: 0.55 },
};

const tall = (name: string, height: number, turn: number | 'random' = 0): PropLook['model'] => ({
  names: [name], fit: { type: 'height', height }, turn,
});

const PROPS: Partial<Record<number, PropLook>> = {
  [Prop.Wall]: { shape: 'box', width: 1, height: 1.2, colour: 0x2e3238 },
  [Prop.WallLow]: { shape: 'box', width: 1, height: 0.35, colour: 0x2e3238 },
  [Prop.WallLight]: { shape: 'box', width: 1, height: 1.2, colour: 0x2e3238, emissive: 0x0a3040 },
  [Prop.Crate]: { shape: 'box', width: 0.8, height: 0.7, colour: 0x6a5a3a, model: tall('crate', 0.75, 'random') },
  [Prop.Barrel]: { shape: 'cylinder', width: 0.6, height: 0.8, colour: 0x8a3a2a, model: tall('barrel', 0.85, 'random') },
  [Prop.Locker]: { shape: 'box', width: 0.6, height: 1.3, colour: 0x4a5a6a, model: tall('locker', 1.3) },
  [Prop.Shelves]: { shape: 'box', width: 0.9, height: 1.3, colour: 0x4a4a4a, model: tall('shelves', 1.3, Math.PI / 2) },
  [Prop.Desk]: { shape: 'box', width: 0.9, height: 0.6, colour: 0x4a4a52, model: tall('desk', 0.65) },
  [Prop.Column]: { shape: 'cylinder', width: 0.6, height: 1.8, colour: 0x3a3e46, model: tall('column', 1.9) },
  [Prop.Computer]: { shape: 'box', width: 0.6, height: 0.9, colour: 0x2a3a4a, emissive: 0x0a4050, model: tall('computer', 0.95) },
};

const LIGHTS: Record<string, number> = { cyan: 0x6ad8ff, amber: 0xffa040 };

const robot = (
  name: string,
  height: number,
  animations: NonNullable<ActorLook['model']>['animations'],
  scale = 1,
  tint?: number,
): ActorLook => ({
  colour: 0x8a8a8a, height, radius: 0.3 * scale, scale,
  remains: { radius: 0.32 * scale, colour: 0x1a1c20, opacity: 0.8 },
  model: { name, animations, ...(tint === undefined ? {} : { tint }) },
});

const ACTORS: Record<string, ActorLook> = {
  hero: {
    colour: 0x9a8a70, height: 1.15, radius: 0.24,
    model: {
      name: 'hero',
      animations: { idle: 'Idle', move: 'Running_A', attack: '1H_Melee_Attack_Chop', cast: 'Spellcast_Shoot', hit: 'Hit_A', death: 'Death_A' },
    },
  },
  crawler: robot('crawler', 0.6, { idle: 'Idle', move: 'Run', attack: 'Attack', hit: 'Hit', death: 'TurnOff' }, 0.8),
  loader: robot('loader', 1.0, { idle: 'Idle', move: 'Walk', attack: 'Attack', hit: 'Hit', death: 'TurnOff' }, 1.3),
  sentry: robot('sentry', 1.0, { idle: 'Idle', attack: 'Attack', hit: 'Hit' }),
  orderEngine: robot('loader', 2.0, { idle: 'Idle', move: 'Walk', attack: 'Attack', cast: 'Attack', hit: 'Hit', death: 'TurnOff' }, 2.0, 0xffb070),
};

/** URLs of the built models, by name, for the model library to load. */
export const MODEL_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./models/*.glb', { query: '?url', import: 'default', eager: true })).map(
    ([path, url]) => [path.slice('./models/'.length, -'.glb'.length), url],
  ),
);

export const unrecalledLook: Look = {
  effects: {
    skill: 0x8ae8ff, shot: 0xffd070, telegraph: 0xff7a3a, items: { gold: 0xd8c070, healingItem: 0x50d070 },
    walkMarker: 0x9ad8e8, targetMarker: 0xff7a3a,
    skillLight: 0x6ad8ff, telegraphLight: 0xff7a3a, bossLight: 0xff9a50,
    smoke: 0x5a5e66,
    explosion: { flash: 0x8ae8ff, scorch: 0x10141a },
    slam: { flash: 0xffa050, scorch: 0x201008 },
  },
  mood: () => FOUNDRY,
  groundColour(kind, tx, ty) {
    const n = valueNoise(tx * 0.25, ty * 0.25);
    const h = hash2(tx, ty, 9);
    const checker = (tx + ty) % 2 === 0 ? 0.03 : 0;
    const l = kind === Ground.Grime ? 0.14 : 0.2;
    const v = Math.round(255 * (l + n * 0.05 + h * 0.02 + checker));
    return (v << 16) | (Math.round(v * 1.04) << 8) | Math.round(v * 1.12);
  },
  prop: (kind) => PROPS[kind] ?? null,
  structure: () => ({ wall: 0x3a3e46, roof: 0x2a2e36, wallHeight: 1.2, roofHeight: 0.6 }),
  lightColour: (name) => LIGHTS[name] ?? LIGHTS.cyan!,
  actor: (kind) => ACTORS[kind] ?? ACTORS.hero!,
};
