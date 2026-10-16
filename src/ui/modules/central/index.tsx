// Nutanix Central & Prism Federation: pick the console you look through (one cluster's Prism
// Element, one region's Prism Central, or Nutanix Central over every region) and watch the
// clusters report up, a warning appear in one store, and how much that console can see.
// Which clusters each console sees comes from src/engine/fleet.ts; this file only animates it.
// The choice uses the URL key `tab` so the landing page's "Prism Federation" link (tab=fed) still works.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { CLUSTERS, DOMAINS, consolesToSeeAll, inView, totals, type Console } from '../../../engine/fleet';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

type View = 'pe' | 'pc' | 'fed';
const VIEWS: readonly View[] = ['pe', 'pc', 'fed'];
const LEVEL: Record<View, Console> = { pe: 'pe', pc: 'pc', fed: 'nc' };
/** The cluster whose Prism Element (and Prism Central) we look through. */
const FOCUS = CLUSTERS[0];
const WARNED = CLUSTERS.find((c) => c.health !== 'ok') ?? CLUSTERS[CLUSTERS.length - 1];

// ── geometry ──
const W = 960;
const TW = 168; // cluster tile width
const GAP = 16;
const DGAP = 40; // extra room between regions
const TY = 236; // cluster tiles
const TH = 142;
const PY = 124; // Prism Central boxes
const PH = 56;
const NY = 14; // Nutanix Central box
const NH = 58;
const NW = 400;
const BUS_PC = 206;
const BUS_NC = 98;
const FRAME_BOTTOM = TY + TH + 8;
const H = FRAME_BOTTOM + 34;

const LAYOUT = (() => {
  const xs = new Map<string, number>();
  let w = 0;
  CLUSTERS.forEach((c, i) => {
    if (i) w += CLUSTERS[i - 1].domain === c.domain ? GAP : DGAP;
    xs.set(c.id, w);
    w += TW;
  });
  const x0 = (W - w) / 2;
  for (const [k, v] of xs) xs.set(k, v + x0);
  const pc = new Map(
    DOMAINS.map((d) => {
      const mine = CLUSTERS.filter((c) => c.domain === d.id);
      const a = xs.get(mine[0].id)!;
      const b = xs.get(mine[mine.length - 1].id)! + TW;
      return [d.id, { a: a + 10, b: b - 10, mid: (a + b) / 2 }] as const;
    }),
  );
  return { xs, pc };
})();

type Pt = [number, number];
const cx = (id: string) => LAYOUT.xs.get(id)! + TW / 2;
const upPath = (id: string, domain: string): Pt[] => {
  const m = LAYOUT.pc.get(domain)!.mid;
  return [[cx(id), TY], [cx(id), BUS_PC], [m, BUS_PC], [m, PY + PH]];
};
const fedPath = (domain: string): Pt[] => {
  const m = LAYOUT.pc.get(domain)!.mid;
  return [[m, PY], [m, BUS_NC], [W / 2, BUS_NC], [W / 2, NY + NH]];
};
const nodeX = (id: string, n: number) => LAYOUT.xs.get(id)! + 12 + n * 17;
const STRIP_Y = TY + 46;
const STRIP_H = 24;
const NODES_Y = TY + 94;

function along(pts: Pt[], f: number): Pt {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

const poly = (pts: Pt[]) => pts.map((p) => p.join(',')).join(' ');

// ── timeline ──
const UP_GAP = 0.3;
const UP_DUR = 1.1;
const FED_GAP = 0.35;
const FED_DUR = 1.0;
const LOCAL_DUR = 0.6;
const BEAT = 1.8;

interface Timeline {
  up: number | null;
  fed: number | null;
  warn: number;
  /** When the warning reaches the console being looked through. */
  arrive: number;
  view: number;
  end: number;
  starts: number[];
}

function timeline(v: View): Timeline {
  const up = v === 'pe' ? null : 1.6;
  const upEnd = up === null ? 0 : up + UP_GAP * (CLUSTERS.length - 1) + UP_DUR;
  const fed = v === 'fed' ? upEnd + 0.4 : null;
  const fedEnd = fed === null ? upEnd : fed + FED_GAP * (DOMAINS.length - 1) + FED_DUR;
  const warn = v === 'pe' ? 2.2 : fedEnd + 0.5;
  const arrive = warn + LOCAL_DUR + (up !== null ? UP_DUR : 0) + (fed !== null ? FED_DUR : 0);
  const view = arrive + (v === 'pe' ? 2 : 0.9);
  const starts = [0, ...(up !== null ? [up] : []), ...(fed !== null ? [fed] : []), warn, view];
  return { up, fed, warn, arrive, view, end: view + 2.6, starts };
}

const upArrive = (tl: Timeline, i: number) => (tl.up === null ? Infinity : tl.up + i * UP_GAP + UP_DUR);
const fedArrive = (tl: Timeline, d: number) => (tl.fed === null ? Infinity : tl.fed + d * FED_GAP + FED_DUR);

type Line = { tone: Tone | 'ink'; k: string; word: string; text: string };

const OWN: Line = {
  tone: 'ink',
  k: 'Each cluster runs itself',
  word: 'Own cluster',
  text: 'Every cluster has Prism Element built in. It manages that one cluster: its nodes, storage and VMs. The dots are nodes reporting in.',
};

function lines(v: View): Line[] {
  const store = `${WARNED.name} (${WARNED.site})`;
  if (v === 'pe')
    return [
      OWN,
      { tone: 'warn', k: 'A warning somewhere else', word: 'Warning', text: `${store} is filling up. Its own Prism Element shows the warning, but from ${FOCUS.name} you cannot see it.` },
      { tone: 'ink', k: 'One cluster at a time', word: 'One at a time', text: `To check all ${CLUSTERS.length} clusters, someone logs in to ${CLUSTERS.length} consoles, one per cluster.` },
    ];
  const up: Line = {
    tone: 'flow',
    k: 'Reporting up',
    word: 'Reporting',
    text: 'Each cluster is registered to one Prism Central, here one per region, and sends it health, capacity and alerts.',
  };
  if (v === 'pc')
    return [
      OWN,
      up,
      { tone: 'warn', k: 'A warning, seen centrally', word: 'Warning', text: `${store} is filling up. The warning reaches the Americas Prism Central, next to the other clusters in that region.` },
      { tone: 'ink', k: 'One region at a time', word: 'One region', text: `EMEA has its own Prism Central. To see every cluster you still open ${consolesToSeeAll('pc')} consoles.` },
    ];
  return [
    OWN,
    up,
    { tone: 'flow', k: 'Federated', word: 'Federated', text: 'Nutanix Central federates both Prism Centrals, so every region reports to one place.' },
    { tone: 'warn', k: 'A warning, seen from the top', word: 'Warning', text: `${store} is filling up. The warning reaches Nutanix Central, next to every other cluster in every region.` },
    { tone: 'ok', k: 'One place', word: 'One place', text: 'One view, one sign-in and one set of roles across every cluster and region. Clusters keep running on their own if it is unreachable.' },
  ];
}

function frameOf(v: View): { x: number; y: number; w: number; h: number; label: string } {
  if (v === 'pe') {
    const x = LAYOUT.xs.get(FOCUS.id)!;
    return { x: x - 8, y: TY - 8, w: TW + 16, h: TH + 16, label: `In view from ${FOCUS.name}’s Prism Element: this one cluster` };
  }
  if (v === 'pc') {
    const d = DOMAINS.find((x) => x.id === FOCUS.domain)!;
    const mine = CLUSTERS.filter((c) => c.domain === d.id);
    const a = LAYOUT.xs.get(mine[0].id)!;
    const b = LAYOUT.xs.get(mine[mine.length - 1].id)! + TW;
    return { x: a - 8, y: PY - 10, w: b - a + 16, h: FRAME_BOTTOM - PY + 10, label: `In view from ${d.name}: the ${mine.length} clusters registered to it` };
  }
  return { x: 4, y: 4, w: W - 8, h: FRAME_BOTTOM - 4, label: 'In view from Nutanix Central: every cluster in every region' };
}

function Fleet({ view, t, tl }: { view: View; t: number; tl: Timeline }) {
  const level = LEVEL[view];
  const seen = new Set(inView(level, FOCUS.id).map((c) => c.id));
  const domSeen = (d: string) => view === 'fed' || (view === 'pc' && d === FOCUS.domain);
  const warned = t >= tl.warn;
  const frame = frameOf(view);
  const warnAtPc = tl.up === null ? Infinity : tl.warn + LOCAL_DUR + UP_DUR;
  const warnAtNc = tl.fed === null ? Infinity : warnAtPc + FED_DUR;

  // the warning travelling up as far as this console reaches
  let warnDot: Pt | null = null;
  if (t >= tl.warn && t < tl.warn + LOCAL_DUR) {
    const k = ease(prog(t, tl.warn, tl.warn + LOCAL_DUR));
    warnDot = [cx(WARNED.id), NODES_Y - (NODES_Y - (STRIP_Y + STRIP_H)) * k];
  } else if (tl.up !== null && t >= tl.warn + LOCAL_DUR && t < warnAtPc) {
    warnDot = along(upPath(WARNED.id, WARNED.domain), ease(prog(t, tl.warn + LOCAL_DUR, warnAtPc)));
  } else if (tl.fed !== null && t >= warnAtPc && t < warnAtNc) {
    warnDot = along(fedPath(WARNED.domain), ease(prog(t, warnAtPc, warnAtNc)));
  }

  const ncCount = DOMAINS.reduce((s, d, i) => s + (t >= fedArrive(tl, i) ? CLUSTERS.filter((c) => c.domain === d.id).length : 0), 0);

  return (
    <svg class="diagram cen-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${CLUSTERS.length} clusters in ${DOMAINS.length} regions, each region with its own Prism Central, and Nutanix Central above both. ${frame.label}.`}>
      {/* links: Prism Central to Nutanix Central */}
      {DOMAINS.map((d, i) => (
        <polyline key={d.id} points={poly(fedPath(d.id))} class={`cen-link${view !== 'fed' ? ' off cen-out' : t >= fedArrive(tl, i) ? ' live' : ''}`} />
      ))}
      {/* links: cluster to Prism Central */}
      {CLUSTERS.map((c, i) => (
        <polyline key={c.id} points={poly(upPath(c.id, c.domain))} class={`cen-link${view === 'pe' ? ' off cen-out' : t >= upArrive(tl, i) ? ' live' : ''}${view === 'pc' && !domSeen(c.domain) ? ' cen-out' : ''}`} />
      ))}

      {/* Nutanix Central */}
      <g class={view === 'fed' ? '' : 'cen-out'}>
        <rect class={`cen-box${view === 'fed' ? ' on' : ''}`} x={W / 2 - NW / 2} y={NY} width={NW} height={NH} />
        <text x={W / 2} y={NY + 24} text-anchor="middle" class="cen-h">
          Nutanix Central
        </text>
        <text x={W / 2} y={NY + 44} text-anchor="middle" class="cen-s">
          {view === 'fed' ? (
            <>
              Sees {ncCount} of {CLUSTERS.length} clusters
              {t >= warnAtNc && <tspan class="warn-fill"> · ⚠ 1 warning</tspan>}
            </>
          ) : (
            'Federates many Prism Centrals'
          )}
        </text>
      </g>

      {/* Prism Central per region */}
      {DOMAINS.map((d) => {
        const p = LAYOUT.pc.get(d.id)!;
        const on = domSeen(d.id);
        const mine = CLUSTERS.map((c, i) => ({ c, i })).filter(({ c }) => c.domain === d.id);
        const k = mine.filter(({ i }) => t >= upArrive(tl, i)).length;
        const hasWarn = d.id === WARNED.domain && t >= warnAtPc;
        return (
          <g key={d.id} class={on ? '' : 'cen-out'}>
            <rect class={`cen-box${view === 'pc' && on ? ' on' : ''}`} x={p.a} y={PY} width={p.b - p.a} height={PH} />
            <text x={p.mid} y={PY + 23} text-anchor="middle" class="cen-h">
              {d.name}
            </text>
            <text x={p.mid} y={PY + 42} text-anchor="middle" class="cen-s">
              {view === 'pe' ? (
                'Manages the clusters registered to it'
              ) : (
                <>
                  {k} of {mine.length} clusters reporting
                  {hasWarn && <tspan class="warn-fill"> · ⚠ 1 warning</tspan>}
                </>
              )}
            </text>
          </g>
        );
      })}

      {/* clusters */}
      {CLUSTERS.map((c, ci) => {
        const x = LAYOUT.xs.get(c.id)!;
        const isWarn = c.id === WARNED.id && warned;
        const peOn = view === 'pe' && c.id === FOCUS.id;
        return (
          <g key={c.id} class={seen.has(c.id) ? '' : 'cen-out'}>
            <rect class={`node-box${isWarn ? ' warn' : ''}`} x={x} y={TY} width={TW} height={TH} />
            <text x={x + 12} y={TY + 20} class="cen-name">
              {c.name}
            </text>
            <text x={x + 12} y={TY + 36} class="muted" style={{ fontSize: '11px' }}>
              {c.site}
            </text>
            <rect class={`cen-pe${peOn ? ' on' : ''}`} x={x + 10} y={STRIP_Y} width={TW - 20} height={STRIP_H} />
            <text x={x + TW / 2} y={STRIP_Y + 16} text-anchor="middle" class={`cen-pe-t${peOn ? ' on' : ''}`}>
              Prism Element
            </text>
            {Array.from({ length: c.nodes }, (_, n) => (
              <rect key={n} class={`cvm${isWarn ? ' warn' : ''}`} x={nodeX(c.id, n)} y={NODES_Y} width={13} height={16} />
            ))}
            {Array.from({ length: c.nodes }, (_, n) => {
              const off = (n * 0.23 + ci * 0.41) % BEAT;
              const f = ((((t - off) % BEAT) + BEAT) % BEAT) / LOCAL_DUR;
              if (f > 1) return null;
              const y = NODES_Y - (NODES_Y - (STRIP_Y + STRIP_H)) * ease(f);
              return <circle key={`b${n}`} class="cen-beat" cx={nodeX(c.id, n) + 6.5} cy={y} r={2.6} />;
            })}
            <text x={x + 12} y={TY + TH - 12} class={isWarn ? 'warn-fill' : 'ok-fill'} style={{ fontSize: '11px', fontWeight: 600 }}>
              {isWarn ? `⚠ ${c.issue ?? 'Warning'}` : '✓ Healthy'}
            </text>
          </g>
        );
      })}

      {/* reports travelling up */}
      {CLUSTERS.map((c, i) => {
        if (tl.up === null) return null;
        const a = tl.up + i * UP_GAP;
        if (t < a || t >= a + UP_DUR) return null;
        const [x, y] = along(upPath(c.id, c.domain), ease(prog(t, a, a + UP_DUR)));
        return <circle key={c.id} class={`cen-dot${domSeen(c.domain) ? '' : ' cen-out'}`} cx={x} cy={y} r={5} />;
      })}
      {DOMAINS.map((d, i) => {
        if (tl.fed === null) return null;
        const a = tl.fed + i * FED_GAP;
        if (t < a || t >= a + FED_DUR) return null;
        const [x, y] = along(fedPath(d.id), ease(prog(t, a, a + FED_DUR)));
        return <circle key={d.id} class="cen-dot" cx={x} cy={y} r={6} />;
      })}
      {warnDot && <circle class="cen-warn-dot" cx={warnDot[0]} cy={warnDot[1]} r={7} />}

      {/* what this console sees */}
      <rect class={`cen-scope${t >= tl.view ? ' now' : ''}`} x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={6} />
      <text x={frame.x + 2} y={FRAME_BOTTOM + 24} class="cen-scope-t">
        {frame.label}
      </text>
    </svg>
  );
}

export default function Central() {
  const [view, setView] = useEnum<View>('tab', 'fed', VIEWS);
  const tl = useMemo(() => timeline(view), [view]);
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.view + 0.5, stops: tl.starts });
  useRestartOn(clock, [view]);
  const t = clock.t;
  const phase = phaseAt(tl.starts, t);
  const L = lines(view);
  const line = L[phase];
  const level = LEVEL[view];
  const tot = totals(inView(level, FOCUS.id));
  const consoles = consolesToSeeAll(level);
  const sawWarning = inView(level, FOCUS.id).some((c) => c.id === WARNED.id);

  return (
    <Show
      top={
        <Choice<View>
          label="Look through"
          value={view}
          onChange={setView}
          options={[
            { value: 'pe', label: 'Prism Element · one cluster' },
            { value: 'pc', label: 'Prism Central · one region' },
            { value: 'fed', label: 'Nutanix Central · every region' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Clusters it covers', v: `${tot.clusters} of ${CLUSTERS.length}`, sub: `${tot.nodes} nodes` },
              { k: 'Consoles to see them all', v: consoles, tone: consoles === 1 ? 'ok' : 'neutral', tip: 'How many consoles of this kind someone has to open to see every cluster.' },
              { k: `${WARNED.name} warning`, v: sawWarning ? 'Seen' : 'Missed', tone: sawWarning ? 'ok' : 'warn' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Fleet view={view} t={t} tl={tl} />
      </div>
      <PlayBar
        clock={clock}
        label="Fleet reporting animation"
        fmt={() => L[phase].word}
        extra={<Illus why="Five example clusters in two regions. Reports are drawn as dots in one pass; real clusters report continuously. Nutanix Central on-premises supports up to 25 Prism Central domains." />}
      />
    </Show>
  );
}
