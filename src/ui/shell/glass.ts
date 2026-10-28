// Liquid glass for the home slide only, rendered by liquidGL (WebGPU/WebGL, MIT). The glass
// refracts the slide's gradient backdrop (.glass-bg). The "Nutanix Central" band is a lower lens
// and its tiles stack on it. Tile text stays in the DOM above the glass (content: false), so it
// stays crisp, selectable and focusable. Without a hardware GPU, with reduced transparency or
// forced colors, or inside another page's frame (a file preview in a chat or mail app, where a
// constant GPU loop would slow the host), nothing starts and the tiles keep their solid colors.
import liquidGL from 'liquid-gl';

type Lens = { destroy: () => void };

// The backdrop is a soft gradient, so a 1x capture looks the same as 2x and costs less GPU time.
const common = { resolution: 1, snapshot: '.glass-bg', content: false, reveal: 'fade', shadow: true, frost: 3, refraction: 0.035, bevelDepth: 0.12, bevelWidth: 0.18 } as const;

// The glass is clear: liquidGL's tint multiplies, which only darkens, so each tile's brand color
// is a translucent fill drawn over the glass in CSS (app.css) instead.
const GROUPS = [
  { target: '.glass-on .lg-band', zIndex: 3 },
  { target: '.glass-on .lg-card, .glass-on .lg-svc, .glass-on .lg-nci, .glass-on .lg-light', zIndex: 6 },
];

/**
 * Only on a hardware GPU: software WebGL (VMs, remote desktops, blocklisted GPUs, headless
 * browsers) can freeze the page for seconds. The browser refuses a context with this flag when it
 * would have to fall back to software rendering.
 */
function hardwareGpu(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ?? c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}

function wanted(): boolean {
  if (typeof matchMedia === 'undefined' || window.self !== window.top) return false;
  return !matchMedia('(prefers-reduced-transparency: reduce)').matches && !matchMedia('(forced-colors: active)').matches && hardwareGpu();
}

/**
 * Start the glass on the home slide; returns a cleanup that removes it and restores the solid
 * tiles. The switch is a class on <html>, which Preact never re-renders (the slide's own class
 * changes whenever the tour starts or stops).
 */
export function startGlass(): () => void {
  const root = document.documentElement;
  const make = liquidGL;
  if (!wanted() || !make) return () => {};
  let lenses: Lens[] = [];
  let raf = 0;
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

  const stop = () => {
    cancelAnimationFrame(raf);
    for (const l of lenses) l.destroy();
    lenses = [];
    root.classList.remove('glass-on');
  };
  const start = () => {
    stop();
    root.classList.add('glass-on');
    // Wait a frame so the transparent tile styles apply before the backdrop is captured.
    raf = requestAnimationFrame(() => {
      for (const g of GROUPS) {
        const made = make({ ...common, specular: motion, target: g.target, zIndex: g.zIndex });
        if (made) lenses.push(...(Array.isArray(made) ? made : [made]));
      }
    });
  };

  start();
  // The backdrop changes with the theme, so rebuild the glass when it switches.
  const mo = new MutationObserver(start);
  mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    mo.disconnect();
    stop();
  };
}
