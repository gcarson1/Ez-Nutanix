// Product status that more than one page repeats and that changes with time. One edit here moves
// every page. The facts are in docs/facts.md (CNA-11, MP-25); tests/engine/copy.test.ts fails when
// a "targeted for <period>" string in the app is past its period.

/** NKP Metal: announced as early access in April 2026 and introduced with NKP 2.19 in October 2026. */
export const NKP_METAL = {
  /** "…NKP Metal, introduced with NKP 2.19 in October 2026". */
  intro: 'introduced with NKP 2.19 in October 2026',
  /** Nutanix's NKP 2.19 pages label it neither early access nor generally available. */
  confirm: 'confirm its support status with Nutanix',
  release: { v: 'NKP 2.19', sub: 'NKP Metal introduced Oct 2026; confirm its support status with Nutanix' },
} as const;
