// Kubernetes Platform, Apps and data tab: how a request reaches an application (load balancer,
// ingress, service, network policy) and how its pods get storage through Nutanix CSI (a Volume Group
// for one writer, a Files share for many). Names are examples; claims are in docs/facts.md (NKP-22).
import type { ComponentChildren } from 'preact';
import { useEnum } from '../../../state/route';
import { Choice, prog } from '../../components/show';
import { Box, Cross, Story, W, along, fly, pts, type Pt, type StoryStep } from '../ai/kit';
import { ProtectScene } from './services';

const AT = [0, 5, 10, 15, 20];
const STEPS: StoryStep[] = [
  {
    tone: 'ink',
    k: 'A request comes in',
    text: 'A customer opens the shop. On-premises, NKP’s built-in load balancer, MetalLB, gives the application an address to reach; in a public cloud NKP uses that cloud’s load balancers.',
  },
  { tone: 'flow', k: 'Ingress routes it', text: 'Traefik routes HTTP traffic to the right service inside the cluster and can require sign-in first. The service spreads requests over the application’s pods.' },
  { tone: 'bad', k: 'Tenants cannot reach each other', text: 'The cluster network is Cilium or Calico. A network policy says which pods may talk, so a pod in another team’s namespace cannot reach the shop’s pods.' },
  {
    tone: 'ink',
    k: 'Storage through Nutanix CSI',
    text: 'A pod asks for storage and the Nutanix CSI driver provides it from the Nutanix cluster underneath. The database gets a Volume Group, a block volume that one pod writes to.',
  },
  { tone: 'ok', k: 'Shared storage for many pods', text: 'When several pods must read and write the same files, a Nutanix Files share is mounted by all of them at once. Kubernetes calls this ReadWriteMany.' },
];
const T = { req: [0.6, 2.4, 5.6, 7.4], block: 10.6, vol: 15.6, share: 20.6 };
const Y = 96;
const HOPS = [
  { x: 16, w: 130, t: 'Customer', s: 'opens the shop' },
  { x: 176, w: 150, t: 'Load balancer', s: 'MetalLB on-premises' },
  { x: 356, w: 150, t: 'Ingress', s: 'Traefik · HTTP routing' },
  { x: 536, w: 130, t: 'Service', s: 'spreads requests' },
];
const NS = { x: 700, y: 40, w: 244, h: 150 };
const podX = (i: number) => NS.x + 44 + i * 54;
const POD_Y = NS.y + 78;
const reqPath = (pod: number): Pt[] => [
  [146, Y],
  [176, Y],
  [326, Y],
  [356, Y],
  [506, Y],
  [536, Y],
  [666, Y],
  [podX(pod), POD_Y],
];
const OTHER = { x: 700, y: 214, w: 244, h: 56 };
const TRY_X = NS.x + NS.w - 22;
const BLOCKED: Pt[] = [
  [TRY_X, OTHER.y],
  [TRY_X, NS.y + NS.h],
];
const CSI = { x: 176, y: 214, w: 490, h: 84 };

function TrafficScene({ top }: { top: ComponentChildren }) {
  return (
    <Story
      steps={STEPS}
      at={AT}
      end={25}
      poster={24}
      label="Traffic and storage"
      top={top}
      why="An example application with times compressed. Which load balancer, ingress settings and network policies apply is configuration; storage classes for Volume Groups and Files come from the Nutanix CSI driver and need a Nutanix cluster underneath."
      legend={[
        { color: 'var(--flow)', label: 'Request, and running pod' },
        { color: 'var(--bad)', label: 'Blocked by network policy' },
        { color: 'var(--ink)', label: 'Storage from the Nutanix cluster' },
      ]}
      kpis={(t) => {
        const done = T.req.filter((a) => t >= a + 1.6).length;
        return [
          { k: 'Requests answered', v: done },
          { k: 'Blocked by network policy', v: t >= T.block + 0.8 ? 1 : 0, tone: t >= T.block + 0.8 ? 'bad' : undefined },
          { k: 'Volumes attached', v: (t >= T.vol + 0.8 ? 1 : 0) + (t >= T.share + 0.8 ? 1 : 0), sub: t >= T.share + 0.8 ? 'one block, one shared' : t >= T.vol + 0.8 ? 'one block volume' : undefined },
          { k: 'Storage from', v: 'Nutanix CSI', sub: 'Volume Groups and Files' },
        ];
      }}
    >
      {(t, phase) => {
        const blocked = t >= T.block + 0.8;
        const vol = prog(t, T.vol, T.vol + 0.8);
        const share = prog(t, T.share, T.share + 0.8);
        const attempt = fly(t, T.block, T.block + 0.8, BLOCKED);
        return (
          <svg
            class="diagram nk-svg"
            viewBox={`0 0 ${W} 314`}
            role="img"
            aria-label="A customer's request passes the load balancer, the Traefik ingress and a service to reach one of the shop's pods. A pod from another team's namespace is blocked by network policy. The database pod gets a Volume Group and the web pods share a Nutanix Files volume, both through Nutanix CSI."
          >
            {HOPS.map((h, i) => (
              <g key={h.t}>
                <Box x={h.x} y={Y - 32} w={h.w} h={64} t={h.t} s={h.s} cls={i === 2 && phase === 1 ? 'ai-ep' : 'ai-box'} />
                <line class="ai-wire" x1={h.x + h.w} x2={i < 3 ? HOPS[i + 1].x : NS.x} y1={Y} y2={Y} />
              </g>
            ))}
            <rect class="nk-ns" x={NS.x} y={NS.y} width={NS.w} height={NS.h} rx={6} />
            <text class="d-sub" x={NS.x + 12} y={NS.y + 20} style={{ fontWeight: 600 }}>
              namespace: shop
            </text>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <circle cx={podX(i)} cy={POD_Y} r={12} class="nk-pod" />
                <text class="d-fine" x={podX(i)} y={POD_Y + 30} text-anchor="middle">
                  web {i + 1}
                </text>
              </g>
            ))}
            <circle cx={podX(3)} cy={POD_Y} r={12} class="nk-pod db" />
            <text class="d-fine" x={podX(3)} y={POD_Y + 30} text-anchor="middle">
              db
            </text>
            <text class="d-fine muted" x={NS.x + 12} y={NS.y + 38}>
              {phase >= 2 ? 'policy: only the ingress may call in' : 'three web pods and a database'}
            </text>
            <g style={{ opacity: phase >= 2 ? 1 : 0.3 }}>
              <rect class="nk-wk" x={OTHER.x} y={OTHER.y} width={OTHER.w} height={OTHER.h} rx={6} />
              <text class="d-sub" x={OTHER.x + 12} y={OTHER.y + 22} style={{ fontWeight: 600 }}>
                namespace: another team
              </text>
              <text class={`d-fine ${blocked ? 'bad-fill' : 'muted'}`} x={OTHER.x + 12} y={OTHER.y + 42} style={{ fontWeight: blocked ? 600 : 400 }}>
                {blocked ? '✕ its pod cannot reach the shop' : 'a pod tries to call the shop'}
              </text>
            </g>
            {blocked && <Cross x={TRY_X} y={(OTHER.y + NS.y + NS.h) / 2} />}

            <g style={{ opacity: phase >= 3 ? 1 : 0.3 }}>
              <rect class="ai-ep" x={CSI.x} y={CSI.y} width={CSI.w} height={CSI.h} rx={8} />
              <text class="ai-site-t" x={CSI.x + 14} y={CSI.y + 22}>
                Nutanix CSI
              </text>
              <text class="d-sub muted" x={CSI.x + CSI.w - 14} y={CSI.y + 22} text-anchor="end">
                storage from the Nutanix cluster
              </text>
              <g style={{ opacity: 0.3 + 0.7 * vol }}>
                <rect class="nk-vol" x={CSI.x + 14} y={CSI.y + 36} width={224} height={36} rx={4} />
                <text class="d-fine" x={CSI.x + 24} y={CSI.y + 58} style={{ fontWeight: 600 }}>
                  Volume Group · one writer (db)
                </text>
              </g>
              <g style={{ opacity: 0.3 + 0.7 * share }}>
                <rect class="nk-vol" x={CSI.x + 252} y={CSI.y + 36} width={224} height={36} rx={4} />
                <text class="d-fine" x={CSI.x + 262} y={CSI.y + 58} style={{ fontWeight: 600 }}>
                  Files share · many writers (web)
                </text>
              </g>
            </g>
            {vol > 0 && (
              <polyline
                points={pts([
                  [CSI.x + 126, CSI.y + 36],
                  [CSI.x + 126, 198],
                  [podX(3), 198],
                  [podX(3), POD_Y + 36],
                ])}
                class="nk-stor"
                style={{ opacity: vol }}
              />
            )}
            {share > 0 &&
              [0, 1, 2].map((i) => (
                <polyline
                  key={i}
                  points={pts([
                    [CSI.x + 364, CSI.y + 36],
                    [CSI.x + 364, 206],
                    [podX(i), 206],
                    [podX(i), POD_Y + 36],
                  ])}
                  class="nk-stor"
                  style={{ opacity: share }}
                />
              ))}

            {T.req.map((a, k) => {
              const p = reqPath(k % 3);
              const out = t >= a && t < a + 1.2 ? along(p, prog(t, a, a + 1.2)) : null;
              const back = t >= a + 1.2 && t < a + 1.6 ? along(p.slice().reverse() as Pt[], prog(t, a + 1.2, a + 1.6)) : null;
              const q = out ?? back;
              return q && <circle key={k} cx={q[0]} cy={q[1]} r={6} class={out ? 'ai-req' : 'ai-ans'} />;
            })}
            {attempt && <circle cx={attempt[0]} cy={attempt[1]} r={6} class="ai-req" />}
          </svg>
        );
      }}
    </Story>
  );
}

// ── the tab ──────────────────────────────────────────────────────────────────────────────────────
type Topic = 'traffic' | 'protect';
const TOPICS: { value: Topic; label: string }[] = [
  { value: 'traffic', label: 'Traffic and storage' },
  { value: 'protect', label: 'Backup and recovery' },
];

export default function AppsView() {
  const [topic, setTopic] = useEnum<Topic>('a', 'traffic', ['traffic', 'protect']);
  const top = <Choice<Topic> label="Apps and data" value={topic} onChange={setTopic} options={TOPICS} />;
  return topic === 'protect' ? <ProtectScene key="protect" top={top} /> : <TrafficScene key="traffic" top={top} />;
}
