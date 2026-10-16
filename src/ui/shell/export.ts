// "Download this view as PNG": rasterize the module's main SVG diagram with its computed
// styles inlined (CSS variables do not survive serialization), on the page background.
const PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline', 'paint-order', 'stroke-linejoin', 'stroke-linecap', 'letter-spacing'];

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src);
  const style = PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
  dst.setAttribute('style', style);
  const a = src.children;
  const b = dst.children;
  for (let i = 0; i < a.length; i++) inlineStyles(a[i], b[i]);
}

/** Pick the largest visible diagram in the module. */
export function mainDiagram(root: ParentNode = document): SVGSVGElement | null {
  const all = Array.from(root.querySelectorAll<SVGSVGElement>('.mod svg.diagram'));
  let best: SVGSVGElement | null = null;
  let area = 0;
  for (const s of all) {
    const r = s.getBoundingClientRect();
    if (r.width * r.height > area) {
      area = r.width * r.height;
      best = s;
    }
  }
  return best;
}

export async function downloadPng(name: string): Promise<boolean> {
  const svg = mainDiagram();
  if (!svg) return false;
  const rect = svg.getBoundingClientRect();
  const scale = 2;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineStyles(svg, clone);
  clone.setAttribute('width', String(rect.width));
  clone.setAttribute('height', String(rect.height));
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const xml = new XMLSerializer().serializeToString(clone);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('render failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    const pad = 24;
    canvas.width = (rect.width + pad * 2) * scale;
    canvas.height = (rect.height + pad * 2) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#0a0a0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad * scale, pad * scale, rect.width * scale, rect.height * scale);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return false;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
