/**
 * Tracks one primary pointer (finger or mouse) on an element. Taps are queued until read; while held, the
 * latest position is available so the game can keep re-targeting.
 */
export class PointerInput {
  private readonly taps: Array<{ x: number; y: number }> = [];
  private pointerId: number | null = null;
  private heldX = 0;
  private heldY = 0;

  constructor(element: HTMLElement) {
    element.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.pointerId = e.pointerId;
      this.heldX = e.clientX;
      this.heldY = e.clientY;
      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        // Capture can fail for synthetic events; holding still works without it.
      }
      this.taps.push({ x: e.clientX, y: e.clientY });
    });
    element.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.heldX = e.clientX;
      this.heldY = e.clientY;
    });
    const release = (e: PointerEvent): void => {
      if (e.pointerId === this.pointerId) this.pointerId = null;
    };
    element.addEventListener('pointerup', release);
    element.addEventListener('pointercancel', release);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Taps since the last call, oldest first. */
  takeTaps(): Array<{ x: number; y: number }> {
    return this.taps.splice(0);
  }

  /** The held pointer's screen position, or null when nothing is held. */
  held(): { x: number; y: number } | null {
    return this.pointerId === null ? null : { x: this.heldX, y: this.heldY };
  }
}
