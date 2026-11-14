import { describe, expect, it } from 'vitest';
import { Prop } from '../../games/ashen-hollow/content/tiles';
import { generateVillage } from '../../games/ashen-hollow/levels/village';
import { prototypeTown } from './prototype';

describe('village parity with the prototype', () => {
  const proto = prototypeTown();
  const { level } = generateVillage();
  const { map } = level;

  it('has the same size and start', () => {
    expect([map.width, map.height]).toEqual([proto.w, proto.h]);
    expect(level.start).toEqual(proto.start);
  });

  it('matches the ground, props and solid tiles exactly', () => {
    const protoProps = Array.from(proto.obj, (o, i) =>
      o === Prop.Tree && proto.meta.get(i) === 'dead' ? Prop.DeadTree : o,
    );
    expect(Array.from(map.ground)).toEqual(Array.from(proto.ground));
    expect(Array.from(map.prop)).toEqual(protoProps);
    expect(Array.from(map.solid)).toEqual(Array.from(proto.solid));
  });

  it('has the same portals', () => {
    expect(level.portals.map(({ tx, ty, to }) => ({ tx, ty, to }))).toEqual(proto.portals.map((p) => ({ tx: p.x, ty: p.y, to: p.to })));
  });

  it('has the same lights', () => {
    expect(level.lights).toEqual(
      proto.lights.map((l) => ({
        x: l.x, y: l.y, radius: l.r, intensity: l.i, colour: l.c, flicker: l.flick, seed: l.seed,
      })),
    );
  });
});
