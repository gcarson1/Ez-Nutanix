// Content attached to every module: presenter talk track, key numbers, likely questions,
// what to click next, and the honest-fit notes. Data, not code, so it can be edited freely.
export interface ModuleContent {
  /** Route path, e.g. "nci/cluster". */
  path: string;
  title: string;
  /** Short eyebrow label above the title (e.g. "Nutanix Cloud Infrastructure"). */
  tag: string;
  /** One or two sentences under the title, in customer terms. */
  summary: string;
  priority: 'P0' | 'P1' | 'P2';
  /** Presenter talk track, 3 to 6 bullets. */
  talk: string[];
  /** Key numbers for the presenter panel. Every value must trace to docs/facts.md. */
  numbers: { k: string; v: string }[];
  /** Three likely customer questions with honest answers. */
  qa: { q: string; a: string }[];
  /** What to click next, in order. */
  next: string[];
  /** "Where this has trade-offs" bullets. */
  honest: string[];
}
