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

export function prototypeTown(): PrototypeMap {
  const code = [
    between('const clamp=', 'function resize'),
    between('// ---------- tiles ----------', '// ---------- interiors ----------'),
    'return genTown();',
  ].join('\n');
  const stubs = { makeEnemy: () => ({}), makeNPC: () => ({}) };
  return new Function('makeEnemy', 'makeNPC', code)(stubs.makeEnemy, stubs.makeNPC) as PrototypeMap;
}
