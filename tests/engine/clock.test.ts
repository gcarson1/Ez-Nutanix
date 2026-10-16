import { describe, it, expect } from 'vitest';
import { EARLY, advance, stepPause } from '../../src/ui/components/clock';

describe('clock steps', () => {
  it('waits just before the first step it reaches, then moves past it', () => {
    expect(advance(0, 0.5, [1, 2])).toEqual({ t: 0.5, stopped: false });
    expect(advance(0.9, 1.5, [2, 1])).toEqual({ t: 1 - EARLY, stopped: true });
    expect(advance(1 - EARLY, 0.5, [1, 2])).toEqual({ t: 1.5 - EARLY, stopped: false });
    expect(advance(1.5, 0.5, [1, 2])).toEqual({ t: 2 - EARLY, stopped: true });
  });
  it('pauses longer on longer loops, never more than a second', () => {
    expect(stepPause(3)).toBe(0.4);
    expect(stepPause(6)).toBeCloseTo(0.6);
    expect(stepPause(30)).toBe(1);
    expect(stepPause(Infinity)).toBe(1);
  });
});
