// The top-bar search: type a few words ("balance tcp", "metro", "erasure coding") and open the
// module, or the exact tab or choice inside it, that they describe. "/" or Ctrl/⌘ K focuses it.
// On narrow screens it is an icon that opens the field over the top bar.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { MODULES } from '../modules/registry';
import { MODULE_WORDS, SCENES } from '../../content/scenes';
import { buildIndex, highlight, search, type SearchHit, type SearchIndex } from '../../engine/search';
import { afterNextRoute, buildHash, getRoute } from '../../state/route';
import { Icon } from '../components/Icon';
import { go } from './nav';

const EXAMPLES = ['balance tcp', 'metro', 'erasure coding', 'witness'];

// Built on the first search, not on page load.
let built: SearchIndex | undefined;
const getIndex = () => (built ??= buildIndex(MODULES, SCENES, MODULE_WORDS));

let focusSearch = () => undefined as void;
/** Focuses the search field (opening it first on narrow screens). */
export function openSearch() {
  focusSearch();
}

function Marked({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlight(text, q).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : p.text))}
    </>
  );
}

/** Outlines the tab or choice a result opened, so the eye lands on it. */
function flashControl(group: string, label: string) {
  const main = document.querySelector('main');
  if (!main) return;
  const els = [...main.querySelectorAll<HTMLElement>('[role="tab"][aria-selected="true"], .seg button[aria-pressed="true"]')];
  const el = els.find((b) => b.textContent?.trim() === label && (b.closest('[role="tablist"]') ?? b.closest('.seg'))?.getAttribute('aria-label') === group);
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center' });
  el.classList.remove('found');
  void el.offsetWidth;
  el.classList.add('found');
  window.setTimeout(() => el.classList.remove('found'), 2400);
}

function openHit(h: SearchHit) {
  const { kind, path, params, group, title } = h.doc;
  const flash = () => kind === 'scene' && group && flashControl(group, title);
  const here = getRoute();
  if (buildHash(here.path, here.params) === buildHash(path, params)) {
    flash();
    return;
  }
  afterNextRoute(flash);
  go(path, params);
}

export function Search() {
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(0);
  // Narrow screens only: the field is open over the top bar.
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = q.trim();
  const hits = useMemo(() => (typed ? search(getIndex(), typed) : []), [typed]);
  const showPop = focused && (hits.length > 0 || typed.length >= 2 || !typed);

  useEffect(() => {
    focusSearch = () => {
      setOpen(true);
      requestAnimationFrame(() => {
        input.current?.focus();
        input.current?.select();
      });
    };
    return () => {
      focusSearch = () => undefined;
    };
  }, []);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const close = () => {
    setQ('');
    setOpen(false);
    input.current?.blur();
  };
  const pick = (h: SearchHit) => {
    close();
    openHit(h);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (hits.length) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length);
      e.preventDefault();
    } else if (e.key === 'Enter') {
      if (hits[active]) pick(hits[active]);
      e.preventDefault();
    } else if (e.key === 'Escape') {
      // Handled here, so the page doesn't also go up a level.
      if (q) {
        setQ('');
        setActive(0);
      } else close();
      e.preventDefault();
    }
  };

  return (
    <div
      class={`search${open ? ' open' : ''}`}
      ref={wrap}
      onFocusIn={() => setFocused(true)}
      onFocusOut={(e) => {
        if (wrap.current?.contains(e.relatedTarget as Node | null)) return;
        setFocused(false);
        if (!q) setOpen(false);
      }}
    >
      <button type="button" class="icon-btn search-btn" onClick={openSearch} aria-label="Search" title="Search (/)">
        <Icon name="search" />
      </button>
      <div class="search-field">
        <Icon name="search" class="search-ico" />
        <input
          ref={input}
          class="input search-input"
          type="search"
          enterKeyHint="go"
          autoComplete="off"
          spellcheck={false}
          placeholder="Search, e.g. balance tcp"
          aria-label="Search modules and settings"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPop && hits.length > 0}
          aria-controls="search-list"
          aria-activedescendant={showPop && hits[active] ? `search-opt-${active}` : undefined}
          value={q}
          onInput={(e) => {
            setQ((e.target as HTMLInputElement).value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
        {!focused && !q && <kbd class="search-key">/</kbd>}
        <button type="button" class="icon-btn search-close" onClick={close} aria-label="Close search">
          <Icon name="x" />
        </button>
      </div>
      {showPop && (
        <div class="search-pop">
          {hits.length > 0 ? (
            <ul class="search-list" id="search-list" role="listbox" aria-label="Results" ref={list}>
              {hits.map((h, i) => (
                <li
                  key={`${h.doc.path}?${buildHash('', h.doc.params)}|${h.doc.title}|${h.doc.group ?? ''}`}
                  id={`search-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  class="search-opt"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => pick(h)}
                >
                  <Icon name={h.doc.icon} />
                  <span class="t">
                    <Marked text={h.doc.title} q={typed} />
                  </span>
                  <span class="w">{h.doc.where}</span>
                  {h.snippet && (
                    <span class="s">
                      <Marked text={h.snippet} q={typed} />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : typed ? (
            <p class="search-none">No matches. Try a product, feature or setting, like LACP or erasure coding.</p>
          ) : (
            <div class="search-none">
              Search every module and setting, for example
              <span class="search-ex">
                {EXAMPLES.map((x) => (
                  <button type="button" key={x} class="pill" onMouseDown={(e) => e.preventDefault()} onClick={() => {
                      setQ(x);
                      setActive(0);
                    }}>
                    {x}
                  </button>
                ))}
              </span>
            </div>
          )}
        </div>
      )}
      <span class="sr-only" role="status">
        {focused && typed ? `${hits.length} result${hits.length === 1 ? '' : 's'}` : ''}
      </span>
    </div>
  );
}
