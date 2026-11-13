// Content attached to every module: presenter talk track, key numbers, likely questions,
// and what to click next. Data, not code, so it can be edited freely.
/** One line of the facts every page shows at the top of its right pane: a short value and, under it, the detail. */
export interface Fact {
  v: string;
  sub?: string;
  tip?: string;
}

export interface ModuleContent {
  /** Route path, e.g. "nci/cluster". */
  path: string;
  title: string;
  /** Short eyebrow label above the title (e.g. "Nutanix Cloud Infrastructure"). */
  tag: string;
  /** One or two sentences under the title, in customer terms. */
  summary: string;
  priority: 'P0' | 'P1' | 'P2';
  /** Shown first in the right pane of every page: the release the page is drawn for, and the license it needs. Sources: docs/facts.md section 22. */
  facts: { release: Fact; license: Fact };
  /** Presenter talk track, 3 to 6 bullets. */
  talk: string[];
  /** Key numbers for the presenter panel. Every value must trace to docs/facts.md. */
  numbers: { k: string; v: string }[];
  /** Three likely customer questions with honest answers. */
  qa: { q: string; a: string }[];
  /** What to click next, in order: steps inside this module, ending with where to go. */
  next: string[];
  /** Modules to open next (route paths), shown as links in the presenter drawer. */
  then?: string[];
}
