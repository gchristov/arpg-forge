import { describe, expect, it } from 'vitest';
import { cameraFromQuery } from './camera-angle';

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

  it('ignores an angle that is not a number', () => {
    expect(cameraFromQuery(game, new URLSearchParams('pitch=steep'))).toEqual(game);
  });
});
