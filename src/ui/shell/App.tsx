// App shell: top bar with breadcrumbs, the landing slide or the active module, presenter
// panel, glossary, shortcuts and about dialogs, toasts and global keyboard shortcuts.
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useRoute, getRoute, replaceParams } from '../../state/route';
import { KEYS, PRESETS, clearedScenario, scenarioParams } from '../../state/scenario';
import { MODULES, findModule, type ModuleDef } from '../modules/registry';
import { GLOSSARY } from '../../content/glossary';
import { Icon } from '../components/Icon';
import lucideLicense from '../../assets/licenses/lucide.txt?raw';
import liquidglLicense from '../../assets/licenses/liquidgl.txt?raw';
import { simKey, stepSpeed } from '../components/clock';
import { Landing } from './Landing';
import { CONFIG, VERSION } from './config';
import { glassBlocker } from './glass';
import { go, goUp } from './nav';

// ── toast ──
let pushToast: (msg: string) => void = () => undefined;
export function toast(msg: string) {
  pushToast(msg);
}

function Toasts() {
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  useEffect(() => {
    let timer = 0;
    pushToast = (text) => {
      setMsg({ text, id: Date.now() });
      clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(null), 2600);
    };
  }, []);
  return msg ? (
    <div class="toast" role="status" key={msg.id}>
      {msg.text}
    </div>
  ) : null;
}

// ── dialogs and drawers ──
function Modal({ title, onClose, wide, children }: { title: string; onClose: () => void; wide?: boolean; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  // Captured on first render, before a child (the jump dialog's filter box) takes focus.
  const prev = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = body;
      prev.current?.focus?.();
    };
  }, []);
  return (
    <div class="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref} onKeyDown={(e) => trapFocus(e, ref.current)}>
        <div class="modal-head">
          <h2>{title}</h2>
          <button type="button" class="tbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function trapFocus(e: KeyboardEvent, root: HTMLElement | null) {
  if (e.key !== 'Tab' || !root) return;
  const els = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
  if (!els.length) return;
  const first = els[0];
  const last = els[els.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}

function Drawer({ title, onClose, children, icon }: { title: string; onClose: () => void; children: ComponentChildren; icon: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <aside class="drawer" aria-label={title} tabIndex={-1} ref={ref}>
      <div class="drawer-head">
        <Icon name={icon} />
        <h2>{title}</h2>
        <span class="spacer" />
        <button type="button" class="icon-btn" onClick={onClose} aria-label={`Close ${title}`}>
          <Icon name="x" />
        </button>
      </div>
      <div class="drawer-body">{children}</div>
    </aside>
  );
}

const LANDING_NOTES = {
  title: 'Platform overview',
  talk: [
    'One platform for every workload: VMs, containers, databases, files and objects, and AI, on premises, at the edge and in public cloud.',
    'Talk bottom-up: the infrastructure (NCI) first, then the services that run on it, then the management layer above many clusters.',
    'Every pane opens a module that shows how that part works, with one or two presets and a short looping animation.',
    'On Protection & Capacity, the Presets menu in the top bar loads a cluster size that matches the customer.',
  ],
  qa: [
    { q: 'Is this all one product?', a: 'It is one platform with separately licensed products. The infrastructure layer (NCI) is the foundation; the services and management products build on it and on each other.' },
    { q: 'Do we have to run AHV?', a: 'No. Nutanix clusters also support VMware ESXi, but some features covered here (for example Flow and some DR options) are AHV-only or work differently on ESXi.' },
    { q: 'Can we start small?', a: 'Yes. Clusters start at one to three nodes for edge sites and grow a node at a time.' },
  ],
  next: ['Open Nutanix Cloud Infrastructure and start with Legacy vs Nutanix HCI.', 'Open Cluster & DSF Lab and pick VM failover.', 'Then open Disaster Recovery.'],
  then: ['nci', 'nci/hci', 'nci/cluster', 'nci/dr'],
};

function Presenter({ def, onClose }: { def: ModuleDef | undefined; onClose: () => void }) {
  const c = def?.content;
  const talk = c?.talk.length ? c.talk : LANDING_NOTES.talk;
  const qa = c?.qa.length ? c.qa : LANDING_NOTES.qa;
  const next = c?.next.length ? c.next : LANDING_NOTES.next;
  const then = (c ? c.then ?? [] : LANDING_NOTES.then).map(findModule).filter((m): m is ModuleDef => !!m);
  return (
    <Drawer title={`Presenter · ${c?.title ?? LANDING_NOTES.title}`} onClose={onClose} icon="podium">
      <h3>Talk track</h3>
      <ul>
        {talk.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {!!c?.numbers.length && (
        <>
          <h3>Key numbers</h3>
          {c.numbers.map((n) => (
            <div class="stat" key={n.k}>
              <span class="k">{n.k}</span>
              <span class="v">{n.v}</span>
            </div>
          ))}
        </>
      )}
      <h3>Likely questions</h3>
      {qa.map((x) => (
        <div class="qa" key={x.q}>
          <div class="q">{x.q}</div>
          <div class="a">{x.a}</div>
        </div>
      ))}
      <h3>What to click next</h3>
      <ol>
        {next.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      {then.length > 0 && (
        <div class="drawer-links">
          {then.map((m) => (
            <button type="button" class="btn" key={m.content.path} onClick={() => go(m.content.path)}>
              <Icon name={m.icon} />
              Open {m.content.title}
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}

/** The theme button: a menu with dark or light, and the home page's liquid glass on or off. */
function ThemeMenu({ theme, onTheme, glass, onGlass }: { theme: 'dark' | 'light'; onTheme: (t: 'dark' | 'light') => void; glass: boolean; onGlass: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Asked only when the menu opens: the first call probes the GPU.
  const blocked = useMemo(() => (open ? glassBlocker() : null), [open]);
  const close = () => {
    setOpen(false);
    (ref.current?.querySelector('.theme-btn') as HTMLElement | null)?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        e.stopPropagation();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey, true);
    (ref.current?.querySelector('[aria-checked="true"]') as HTMLElement | null)?.focus();
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);
  const move = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const items = [...(ref.current?.querySelectorAll<HTMLElement>('.speed-opt:not([disabled])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    e.preventDefault();
  };
  const on = glass && !blocked;
  return (
    <div class="speed theme-menu" ref={ref}>
      <button type="button" class="icon-btn theme-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Theme and glass" title="Theme and glass (T switches the theme)">
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
      </button>
      {open && (
        <div class="speed-menu" role="menu" aria-label="Theme and glass" onKeyDown={move}>
          <div class="speed-h">Theme</div>
          {(['dark', 'light'] as const).map((v) => (
            <button
              key={v}
              type="button"
              class="speed-opt"
              role="menuitemradio"
              aria-checked={theme === v}
              onClick={() => {
                onTheme(v);
                close();
              }}
            >
              <span class="speed-mark">{theme === v ? '✓' : ''}</span>
              {v === 'dark' ? 'Dark' : 'Light'}
            </button>
          ))}
          <div class="speed-h sep">Home page</div>
          <button
            type="button"
            class="speed-opt"
            role="menuitemcheckbox"
            aria-checked={on}
            disabled={!!blocked}
            onClick={() => {
              onGlass(!glass);
              close();
            }}
          >
            <span class="speed-mark">{on ? '✓' : ''}</span>
            <span>
              Liquid glass
              {blocked && <span class="speed-note">{blocked}</span>}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

function Glossary({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return GLOSSARY.filter((g) => !s || `${g.term} ${g.full ?? ''} ${g.def}`.toLowerCase().includes(s)).sort((a, b) => a.term.localeCompare(b.term));
  }, [q]);
  return (
    <Drawer title="Glossary" onClose={onClose} icon="book">
      <input class="input" type="search" placeholder="Search terms" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} aria-label="Search glossary" />
      <dl style={{ marginTop: 'var(--sp-4)' }}>
        {list.map((g) => (
          <div class="gloss-item" key={g.term}>
            <dt>
              <span class="mono">{g.term}</span>
              {g.full}
            </dt>
            <dd>{g.def}</dd>
          </div>
        ))}
        {!list.length && <p class="muted">No matching terms.</p>}
      </dl>
    </Drawer>
  );
}

const SHORTCUTS: [string, string][] = [
  ['P', 'Presenter notes'],
  ['G', 'Glossary'],
  ['?', 'This list'],
  ['Space', 'Pause / play the animation'],
  ['← →', 'Scrub the animation back / forward'],
  ['Shift ← →', 'Jump to the previous / next step'],
  ['< >', 'Slower / faster animation'],
  ['J', 'Jump to a module'],
  ['T', 'Light / dark theme'],
  ['Esc', 'Close panel, or go up a level'],
];

function About({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About this explorer" onClose={onClose} wide>
      <div class="modal-sec">
        <p>
          This explorer is an educational visualization of how the Nutanix platform behaves. It runs entirely in this one file, works offline and sends nothing anywhere.
        </p>
      </div>
      <div class="modal-sec">
        <h3 class="eyebrow">Modeled</h3>
        <ul>
          <li>Replica and erasure-coding placement across nodes, blocks and racks, with the platform’s minimum-size rules.</li>
          <li>Failure detection, HA restarts, many-to-many re-protection and the cases where data becomes unavailable or cannot self-heal.</li>
          <li>Metadata and configuration quorum (3 copies at redundancy factor 2, 5 at redundancy factor 3).</li>
          <li>Capacity math from raw to usable, including the rebuild reserve and EC-X on write-cold data only.</li>
          <li>One-node-at-a-time rolling upgrades with resiliency gating, replication RPO tiers and category-based security policy.</li>
        </ul>
      </div>
      <div class="modal-sec">
        <h3 class="eyebrow">Simplified</h3>
        <ul>
          <li>Data is drawn as a small sample of pieces, a few dozen at most, not real extents.</li>
          <li>Timings (detection, restart, rebuild, upgrade) are compressed and illustrative, not measurements; the speed button changes playback speed only.</li>
          <li>Performance and latency figures are relative and labeled “Illustrative.”</li>
          <li>Behavior, limits and requirements vary by software version, hypervisor, hardware and license.</li>
        </ul>
      </div>
      <div class="modal-sec">
        <p class="muted small">
          Version {VERSION.slice(1)}. Facts checked on {CONFIG.factsCheckedOn}. Product names are used descriptively. {CONFIG.disclaimer}
        </p>
        <details class="credits">
          <summary class="muted small">Icons: Lucide, ISC license</summary>
          <pre>{lucideLicense}</pre>
        </details>
        <details class="credits">
          <summary class="muted small">Home page glass: liquidGL, MIT license</summary>
          <pre>{liquidglLicense}</pre>
        </details>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

// ── module frame ──
function ModuleView({ def }: { def: ModuleDef }) {
  const c = def.content;
  const { Component } = def;
  const h1 = useRef<HTMLHeadingElement>(null);
  // Screen readers announce the new page; preventScroll keeps the view where navigation put it.
  useEffect(() => h1.current?.focus({ preventScroll: true }), []);
  return (
    <div class="mod">
      <header class="mod-head" style={{ viewTransitionName: 'hero' }}>
        <div>
          <div class="mod-tag">
            <i />
            {def.parent ? findModule(def.parent)?.content.title ?? c.tag : c.tag}
          </div>
          <h1 tabIndex={-1} ref={h1}>
            {c.title}
          </h1>
          <p>{c.summary}</p>
        </div>
      </header>
      <Component />
    </div>
  );
}

function crumbsFor(def: ModuleDef | undefined): { label: string; path: string }[] {
  const out: { label: string; path: string }[] = [];
  let d = def;
  while (d) {
    out.unshift({ label: d.content.title, path: d.content.path });
    d = d.parent ? findModule(d.parent) : undefined;
  }
  return out;
}

/** Modules that read the shared cluster size, where the top bar shows Presets. */
const PRESET_PATHS = ['nci/capacity'];
const authors = CONFIG.authors ?? [];

function applyPreset(id: string) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  // Presets show only on Protection & Capacity, so the preset rewrites this page's params in one step,
  // landing on the Copies tab where a cluster size applies (no history entry, no scroll). The node count
  // is written even when it equals the default, because Protection & Capacity opens on 3 nodes otherwise.
  const params: Record<string, string | null | undefined> = { ...getRoute().params, ...clearedScenario(), ...scenarioParams(p.cfg), tab: undefined, aw: undefined };
  if (p.cfg.nodes !== undefined) params[KEYS.nodes] = String(p.cfg.nodes);
  replaceParams(Object.fromEntries(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1] !== '')));
  toast(`Preset: ${p.label}`);
}

type Panel = 'presenter' | 'glossary' | null;
type Dialog = 'keys' | 'about' | 'jump' | null;

export function App() {
  const route = useRoute();
  const def = route.path ? findModule(route.path) : undefined;
  const [panel, setPanel] = useState<Panel>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('nax-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  // The home page's liquid glass, on unless the viewer turned it off (index.html applies it before first paint).
  const [glass, setGlass] = useState(() => {
    try {
      return localStorage.getItem('nax-glass') !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.glass = glass ? 'on' : 'off';
    try {
      localStorage.setItem('nax-glass', glass ? 'on' : 'off');
    } catch {
      /* storage unavailable */
    }
  }, [glass]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('nax-theme', theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);

  useEffect(() => {
    document.title = def ? `${def.content.title} · ${CONFIG.title}` : CONFIG.title;
  }, [def]);

  const state = useRef({ panel, dialog, def });
  state.current = { panel, dialog, def };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && (t as HTMLInputElement).type !== 'range' && (t as HTMLInputElement).type !== 'checkbox'));
      const s = state.current;
      if (e.key === 'Escape') {
        if (s.dialog) setDialog(null);
        else if (s.panel) setPanel(null);
        else if (s.def) goUp(s.def.parent);
        else if (getRoute().path) go('');
        else return;
        e.preventDefault();
        return;
      }
      if (typing) return;
      const k = e.key;
      if (k === 'p' || k === 'P') setPanel((p) => (p === 'presenter' ? null : 'presenter'));
      else if (k === 'g' || k === 'G') setPanel((p) => (p === 'glossary' ? null : 'glossary'));
      else if (k === '?') setDialog((d) => (d === 'keys' ? null : 'keys'));
      else if (k === 't' || k === 'T') setTheme((x) => (x === 'dark' ? 'light' : 'dark'));
      else if (k === 'j' || k === 'J') setDialog((d) => (d === 'jump' ? null : 'jump'));
      else if (s.dialog) return;
      // Space pauses unless it would press a button, but a preset, tab or step that is already selected
      // has nothing left to press, so presenters can click one and hold or resume a frame with Space.
      else if (k === ' ' && (t.tagName !== 'BUTTON' || t.closest('.seg [aria-pressed="true"], [role="tab"][aria-selected="true"], [aria-current="step"]')) && simKey('toggle')) e.preventDefault();
      else if (k === '<' || k === '>') stepSpeed(k === '>' ? 1 : -1);
      // On the scrub bar itself the arrows keep their own finer steps.
      else if ((k === 'ArrowLeft' || k === 'ArrowRight') && !(t.tagName === 'INPUT' && (t as HTMLInputElement).type === 'range') && simKey(k === 'ArrowRight' ? 'forward' : 'back', e.shiftKey)) e.preventDefault();
      else return;
      if (k !== ' ') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const crumbs = crumbsFor(def);

  return (
    <>
      <header class="bar">
        <div class="bar-in wide">
          <button type="button" class="brandmark" onClick={() => go('')} title="Back to platform">
            <i />
            <span class="hide-sm">Architecture Explorer</span>
          </button>
          {def && (
            <nav class="crumbs" aria-label="Breadcrumb">
              <span class="sep plat">/</span>
              <button type="button" class="plat" onClick={() => goUp('')}>
                Platform
              </button>
              {crumbs.map((c, i) => (
                <span key={c.path} class={i < crumbs.length - 1 ? 'mid' : ''} style={{ display: 'contents' }}>
                  <span class={`sep${i < crumbs.length - 1 ? ' mid' : ''}`}>/</span>
                  {i < crumbs.length - 1 ? (
                    <button type="button" class="mid" onClick={() => goUp(c.path)}>
                      {c.label}
                    </button>
                  ) : (
                    <span class="cur" aria-current="page">
                      {c.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <span class="spacer" />
          <div class="bar-r hstack">
            {def && (
              <button type="button" class="tbtn" onClick={() => goUp(def.parent)} title={`Back to ${def.parent ? findModule(def.parent)?.content.title : 'platform'}`} aria-label={`Back to ${def.parent ? findModule(def.parent)?.content.title : 'platform'}`}>
                <Icon name="back" />
                <span class="lbl">{def.parent ? 'Back' : 'Back to platform'}</span>
              </button>
            )}
            {/* Presets size the shared cluster, so they show only on the modules that use it. */}
            {def && PRESET_PATHS.includes(def.content.path) && (
              <>
                <label class="sr-only" for="preset">
                  Scenario preset
                </label>
                <select
                  id="preset"
                  class="input preset"
                  value=""
                  onChange={(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    (e.target as HTMLSelectElement).value = '';
                    if (v) applyPreset(v);
                  }}
                >
                  <option value="">Presets…</option>
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <span class="bar-div" />
              </>
            )}
            <button type="button" class={`tbtn${panel === 'presenter' ? ' on' : ''}`} onClick={() => setPanel(panel === 'presenter' ? null : 'presenter')} title="Presenter notes (P)" aria-pressed={panel === 'presenter'}>
              <Icon name="podium" />
              <span class="lbl wide-only">Presenter</span>
            </button>
            <button type="button" class={`tbtn${panel === 'glossary' ? ' on' : ''}`} onClick={() => setPanel(panel === 'glossary' ? null : 'glossary')} title="Glossary (G)" aria-pressed={panel === 'glossary'}>
              <Icon name="book" />
              <span class="lbl wide-only">Glossary</span>
            </button>
            <button type="button" class="icon-btn" onClick={() => setDialog('keys')} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
              <Icon name="keyboard" />
            </button>
            <ThemeMenu theme={theme} onTheme={setTheme} glass={glass} onGlass={setGlass} />
          </div>
        </div>
      </header>

      <main class={`page${route.path ? '' : ' home'}`} id="main">
        {def ? <ModuleView def={def} key={def.content.path} /> : route.path ? <NotFound /> : <Landing />}
      </main>

      <footer class={`foot-bar${route.path ? '' : ' fab-room'}`}>
        <div class="in foot-cols">
          <div class="foot-col">
            {(CONFIG.credit || authors.length > 0) && (
              <span class="credit">
                {CONFIG.credit && <span class="by">{CONFIG.credit}</span>}
                {authors.length > 0 && (
                  <span class="authors">
                    {authors.map((a, i) => (
                      <span class="author" key={a.name}>
                        {a.name}
                        {a.handle && (
                          <span class="handle">
                            {a.handle}
                            {i === authors.length - 1 && <span class="on"> on Slack</span>}
                          </span>
                        )}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            )}
          </div>
          <div class="foot-col">
            {(CONFIG.presenterName || CONFIG.organization) && (
              <span class="who">
                {[CONFIG.presenterName, CONFIG.presenterRole, CONFIG.organization].filter(Boolean).join(' · ')}
                {CONFIG.contact ? ` · ${CONFIG.contact}` : ''}
              </span>
            )}
            <span class="ver">{VERSION}</span>
            <button type="button" class="tbtn" onClick={() => setDialog('about')}>
              About this explorer
            </button>
          </div>
          <p class="foot-col disclaimer">{CONFIG.disclaimer}</p>
        </div>
      </footer>

      {panel === 'presenter' && <Presenter def={def} onClose={() => setPanel(null)} />}
      {panel === 'glossary' && <Glossary onClose={() => setPanel(null)} />}
      {dialog === 'keys' && (
        <Modal title="Keyboard shortcuts" onClose={() => setDialog(null)}>
          <div class="modal-sec kbd-list">
            {SHORTCUTS.map(([k, v]) => (
              <Fragment key={k}>
                <kbd>{k}</kbd>
                <span>{v}</span>
              </Fragment>
            ))}
          </div>
        </Modal>
      )}
      {dialog === 'about' && <About onClose={() => setDialog(null)} />}
      {dialog === 'jump' && <Jump onClose={() => setDialog(null)} />}
      <Toasts />
    </>
  );
}

/**
 * Every module, grouped by where it sits, with type-to-filter. Enter in the filter box opens the first
 * match; the arrows move focus through the box and the rows in the order they are shown.
 */
function Jump({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const s = q.trim().toLowerCase();
  // Titles first: a word inside a summary ("acknowledged" holds "edge") only counts when no title matches.
  const byTitle = MODULES.filter((m) => m.content.title.toLowerCase().includes(s));
  const list = !s ? MODULES : byTitle.length ? byTitle : MODULES.filter((m) => `${m.content.tag} ${m.content.summary}`.toLowerCase().includes(s));
  const open = (m: ModuleDef) => {
    onClose();
    go(m.content.path);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const els = [...(box.current?.querySelectorAll<HTMLElement>('input, .rowbtn') ?? [])];
      const i = els.indexOf(document.activeElement as HTMLElement);
      els[(i + (e.key === 'ArrowDown' ? 1 : els.length - 1)) % els.length]?.focus();
      e.preventDefault();
    } else if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      box.current?.querySelector<HTMLElement>('.rowbtn')?.click();
      e.preventDefault();
    }
  };
  const groups = [...new Set(list.map((m) => m.parent))];
  return (
    <Modal title="Jump to a module" onClose={onClose}>
      <div class="modal-sec jump" ref={box} onKeyDown={onKey}>
        <input class="input" type="search" placeholder="Type to filter" aria-label="Filter modules" value={q} ref={(el) => el?.focus()} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        {groups.map((g) => (
          <div key={g} class="jump-group">
            <h3 class="eyebrow">{g ? findModule(g)?.content.title : 'Platform'}</h3>
            {list
              .filter((m) => m.parent === g)
              .map((m) => (
                <button type="button" key={m.content.path} class="rowbtn" onClick={() => open(m)}>
                  <Icon name={m.icon} />
                  <span class="t">{m.content.title}</span>
                </button>
              ))}
          </div>
        ))}
        {!list.length && <p class="muted">No module matches.</p>}
      </div>
    </Modal>
  );
}

function NotFound() {
  return (
    <div class="mod">
      <h1>That view doesn’t exist</h1>
      <p class="muted" style={{ marginTop: 'var(--sp-3)' }}>
        The link may come from a newer version of this explorer.
      </p>
      <div class="hstack" style={{ marginTop: 'var(--sp-5)' }}>
        <button type="button" class="btn primary" onClick={() => go('')}>
          Back to platform
        </button>
      </div>
      <ul style={{ marginTop: 'var(--sp-6)' }}>
        {MODULES.map((m) => (
          <li key={m.content.path}>
            <button type="button" class="tbtn" onClick={() => go(m.content.path)}>
              {m.content.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
