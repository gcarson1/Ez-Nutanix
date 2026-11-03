// Fuzzy search over every module and every option a module offers (src/content/scenes.ts).
// Pure: the shell builds the index once and asks it for ranked results; no DOM here.
//
// Text is lowercased, accents and punctuation become spaces ("balance-tcp" is "balance tcp") and
// words are lightly stemmed ("copies" is "copy"). Each query word is scored against each entry's
// words: exact 1, a prefix while typing 0.85, one typo 0.7, two typos in a long word 0.5, inside a
// longer word 0.5; times the weight of the field it matched (an option's own label counts most, a
// talk-track sentence least). Entries must match at least half the query words, missing words cost
// a lot, and the whole phrase appearing in one field earns a bonus.
import type { ModuleContent } from '../content/types';
import type { Scene } from '../content/scenes';

export interface SearchModule {
  content: ModuleContent;
  icon: string;
  parent: string;
}

interface Field {
  w: number;
  text: string;
  norm: string;
  /** `norm` without filler words, for spotting the whole query as a phrase. */
  key: string;
  /** Shown as a result's snippet when it holds the best match. */
  show: boolean;
}

export interface SearchDoc {
  kind: 'module' | 'scene';
  path: string;
  params: Record<string, string>;
  /** First line: the module's title, or the option's label. */
  title: string;
  /** Second line: where it lives. */
  where: string;
  icon: string;
  /** For an option: its control's label and its tooltip, for matching the pressed control on arrival. */
  group?: string;
  fields: Field[];
}

export interface SearchIndex {
  docs: SearchDoc[];
  /** Each stemmed word: the entries holding it, with the highest weight of a field it appears in. */
  inv: Map<string, Map<number, number>>;
}

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** The best-matching visible text (summary, talk track, tooltip), or '' when the title matched. */
  snippet: string;
}

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'with', 'is', 'are', 'how', 'what', 'does', 'do', 'my', 'your', 'i', 'we', 'it', 'at', 'by', 'be', 'can', 'when', 'why', 'about', 'show', 'me', 'this', 'that']);

export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** A light English stemmer, applied the same way to the query and the text. */
export function stem(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed') && !w.endsWith('eed')) return w.slice(0, -2);
  if (w.length > 4 && /(ss|x|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

export function words(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(' ').map(stem) : [];
}

/** Optimal string alignment distance (a swap of two letters counts once), stopping past `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2: number[] = [];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur.push(v);
      if (v < low) low = v;
    }
    if (low > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[b.length];
}

/** A match without a typo: the same word 1, a prefix while typing 0.85 (0.6 for two letters), inside a longer word 0.5. */
function direct(q: string, t: string): number {
  if (q === t) return 1;
  if (q.length >= 2 && t.startsWith(q)) return q.length >= 3 ? 0.85 : 0.6;
  if (q.length >= 4 && t.length > q.length && t.includes(q)) return 0.5;
  return 0;
}

/** A match with a typo: one 0.7, two in a long word 0.5, one in a word still being typed 0.55. */
function typo(q: string, t: string): number {
  if (q.length < 4) return 0;
  const d = distance(q, t, 2);
  if (d <= 1) return 0.7;
  if (d === 2 && q.length >= 7) return 0.5;
  if (q.length >= 5 && t.length > q.length && distance(q, t.slice(0, q.length), 1) <= 1) return 0.55;
  return 0;
}

/** How well a query word matches a word of the text, 0 to 1. */
export function similarity(q: string, t: string): number {
  return direct(q, t) || typo(q, t);
}

function field(w: number, text: string, show = false): Field {
  const ws = words(text);
  return { w, text, norm: ws.join(' '), key: ws.filter((x) => !STOP.has(x)).join(' '), show };
}

/** Initials of a multi-word title ("Disaster Recovery" gives "dr"), so short names find it. */
function initials(title: string): string {
  const ws = normalize(title).split(' ').filter((w) => w && !STOP.has(w));
  return ws.length > 1 ? ws.map((w) => w[0]).join('') : '';
}

function addWords(inv: SearchIndex['inv'], i: number, doc: SearchDoc) {
  const put = (w: string, weight: number) => {
    let m = inv.get(w);
    if (!m) inv.set(w, (m = new Map()));
    m.set(i, Math.max(m.get(i) ?? 0, weight));
  };
  for (const f of doc.fields) {
    const ws = f.norm ? f.norm.split(' ') : [];
    ws.forEach((w, j) => {
      put(w, f.w);
      // Joined pairs, so "activebackup" or "rf 2" typed either way still meets "Active-Backup" or "RF2".
      const next = ws[j + 1];
      if (next && f.w >= 1.5) put(w + next, f.w * 0.9);
    });
  }
}

export function buildIndex(modules: SearchModule[], scenes: Scene[], moduleWords: Record<string, string> = {}): SearchIndex {
  const byPath = new Map(modules.map((m) => [m.content.path, m]));
  const docs: SearchDoc[] = [];
  for (const m of modules) {
    const c = m.content;
    const parent = m.parent ? byPath.get(m.parent)?.content.title : '';
    docs.push({
        kind: 'module',
        path: c.path,
        params: {},
        title: c.title,
        where: parent || c.tag,
        icon: m.icon,
        fields: [
          field(3, `${c.title} ${initials(c.title)} ${c.path.split('/').pop()}`),
          field(1, c.path.split('/').slice(0, -1).join(' ')),
          ...(moduleWords[c.path] ? [field(3, moduleWords[c.path])] : []),
          field(1, c.tag),
          field(1.5, c.summary, true),
          ...c.talk.map((t) => field(0.8, t, true)),
          ...c.numbers.map((n) => field(0.8, `${n.k}: ${n.v}`, true)),
          ...c.qa.map((x) => field(0.8, `${x.q} ${x.a}`, true)),
        ],
    });
  }
  for (const s of scenes) {
    const m = byPath.get(s.path);
    if (!m) continue;
    const t = m.content.title;
    docs.push({
        kind: 'scene',
        path: s.path,
        params: s.params ?? {},
        title: s.label,
        where: `${t} · ${s.group}`,
        icon: m.icon,
        group: s.group,
        fields: [
          field(3, s.label),
          field(2, s.group),
          ...(s.hint ? [field(2.5, s.hint, true)] : []),
          ...(s.words ? [field(2.5, s.words)] : []),
          field(1.2, t),
          field(1, `${s.path.replace(/\//g, ' ')} ${initials(t)}`),
        ],
    });
  }
  const inv: SearchIndex['inv'] = new Map();
  docs.forEach((d, i) => addWords(inv, i, d));
  return { docs, inv };
}

/** Query words without filler, keeping them all when the query is nothing but filler. */
function queryWords(q: string): string[] {
  const raw = normalize(q).split(' ').filter(Boolean);
  const kept = raw.filter((w) => !STOP.has(w));
  return (kept.length ? kept : raw).map(stem);
}

/**
 * For one query word, each entry's best weighted match. Typos count only when the word appears
 * nowhere as typed, so "cost" finds Cost and not "site lost".
 */
function matches(q: string, index: SearchIndex): Map<number, number> {
  const out = new Map<number, number>();
  const add = (sim: number, docs: Map<number, number>) => {
    for (const [i, weight] of docs) if (sim * weight > (out.get(i) ?? 0)) out.set(i, sim * weight);
  };
  for (const [w, docs] of index.inv) {
    const sim = direct(q, w);
    if (sim) add(sim, docs);
  }
  if (out.size) return out;
  for (const [w, docs] of index.inv) {
    const sim = typo(q, w);
    if (sim) add(sim, docs);
  }
  return out;
}

function scoreAll(qs: string[], index: SearchIndex, cache: Map<string, Map<number, number>>): Map<number, number> {
  const per = qs.map((q) => cache.get(q) ?? cache.set(q, matches(q, index)).get(q)!);
  const phrase = qs.join(' ');
  const out = new Map<number, number>();
  const seen = new Set<number>();
  for (const m of per) for (const i of m.keys()) seen.add(i);
  for (const i of seen) {
    let sum = 0;
    let hit = 0;
    for (const m of per) {
      const s = m.get(i) ?? 0;
      sum += s;
      if (s > 0) hit++;
    }
    const cover = hit / qs.length;
    if (cover < 0.5) continue;
    let bonus = 0;
    if (qs.length > 1) for (const f of index.docs[i].fields) if (f.key.includes(phrase)) bonus = Math.max(bonus, f.w * 1.5);
    out.set(i, (sum + bonus) * cover * cover);
  }
  return out;
}

/** Ranked results for a query: the best first, at most `limit`, dropping ones far below the best. */
export function search(index: SearchIndex, query: string, limit = 8): SearchHit[] {
  const qs = queryWords(query);
  if (!qs.length) return [];
  // Two typed words that form one word of the text ("near sync", "rf 2") are also tried joined.
  const variants = [qs];
  for (let i = 0; i < qs.length - 1; i++) variants.push([...qs.slice(0, i), qs[i] + qs[i + 1], ...qs.slice(i + 2)]);
  const cache = new Map<string, Map<number, number>>();
  const scores = new Map<number, number>();
  for (const v of variants) for (const [i, sc] of scoreAll(v, index, cache)) scores.set(i, Math.max(scores.get(i) ?? 0, sc));
  // Ties keep index order: a module before its options.
  const hits = [...scores].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([i, score]) => ({ doc: index.docs[i], score, snippet: '' }));
  const top = hits[0]?.score ?? 0;
  const out = hits.filter((h) => h.score >= top * 0.25).slice(0, limit);
  for (const h of out) h.snippet = snippetFor(h.doc, qs);
  return out;
}

/** The visible field that matches the query best, trimmed around its first match. */
function snippetFor(doc: SearchDoc, qs: string[]): string {
  let pick: Field | undefined;
  let top = 0;
  for (const f of doc.fields) {
    if (!f.show || !f.norm) continue;
    const ws = f.norm.split(' ');
    const s = qs.reduce((acc, q) => acc + Math.max(0, ...ws.map((w) => similarity(q, w))), 0) * f.w;
    if (s > top) {
      top = s;
      pick = f;
    }
  }
  // Found by its title or label alone: the two result lines say enough.
  return pick ? trim(pick.text, qs) : '';
}

function trim(text: string, qs: string[], max = 140): string {
  if (text.length <= max) return text;
  const parts = highlight(text, qs);
  let at = 0;
  for (const p of parts) {
    if (p.hit) break;
    at += p.text.length;
  }
  let start = Math.max(0, at - 40);
  if (start > 0) {
    const sp = text.indexOf(' ', start);
    start = sp >= 0 && sp < at ? sp + 1 : start;
  }
  let end = Math.min(text.length, start + max);
  if (end < text.length) {
    const sp = text.lastIndexOf(' ', end);
    if (sp > start + 40) end = sp;
  }
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/** Splits text into runs, marking the words that match the query, for highlighting. */
export function highlight(text: string, qs: string[] | string): { text: string; hit: boolean }[] {
  const q = typeof qs === 'string' ? queryWords(qs) : qs;
  const out: { text: string; hit: boolean }[] = [];
  const re = /[\p{L}\p{N}]+/gu;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    const w = words(m[0]);
    const hit = w.length > 0 && w.some((x) => q.some((y) => similarity(y, x) >= 0.5));
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), hit: false });
  // A space or hyphen between two matched words joins them, so "balance-tcp" is one highlight.
  for (let i = 1; i < out.length - 1; i++) if (out[i - 1].hit && out[i + 1].hit && /^[\s\-/·]{1,3}$/.test(out[i].text)) out[i].hit = true;
  const merged: { text: string; hit: boolean }[] = [];
  for (const p of out) {
    const prev = merged[merged.length - 1];
    if (prev && prev.hit === p.hit) prev.text += p.text;
    else merged.push({ ...p });
  }
  return merged;
}
