import type { CameraLook } from './look';

/** 30° above the ground with no perspective: the classic 2:1 isometric look, a tile twice as wide as it is tall on screen. */
export const ISOMETRIC_CAMERA: CameraLook = { pitch: 30 };

/** How far above the ground the camera looks down, in radians. */
export function elevationOf(camera: CameraLook): number {
  return (camera.pitch * Math.PI) / 180;
}

/** A game's camera, with `?pitch=N`, `?fov=N` and `?closeness=N` trying others while tuning it. */
export function cameraFromQuery(camera: CameraLook, params: URLSearchParams): CameraLook {
  return {
    pitch: numberFrom(params, 'pitch', 20, 80) ?? camera.pitch,
    fieldOfView: numberFrom(params, 'fov', 0, 60) ?? camera.fieldOfView,
    closeness: numberFrom(params, 'closeness', 0.5, 8) ?? camera.closeness,
  };
}

function numberFrom(params: URLSearchParams, name: string, min: number, max: number): number | null {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : null;
}
