/** The most pixels drawn per screen point: past this, extra sharpness costs more battery than it's worth. */
const MAX_PIXEL_RATIO = 1.5;

/** How many pixels to draw per screen point on a screen of `devicePixelRatio`: as many as it has, up to the cap. */
export function drawnPixelRatio(devicePixelRatio: number): number {
  return Math.min(MAX_PIXEL_RATIO, devicePixelRatio);
}
