import { describe, expect, it } from 'vitest';
import { LineQueue } from './line-queue';

const queue = () => new LineQueue<string>((line) => line.length);

describe('LineQueue', () => {
  it('shows one line at a time, each for its own time, in the order they came', () => {
    const q = queue();
    q.push('abc');
    q.push('de');
    expect(q.tick(0)).toEqual({ retired: null, shown: 'abc' });
    expect(q.tick(2.5)).toEqual({ retired: null, shown: null });
    expect(q.tick(1)).toEqual({ retired: 'abc', shown: 'de' });
    expect(q.tick(2)).toEqual({ retired: 'de', shown: null });
    expect(q.showing).toBeNull();
  });

  it('shows nothing while held, and shows a line cut short again in full afterwards', () => {
    const q = queue();
    q.push('abcd');
    q.push('ef');
    q.tick(0);
    q.tick(3);
    expect(q.hold(true)).toBe('abcd');
    expect(q.tick(10)).toEqual({ retired: null, shown: null });
    q.hold(false);
    expect(q.tick(0)).toEqual({ retired: null, shown: 'abcd' });
    expect(q.tick(3)).toEqual({ retired: null, shown: null });
    expect(q.tick(1)).toEqual({ retired: 'abcd', shown: 'ef' });
  });

  it('keeps lines that arrive while held for afterwards', () => {
    const q = queue();
    q.hold(true);
    q.push('a');
    expect(q.tick(1)).toEqual({ retired: null, shown: null });
    q.hold(false);
    expect(q.tick(0).shown).toBe('a');
  });

  it('lets a line go when held once it has been up long enough to read, rather than showing it again', () => {
    const q = new LineQueue<string>((line) => line.length, () => 2);
    q.push('abcd');
    q.push('ef');
    q.tick(0);
    q.tick(2.5);
    expect(q.hold(true)).toBe('abcd');
    q.hold(false);
    expect(q.tick(0).shown).toBe('ef');
  });
});
