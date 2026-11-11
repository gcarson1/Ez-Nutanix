import { describe, expect, it } from 'vitest';
import { SPEC_EXAMPLE, specExample, specRounds } from '../../src/engine/ai-speed';

describe('speculative decoding rounds', () => {
  it('writes every token once, in order, with one large-model pass per round', () => {
    const rounds = specRounds(12, [4, 10], 3);
    expect(rounds.map((r) => r.from)).toEqual([0, 3, 5, 8, 11]);
    expect(rounds.reduce((a, r) => a + r.accepted + (r.corrected ? 1 : 0), 0)).toBe(12);
  });

  it('keeps guesses up to the first wrong one, corrects it and drops the rest', () => {
    expect(specRounds(12, [4, 10], 3)[1]).toEqual({ from: 3, guesses: 3, accepted: 1, corrected: true });
  });

  it('the example the page plays takes 5 passes for its 12 tokens, under the 2.5x Nutanix cites', () => {
    // speed.tsx has one row of timings per round and says "5 passes" and "12 tokens" from these numbers.
    expect(SPEC_EXAMPLE.tokens).toHaveLength(12);
    expect(specExample()).toHaveLength(5);
    expect(SPEC_EXAMPLE.tokens.length / specExample().length).toBeLessThanOrEqual(2.5);
  });

  it('with every guess wrong it is no better than the large model alone, and it always ends', () => {
    expect(specRounds(5, [0, 1, 2, 3, 4], 3)).toHaveLength(5);
    expect(specRounds(4, [], 0)).toHaveLength(4);
  });
});
