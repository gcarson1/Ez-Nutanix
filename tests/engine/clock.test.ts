import { describe, it, expect } from 'vitest';
import { h } from 'preact';
import { RAMP, SECS_PER_WORD, paced, rateAt, readSecs, realLength, stepsFrom, words } from '../../src/ui/components/clock';
import { FLOW_SPEED, flowDots, pathLength } from '../../src/ui/components/show';

describe('reading time', () => {
  it('counts words in strings, parts and elements', () => {
    expect(words('Node 2 loses power.')).toBe(4);
    expect(words(['A node fails', 'N2 goes down.'])).toBe(6);
    expect(words(h('p', null, 'One ', h('b', null, 'two'), ' three · four'))).toBe(4);
    expect(words(['', null, undefined, false])).toBe(0);
    expect(readSecs('one two three')).toBeCloseTo(3 * SECS_PER_WORD);
  });
  it('merges a step whose caption repeats the one before', () => {
    expect(paced([0, 2, 4, 6], ['a b', 'a  b', 'c', 'a b'])).toEqual([
      { at: 0, read: 2 * SECS_PER_WORD },
      { at: 4, read: SECS_PER_WORD },
      { at: 6, read: 2 * SECS_PER_WORD },
    ]);
  });
  it('finds steps where a caption heading changes over time', () => {
    const cap = (t: number) => (t < 3.3 ? { k: 'First', text: 'one two' } : { k: 'Second', text: 'three' });
    const s = stepsFrom(10, cap);
    expect(s).toHaveLength(2);
    expect(s[0]).toEqual({ at: 0, read: 3 * SECS_PER_WORD });
    expect(s[1].at).toBeCloseTo(3.3, 3);
    expect(s[1].read).toBeCloseTo(2 * SECS_PER_WORD);
  });
});

describe('playback speed', () => {
  const steps = [
    { at: 0, read: 1 }, // 4 s of sim, quick to read: full speed
    { at: 4, read: 8 }, // 2 s of sim, 8 s to read: a quarter speed
    { at: 6, read: 0 },
  ];
  it('plays at full speed where there is time to read', () => {
    expect(rateAt(1, 1, steps, 12)).toBe(1);
    expect(rateAt(11, 1, steps, 12)).toBe(1);
  });
  it('slows a step down so its caption can be read', () => {
    expect(rateAt(5, 1, steps, 12)).toBeCloseTo(0.25);
    expect(realLength(1, steps, 12, 4, 6)).toBeGreaterThanOrEqual(8 - 1e-6);
  });
  it('never stops, and eases into and out of the slower speed', () => {
    let prev = rateAt(0, 1, steps, 12);
    for (let t = 0; t <= 12; t += 0.01) {
      const r = rateAt(t, 1, steps, 12);
      expect(r).toBeGreaterThan(0);
      // continuous: no jumps between neighbouring frames
      expect(Math.abs(r - prev)).toBeLessThan(0.02);
      prev = r;
    }
    // the slowdown starts before the slow step and ends after it
    expect(rateAt(4 - RAMP / 2, 1, steps, 12)).toBeLessThan(1);
    expect(rateAt(6 + RAMP / 2, 1, steps, 12)).toBeLessThan(1);
    expect(rateAt(4 - RAMP - 0.01, 1, steps, 12)).toBe(1);
  });
  it('gives every step at least its reading time', () => {
    const many = [
      { at: 0, read: 3 },
      { at: 1, read: 6 },
      { at: 1.5, read: 2 },
      { at: 5, read: 9 },
    ];
    const ends = [1, 1.5, 5, 9];
    many.forEach((s, i) => expect(realLength(1.5, many, 9, s.at, ends[i])).toBeGreaterThanOrEqual(s.read - 1e-3));
  });
  it('scales with the full speed', () => {
    const fast = [{ at: 0, read: 10 }];
    expect(rateAt(50, 24, fast, 100)).toBeCloseTo(10);
    expect(realLength(24, fast, 100)).toBeCloseTo(10, 1);
  });
});

describe('looping dots', () => {
  it('move at the same speed on short and long links', () => {
    for (const len of [80, 300, 900]) {
      const [a] = flowDots(1, len, 1);
      const [b] = flowDots(1.1, len, 1);
      expect(((b - a + 1) % 1) * len).toBeCloseTo(0.1 * FLOW_SPEED, 6);
    }
  });
  it('are evenly spaced, with more of them on longer links', () => {
    const d = flowDots(0.37, 600);
    expect(d).toHaveLength(4);
    d.forEach((f) => expect(f).toBeGreaterThanOrEqual(0));
    d.forEach((f) => expect(f).toBeLessThan(1));
    expect(flowDots(0, 60)).toHaveLength(1);
  });
  it('measures a path', () => {
    expect(pathLength((p) => ({ x: 300 * p, y: 400 * p }))).toBeCloseTo(500);
  });
});
