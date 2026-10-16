// Project Beacon: a short vision story. Beacon is a direction (2023), not a product you buy;
// its concrete outcomes so far are Cloud Native AOS with NDK. Click a piece to see its status.
import { useEffect, useState } from 'preact/hooks';
import { useEnum, useNum } from '../../../state/route';
import { Follow, type Tone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import './style.css';

type PieceId = 'ndb' | 'ndk' | 'cnaos' | 'metal' | 'vision';

const PIECES: { id: PieceId; label: string; sub: string; tone: Tone; status: string; text: string; path?: string }[] = [
  {
    id: 'vision',
    label: 'Build once, run anywhere',
    sub: 'The overall idea',
    tone: 'neutral',
    status: 'Vision',
    text: 'The goal behind Beacon: the same data services, management and mobility for an app wherever it runs. This is a direction, not a feature you can turn on.',
  },
  {
    id: 'ndb',
    label: 'Database Service (NDB)',
    sub: 'First piece named in 2023',
    tone: 'ok',
    status: 'Shipping',
    text: 'In 2023 Beacon started with databases as a managed service. NDB itself is a shipping product (2.11 in July 2026); the fully managed, run-anywhere service described in the vision is broader than what ships today.',
    path: 'ndb',
  },
  {
    id: 'ndk',
    label: 'Data Services for Kubernetes',
    sub: 'NDK: app snapshots, replication, DR',
    tone: 'ok',
    status: 'Shipping',
    text: 'Nutanix Data Services for Kubernetes (NDK) gives Kubernetes apps snapshots, replication and DR. GA since March 2024; NDK 2.3 shipped in August 2026.',
    path: 'cnaos',
  },
  {
    id: 'cnaos',
    label: 'Cloud Native AOS',
    sub: 'AOS as pods, no hypervisor',
    tone: 'ok',
    status: 'GA on EKS',
    text: 'AOS storage delivered inside Kubernetes. Announced May 2025; release 1.0.0 (July 2025) runs on Amazon EKS. Press coverage calls it the first product out of Project Beacon.',
    path: 'cnaos',
  },
  {
    id: 'metal',
    label: 'NKP Metal',
    sub: 'Kubernetes and AOS on bare metal',
    tone: 'warn',
    status: 'Early access',
    text: 'Kubernetes on bare-metal servers with Cloud Native AOS storage and VMs alongside containers. Announced April 2026 as early access, GA targeted for the second half of 2026 and not confirmed.',
    path: 'cnaos',
  },
];

const CHAPTERS: { year: string; title: string; text: string; lit: PieceId[] }[] = [
  {
    year: '2023',
    title: 'The idea',
    text: 'At .NEXT in May 2023, Nutanix described Project Beacon as a multi-year vision: a data-centric platform where developers build an app once and run it anywhere, with data services that come along. Databases as a managed service were named as the first step.',
    lit: ['vision', 'ndb'],
  },
  {
    year: '2024',
    title: 'Broadened to Kubernetes storage',
    text: 'In May 2024 the vision expanded to cloud-native block and file storage for Kubernetes apps. NDK, which gives Kubernetes apps snapshots, replication and DR, had gone GA that March.',
    lit: ['vision', 'ndk'],
  },
  {
    year: '2025',
    title: 'The first concrete product',
    text: 'In May 2025 Nutanix announced Cloud Native AOS: AOS running as microservices inside Kubernetes, with no hypervisor. Release 1.0.0 followed in July 2025 on Amazon EKS. Together with NDK, it is what Beacon’s direction has delivered so far.',
    lit: ['ndk', 'cnaos'],
  },
  {
    year: '2026',
    title: 'Where it stands',
    text: 'Nutanix no longer markets Beacon as a product; the newest item on its web page is from 2024. The direction continues in shipping products and in NKP Metal, which brings Kubernetes and Cloud Native AOS to bare metal and was early access in 2026.',
    lit: ['cnaos', 'metal'],
  },
];

const IDS = PIECES.map((p) => p.id);

function VisionDiagram({ sel, lit, onSel, narrow }: { sel: PieceId | null; lit: PieceId[]; onSel: (p: PieceId) => void; narrow: boolean }) {
  // Wide: infrastructure in one row, pieces side by side. Narrow (phone): 2x2 infrastructure, pieces stacked.
  const W = narrow ? 440 : 960;
  const infra = ['Nutanix Cloud Infrastructure', 'Public cloud Kubernetes', 'Bare-metal Linux', 'Edge sites'];
  const perRow = narrow ? 2 : 4;
  const iw = (W - (perRow - 1) * 12) / perRow;
  const top = narrow ? 48 : 30;
  const infraY = top + 136;
  const infraEnd = infraY + Math.ceil(infra.length / perRow) * 60 - 12;
  const piecesHead = infraEnd + 48;
  const pw = narrow ? W : (W - 4 * 12) / 5;
  const ph = narrow ? 70 : 150;
  const piecesEnd = narrow ? piecesHead + 14 + PIECES.length * (ph + 10) - 10 : piecesHead + 14 + ph;
  const H = piecesEnd + 44;
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Project Beacon: the direction, and the pieces delivered so far">
      <text x={0} y={18} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
        THE DIRECTION
      </text>
      <text x={narrow ? 0 : W - 4} y={narrow ? 38 : 18} text-anchor={narrow ? 'start' : 'end'} class="warn-fill" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em' }}>
        ⚑ VISION · NOT A SHIPPING PRODUCT
      </text>
      <rect class="bc-apps" x={0} y={top} width={W} height={52} />
      <text x={W / 2} y={top + 32} text-anchor="middle" style={{ fontWeight: 600, fontSize: '15px' }}>
        Apps and databases, written once
      </text>
      <rect class="bc-band" x={0} y={top + 64} width={W} height={60} />
      <text x={W / 2} y={top + 90} text-anchor="middle" style={{ fontWeight: 600, fontSize: '15px' }}>
        {narrow ? 'Consistent data services and mobility' : 'Consistent data services, management and mobility'}
      </text>
      <text x={W / 2} y={top + 110} text-anchor="middle" class="muted" style={{ fontSize: '12.5px' }}>
        {narrow ? 'so the app can move without being rebuilt' : 'the same everywhere, so the app can move without being rebuilt'}
      </text>
      {infra.map((l, i) => {
        const x = (i % perRow) * (iw + 12);
        const y = infraY + Math.floor(i / perRow) * 60;
        return (
          <g key={l}>
            <rect class="bc-infra" x={x} y={y} width={iw} height={48} />
            <text x={x + iw / 2} y={y + 29} text-anchor="middle" style={{ fontSize: narrow ? '12.5px' : '13.5px' }}>
              {l}
            </text>
          </g>
        );
      })}

      <text x={0} y={piecesHead} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
        {narrow ? 'DELIVERED SO FAR · TAP A PIECE' : 'WHAT HAS BEEN DELIVERED ALONG THE WAY · CLICK A PIECE'}
      </text>
      {PIECES.map((p, i) => {
        const x = narrow ? 0 : i * (pw + 12);
        const y = narrow ? piecesHead + 14 + i * (ph + 10) : piecesHead + 14;
        const on = sel === p.id;
        const isLit = lit.includes(p.id);
        const mark = p.tone === 'ok' ? '✓' : p.tone === 'warn' ? '△' : '◇';
        return (
          <g
            key={p.id}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${p.label}: ${p.status}`}
            onClick={() => onSel(p.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSel(p.id))}
            class={isLit ? '' : 'bc-dim'}
          >
            <rect class={`hit bc-piece ${p.tone}${on ? ' sel' : ''}`} x={x} y={y} width={pw} height={ph} />
            {narrow ? (
              <>
                <text x={x + 14} y={y + 26} style={{ fontWeight: 600, fontSize: '14.5px' }}>
                  {p.label}
                </text>
                <text x={x + pw - 14} y={y + 26} text-anchor="end" class={`bc-st ${p.tone}`} style={{ fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.04em' }}>
                  {mark} {p.status.toUpperCase()}
                </text>
                <text x={x + 14} y={y + 50} class="muted" style={{ fontSize: '12px' }}>
                  {p.sub}
                </text>
              </>
            ) : (
              <>
                <text x={x + 14} y={y + 28} class={`bc-st ${p.tone}`} style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em' }}>
                  {mark} {p.status.toUpperCase()}
                </text>
                {wrap(p.label, 20).map((ln, k) => (
                  <text key={k} x={x + 14} y={y + 58 + k * 19} style={{ fontWeight: 600, fontSize: '14.5px' }}>
                    {ln}
                  </text>
                ))}
                {wrap(p.sub, 24).map((ln, k) => (
                  <text key={k} x={x + 14} y={y + 110 + k * 16} class="muted" style={{ fontSize: '12px' }}>
                    {ln}
                  </text>
                ))}
              </>
            )}
          </g>
        );
      })}
      <path d={`M0 ${piecesEnd + 20} H ${W}`} class="line" />
      <text x={0} y={piecesEnd + 38} class="muted" style={{ fontSize: '12px' }}>
        ✓ shipping · △ early access · ◇ vision
      </text>
    </svg>
  );
}

function useNarrow(px = 700): boolean {
  const q = typeof matchMedia !== 'undefined' ? matchMedia(`(max-width: ${px}px)`) : null;
  const [n, setN] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setN(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return n;
}

function wrap(s: string, n: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of s.split(' ')) {
    if ((cur + ' ' + w).trim().length > n && cur) {
      out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
}

export default function Beacon() {
  const [ch, setCh] = useNum('ch', 0, 0, CHAPTERS.length - 1);
  const [pc, setPc] = useEnum<PieceId | ''>('pc', '', ['', ...IDS]);
  const narrow = useNarrow();
  const chapter = CHAPTERS[ch];
  const piece = PIECES.find((p) => p.id === pc) ?? null;

  return (
    <>
      <div class="bc-note" role="note">
        <Icon name="info" />
        <span>
          <strong>Project Beacon is a direction, not a product.</strong> It was announced in 2023 as a multi-year vision. You cannot buy “Beacon”; you can buy the products that came out of it.
        </span>
      </div>
      <div class="tabs" role="tablist" aria-label="Story">
        {CHAPTERS.map((c, i) => (
          <button type="button" role="tab" key={c.year} aria-selected={i === ch} onClick={() => setCh(i)}>
            <span class="mono">{c.year}</span> · {c.title}
          </button>
        ))}
      </div>
      <div class="cols-2 bc-cols">
        <div>
          <p class="lede bc-lede">{chapter.text}</p>
          <div class="hstack" style={{ marginTop: 'var(--sp-4)', gap: 'var(--sp-2)' }}>
            <button type="button" class="btn" disabled={ch === 0} onClick={() => setCh(ch - 1)}>
              <Icon name="back" /> Previous
            </button>
            <button type="button" class="btn primary" disabled={ch === CHAPTERS.length - 1} onClick={() => setCh(ch + 1)}>
              Next <Icon name="arrow" />
            </button>
          </div>
        </div>
        <div>
          {piece ? (
            <Follow tone={piece.tone === 'neutral' ? 'ink' : piece.tone} k={`${piece.label} · ${piece.status}`}>
              <p>{piece.text}</p>
              {piece.path && (
                <p>
                  <button type="button" class="tbtn" onClick={() => go(piece.path!)}>
                    Open the related module <Icon name="arrow" />
                  </button>
                </p>
              )}
            </Follow>
          ) : (
            <Follow tone="ink" k="Pieces">
              <p>Click a piece in the diagram to see what it is and whether it ships today. The pieces lit up belong to the chapter you are on.</p>
            </Follow>
          )}
        </div>
      </div>
      <div class={narrow ? 'bc-diag' : 'diagram-scroll bc-diag'}>
        <VisionDiagram narrow={narrow} sel={piece?.id ?? null} lit={chapter.lit} onSel={(p) => setPc(p === pc ? '' : p)} />
      </div>
    </>
  );
}
