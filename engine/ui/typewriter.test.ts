import { describe, expect, it } from 'vitest';
import { charactersTyped, typingSeconds, type TypingPace } from './typewriter';

const pace: TypingPace = { charactersPerSecond: 10, sentencePause: 1, clausePause: 0.5 };

describe('typing text out', () => {
  it('types at its pace, resting after a sentence or clause ends', () => {
    expect(charactersTyped('abc', 0, pace)).toBe(0);
    expect(charactersTyped('abc', 0.21, pace)).toBe(2);
    // "Hi. Yo": 'H','i','.' by 0.3s, then a 1s rest before the space.
    expect(charactersTyped('Hi. Yo', 0.35, pace)).toBe(3);
    expect(charactersTyped('Hi. Yo', 1.45, pace)).toBe(4);
    expect(charactersTyped('a, b', 0.75, pace)).toBe(2);
  });

  it('rests once after a run of stops', () => {
    expect(typingSeconds('Hm…?! x', pace)).toBeCloseTo(0.7 + 1);
  });

  it('is all out once its typing time has passed, and never before', () => {
    const text = 'Feeling better? I found you by the river, half under.';
    const seconds = typingSeconds(text, pace);
    expect(charactersTyped(text, seconds + 0.001, pace)).toBe(text.length);
    expect(charactersTyped(text, seconds - 0.05, pace)).toBeLessThan(text.length);
  });

  it('waits its lead before the first character', () => {
    const waits: TypingPace = { ...pace, lead: 1 };
    expect(charactersTyped('abc', 0.95, waits)).toBe(0);
    expect(charactersTyped('abc', 1.15, waits)).toBe(1);
    expect(typingSeconds('abc', waits)).toBeCloseTo(1.3);
  });
});
