import { describe, expect, it } from 'vitest';
import { checkContent } from '../../engine/sim/content-checks';
import { MODEL_URLS, unrecalledLook } from './art/look';
import { dialogueFor, QUEST, READABLE_IDS, STEP } from './content/story';
import { unrecalledContent } from './content/world';

const content = unrecalledContent();

describe('Unrecalled content', () => {
  it('passes the engine content checks', () => {
    expect(checkContent(content)).toEqual([]);
  });

  it('words every quest step, everything there is to read, and everyone there is to talk to', () => {
    // Steps played as scenes show no objective.
    const scenes: number[] = [0, STEP.freed, STEP.ending];
    expect(QUEST.every((step, at) => step.text || scenes.includes(at))).toBe(true);
    const kinds = content.levels.flatMap((l) => l.npcs.map((n) => n.kind));
    expect(kinds.filter((kind) => !dialogueFor(kind, 0, 0, null))).toEqual([]);
    const ids = content.levels.flatMap((l) => (l.readables ?? []).map((r) => r.id));
    expect(ids.filter((id) => !READABLE_IDS.includes(id))).toEqual([]);
    expect(READABLE_IDS.filter((id) => !ids.includes(id))).toEqual([]);
  });

  it('puts a panel beside every door the story keeps locked, saying what opens it', () => {
    const unexplained = content.levels.flatMap((l) => l.level.portals
      .filter((p) => p.lockedUntilStep !== undefined)
      .filter((p) => !(l.readables ?? []).some((r) => Math.abs(r.tx - p.tx) <= 2 && Math.abs(r.ty - p.ty) <= 2))
      .map((p) => `${l.level.id} → ${p.to}`));
    expect(unexplained).toEqual([]);
  });

  it('gives every actor kind a model that was built', () => {
    const kinds = ['hero', ...Object.keys(content.enemies)];
    const missing = kinds.filter((kind) => {
      const model = unrecalledLook.actor(kind).model;
      const weapon = typeof model?.weapon === 'string' ? model.weapon : model?.weapon?.name;
      return !model || !MODEL_URLS[model.name] || (weapon !== undefined && !MODEL_URLS[weapon]);
    });
    expect(missing).toEqual([]);
  });

  it('draws the salvager holding every weapon they can come to hold, with a model that was built', () => {
    const armed = unrecalledLook.actor('hero').model?.armed ?? {};
    const missing = Object.keys(content.hero.weapons ?? {}).filter((id) => {
      const held = armed[id]?.weapon;
      const name = typeof held === 'string' ? held : held?.name;
      return !name || !MODEL_URLS[name];
    });
    expect(missing).toEqual([]);
  });
});
