/** Remembers what each part of a HUD shows, so the page is only touched when a value actually changes. */
export class ShownValues {
  private readonly shown = new Map<string, string | number | boolean>();

  set<T extends string | number | boolean>(key: string, value: T, apply: (value: T) => void): void {
    if (this.shown.get(key) === value) return;
    this.shown.set(key, value);
    apply(value);
  }
}
