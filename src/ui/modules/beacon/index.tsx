// Project Beacon: a short vision story on one timeline. Beacon is a direction (2023), not a
// product you buy; a marker walks 2023 to 2026 on a loop and each year's delivered piece appears
// with its status in words.
import { useClock } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

type Status = 'ok' | 'warn';

const YEARS: { year: string; title: string; tone: Tone | 'ink'; text: string; piece: { name: string; short: string; status: string; tone: Status; sub: string } }[] = [
  {
    year: '2023',
    title: 'The idea',
    tone: 'ink',
    text: 'At .NEXT in May 2023, Nutanix described Project Beacon as a multi-year vision: build an app once, run it anywhere, and let its data services come along. Databases as a service were named first; NDB ships today, though the run-anywhere service in the vision is broader.',
    piece: { name: 'Database Service (NDB)', short: 'NDB', status: 'Shipping', tone: 'ok', sub: 'Databases as a service, the first step named in 2023' },
  },
  {
    year: '2024',
    title: 'Kubernetes storage',
    tone: 'ink',
    text: 'In May 2024 the vision widened to cloud-native block and file storage for Kubernetes apps. NDK, which gives those apps snapshots, replication and DR, had gone GA that March.',
    piece: { name: 'Data Services for Kubernetes (NDK)', short: 'NDK', status: 'Shipping', tone: 'ok', sub: 'Snapshots, replication and DR for Kubernetes apps · GA March 2024' },
  },
  {
    year: '2025',
    title: 'First real product',
    tone: 'ok',
    text: 'Cloud Native AOS was announced in May 2025: AOS running as pods inside Kubernetes, with no hypervisor. Release 1.0 followed in July 2025 on Amazon EKS; with NDK, it is what the direction has delivered so far.',
    piece: { name: 'Cloud Native AOS', short: 'Cloud Native AOS', status: 'GA on EKS', tone: 'ok', sub: 'AOS as pods, no hypervisor · 1.0 on Amazon EKS, July 2025' },
  },
  {
    year: '2026',
    title: 'Where it stands',
    tone: 'warn',
    text: 'Nutanix no longer markets Beacon as a product; its page has not changed since 2024. The direction carries on in NKP Metal, Kubernetes and Cloud Native AOS on bare metal, in early access with GA targeted for the second half of 2026.',
    piece: { name: 'NKP Metal', short: 'NKP Metal', status: 'Early access', tone: 'warn', sub: 'Kubernetes and Cloud Native AOS on bare metal · GA targeted 2H 2026' },
  },
];

const W = 960;
const COL = W / YEARS.length;
const XC = YEARS.map((_, i) => COL * i + COL / 2);
const AXIS = 188;
const CARD = { y: 216, w: 216, h: 142 };
const H = CARD.y + CARD.h + 10;
const FIRST = 0.9;
const DWELL = 3.6;
const MOVE = 0.9;
const AT = YEARS.map((_, i) => FIRST + i * DWELL);
const END = AT[AT.length - 1] + DWELL;
const MARK = { ok: '✓', warn: '△' } as const;

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

function Timeline({ t, now }: { t: number; now: number }) {
  let x = 24;
  for (let i = 0; i < YEARS.length; i++) x += (XC[i] - x) * ease(prog(t, AT[i] - MOVE, AT[i]));
  return (
    <svg class="diagram bc-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Project Beacon from 2023 to 2026: a vision of building an app once and running it anywhere. Delivered along the way: NDB and NDK (shipping), Cloud Native AOS (GA on Amazon EKS) and NKP Metal (early access). Beacon itself is not a product.">
      <rect class="bc-band" x={1} y={12} width={W - 2} height={80} />
      <text x={22} y={36} class="warn-fill" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em' }}>
        ◇ THE VISION · NOT A PRODUCT YOU CAN BUY
      </text>
      <text x={22} y={60} style={{ fontSize: '16px', fontWeight: 600 }}>
        Build an app once, run it anywhere
      </text>
      <text x={22} y={80} class="muted" style={{ fontSize: '13px' }}>
        with the same data services wherever it runs
      </text>

      <line x1={24} y1={AXIS} x2={W - 24} y2={AXIS} class="bc-axis" />
      <line x1={24} y1={AXIS} x2={x} y2={AXIS} class="bc-axis on" />
      {YEARS.map((y, i) => {
        const seen = t >= AT[i];
        const k = prog(t, AT[i], AT[i] + 0.5);
        const cx = XC[i] - CARD.w / 2;
        const p = y.piece;
        const name = wrap(p.name, 22);
        return (
          <g key={y.year}>
            <text x={XC[i]} y={138} text-anchor="middle" class={`mono bc-year${i === now ? ' now' : seen ? '' : ' later'}`}>
              {y.year}
            </text>
            <text x={XC[i]} y={162} text-anchor="middle" class={seen ? 'muted' : 'faint'} style={{ fontSize: '13px' }}>
              {y.title}
            </text>
            <circle cx={XC[i]} cy={AXIS} r={6} class={seen ? 'bc-tick on' : 'bc-tick'} />
            {seen && (
              <g style={{ opacity: k, transform: `translateY(${(1 - k) * 12}px)` }}>
                <line x1={XC[i]} y1={AXIS + 6} x2={XC[i]} y2={CARD.y} class="bc-axis on" />
                <rect class={`bc-piece ${p.tone}${i === now ? ' now' : ''}`} x={cx} y={CARD.y} width={CARD.w} height={CARD.h} />
                <text x={cx + 14} y={CARD.y + 26} class={`bc-st ${p.tone}`}>
                  {MARK[p.tone]} {p.status.toUpperCase()}
                </text>
                {name.map((ln, j) => (
                  <text key={j} x={cx + 14} y={CARD.y + 52 + j * 19} style={{ fontSize: '14.5px', fontWeight: 600 }}>
                    {ln}
                  </text>
                ))}
                {wrap(p.sub, 29).map((ln, j) => (
                  <text key={j} x={cx + 14} y={CARD.y + 52 + (name.length - 1) * 19 + 24 + j * 16} class="muted" style={{ fontSize: '12px' }}>
                    {ln}
                  </text>
                ))}
              </g>
            )}
          </g>
        );
      })}
      <circle cx={x} cy={AXIS} r={9} class="bc-head" />
    </svg>
  );
}

export default function Beacon() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END, stops: AT });
  const t = clock.t;
  const now = phaseAt([0, ...AT.slice(1)], t);
  const y = YEARS[now];
  const shown = YEARS.filter((_, i) => t >= AT[i]).map((v) => v.piece);
  const shipping = shown.filter((p) => p.tone === 'ok');
  const early = shown.filter((p) => p.tone === 'warn');

  return (
    <Show
      foot={
        <>
          <Follow tone={y.tone} k={`${y.year} · ${y.title}`}>
            <p>{y.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Can you buy Beacon?', v: 'No', tone: 'warn', sub: 'it is a direction' },
              { k: 'Pieces shipping', v: shipping.length, tone: shipping.length ? 'ok' : undefined, sub: shipping.map((p) => p.short).join(', ') || '—' },
              { k: 'Early access', v: early.length, sub: early.map((p) => p.short).join(', ') || '—' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Timeline t={t} now={now} />
      </div>
      <PlayBar clock={clock} label="Beacon timeline animation" fmt={() => `${y.year} · ${y.title}`} extra={<Illus why="The dates are history and announced plans, not product commitments. Each product’s own release notes say what ships today." />} />
    </Show>
  );
}
