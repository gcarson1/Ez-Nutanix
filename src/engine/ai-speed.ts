// Enterprise AI: speculative decoding as a schedule. A small draft model guesses the next few
// tokens and the large model checks them in one pass. Pure; the picture is in
// src/ui/modules/ai/speed.tsx.

export interface SpecRound {
  /** Index of the first token this round works on. */
  from: number;
  /** How many tokens the draft model guessed. */
  guesses: number;
  /** How many of them the large model kept, counted from the first. */
  accepted: number;
  /** True when a guess was wrong: the large model wrote that token itself, and later guesses were dropped. */
  corrected: boolean;
}

/** The example the page plays: twelve tokens, a draft model that guesses three ahead and is wrong twice. */
export const SPEC_EXAMPLE = {
  tokens: ['Each', 'block', 'is', 'kept', 'on', 'two', 'different', 'nodes', 'so', 'one', 'can', 'fail.'],
  /** What the draft model guessed where it was wrong, by token index. */
  wrong: { 4: 'in', 10: 'may' } as Record<number, string>,
  ahead: 3,
};

/**
 * The rounds needed to write `total` tokens when the draft model guesses `k` tokens ahead and gets
 * the tokens at the `wrong` indexes wrong. Each round costs one pass of the large model and adds
 * the guesses it kept, plus its own token where a guess was wrong.
 */
export function specRounds(total: number, wrong: readonly number[], k = 3): SpecRound[] {
  const rounds: SpecRound[] = [];
  const step = Math.max(1, Math.round(k));
  let at = 0;
  while (at < total) {
    const guesses = Math.min(step, total - at);
    let accepted = 0;
    while (accepted < guesses && !wrong.includes(at + accepted)) accepted++;
    const corrected = accepted < guesses;
    rounds.push({ from: at, guesses, accepted, corrected });
    at += accepted + (corrected ? 1 : 0);
  }
  return rounds;
}

/** The rounds of the page's example. */
export const specExample = () => specRounds(SPEC_EXAMPLE.tokens.length, Object.keys(SPEC_EXAMPLE.wrong).map(Number), SPEC_EXAMPLE.ahead);
