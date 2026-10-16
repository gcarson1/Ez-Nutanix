// Navigation with a spatial transition: the clicked element grows into the module header.
// Uses the View Transitions API where available; elsewhere (and under reduced motion) it
// simply navigates.
import { navigate } from '../../state/route';
import { prefersReducedMotion } from '../components/clock';

type VTDoc = Document & { startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> } };

export function go(path: string, params: Record<string, string> = {}, from?: HTMLElement | null) {
  const doc = document as VTDoc;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    navigate(path, params);
    window.scrollTo(0, 0);
    return;
  }
  if (from) from.style.viewTransitionName = 'hero';
  const vt = doc.startViewTransition(async () => {
    if (from) from.style.viewTransitionName = '';
    navigate(path, params);
    window.scrollTo(0, 0);
    // Let Preact flush the render before the new snapshot is taken.
    await new Promise((r) => setTimeout(r, 0));
  });
  vt.finished.catch(() => undefined);
}
