// Kubernetes Platform, Day-2 services tab: observability across clusters (Prometheus, Thanos, Grafana,
// NKP Insights, AI Navigator), and backup and recovery (Velero, and Nutanix Data Services for
// Kubernetes replicating an application to a second site). Clusters, the app and the alert are
// examples; claims are in docs/facts.md (NKP-7 to NKP-9, NKP-16, NKP-17, CNA-6).
import type { ComponentChildren } from 'preact';
import { useEnum } from '../../../state/route';
import { Choice, prog } from '../../components/show';
import { Box, Story, W, fly, pts, type Pt, type StoryStep } from '../ai/kit';

// ── Observability ────────────────────────────────────────────────────────────────────────────────
const OB_AT = [0, 5, 11, 17];
const OB_STEPS: StoryStep[] = [
  { tone: 'ink', k: 'Each cluster is measured', text: 'Prometheus runs in every cluster and collects its metrics. On its own, that still means one place to look per cluster.' },
  {
    tone: 'flow',
    k: 'One place to look',
    text: 'Thanos aggregates the Prometheus data from all the clusters, and Grafana shows it as dashboards, so infrastructure and applications across the fleet are monitored from one view.',
  },
  {
    tone: 'warn',
    k: 'Insights flags a problem',
    text: 'The NKP Insights Engine collects events and metrics from the clusters and detects anomalies of varying severity. Here it raises a warning on one cluster before anyone has opened a dashboard.',
  },
  {
    tone: 'ok',
    k: 'AI Navigator helps with the fix',
    text: 'AI Navigator is NKP’s chatbot for best practices. Asked about the warning, it answers from what it can read of the cluster, within the access the person asking already has.',
  },
];
const OB_NAMES = ['retail-prod', 'fin-prod', 'retail-edge'];
const obX = (i: number) => 16 + i * 316;
const OB = { up: [5.4, 5.9, 6.4], spike: 11.3, alert: 12.6, ask: 17.5, answer: 19.2 };
const PANEL = { x: 16, y: 16, w: 600, h: 200 };
const rowY = (i: number) => PANEL.y + 70 + i * 46;
const upPath = (i: number): Pt[] => [
  [obX(i) + 148, 250],
  [obX(i) + 148, 232],
  [316, 232],
  [316, PANEL.y + PANEL.h],
];
/** A cluster's metric line up to `to` (0..1 of the row), with a spike on the middle cluster once it starts. */
function spark(i: number, to: number, spike: number): Pt[] {
  const x0 = PANEL.x + 150;
  const w = PANEL.w - 170;
  return Array.from({ length: 49 }, (_, k) => (k / 48) * to).map((f) => {
    const wave = Math.sin(f * 14 + i * 2.1) * 5 + Math.sin(f * 31 + i) * 2.5;
    const bump = i === 1 && f > 0.72 ? spike * 20 * Math.min(1, (f - 0.72) / 0.1) : 0;
    return [x0 + f * w, rowY(i) - wave - bump];
  });
}

function ObserveScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={OB_STEPS}
      at={OB_AT}
      end={23}
      poster={22}
      label="Observability"
      top={top}
      why="Example clusters, metric lines and one example warning, with times compressed. Observability is in NKP Pro and Ultimate; AI Navigator needs a Pro or Ultimate license, and its MCP server an internet-connected site."
      legend={[
        { color: 'var(--ink)', label: 'A cluster’s metrics' },
        { color: 'var(--warn)', label: 'Anomaly' },
        { color: 'var(--flow)', label: 'Metrics on their way to the shared view' },
      ]}
      kpis={(t) => {
        const up = OB.up.filter((a) => t >= a + 1).length;
        return [
          { k: 'Clusters in the shared view', v: `${up} of 3`, tone: up === 3 ? 'ok' : undefined },
          { k: 'Places to look', v: up === 3 ? 1 : 3, tone: up === 3 ? 'ok' : 'warn' },
          { k: 'Anomalies flagged', v: t >= OB.alert ? 1 : 0, tone: t >= OB.alert ? 'warn' : undefined, sub: t >= OB.alert ? 'by NKP Insights' : undefined },
          { k: 'AI Navigator', v: t >= OB.answer ? 'Answered' : t >= OB.ask ? 'Asked' : 'Idle', tone: t >= OB.answer ? 'ok' : undefined },
        ];
      }}
    >
      {(t, phase) => {
        const shown = (i: number) => prog(t, OB.up[i] + 1, OB.up[i] + 2.4);
        const spike = prog(t, OB.spike, OB.spike + 1.2);
        const alert = t >= OB.alert;
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 348`}
            role="img"
            aria-label="Three clusters each collect metrics with Prometheus. Thanos aggregates them and Grafana shows all three in one view. NKP Insights flags an anomaly on one cluster, and the AI Navigator chatbot helps with the fix."
          >
            <rect class="ai-ep" x={PANEL.x} y={PANEL.y} width={PANEL.w} height={PANEL.h} rx={8} />
            <text class="ai-site-t" x={PANEL.x + 14} y={PANEL.y + 22}>
              One view of the fleet
            </text>
            <text class="d-sub muted" x={PANEL.x + 14} y={PANEL.y + 40}>
              Thanos aggregates · Grafana shows
            </text>
            {OB_NAMES.map((name, i) => {
              const hot = i === 1 && spike > 0.3;
              return (
                <g key={name} style={{ opacity: 0.25 + 0.75 * Math.min(1, shown(i) * 3) }}>
                  <text class="d-sub" x={PANEL.x + 14} y={rowY(i) + 4} style={{ fontWeight: 600 }}>
                    {name}
                  </text>
                  <line class="ai-net" x1={PANEL.x + 150} x2={PANEL.x + PANEL.w - 20} y1={rowY(i) + 12} y2={rowY(i) + 12} />
                  {shown(i) > 0 && <polyline points={pts(spark(i, shown(i), spike))} class={`nk-spark${hot ? ' hot' : ''}`} />}
                  {hot && (
                    <text class="d-fine warn-fill" x={PANEL.x + 14} y={rowY(i) + 20} style={{ fontWeight: 600 }}>
                      ⚠ restarts rising
                    </text>
                  )}
                </g>
              );
            })}
            <Box
              x={640}
              y={16}
              w={304}
              h={92}
              t="NKP Insights"
              s="detects anomalies from events and metrics"
              state={alert ? '⚠ Warning: pods restarting on fin-prod' : phase >= 1 ? 'watching all three clusters' : 'watching'}
              tone={alert ? 'warn' : undefined}
              cls={alert ? 'ai-box warn' : 'ai-box'}
            />
            <Box
              x={640}
              y={124}
              w={304}
              h={92}
              t="AI Navigator"
              s={t >= OB.ask ? '“Why is fin-prod restarting pods?”' : 'chatbot for best practices'}
              state={t >= OB.answer ? '✓ points to the cause and the usual fix' : t >= OB.ask ? 'reading what you are allowed to see…' : 'ask it a question'}
              tone={t >= OB.answer ? 'ok' : undefined}
            />
            {OB_NAMES.map((name, i) => {
              const p = fly(t, OB.up[i], OB.up[i] + 1, upPath(i));
              const beat = (t * 1.3 + i * 0.4) % 1;
              return (
                <g key={name}>
                  <polyline points={pts(upPath(i))} class="ai-wire" style={{ opacity: phase >= 1 ? 1 : 0.35 }} />
                  <rect class={`nk-cl${i === 1 && alert ? '' : ''}`} x={obX(i)} y={250} width={296} height={84} rx={5} />
                  <text class="d-label" x={obX(i) + 12} y={272} style={{ fontWeight: 600 }}>
                    {name}
                  </text>
                  <rect class="nk-chip ok" x={obX(i) + 12} y={286} width={272} height={32} rx={4} />
                  <circle cx={obX(i) + 28 + beat * 6} cy={302} r={4} class="nk-dot" style={{ opacity: 0.4 + 0.6 * (1 - beat) }} />
                  <text class="d-sub" x={obX(i) + 44} y={307}>
                    Prometheus · collecting metrics
                  </text>
                  {p && <circle cx={p[0]} cy={p[1]} r={6} class="ai-req" />}
                </g>
              );
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── Backup and recovery ──────────────────────────────────────────────────────────────────────────
const PR_AT = [0, 5, 11, 17, 23];
const PR_STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'An app is more than its data',
    text: 'A Kubernetes application is its pods, its configuration and the data on its volumes, together in a namespace. Protecting it means capturing all of them, not only the data.',
  },
  { tone: 'flow', k: 'Velero backs it up on a schedule', text: 'Velero, the open-source tool included with NKP, takes scheduled backups of the application and keeps them for as long as the retention policy says.' },
  { tone: 'ok', k: 'A mistake, undone', text: 'Someone deletes the namespace by mistake. Velero restores the application to a known good state from the latest backup.' },
  {
    tone: 'flow',
    k: 'NDK replicates it to another site',
    text: 'Nutanix Data Services for Kubernetes (NDK) snapshots the application as one unit, its Kubernetes resources with its volume data, and replicates it asynchronously to a cluster at a second site, without slowing the primary.',
  },
  { tone: 'ok', k: 'The site is lost, the app recovers', text: 'When site A is lost, the application is recovered on the second cluster from its replicated copy, and NDK reconnects it to its data there.' },
];
const PR = { backups: [5.5, 7.0, 8.5], del: 11.5, restore: 13.2, back: 14.4, rep: [17.6, 20.4], fail: 23.5, up: 25.0 };
const A = { x: 16, y: 24, w: 380, h: 190 };
const B = { x: 564, y: 24, w: 380, h: 190 };
const STORE = { x: 16, y: 234, w: 380, h: 82 };
const DOWN: Pt[] = [
  [206, A.y + A.h],
  [206, STORE.y],
];
const ACROSS: Pt[] = [
  [A.x + A.w, 130],
  [B.x, 130],
];

/** The shop application's namespace: three pods, its configuration and its volume. */
function Namespace({ x, y, mode }: { x: number; y: number; mode: 'run' | 'gone' | 'copy' | 'none' }) {
  if (mode === 'none') {
    return (
      <g>
        <rect class="nk-slot" x={x} y={y} width={348} height={130} rx={5} />
        <text class="d-sub muted" x={x + 174} y={y + 70} text-anchor="middle">
          nothing here yet
        </text>
      </g>
    );
  }
  const gone = mode === 'gone';
  return (
    <g>
      <rect class={gone ? 'nk-slot' : 'nk-ns'} x={x} y={y} width={348} height={130} rx={5} style={{ opacity: mode === 'copy' ? 0.55 : 1 }} />
      <text class={`d-sub ${gone ? 'bad-fill' : ''}`} x={x + 12} y={y + 20} style={{ fontWeight: 600 }}>
        {gone ? '✕ namespace shop: deleted' : mode === 'copy' ? 'namespace shop: replicated copy, not running' : 'namespace: shop'}
      </text>
      {!gone && (
        <g style={{ opacity: mode === 'copy' ? 0.45 : 1 }}>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={x + 28 + i * 30} cy={y + 52} r={10} class="nk-pod" />
          ))}
          <text class="d-fine muted" x={x + 16} y={y + 82}>
            3 pods
          </text>
          <rect class="nk-chip" x={x + 124} y={y + 38} width={94} height={30} rx={4} />
          <text class="d-fine" x={x + 171} y={y + 57} text-anchor="middle">
            configuration
          </text>
          <rect class="nk-vol" x={x + 232} y={y + 34} width={100} height={38} rx={4} />
          <text class="d-fine" x={x + 282} y={y + 57} text-anchor="middle">
            volume: orders
          </text>
          <text class="d-fine muted" x={x + 16} y={y + 114}>
            pods, configuration and data, captured together
          </text>
        </g>
      )}
    </g>
  );
}

function ProtectScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={PR_STEPS}
      at={PR_AT}
      end={29}
      poster={28}
      label="Backup and recovery"
      top={top}
      why="An example application, schedule and sites, with times compressed. Backup and restore is in NKP Pro and Ultimate. NDK works with Nutanix storage; its recovery points and supported sites depend on the NDK release."
      legend={[
        { color: 'var(--flow)', label: 'Running pod' },
        { color: 'var(--ink)', label: 'Backup or replicated copy' },
        { color: 'var(--bad)', label: 'Deleted or failed' },
      ]}
      kpis={(t) => {
        const kept = PR.backups.filter((a) => t >= a + 0.9).length;
        const gone = t >= PR.del && t < PR.back;
        const failed = t >= PR.fail;
        const copy = t >= PR.rep[0] + 1.2;
        return [
          { k: 'Backups kept', v: kept, sub: kept ? 'by Velero, on a schedule' : undefined },
          {
            k: 'The shop app',
            v: failed ? (t >= PR.up ? 'Running at site B' : 'Down with site A') : gone ? 'Deleted' : t >= PR.back ? 'Restored' : 'Running',
            tone: failed ? (t >= PR.up ? 'ok' : 'bad') : gone ? 'bad' : 'ok',
          },
          { k: 'Copy at site B', v: copy ? 'Replicated' : 'None', tone: copy ? 'ok' : undefined, sub: copy ? 'by NDK, asynchronously' : undefined },
          { k: 'Captured', v: 'App and data', sub: 'as one unit' },
        ];
      }}
    >
      {(t) => {
        const kept = PR.backups.filter((a) => t >= a + 0.9).length;
        const gone = t >= PR.del && t < PR.back;
        const failed = t >= PR.fail;
        const copy = t >= PR.rep[0] + 1.2;
        const up = t >= PR.up;
        const restore = fly(t, PR.restore, PR.back, DOWN.slice().reverse() as Pt[]);
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 326`}
            role="img"
            aria-label="An application runs in a namespace on a cluster at site A. Velero backs it up on a schedule and restores it after the namespace is deleted by mistake. NDK replicates the application to a cluster at site B, where it is recovered when site A is lost."
          >
            <rect class={`nk-isl${failed ? ' down' : ''}`} x={A.x} y={A.y} width={A.w} height={A.h} rx={6} />
            <text class="d-label" x={A.x + 14} y={A.y + 22} style={{ fontWeight: 600 }}>
              retail-prod · site A
            </text>
            {failed && (
              <text class="d-sub bad-fill" x={A.x + A.w - 14} y={A.y + 22} text-anchor="end" style={{ fontWeight: 600 }}>
                ✕ site lost
              </text>
            )}
            <g style={{ opacity: failed ? 0.3 : 1 }}>
              <Namespace x={A.x + 16} y={A.y + 40} mode={gone ? 'gone' : 'run'} />
            </g>
            <polyline points={pts(DOWN)} class="ai-wire" />
            <rect class="ai-box" x={STORE.x} y={STORE.y} width={STORE.w} height={STORE.h} rx={6} />
            <text class="d-label" x={STORE.x + 14} y={STORE.y + 22} style={{ fontWeight: 600 }}>
              Backup storage
            </text>
            <text class="d-sub muted" x={STORE.x + STORE.w - 14} y={STORE.y + 22} text-anchor="end">
              Velero backups
            </text>
            {['01:00', '02:00', '03:00'].map((h, i) => (
              <g key={h} style={{ opacity: i < kept ? 1 : 0.2 }}>
                <rect class={`nk-chip${i === kept - 1 ? ' ok' : ''}`} x={STORE.x + 14 + i * 120} y={STORE.y + 36} width={110} height={32} rx={4} />
                <text class="d-sub mono" x={STORE.x + 69 + i * 120} y={STORE.y + 57} text-anchor="middle">
                  backup {h}
                </text>
              </g>
            ))}
            <polyline points={pts(ACROSS)} class={`ai-wire${copy ? '' : ' idle'}`} />
            <text class={`d-fine ${copy ? '' : 'muted'}`} x={(A.x + A.w + B.x) / 2} y={116} text-anchor="middle" style={{ fontWeight: copy ? 600 : 400 }}>
              NDK
            </text>
            <text class="d-fine muted" x={(A.x + A.w + B.x) / 2} y={150} text-anchor="middle">
              asynchronous replication
            </text>
            <rect class={`nk-isl${up ? ' ok' : ''}`} x={B.x} y={B.y} width={B.w} height={B.h} rx={6} />
            <text class="d-label" x={B.x + 14} y={B.y + 22} style={{ fontWeight: 600 }}>
              retail-dr · site B
            </text>
            {up && (
              <text class="d-sub ok-fill" x={B.x + B.w - 14} y={B.y + 22} text-anchor="end" style={{ fontWeight: 600 }}>
                ✓ app recovered here
              </text>
            )}
            <Namespace x={B.x + 16} y={B.y + 40} mode={up ? 'run' : copy ? 'copy' : 'none'} />
            {PR.backups.map((a, i) => {
              const p = fly(t, a, a + 0.9, DOWN);
              return p && <rect key={i} class="nk-copy" x={p[0] - 9} y={p[1] - 9} width={18} height={18} rx={3} />;
            })}
            {restore && <rect class="nk-copy" x={restore[0] - 9} y={restore[1] - 9} width={18} height={18} rx={3} />}
            {PR.rep.map((a, i) => {
              const p = fly(t, a, a + 1.2, ACROSS);
              return p && <rect key={i} class="nk-copy" x={p[0] - 9} y={p[1] - 9} width={18} height={18} rx={3} />;
            })}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type Service = 'obs' | 'protect';
const SERVICES: { value: Service; label: string }[] = [
  { value: 'obs', label: 'Observability' },
  { value: 'protect', label: 'Backup and recovery' },
];

export default function ServicesView() {
  const [svc, setSvc] = useEnum<Service>('s', 'obs', ['obs', 'protect']);
  const top = <Choice<Service> label="Service" value={svc} onChange={setSvc} options={SERVICES} />;
  return svc === 'protect' ? <ProtectScene key="protect" top={top} /> : <ObserveScene key="obs" top={top} />;
}
