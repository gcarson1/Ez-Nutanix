// App shell: top bar with breadcrumbs, the landing slide or the active module, presenter
// panel, glossary, shortcuts and about dialogs, toasts and global keyboard shortcuts.
import { Fragment, type ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useRoute, getRoute, setParams } from '../../state/route';
import { KEYS, PRESETS, clearedScenario, setScenario } from '../../state/scenario';
import { MODULES, findModule, type ModuleDef } from '../modules/registry';
import { GLOSSARY } from '../../content/glossary';
import { Icon } from '../components/Icon';
import { simKey, stepSpeed } from '../components/clock';
import { Landing } from './Landing';
import { CONFIG, VERSION } from './config';
import { go } from './nav';

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
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const body = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = body;
      prev?.focus?.();
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
    'On Protection & Capacity and Scale-out vs 3-tier, the Presets menu in the top bar loads a cluster size that matches the customer into Protection & Capacity.',
  ],
  qa: [
    { q: 'Is this all one product?', a: 'It is one platform with separately licensed products. The infrastructure layer (NCI) is the foundation; the services and management products build on it and on each other.' },
    { q: 'Do we have to run AHV?', a: 'No. Nutanix clusters also support VMware ESXi, but some features covered here (for example Flow and some DR options) are AHV-only or work differently on ESXi.' },
    { q: 'Can we start small?', a: 'Yes. Clusters start at one to three nodes for edge sites and grow a node at a time.' },
  ],
  next: ['Open Nutanix Cloud Infrastructure', 'Open the Cluster Lab and show VM failover', 'Show Disaster Recovery'],
};

function Presenter({ def, onClose }: { def: ModuleDef | undefined; onClose: () => void }) {
  const c = def?.content;
  const talk = c?.talk.length ? c.talk : LANDING_NOTES.talk;
  const qa = c?.qa.length ? c.qa : LANDING_NOTES.qa;
  const next = c?.next.length ? c.next : LANDING_NOTES.next;
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
    </Drawer>
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
  ['T', 'Light / dark theme'],
  ['Esc', 'Close panel, or go back'],
];

function About({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About this simulation" onClose={onClose} wide>
      <div class="modal-sec">
        <p>
          This explorer is an educational visualization of how the Nutanix platform behaves. It runs entirely in this one file, works offline and sends nothing anywhere.
        </p>
      </div>
      <div class="modal-sec">
        <h3 class="eyebrow">Modeled</h3>
        <ul>
          <li>Replica and erasure-coding placement across nodes, blocks and racks, with the platform’s minimum-size rules.</li>
          <li>Failure detection, HA restarts, many-to-many re-protection, and the cases where data becomes unavailable or cannot self-heal.</li>
          <li>Metadata and configuration quorum (3 copies at redundancy factor 2, 5 at redundancy factor 3).</li>
          <li>Capacity math from raw to usable, including the rebuild reserve and EC-X on write-cold data only.</li>
          <li>One-node-at-a-time rolling upgrades with resiliency gating, replication RPO tiers, and category-based security policy.</li>
        </ul>
      </div>
      <div class="modal-sec">
        <h3 class="eyebrow">Simplified</h3>
        <ul>
          <li>Data is a representative sample of a few hundred items, not real extents.</li>
          <li>Timings (detection, restart, rebuild, upgrade) are illustrative defaults you can adjust; they are not measurements.</li>
          <li>Performance and latency figures are relative and labeled “Illustrative.”</li>
          <li>Behavior, limits and requirements vary by software version, hypervisor, hardware and license.</li>
        </ul>
      </div>
      <div class="modal-sec">
        <p class="muted small">
          Version {VERSION.slice(1)}. Facts checked on {CONFIG.factsCheckedOn}. Product names are used descriptively. {CONFIG.disclaimer}
        </p>
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
  return (
    <div class="mod">
      <header class="mod-head" style={{ viewTransitionName: 'hero' }}>
        <div>
          <div class="mod-tag">
            <i />
            {c.tag}
          </div>
          <h1>{c.title}</h1>
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
const PRESET_PATHS = ['nci/capacity', 'nci/scale'];
const authors = CONFIG.authors ?? [];

function applyPreset(id: string) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  const cur = getRoute().path;
  // The Cluster & DSF Lab uses one fixed cluster; presets size Protection & Capacity.
  if (cur !== 'nci/capacity') go('nci/capacity');
  setParams(clearedScenario());
  setScenario(p.cfg);
  // Written even when it equals the default, because Protection & Capacity opens on 3 nodes otherwise.
  if (p.cfg.nodes !== undefined) setParams({ [KEYS.nodes]: p.cfg.nodes });
  toast(`Preset: ${p.label}`);
}

type Panel = 'presenter' | 'glossary' | null;
type Dialog = 'keys' | 'about' | null;

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
        else if (s.def) go(s.def.parent);
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
      else if (s.dialog) return;
      else if (k === ' ' && t.tagName !== 'BUTTON' && simKey('toggle')) e.preventDefault();
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
              <span class="sep">/</span>
              <button type="button" onClick={() => go('')}>
                Platform
              </button>
              {crumbs.map((c, i) => (
                <span key={c.path} class={i < crumbs.length - 1 ? 'mid' : ''} style={{ display: 'contents' }}>
                  <span class={`sep${i < crumbs.length - 1 ? ' mid' : ''}`}>/</span>
                  {i < crumbs.length - 1 ? (
                    <button type="button" class="mid" onClick={() => go(c.path)}>
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
              <button type="button" class="tbtn" onClick={() => go(def.parent)}>
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
            <button type="button" class="icon-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Light / dark (T)" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
            </button>
          </div>
        </div>
      </header>

      <main class={`page${route.path ? '' : ' home'}`} id="main">
        {def ? <ModuleView def={def} key={def.content.path} /> : route.path ? <NotFound /> : <Landing />}
      </main>

      <footer class={`foot-bar${route.path ? '' : ' fab-room'}`}>
        <div class="in">
          <div class="foot-row">
            {(CONFIG.credit || authors.length > 0) && (
              <span class="credit">
                {CONFIG.credit}
                {authors.map((a, i) => (
                  <Fragment key={a.name}>
                    {i === 0 ? ' ' : i === authors.length - 1 ? ' and ' : ', '}
                    <span class="author">
                      {a.name}
                      {a.handle && (
                        <span class="handle">
                          {a.handle}
                          {i === authors.length - 1 && <span class="on"> on Slack</span>}
                        </span>
                      )}
                    </span>
                  </Fragment>
                ))}
              </span>
            )}
            <span class="ver">{VERSION}</span>
            {(CONFIG.presenterName || CONFIG.organization) && (
              <span class="who">
                {[CONFIG.presenterName, CONFIG.presenterRole, CONFIG.organization].filter(Boolean).join(' · ')}
                {CONFIG.contact ? ` · ${CONFIG.contact}` : ''}
              </span>
            )}
            <button type="button" class="tbtn" onClick={() => setDialog('about')}>
              About this simulation
            </button>
          </div>
          <p class="disclaimer">{CONFIG.disclaimer}</p>
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
      <Toasts />
    </>
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
