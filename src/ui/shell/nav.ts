// Navigation with a spatial transition: the clicked element grows into the module header.
// Uses the View Transitions API where available; elsewhere (and under reduced motion) it
// simply navigates.
import { afterNextRoute, backTo, getRoute, navigate } from '../../state/route';
import { prefersReducedMotion } from '../components/clock';

type VT = { ready: Promise<void>; updateCallbackDone: Promise<void>; finished: Promise<void> };
type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };

// The tile or pane that opened each module, so going back up can return focus to it, not just to the
// first tile with that path (three cloud tiles open the same module).
const entered: Record<string, string> = {};

export function go(path: string, params: Record<string, string> = {}, from?: HTMLElement | null) {
  const doc = document as VTDoc;
  if (from) entered[path] = from.dataset.pane ? `[data-pane="${from.dataset.pane}"]` : `[data-path="${from.dataset.path ?? path}"]`;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    navigate(path, params);
    window.scrollTo(0, 0);
    return;
  }
  if (from) {
    // Only one element may carry the name: hand it from the current header to the clicked tile.
    document.querySelectorAll<HTMLElement>('.mod-head').forEach((h) => h !== from && (h.style.viewTransitionName = 'none'));
    from.style.viewTransitionName = 'hero';
  }
  const vt = doc.startViewTransition(async () => {
    if (from) from.style.viewTransitionName = '';
    navigate(path, params);
    window.scrollTo(0, 0);
    // Let Preact flush the render before the new snapshot is taken.
    await new Promise((r) => setTimeout(r, 0));
  });
  // A newer transition (a quick second click, or Escape) skips this one and rejects its promises
  // with an AbortError. That is expected, so none of them may surface as an unhandled rejection.
  for (const p of [vt.ready, vt.updateCallbackDone, vt.finished]) p?.catch(() => undefined);
}

/**
 * Go up a level (Esc, Back, a breadcrumb). When that is where we came from, step back through
 * history so Back undoes the way in and the page keeps its scroll; then focus the tile or pane
 * that leads to the module just left.
 */
export function goUp(path: string) {
  const left = getRoute().path;
  // Two levels up (a breadcrumb), the module's own tile is gone, so fall back to its section's tile.
  afterNextRoute(() => {
    const tries = [entered[left], `[data-path="${left}"]`, `[data-path="${left.split('/')[0]}"]`].filter((q): q is string => !!q);
    tries.map((q) => document.querySelector<HTMLElement>(q)).find((el) => el)?.focus({ preventScroll: true });
  });
  if (!backTo(path)) go(path);
}
