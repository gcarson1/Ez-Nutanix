// Navigation with a spatial transition: the clicked element grows into the module header.
// Uses the View Transitions API where available; elsewhere (and under reduced motion) it
// simply navigates.
import { navigate } from '../../state/route';
import { prefersReducedMotion } from '../components/clock';

type VT = { ready: Promise<void>; updateCallbackDone: Promise<void>; finished: Promise<void> };
type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => VT };

export function go(path: string, params: Record<string, string> = {}, from?: HTMLElement | null) {
  const doc = document as VTDoc;
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
