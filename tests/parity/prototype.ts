import { readFileSync } from 'node:fs';

/**
 * Runs parts of the frozen prototype's code headless, so parity tests can compare the engine version with it.
 * Deleted together with the prototype.
 */
const source = readFileSync('prototypes/ashen-hollow.html', 'utf8');

function between(start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`prototype section not found: ${start}`);
  return source.slice(from, to);
}

interface PrototypeMap {
  w: number;
  h: number;
  ground: Uint8Array;
  obj: Uint8Array;
  solid: Uint8Array;
  meta: Map<number, unknown>;
  portals: Array<{ x: number; y: number; to: string }>;
  lights: Array<{ x: number; y: number; r: number; i: number; c: string; flick: number; seed: number }>;
  start: { x: number; y: number };
}

interface PrototypeInterior extends PrototypeMap {
  name: string;
  sub: string;
  enemies: Array<{ kind: string; x: number; y: number }>;
  npcs: Array<{ kind: string; name: string; x: number; y: number }>;
}

/** The four interiors as the prototype's boot builds them, with enemies and NPCs reduced to kind and position. */
export function prototypeInteriors(): Record<string, PrototypeInterior> {
  const code = [
    between('const clamp=', 'function resize'),
    between('// ---------- tiles ----------', '// ---------- town ----------'),
    between('// ---------- interiors ----------', '// ---------- actors ----------'),
    `return {
      tavern: buildInterior('tavern',{name:'The Sleeping Boar',sub:'Warm ale, cold stew',floor:G_WOOD,npc:{kind:'innkeeper',name:'Brann'}}),
      smithy: buildInterior('smithy',{name:'The Smithy',sub:'Hilde’s forge',floor:G_STONE,npc:{kind:'smith',name:'Hilde'}}),
      cottage: buildInterior('cottage',{name:'Maren’s Cottage',sub:'Someone left a chest unlocked',floor:G_WOOD}),
      crypt: buildInterior('crypt',{name:'The Old Crypt',sub:'The air smells of dust and grave-moss',floor:G_CRYPT}),
    };`,
  ].join('\n');
  const makeEnemy = (kind: string, x: number, y: number) => ({ kind, x, y });
  const makeNPC = (kind: string, name: string, x: number, y: number) => ({ kind, name, x, y });
  const interiors = new Function('makeEnemy', 'makeNPC', code)(makeEnemy, makeNPC) as Record<string, PrototypeInterior>;
  if (!source.includes("G.maps.crypt=buildInterior('crypt',{name:'The Old Crypt',sub:'The air smells of dust and grave-moss',floor:G_CRYPT")) {
    throw new Error('the prototype builds its interiors differently than this test assumes');
  }
  return interiors;
}

export function prototypeTown(): PrototypeMap {
  const code = [
    between('const clamp=', 'function resize'),
    between('// ---------- tiles ----------', '// ---------- interiors ----------'),
    'return genTown();',
  ].join('\n');
  const stubs = { makeEnemy: () => ({}), makeNPC: () => ({}) };
  return new Function('makeEnemy', 'makeNPC', code)(stubs.makeEnemy, stubs.makeNPC) as PrototypeMap;
}
