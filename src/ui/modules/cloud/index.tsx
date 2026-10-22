// Hybrid and public cloud: Nutanix Cloud Clusters (NC2) on AWS, Azure and Google Cloud (all GA
// per the research note). Pick the cloud and a use case (DR, burst, data-center exit) and watch
// VMs and cloud nodes move on a loop. Migration has its own module (Move), and the cloud-native
// path has Cloud Native AOS.
import { useEnum } from '../../../state/route';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, flowDots, phaseAt, prog } from '../../components/show';
import './style.css';

type Prov = 'aws' | 'azure' | 'gcp';
type Use = 'dr' | 'burst' | 'exit';

const PROV: Record<Prov, { name: string; short: string; status: string }> = {
  aws: { name: 'Amazon Web Services', short: 'AWS', status: 'NC2 on AWS is generally available. GC2 (Government Cloud Clusters) runs on AWS GovCloud (US) and the AWS European Sovereign Cloud.' },
  azure: { name: 'Microsoft Azure', short: 'Azure', status: 'NC2 on Azure is generally available.' },
  gcp: { name: 'Google Cloud', short: 'Google Cloud', status: 'NC2 on Google Cloud has been generally available since Dec 9, 2025, on Z3 and C4 bare-metal instances in 17 regions at launch.' },
};
const PROV_IDS = Object.keys(PROV) as Prov[];

type Phase = { k: string; at: number; tone: Tone | 'ink'; text: (cloud: string) => string };
const USES: Record<Use, { label: string; link: string; end: number; phases: Phase[] }> = {
  dr: {
    label: 'Disaster recovery',
    link: 'replication',
    end: 12.5,
    phases: [
      { k: 'Protected', at: 0, tone: 'flow', text: (c) => `Protection policies replicate the VMs to an NC2 cluster in ${c}, the same way they would to a second data center. While it only holds copies, the cloud cluster can stay small.` },
      { k: 'Site lost', at: 4.2, tone: 'bad', text: () => 'The data center goes down and its VMs stop. Recent copies of them are already in the cloud.' },
      { k: 'Failover', at: 5.8, tone: 'warn', text: (c) => `The recovery plan powers the VMs on in ${c}. The NC2 cluster can be expanded now, depending on cloud and configuration.` },
      { k: 'Running in the cloud', at: 9.2, tone: 'ok', text: (c) => `The VMs run in ${c} on the same AHV, with the same Prism Central tools and policies, until you fail back.` },
    ],
  },
  burst: {
    label: 'Burst capacity',
    link: 'extended network',
    end: 11.5,
    phases: [
      { k: 'Running short', at: 0, tone: 'warn', text: () => 'A seasonal peak, a hardware delay or a new project: the data center is nearly full.' },
      { k: 'Add cloud nodes', at: 2.8, tone: 'flow', text: (c) => `Instead of buying hardware, add nodes to the NC2 cluster in ${c}: bare-metal instances running the same AOS and AHV.` },
      { k: 'Burst', at: 4.6, tone: 'flow', text: () => 'The extra VMs run there, with the same Prism Central and the same policies as the VMs at home.' },
      { k: 'Shrink back', at: 8.2, tone: 'ok', text: () => 'When the peak is over, the extra VMs go and the cluster shrinks again, so you stop paying for those nodes.' },
    ],
  },
  exit: {
    label: 'Data-center exit',
    link: 'Move or replication',
    end: 12.5,
    phases: [
      { k: 'Before', at: 0, tone: 'ink', text: () => 'Every workload runs in your own data center today.' },
      { k: 'Moving in waves', at: 1.6, tone: 'flow', text: (c) => `Workloads move to NC2 in ${c} in waves, as they are: the same AHV means no refactoring, and with the right network design they keep their IP addresses.` },
      { k: 'Retire the building', at: 8, tone: 'warn', text: () => 'With nothing left on-premises, the data center is retired on your timeline.' },
      { k: 'Running in the cloud', at: 9.6, tone: 'ok', text: () => 'Teams keep the tools and runbooks they know. Later, apps can be modernized to native cloud services one at a time.' },
    ],
  },
};
const USE_IDS = Object.keys(USES) as Use[];

const VMS = 8;
const BASE_NODES = 3;
const WAVE = 1.5;

/** Everything the picture needs at time t. `nodes` is fractional while a node joins or leaves. */
function sceneAt(use: Use, t: number) {
  const P = USES[use].phases;
  const at = (i: number) => P[i].at;
  const vms: { s: number; where: 'dc' | 'cloud' | 'moving'; f: number; state: 'on' | 'off' | 'replica' | 'new' }[] = [];
  let nodes = BASE_NODES;
  let dcDown = false;
  let dcGone = 0;
  let used = 0.7;
  if (use === 'dr') {
    dcDown = t >= at(1);
    nodes += 2 * prog(t, at(2), at(2) + 1);
    for (let s = 0; s < VMS; s++) {
      vms.push({ s, where: 'dc', f: 0, state: dcDown ? 'off' : 'on' });
      if (t >= 0.4 + s * 0.42) vms.push({ s, where: 'cloud', f: 1, state: t >= at(2) + 1.2 + s * 0.25 ? 'on' : 'replica' });
    }
  } else if (use === 'burst') {
    used = 0.7 + 0.24 * ease(prog(t, 0.3, at(1) - 0.3));
    nodes += 2 * prog(t, at(1), at(2)) - 2 * prog(t, at(3) + 1.2, at(3) + 2.4);
    for (let s = 0; s < VMS; s++) vms.push({ s, where: 'dc', f: 0, state: 'on' });
    for (let s = 0; s < 6; s++) if (t >= at(2) + 0.2 + s * 0.4 && t < at(3) + s * 0.15) vms.push({ s, where: 'cloud', f: 1, state: 'new' });
  } else {
    for (let s = 0; s < VMS; s++) {
      const go = at(1) + Math.floor(s / 2) * WAVE + (s % 2) * 0.25;
      const f = prog(t, go, go + 1);
      vms.push({ s, where: f <= 0 ? 'dc' : f >= 1 ? 'cloud' : 'moving', f, state: 'on' });
    }
    nodes += prog(t, at(1) + WAVE, at(1) + WAVE + 0.6) + prog(t, at(1) + 3 * WAVE, at(1) + 3 * WAVE + 0.6);
    dcGone = prog(t, at(2), at(2) + 1.2);
  }
  return { vms, nodes, dcDown, dcGone, used };
}

export default function Cloud() {
  const [prov, setProv] = useEnum<Prov>('c', 'aws', PROV_IDS);
  const [use, setUse] = useEnum<Use>('u', 'dr', USE_IDS);
  const U = USES[use];
  const P = PROV[prov];
  // The provider's status line stays put, so it is read once, in the first step.
  const steps = paced(
    U.phases.map((p) => p.at),
    U.phases.map((p, k) => [p.k, p.text(P.short), k === 0 ? P.status : '']),
  );
  const clock = useClock({ rate: 1, duration: U.end, keys: true, poster: U.phases[2].at + 2.6, steps });
  useRestartOn(clock, [prov, use]);
  const t = clock.t;
  const i = phaseAt(
    U.phases.map((p) => p.at),
    t,
  );
  const ph = U.phases[i];
  const sc = sceneAt(use, t);
  const inDc = sc.vms.filter((v) => v.where === 'dc' && v.state === 'on').length;
  const inCloud = sc.vms.filter((v) => v.where === 'cloud' && v.state !== 'replica').length;

  return (
    <Show
      top={
        <>
          <Choice<Prov> label="Cloud" value={prov} onChange={setProv} options={PROV_IDS.map((p) => ({ value: p, label: PROV[p].short }))} />
          <Choice<Use> label="Use case" value={use} onChange={setUse} options={USE_IDS.map((u) => ({ value: u, label: USES[u].label }))} />
        </>
      }
      foot={
        <>
          <Follow tone={ph.tone} k={ph.k}>
            <p>{ph.text(P.short)}</p>
            <p class="rest">{P.status}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'VMs running in your data center', v: inDc, tone: sc.dcDown ? 'bad' : undefined, sub: sc.dcDown ? 'site down' : sc.dcGone >= 1 ? 'retired' : undefined },
              { k: `VMs running in ${P.short}`, v: inCloud, tone: inCloud ? 'ok' : undefined },
              { k: 'Cloud nodes', v: Math.ceil(sc.nodes - 1e-6), sub: 'bare-metal instances' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Scene prov={prov} use={use} t={t} sc={sc} />
      </div>
      <PlayBar clock={clock} label="Use case animation" fmt={() => ph.k} extra={<Illus why="A simplified picture: VM and node counts, timing and network paths are examples, not sizing. Regions, instance types and features vary by cloud and release." />} />
    </Show>
  );
}

// ── geometry ──
const W = 960;
const H = 352;
const PANEL = { y: 20, w: 400, h: 280 };
const DC_X = 10;
const CL_X = 550;
const LINK_Y = 150;
const VW = 58;
const VH = 32;

const slot = (x0: number, s: number) => ({ x: x0 + 20 + (s % 4) * 68, y: 84 + Math.floor(s / 4) * 44 });

/** A point a fraction f of the way along a polyline. */
function along(pts: { x: number; y: number }[], f: number) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let d = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * r, y: pts[i].y + (pts[i + 1].y - pts[i].y) * r };
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

function Vm({ x, y, label, cls }: { x: number; y: number; label: string; cls: string }) {
  return (
    <g>
      <rect x={x} y={y} width={VW} height={VH} rx={3} class={cls} />
      <text x={x + VW / 2} y={y + 20} text-anchor="middle" class={`cld-xs${cls === 'cld-replica' ? ' flow-fill' : ''}`}>
        {label}
      </text>
    </g>
  );
}

/** A row of nodes; a fractional count fades the last one in or out. */
function Nodes({ x0, n, down }: { x0: number; n: number; down: boolean }) {
  const whole = Math.ceil(n - 1e-6);
  return (
    <>
      {Array.from({ length: whole }, (_, i) => (
        <g key={i} style={{ opacity: i === whole - 1 && n < whole ? n - i : 1 }}>
          <rect x={x0 + 20 + i * 72} y={206} width={64} height={46} class={`node-box${down ? ' down' : ''}`} />
          <text x={x0 + 26 + i * 72} y={224} class="cld-xs">
            node {i + 1}
          </text>
          <rect x={x0 + 26 + i * 72} y={230} width={52} height={14} class={`cvm${down ? ' down' : ''}`} />
        </g>
      ))}
    </>
  );
}

function Scene({ prov, use, t, sc }: { prov: Prov; use: Use; t: number; sc: ReturnType<typeof sceneAt> }) {
  const P = PROV[prov];
  const U = USES[use];
  const moving = sc.vms.filter((v) => v.where === 'moving');
  const flowing = (use === 'dr' && !sc.dcDown) || moving.length > 0;
  const route = (s: number) => {
    const a = slot(DC_X, s);
    const b = slot(CL_X, s);
    return [
      { x: a.x + VW / 2, y: a.y + VH / 2 },
      { x: DC_X + PANEL.w, y: LINK_Y },
      { x: CL_X, y: LINK_Y },
      { x: b.x + VW / 2, y: b.y + VH / 2 },
    ];
  };
  const running = sc.vms.filter((v) => v.where === 'cloud' && v.state !== 'replica').length;

  return (
    <svg class="diagram cld-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Your data center and NC2 in ${P.name}, ${U.label.toLowerCase()}: ${running} VMs running in the cloud.`}>
      {/* data center */}
      <g style={{ opacity: 1 - 0.65 * sc.dcGone }}>
        <rect x={DC_X} y={PANEL.y} width={PANEL.w} height={PANEL.h} class={`node-box${sc.dcDown ? ' down' : ''}`} />
        <text x={DC_X + 20} y={PANEL.y + 28} class="cld-t">
          Your data center
        </text>
        <text x={DC_X + 20} y={PANEL.y + 48} class="cld-xs muted">
          Nutanix cluster · AOS + AHV
        </text>
        {sc.dcDown && (
          <text x={DC_X + PANEL.w - 20} y={PANEL.y + 28} text-anchor="end" class="cld-s bad-fill">
            ✕ site down
          </text>
        )}
        {use === 'burst' && (
          <g>
            <rect x={DC_X + 20} y={176} width={PANEL.w - 40} height={10} class="bg3" />
            <rect x={DC_X + 20} y={176} width={(PANEL.w - 40) * sc.used} height={10} class={sc.used > 0.85 ? 'warn-fill' : 'ink-fill'} />
            <text x={DC_X + PANEL.w - 20} y={170} text-anchor="end" class={`cld-xs ${sc.used > 0.85 ? 'warn-fill' : 'muted'}`} style={{ fontWeight: 600 }}>
              {sc.used > 0.85 ? '⚠ ' : ''}
              {Math.round(sc.used * 100)}% of capacity used
            </text>
          </g>
        )}
        {sc.vms.map((v) => {
          const p = slot(DC_X, v.s);
          if (v.where === 'dc') return <Vm key={v.s} x={p.x} y={p.y} label={v.state === 'off' ? '✕ off' : `VM ${v.s + 1}`} cls={v.state === 'off' ? 'vm failed' : 'vm hl'} />;
          return use === 'exit' ? <rect key={v.s} x={p.x} y={p.y} width={VW} height={VH} rx={3} class="cld-gone" /> : null;
        })}
        <Nodes x0={DC_X} n={4} down={sc.dcDown} />
        {sc.dcGone > 0.5 && (
          <text x={DC_X + PANEL.w / 2} y={190} text-anchor="middle" class="cld-t muted">
            Data center retired
          </text>
        )}
      </g>

      {/* the link */}
      <line x1={DC_X + PANEL.w} x2={CL_X} y1={LINK_Y} y2={LINK_Y} class={flowing ? 'xfer' : 'line'} stroke-width={2} stroke-dasharray="6 6" stroke-dashoffset={flowing ? -t * 30 : 0} />
      <text x={(DC_X + PANEL.w + CL_X) / 2} y={LINK_Y - 12} text-anchor="middle" class="cld-xs muted">
        {U.link}
      </text>
      {use === 'dr' && !sc.dcDown && flowDots(t, CL_X - DC_X - PANEL.w, 3).map((f, k) => <circle key={k} cx={DC_X + PANEL.w + f * (CL_X - DC_X - PANEL.w)} cy={LINK_Y} r={4.5} class="flow-fill" />)}

      {/* cloud */}
      <rect x={CL_X} y={PANEL.y} width={PANEL.w} height={PANEL.h} class="cld-cloud" />
      <text x={CL_X + 20} y={PANEL.y + 28} class="cld-t">
        {P.name}
      </text>
      <text x={CL_X + 20} y={PANEL.y + 48} class="cld-xs muted">
        NC2 · the same AOS + AHV on bare-metal instances
      </text>
      {sc.vms
        .filter((v) => v.where === 'cloud')
        .map((v) => {
          const p = slot(CL_X, v.s);
          return <Vm key={v.s} x={p.x} y={p.y} label={v.state === 'replica' ? 'replica' : v.state === 'new' ? 'new VM' : `VM ${v.s + 1}`} cls={v.state === 'replica' ? 'cld-replica' : 'vm hl'} />;
        })}
      <Nodes x0={CL_X} n={sc.nodes} down={false} />
      <text x={CL_X + 20} y={278} class="cld-xs muted">
        NC2 cluster: bare-metal nodes, each with its own CVM
      </text>
      {moving.map((v) => {
        const p = along(route(v.s), ease(v.f));
        return <Vm key={v.s} x={p.x - VW / 2} y={p.y - VH / 2} label={`VM ${v.s + 1}`} cls="vm hl" />;
      })}

      <rect x={DC_X} y={312} width={CL_X + PANEL.w - DC_X} height={32} class="ink-fill" />
      <text x={W / 2} y={333} text-anchor="middle" class="cld-s" style={{ fill: '#fff', fontWeight: 600 }}>
        Prism Central: the same management on both sides
      </text>
    </svg>
  );
}
