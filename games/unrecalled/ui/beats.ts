/** Waits `seconds`, for a scene's pauses. */
export const wait = (seconds: number) => new Promise<void>((done) => setTimeout(done, seconds * 1000));

/** Waits until `test` holds, checking each frame, for a scene's beat that waits on the game. */
export const until = (test: () => boolean) => new Promise<void>((done) => {
  const check = () => (test() ? done() : requestAnimationFrame(check));
  check();
});
