// Snapshots & Clones, Recovery points vs snapshots tab: the same snapshot technology two ways.
// On the left a VM snapshot, taken by hand on one VM and kept on its cluster (the Prism Element
// and AHV term). On the right recovery points, the Prism Central term: made on a schedule by a
// protection policy for every VM in a category, kept locally and replicated to another site,
// each with its own retention, and what recovery plans restore from. Claims: docs/facts.md section 18 (OWN-12).
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, ease, phaseAt, prog } from '../../components/show';

const P = [0, 1.5, 5, 9.5];
const END = 14;
const LINES: { tone: Tone | 'ink'; k: string; text: string }[] = [
  { tone: 'ink', k: 'Same technology underneath', text: 'A recovery point is a snapshot. The difference is who makes it, for which VMs, where it is kept and how long.' },
  { tone: 'flow', k: 'A snapshot: by hand, one VM', text: 'An admin takes a snapshot of one VM before a change. It is kept on the same cluster and managed there, in Prism Element.' },
  { tone: 'flow', k: 'Recovery points: by policy', text: 'In Prism Central, a protection policy takes recovery points on a schedule for every VM in a category, here three ERP VMs together, with no one clicking.' },
  { tone: 'ok', k: 'Replicated, with retention', text: 'The same policy replicates them to another site and keeps a set number locally and remotely. Recovery plans fail over from these, so they protect against losing the cluster; a local snapshot does not.' },
];
const STEPS = paced(P, LINES.map((l) => [l.k, l.text]));

const W = 960;
const H = 330;
const L = { x: 0, w: 448 };
const R = { x: 476, w: 484 };
const SNAP_AT = P[1] + 0.8;
const RP_AT = [P[2] + 0.6, P[2] + 2, P[2] + 3.4];
const REP_AT = (k: number) => P[3] + 0.3 + k * 0.9;
const RP_X = (k: number) => R.x + 150 + k * 92;
const SITE_A = 196;
const SITE_B = 266;

function CompareDiagram({ t }: { t: number }) {
  const snapIn = ease(prog(t, SNAP_AT, SNAP_AT + 0.5));
  return (
    <svg class="diagram sn-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Left: a VM snapshot taken by hand on one VM and kept on its own cluster. Right: recovery points taken on a schedule by a Prism Central protection policy for three VMs in one category, kept locally and replicated to another site.">
      {/* ── a VM snapshot ── */}
      <rect x={L.x} y={0} width={L.w} height={H} rx={6} class="sn-panel" />
      <text x={L.x + 16} y={26} style={{ fontSize: '15px', fontWeight: 650 }}>
        VM snapshot
      </text>
      <text x={L.x + 16} y={44} class="muted" style={{ fontSize: '12px' }}>
        Prism Element and AHV · taken by hand
      </text>
      <rect x={L.x + 16} y={64} width={150} height={44} rx={4} class="vm" />
      <text x={L.x + 28} y={91} style={{ fontSize: '13px', fontWeight: 600 }}>
        sql-prod
      </text>
      <rect x={L.x + 190} y={70} width={140} height={32} rx={4} class={`sn-act${t >= SNAP_AT - 0.4 && t < SNAP_AT + 0.4 ? ' on' : ''}`} />
      <text x={L.x + 260} y={91} text-anchor="middle" style={{ fontSize: '12px', fontWeight: 600 }}>
        Take snapshot
      </text>
      <text x={L.x + 16} y={SITE_A - 18} class="muted" style={{ fontSize: '11px' }}>
        This cluster
      </text>
      <line x1={L.x + 16} x2={L.x + L.w - 16} y1={SITE_A + 16} y2={SITE_A + 16} class="sn-lane" />
      {snapIn > 0 && (
        <g style={{ opacity: snapIn }}>
          <rect x={L.x + 30} y={SITE_A} width={84} height={32} rx={3} class="sn-own" />
          <text x={L.x + 72} y={SITE_A + 21} text-anchor="middle" class="sn-on-own" style={{ fontSize: '12px', fontWeight: 600 }}>
            9:00
          </text>
        </g>
      )}
      <text x={L.x + 16} y={SITE_B - 18} class="muted" style={{ fontSize: '11px' }}>
        Another site
      </text>
      <line x1={L.x + 16} x2={L.x + L.w - 16} y1={SITE_B + 16} y2={SITE_B + 16} class="sn-lane" stroke-dasharray="4 4" />
      <text x={L.x + 30} y={SITE_B + 8} class="faint" style={{ fontSize: '12px' }}>
        nothing here: a local snapshot stays on its cluster
      </text>

      {/* ── recovery points ── */}
      <rect x={R.x} y={0} width={R.w} height={H} rx={6} class="sn-panel" />
      <text x={R.x + 16} y={26} style={{ fontSize: '15px', fontWeight: 650 }}>
        Recovery points
      </text>
      <text x={R.x + 16} y={44} class="muted" style={{ fontSize: '12px' }}>
        Prism Central · made by a protection policy, or by hand
      </text>
      <rect x={R.x + 16} y={60} width={128} height={88} rx={4} class="sn-cat" />
      <text x={R.x + 26} y={78} class="mono" style={{ fontSize: '11px', fontWeight: 600 }}>
        category app: erp
      </text>
      {['erp-web', 'erp-app', 'erp-db'].map((v, k) => (
        <g key={v}>
          <rect x={R.x + 26} y={86 + k * 20} width={108} height={16} rx={2} class="vm" />
          <text x={R.x + 32} y={98 + k * 20} style={{ fontSize: '10.5px' }}>
            {v}
          </text>
        </g>
      ))}
      <rect x={R.x + 156} y={60} width={R.w - 172} height={88} rx={4} class={`sn-policy${t >= P[2] ? ' on' : ''}`} />
      <text x={R.x + 170} y={82} style={{ fontSize: '13px', fontWeight: 600 }}>
        Protection policy
      </text>
      <text x={R.x + 170} y={102} class="muted" style={{ fontSize: '12px' }}>
        every hour, for every VM in the category
      </text>
      <text x={R.x + 170} y={120} class="muted" style={{ fontSize: '12px' }}>
        keep 24 here, 7 at the other site
      </text>
      <text x={R.x + 170} y={138} class="muted" style={{ fontSize: '12px' }}>
        used by recovery plans for failover
      </text>
      <text x={R.x + 16} y={SITE_A - 18} class="muted" style={{ fontSize: '11px' }}>
        This site
      </text>
      <line x1={R.x + 16} x2={R.x + R.w - 16} y1={SITE_A + 16} y2={SITE_A + 16} class="sn-lane" />
      <text x={R.x + 16} y={SITE_B - 18} class="muted" style={{ fontSize: '11px' }}>
        Other site
      </text>
      <line x1={R.x + 16} x2={R.x + R.w - 16} y1={SITE_B + 16} y2={SITE_B + 16} class="sn-lane" />
      {RP_AT.map((a, k) => {
        const f = ease(prog(t, a, a + 0.5));
        if (f <= 0) return null;
        const rep = prog(t, REP_AT(k), REP_AT(k) + 0.8);
        const label = `${10 + k}:00`;
        return (
          <g key={k}>
            <g style={{ opacity: f }}>
              <rect x={RP_X(k)} y={SITE_A} width={78} height={32} rx={3} class="sn-own" />
              <text x={RP_X(k) + 39} y={SITE_A + 14} text-anchor="middle" class="sn-on-own" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                {label}
              </text>
              <text x={RP_X(k) + 39} y={SITE_A + 27} text-anchor="middle" class="sn-on-own" style={{ fontSize: '9.5px' }}>
                3 VMs
              </text>
            </g>
            {rep > 0 && rep < 1 && <circle cx={RP_X(k) + 39} cy={SITE_A + 32 + (SITE_B - SITE_A - 32) * ease(rep)} r={5} class="sn-rep-dot" />}
            {rep >= 1 && (
              <g>
                <rect x={RP_X(k)} y={SITE_B} width={78} height={32} rx={3} class="sn-copy" />
                <text x={RP_X(k) + 39} y={SITE_B + 21} text-anchor="middle" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  {label}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export function Compare() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END - 1, steps: STEPS });
  const t = clock.t;
  const line = LINES[phaseAt(P, t)];
  const made = RP_AT.filter((a) => t >= a + 0.5).length;
  const copied = RP_AT.filter((_, k) => t >= REP_AT(k) + 0.8).length;
  return (
    <Show
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Snapshots', v: t >= SNAP_AT ? 1 : 0, sub: 'by hand, this cluster only' },
              { k: 'Recovery points', v: made, sub: 'by policy, 3 VMs each', tone: made ? 'ok' : undefined },
              { k: 'At the other site', v: copied, tone: copied ? 'ok' : undefined, sub: 'replicated recovery points' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <CompareDiagram t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Snapshot or recovery point on this site' },
          { color: 'var(--s3)', label: 'Replicated copy at the other site' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Recovery points and snapshots animation"
        extra={<Illus why="Schedule and retention are examples you set in the protection policy. Times are compressed. A VM protected by a Prism Central protection policy cannot also be in a legacy protection domain." />}
      />
    </Show>
  );
}
