// Liquid glass for the home slide only, rendered by liquidGL (WebGPU/WebGL, MIT). The glass
// refracts the slide's gradient backdrop (.glass-bg). The "Nutanix Central" band is a lower lens
// and its tiles stack on it. Tile text stays in the DOM above the glass (content: false), so it
// stays crisp, selectable and focusable. Without a hardware GPU, with reduced transparency, more
// contrast or forced colors, inside another page's frame (a file preview in a chat or mail app,
// where a constant GPU loop would slow the host) or in an automated browser, nothing starts and the
// tiles keep their solid colors.
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

/** Software renderers, by the unmasked WebGL renderer name (Chrome's SwiftShader, Mesa's llvmpipe, Windows' basic driver). */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render/i;

/**
 * Only on a hardware GPU: software WebGL (VMs, remote desktops, blocklisted GPUs, headless
 * browsers) freezes the page. The browser refuses a context with this flag when it would fall
 * back to software, but not always (headless Chrome on a GPU-less Linux CI runner hands out
 * SwiftShader anyway), so the renderer's own name is checked too.
 */
function hardwareGpu(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true }) ?? c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return !SOFTWARE.test(renderer);
  } catch {
    return false;
  }
}

let gpu: boolean | undefined;

/**
 * Why the glass cannot run here, or null when it can. The theme menu shows the reason next to its
 * disabled Liquid glass switch; the viewer's own on/off choice is separate (data-glass on <html>).
 */
export function glassBlocker(): string | null {
  if (typeof matchMedia === 'undefined') return 'Not available here';
  if (window.self !== window.top) return 'Off inside another page';
  // Automated browsers (test runners, CI) skip it before the probe below: their GPU-less sandboxes
  // hand out a software renderer that takes seconds just to create a context. ?glass forces it on.
  if (navigator.webdriver && !/[?&]glass\b/.test(location.search)) return 'Off in automated browsers';
  // Safari's Increase Contrast reports prefers-contrast, not reduced transparency.
  const off = ['(prefers-reduced-transparency: reduce)', '(prefers-contrast: more)', '(forced-colors: active)'];
  if (off.some((q) => matchMedia(q).matches)) return 'Off with your display settings';
  return (gpu ??= hardwareGpu()) ? null : 'Needs a hardware GPU';
}

/**
 * Start the glass on the home slide; returns a cleanup that removes it and restores the solid
 * tiles. The switch is a class on <html>, which Preact never re-renders (the slide's own class
 * changes whenever the tour starts or stops).
 */
export function startGlass(): () => void {
  const root = document.documentElement;
  const make = liquidGL;
  if (glassBlocker() || !make) return () => {};
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
    if (root.dataset.glass === 'off') return; // turned off in the theme menu
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
  // The backdrop changes with the theme, and the theme menu turns the glass off and on, so rebuild
  // (or remove) the glass when either attribute changes.
  const mo = new MutationObserver(start);
  mo.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-glass'] });
  return () => {
    mo.disconnect();
    stop();
  };
}
