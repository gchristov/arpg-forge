/** Calls an action when one of its keys is pressed. Keys are `KeyboardEvent.key` values, such as "1" or " ". */
export function bindKeys(actions: Record<string, () => void>): void {
  addEventListener('keydown', (e) => {
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
}
