import { describe, expect, it } from 'vitest';
import { Prop } from '../../games/ashen-hollow/content/tiles';
import { buildInterior, INTERIOR_IDS } from '../../games/ashen-hollow/levels/interiors';
import { prototypeInteriors } from './prototype';

describe('interior parity with the prototype', () => {
  const proto = prototypeInteriors();

  for (const id of INTERIOR_IDS) {
    describe(id, () => {
      const p = proto[id]!;
      const { level, spawns, npcs } = buildInterior(id);
      const { map } = level;

      it('has the same size, start, name and subtitle', () => {
        expect([map.width, map.height]).toEqual([p.w, p.h]);
        expect(level.start).toEqual(p.start);
        expect([level.name, level.subtitle]).toEqual([p.name, p.sub]);
      });

      it('matches the floor, props and solid tiles exactly', () => {
        const protoProps = Array.from(p.obj, (o, i) => (o === Prop.Wall && p.meta.get(i) === 'torch' ? Prop.WallTorch : o));
        const props = Array.from(map.prop, (o) => (o === Prop.WallLow ? Prop.Wall : o));
        expect(Array.from(map.ground)).toEqual(Array.from(p.ground));
        expect(props).toEqual(protoProps);
        expect(Array.from(map.solid)).toEqual(Array.from(p.solid));
      });

      it('has the same exit, lights, enemies and NPCs', () => {
        expect(level.portals.map(({ tx, ty, to }) => ({ tx, ty, to }))).toEqual(p.portals.map((q) => ({ tx: q.x, ty: q.y, to: q.to })));
        expect(level.lights).toEqual(
          p.lights.map((l) => ({ x: l.x, y: l.y, radius: l.r, intensity: l.i, colour: l.c, flicker: l.flick, seed: l.seed })),
        );
        expect(spawns).toEqual(p.enemies);
        expect(npcs).toEqual(p.npcs);
      });
    });
  }
});
