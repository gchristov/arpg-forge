import { describe, expect, it } from 'vitest';
import { scanStrength } from './scan-beams';

describe('scanStrength', () => {
  it('rises from nothing at the start of a scan, holds, and dies away by its end', () => {
    expect(scanStrength(0)).toBe(0);
    expect(scanStrength(0.1)).toBeCloseTo(0.5);
    expect(scanStrength(0.5)).toBe(1);
    expect(scanStrength(0.9)).toBeCloseTo(0.4);
    expect(scanStrength(1)).toBe(0);
  });
});
