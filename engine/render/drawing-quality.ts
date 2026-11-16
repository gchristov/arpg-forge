/** The most pixels drawn per screen point: past this, extra sharpness costs more battery than it's worth. */
export const MAX_PIXEL_RATIO = 1.5;

/**
 * How finely to draw on a screen of `devicePixelRatio`: as many pixels per point as it has, up to the cap, and
 * antialiasing only below the cap, where pixels are big enough for jagged edges to show.
 */
export function drawingQuality(devicePixelRatio: number): { pixelRatio: number; antialias: boolean } {
  const pixelRatio = Math.min(MAX_PIXEL_RATIO, devicePixelRatio);
  return { pixelRatio, antialias: pixelRatio < MAX_PIXEL_RATIO };
}
