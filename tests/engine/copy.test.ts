// Guards on the wording in src/: copy that was wrong once, and status that goes stale with time.
import { describe, expect, it } from 'vitest';

// Every source file's text, read with Vite's raw glob (no Node imports, so the type check stays browser-only).
const RAW = import.meta.glob('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const SRC = Object.entries(RAW).map(([file, text]) => ({ file, text }));

describe('copy guards', () => {
  it('HA is never said to restart VMs "instantly" (detection takes about 60 s)', () => {
    const bad = SRC.filter(({ text }) => /\bHA\b[^.\n]{0,80}\binstantly\b|\binstantly\b[^.\n]{0,80}\bHA\b|restarted instantly|restarts[^.\n]{0,40}instantly/i.test(text)).map((s) => s.file);
    expect(bad).toEqual([]);
  });

  it('no class string can render the word "undefined"', () => {
    const bad = SRC.filter(({ text }) => /class=\{`[^`]*\$\{[^}`]*\bundefined\b[^}`]*\}/.test(text)).map((s) => s.file);
    expect(bad).toEqual([]);
  });
});

describe('status freshness', () => {
  // A string that says a product is "targeted for the second half of 2026" must be re-checked once that
  // period is over: either the product shipped (say so) or the target moved (say that).
  const PERIOD_END: [RegExp, (m: RegExpMatchArray) => Date][] = [
    [/targeted for (?:the )?first half of (\d{4})/gi, (m) => new Date(Number(m[1]), 6, 1)],
    [/targeted for (?:the )?second half of (\d{4})/gi, (m) => new Date(Number(m[1]) + 1, 0, 1)],
    [/targeted for Q([1-4]) (\d{4})/gi, (m) => new Date(Number(m[2]), Number(m[1]) * 3, 1)],
  ];
  it('no "targeted for <period>" string is past its period', () => {
    const now = new Date();
    const stale: string[] = [];
    for (const { file, text } of SRC)
      for (const [re, end] of PERIOD_END) for (const m of text.matchAll(re)) if (end(m) <= now) stale.push(`${file}: ${m[0]}`);
    expect(stale, 'Re-check these against Nutanix and update the wording and docs/facts.md').toEqual([]);
  });
});
