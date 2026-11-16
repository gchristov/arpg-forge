import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../core/math';
import { arena, OPEN_ROOM } from '../sim/testing';
import { currentLevel, type GameState, type Npc } from '../sim/state';
import { tapCommand, type TapView } from './tap-command';

/** A straight top-down view, 40 screen pixels a tile, with one building covering tiles 10–12 across and down. */
const PIXELS = 40;
const view: TapView = {
  zoom: 1,
  screenPosition: (x: number, y: number, _height: number, out: Vec2) => Object.assign(out, { x: x * PIXELS, y: y * PIXELS }),
  pick: (sx: number, sy: number) => {
    const ground = { x: sx / PIXELS, y: sy / PIXELS };
    if (ground.x >= 10 && ground.x < 13 && ground.y >= 10 && ground.y < 13) return { structure: 0 };
    return { ground };
  },
};

const tapTile = (state: GameState, x: number, y: number) => tapCommand(state, view, () => 1, x * PIXELS, y * PIXELS);

function room(): GameState {
  return arena(OPEN_ROOM, { x: 2.5, y: 2.5 }, [{ kind: 'dummy', x: 5.5, y: 5.5 }]);
}

describe('tapCommand', () => {
  it('attacks an enemy tapped near its body', () => {
    const state = room();
    const enemy = currentLevel(state).enemies[0]!;
    expect(tapTile(state, 5.9, 5.5)).toEqual({ type: 'attack', enemyId: enemy.id });
  });

  it('ignores enemies the hero can\'t see, and walks there instead', () => {
    const state = room();
    const enemy = currentLevel(state).enemies[0]!;
    expect(tapCommand(state, view, () => 1, 5.5 * PIXELS, 5.5 * PIXELS, (id) => id !== enemy.id)).toEqual({ type: 'walk', x: 5.5, y: 5.5 });
  });

  it('ignores dead enemies and walks there instead', () => {
    const state = room();
    currentLevel(state).enemies[0]!.dead = true;
    expect(tapTile(state, 5.5, 5.5)).toEqual({ type: 'walk', x: 5.5, y: 5.5 });
  });

  it('talks to an NPC tapped near its body', () => {
    const state = room();
    currentLevel(state).npcs.push({ ...state.hero, id: 99, kind: 'elder', name: 'Elder', x: 8.5, y: 2.5 } as Npc);
    expect(tapTile(state, 8.5, 2.7)).toEqual({ type: 'talk', npcId: 99 });
  });

  it('enters a building tapped', () => {
    expect(tapTile(room(), 11, 11)).toEqual({ type: 'enterStructure', index: 0 });
  });

  it('opens a chest tapped, but walks onto one already open', () => {
    const state = room();
    const chest = { tx: 15, ty: 3, gold: 10, healingItems: 0, opened: false };
    currentLevel(state).containers.push(chest);
    expect(tapTile(state, 15.5, 3.5)).toEqual({ type: 'open', index: 0 });
    chest.opened = true;
    expect(tapTile(state, 15.5, 3.5)).toEqual({ type: 'walk', x: 15.5, y: 3.5 });
  });

  it('reads something tapped near its body', () => {
    const state = room();
    currentLevel(state).readables.push({ tx: 15, ty: 6, id: 'notice' });
    expect(tapTile(state, 15.5, 6.7)).toEqual({ type: 'read', index: 0 });
  });

  it('walks into a portal tapped', () => {
    const state = room();
    currentLevel(state).level.portals.push({ tx: 17, ty: 9, to: 'home', stepOut: { x: 0, y: -1 } });
    expect(tapTile(state, 17.2, 9.8)).toEqual({ type: 'walkInto', tx: 17, ty: 9 });
  });

  it('enters a building tapped on the ground just in front of it, as by its door', () => {
    const state = room();
    currentLevel(state).level.structures.push({ kind: 'shed', name: 'Shed', x: 20, y: 2, width: 3, depth: 2, door: { tx: 21, ty: 3 } });
    expect(tapTile(state, 21.5, 4.6)).toEqual({ type: 'enterStructure', index: 0 });
    expect(tapTile(state, 21.5, 5.2)).toEqual({ type: 'walk', x: 21.5, y: 5.2 });
  });

  it('opens a chest or walks into a portal tapped beside its tile, not only on it', () => {
    const state = room();
    currentLevel(state).containers.push({ tx: 15, ty: 3, gold: 10, healingItems: 0, opened: false });
    currentLevel(state).level.portals.push({ tx: 17, ty: 9, to: 'home', stepOut: { x: 0, y: -1 } });
    expect(tapTile(state, 15.5, 4.2)).toEqual({ type: 'open', index: 0 });
    expect(tapTile(state, 17.3, 10.2)).toEqual({ type: 'walkInto', tx: 17, ty: 9 });
    expect(tapTile(state, 15.5, 5)).toEqual({ type: 'walk', x: 15.5, y: 5 });
  });

  it('walks to any other ground tapped', () => {
    expect(tapTile(room(), 3.25, 14.5)).toEqual({ type: 'walk', x: 3.25, y: 14.5 });
  });
});
