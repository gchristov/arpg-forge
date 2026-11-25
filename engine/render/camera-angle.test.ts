import { describe, expect, it } from 'vitest';
import { cameraFromQuery, framing } from './camera-angle';

describe('cameraFromQuery', () => {
  const game = { pitch: 40, fieldOfView: 20 };

  it("keeps the game's camera when the address names no angle", () => {
    expect(cameraFromQuery(game, new URLSearchParams(''))).toEqual(game);
  });

  it('tries the angles the address names, within reason', () => {
    expect(cameraFromQuery(game, new URLSearchParams('pitch=55&fov=0'))).toEqual({ pitch: 55, fieldOfView: 0 });
    expect(cameraFromQuery(game, new URLSearchParams('pitch=120&fov=-5'))).toEqual({ pitch: 80, fieldOfView: 0 });
  });

  it('comes as close as eight times, for looking at a character up close', () => {
    expect(cameraFromQuery(game, new URLSearchParams('closeness=6')).closeness).toBe(6);
    expect(cameraFromQuery(game, new URLSearchParams('closeness=20')).closeness).toBe(8);
  });

  it('tries a closeness and field of view whichever way the screen is held', () => {
    const upright = { ...game, closeness: 2, portrait: { closeness: 1.2 } };
    const tried = cameraFromQuery(upright, new URLSearchParams('closeness=3&fov=25'));
    expect(framing(tried, 400, 800)).toEqual({ closeness: 3, fieldOfView: 25 });
    expect(framing(tried, 800, 400)).toEqual({ closeness: 3, fieldOfView: 25 });
  });

  it('ignores an angle that is not a number', () => {
    expect(cameraFromQuery(game, new URLSearchParams('pitch=steep'))).toEqual(game);
  });
});

describe('framing', () => {
  const camera = { pitch: 50, fieldOfView: 32, closeness: 2.2, portrait: { closeness: 1.4 } };

  it('uses the portrait closeness on a screen taller than it is wide, keeping the field of view not given for it', () => {
    expect(framing(camera, 390, 844)).toEqual({ closeness: 1.4, fieldOfView: 32 });
  });

  it('uses the usual camera on a wide or square screen', () => {
    expect(framing(camera, 844, 390)).toEqual({ closeness: 2.2, fieldOfView: 32 });
    expect(framing(camera, 800, 800)).toEqual({ closeness: 2.2, fieldOfView: 32 });
  });

  it('uses the usual camera upright too when the game gives no portrait one', () => {
    expect(framing({ pitch: 30 }, 390, 844)).toEqual({ closeness: 1, fieldOfView: 0 });
  });
});
