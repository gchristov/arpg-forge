import type { CameraLook } from './look';

/** 30° above the ground with no perspective: the classic 2:1 isometric look, a tile twice as wide as it is tall on screen. */
export const ISOMETRIC_CAMERA: CameraLook = { pitch: 30 };

/** How far above the ground the camera looks down, in radians. */
export function elevationOf(camera: CameraLook): number {
  return (camera.pitch * Math.PI) / 180;
}

/**
 * A game's camera, with `?pitch=N`, `?fov=N` and `?closeness=N` trying others while tuning it; `fov` and `closeness`
 * apply whichever way the screen is held, so they can be tried on a phone held either way.
 */
export function cameraFromQuery(camera: CameraLook, params: URLSearchParams): CameraLook {
  const fieldOfView = numberFrom(params, 'fov', 0, 60);
  const closeness = numberFrom(params, 'closeness', 0.5, 8);
  const portrait = camera.portrait && {
    closeness: closeness ?? camera.portrait.closeness,
    fieldOfView: fieldOfView ?? camera.portrait.fieldOfView,
  };
  return {
    pitch: numberFrom(params, 'pitch', 20, 80) ?? camera.pitch,
    fieldOfView: fieldOfView ?? camera.fieldOfView,
    closeness: closeness ?? camera.closeness,
    ...(portrait && { portrait }),
  };
}

/** How close the camera stands and its field of view on a screen of this size: its portrait ones when it's upright. */
export function framing(camera: CameraLook, width: number, height: number): { closeness: number; fieldOfView: number } {
  const upright = height > width ? camera.portrait : undefined;
  return {
    closeness: upright?.closeness ?? camera.closeness ?? 1,
    fieldOfView: upright?.fieldOfView ?? camera.fieldOfView ?? 0,
  };
}

function numberFrom(params: URLSearchParams, name: string, min: number, max: number): number | null {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
}
