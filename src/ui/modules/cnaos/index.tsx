// Cloud Native AOS: Nutanix storage and data protection for Kubernetes apps, with no hypervisor
// underneath. One loop on one cluster: AOS runs as a pod on every worker, keeps two copies of each
// write, rides out a worker failure, then NDK snapshots the whole app and replicates it for DR.
// Pick Amazon EKS (generally available) or bare metal (NKP Metal, early access). The landing's
// "Any Bare Metal Linux" pane opens this module with on=metal. Claims: docs/facts.md section 10.
import { useEnum } from '../../../state/route';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Points, Show, ease, flowDots, phaseAt, prog, type Point } from '../../components/show';
import './style.css';

type On = 'eks' | 'metal';

const P = [0, 3.4, 6.8, 10.4, 13.6];
const END = 17.4;
const WORKER_IN = [0.2, 0.5, 0.8];
const AOS_IN = [1.3, 1.6, 1.9];
const PV_IN = P[1] + 0.2;
const WRITE = [4.0, 4.9, 5.8];
const FAIL = 7.0;
const RESTART = 8.0;
const READY = 9.2;
const OUTLINE = P[3] + 0.1;
const SNAP_IN = P[3] + 0.3;
const CHIP_IN = [P[3] + 0.9, P[3] + 1.4];
const NOTE_IN = P[3] + 1.9;
const REGION_IN = P[4] + 0.1;
const REPL = [P[4] + 0.4, P[4] + 1.8];
const COPY_IN = P[4] + 1.2;
const DC_IN = P[4] + 1.8;
const DC_FLOW = [P[4] + 2.0, P[4] + 3.2];

const SITE: Record<On, { cluster: string; worker: string; kind: string; vol: string; dcLine: string; regionHead: string; regionSub: string; regionFoot: string; drHead: string }> = {
  eks: {
    cluster: 'AMAZON EKS CLUSTER IN AWS',
    worker: 'Worker',
    kind: 'EC2',
    vol: 'EBS gp3',
    dcLine: 'Its apps can fail over to EKS through NDK',
    regionHead: 'Another AWS region or zone',
    regionSub: 'EKS with Cloud Native AOS',
    regionFoot: 'Target RPO 1 hour or more in release 1.0',
    drHead: 'DR SITES',
  },
  metal: {
    cluster: 'BARE-METAL SERVERS WITH NKP METAL',
    worker: 'Server',
    kind: 'bare metal',
    vol: 'Local drive',
    dcLine: 'Planned: future development',
    regionHead: 'A public cloud',
    regionSub: 'Amazon EKS with Cloud Native AOS',
    regionFoot: 'Planned: future development',
    drHead: 'OTHER SITES · PLANNED',
  },
};

function phases(on: On): string[] {
  return ['AOS runs as pods', 'Two copies of every write', on === 'eks' ? 'A worker fails' : 'A server fails', 'Protect the whole app', on === 'eks' ? 'Replicate for DR' : 'Move between sites (planned)'];
}

function caption(on: On, i: number): string {
  if (on === 'metal')
    return [
      'NKP Metal runs Kubernetes straight on the servers. Cloud Native AOS runs as a pod on each one and pools the local drives into one storage system, with no hypervisor and no Controller VM (CVM).',
      'A database pod claims a persistent volume like any Kubernetes app. AOS keeps each block on two servers, as release 1.0 does on Amazon EKS.',
      'Server 1 fails. The second copies on the other servers keep the volume available, so Kubernetes restarts the database pod on server 3 with all its data.',
      'NDK, Nutanix Data Services for Kubernetes, snapshots the app as one unit: its Kubernetes resources and its volume data, consistent with each other.',
      'Nutanix lists moving apps between bare-metal servers, on-premises clusters and public clouds as future development, so treat this step as planned, not available.',
    ][i];
  return [
    'Amazon EKS workers on EC2, each with EBS gp3 volumes. Cloud Native AOS runs as a pod on every worker and pools those volumes into one storage system, with no hypervisor and no Controller VM (CVM).',
    'A database pod claims a persistent volume like any Kubernetes app. AOS keeps every block it writes on two different workers (RF2).',
    'Worker 1 fails. The second copies on the other workers keep the volume available, so Kubernetes restarts the database pod on worker 3 with all its data.',
    'NDK, Nutanix Data Services for Kubernetes, snapshots the app as one unit: its Kubernetes resources and its volume data, consistent with each other.',
    'NDK replicates the snapshot to another AWS region or zone, on a schedule, with a target RPO of 1 hour or more in release 1.0. It also pairs EKS with NKP on Nutanix in your data center, so apps there can fail over to AWS.',
  ][i];
}

function points(on: On): Point[] {
  const box = on === 'eks' ? 'worker' : 'server';
  return [
    {
      k: 'Nutanix storage inside Kubernetes',
      by: 'No hypervisor, no CVM',
      text: on === 'eks' ? 'AOS runs as pods on the EKS workers, so stateful apps get Nutanix volumes, snapshots and compression in AWS.' : 'AOS runs as pods on the servers, so stateful apps get Nutanix volumes and snapshots on bare metal.',
      tone: 'ink',
      at: AOS_IN[0],
    },
    { k: `Survives a ${box} failure`, by: 'Two copies of every write (RF2)', text: `Each write is kept on two ${box}s, so when one fails the data is still there and the app restarts on another.`, tone: 'ok', at: P[2] },
    on === 'eks'
      ? { k: 'App-level DR, cloud and on premises', by: 'Nutanix Data Services for Kubernetes (NDK)', text: 'Whole apps, Kubernetes resources and data together, replicate to another AWS region, and apps on NKP in your data center can fail over to EKS.', tone: 'flow', at: P[4] }
      : { k: 'Move apps between sites', by: 'Planned', text: 'Nutanix lists moving apps between bare metal, on-premises clusters and public clouds as future development.', tone: 'warn', at: P[4] },
  ];
}

// ── geometry ──
const W = 960;
const CW = 650;
const PAD = 14;
const WG = 12;
const NW = (CW - 2 * PAD - 2 * WG) / 3;
const TOP = 26;
const WY = TOP + PAD;
const WH = 168;
const POD_Y = WY + 30;
const POD_H = 26;
const AOS_Y = WY + 68;
const AOS_H = 24;
const VOL_Y = WY + 104;
const VOL_H = 50;
const VW = (NW - 32) / 2;
const SNAP_Y = WY + WH + 12;
const SNAP_H = 44;
const CH = PAD + WH + 12 + SNAP_H + PAD;
const H = TOP + CH + 2;
const DR_X = 700;
const DR_W = W - DR_X;
const BOX_H = 108;
const DC_Y = TOP;
const RG_Y = TOP + CH - BOX_H;
const LINK_Y = SNAP_Y + SNAP_H / 2;
const LINK2_Y = AOS_Y + AOS_H / 2;
const TS = 14;

const wx = (i: number) => PAD + i * (NW + WG);
const vx = (w: number, v: number) => wx(w) + 12 + v * (VW + 8);
const tx = (w: number, v: number, s: number) => vx(w, v) + 8 + s * 20;
const TY = VOL_Y + 24;
const AOS_CY = AOS_Y + AOS_H / 2;

const PODS: { label: string; w: number }[][] = [
  [
    { label: 'Database', w: 92 },
    { label: 'web', w: 50 },
  ],
  [
    { label: 'web', w: 50 },
    { label: 'api', w: 50 },
  ],
  [{ label: 'api', w: 50 }],
];
const podX = (w: number, k: number) => wx(w) + 12 + PODS[w].slice(0, k).reduce((s, p) => s + p.w + 8, 0);
const DB_CX = podX(0, 0) + PODS[0][0].w / 2;
const NEW_DB_X = podX(2, 1);
const NEW_DB_W = 92;

/** Each block of the database's volume: [worker, volume, slot] of the first copy and of the second. */
const BLOCKS: { p: [number, number, number]; c: [number, number, number] }[] = [
  { p: [0, 0, 0], c: [1, 0, 0] },
  { p: [0, 1, 0], c: [2, 1, 0] },
  { p: [0, 0, 1], c: [1, 1, 0] },
];

function CnDiagram({ on, t }: { on: On; t: number }) {
  const s = SITE[on];
  const metal = on === 'metal';
  const fail = prog(t, FAIL, FAIL + 0.4);
  const dbHl = t >= P[1] && fail === 0;
  const pv = prog(t, PV_IN, PV_IN + 0.3);
  const restart = prog(t, RESTART, RESTART + 0.6);
  const ready = t >= READY;
  const outline = prog(t, OUTLINE, OUTLINE + 0.4);
  const snap = prog(t, SNAP_IN, SNAP_IN + 0.4);
  const chips = CHIP_IN.map((a) => prog(t, a, a + 0.3));
  const note = prog(t, NOTE_IN, NOTE_IN + 0.3);
  const region = prog(t, REGION_IN, REGION_IN + 0.4);
  const copy = prog(t, COPY_IN, COPY_IN + 0.3);
  const dc = prog(t, DC_IN, DC_IN + 0.4);

  return (
    <svg
      class="diagram cn-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${metal ? 'Three bare-metal servers running NKP Metal' : 'Three Amazon EKS workers'}, each running AOS as a pod. A database writes every block on two ${s.worker.toLowerCase()}s; when one fails the pod restarts on another with its data. NDK snapshots the whole app and ${metal ? 'would replicate it to other sites, which is planned' : 'replicates it to another AWS region; apps on NKP in your data center can fail over to EKS'}.`}
    >
      <text x={0} y={16} class="muted" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
        {s.cluster}
      </text>
      <text x={DR_X} y={16} class={metal ? 'cn-warn' : 'muted'} style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
        {s.drHead}
      </text>
      <rect x={0} y={TOP} width={CW} height={CH} class="frame" rx={4} />

      {/* workers */}
      {[0, 1, 2].map((w) => {
        const k = prog(t, WORKER_IN[w], WORKER_IN[w] + 0.5);
        const aos = prog(t, AOS_IN[w], AOS_IN[w] + 0.5);
        const down = w === 0 && fail > 0;
        const x = wx(w);
        return (
          <g key={w} style={{ opacity: k }}>
            <rect x={x} y={WY} width={NW} height={WH} class={`node-box${down ? ' down' : ''}`} />
            <text x={x + 12} y={WY + 20} style={{ fontSize: '13.5px', fontWeight: 600 }}>
              {s.worker} {w + 1}
            </text>
            <text x={x + NW - 12} y={WY + 20} text-anchor="end" class={down ? 'cn-bad' : 'mono muted'} style={{ fontSize: '12px' }}>
              {down ? 'failed' : s.kind}
            </text>
            {PODS[w].map((p, j) => {
              const db = w === 0 && j === 0;
              const cls = down ? 'vm failed' : db && dbHl ? 'vm hl' : 'vm';
              return (
                <g key={j}>
                  <rect x={podX(w, j)} y={POD_Y} width={p.w} height={POD_H} rx={3} class={cls} />
                  <text x={podX(w, j) + p.w / 2} y={POD_Y + 17} text-anchor="middle" class={db ? undefined : 'muted'} style={{ fontSize: '11.5px', fontWeight: db ? 600 : 400 }}>
                    {p.label}
                  </text>
                </g>
              );
            })}
            {aos > 0 ? (
              <g style={{ opacity: aos }}>
                <rect x={x + 12 + (1 - ease(aos)) * 20} y={AOS_Y} width={NW - 24} height={AOS_H} class={down ? 'cvm down' : 'cvm'} />
                <text x={x + 20} y={AOS_Y + 16} class="cn-on-ink" style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  AOS pod
                </text>
                <text x={x + NW - 20} y={AOS_Y + 16} text-anchor="end" class="cn-on-ink soft" style={{ fontSize: '11px' }}>
                  storage
                </text>
              </g>
            ) : (
              <rect x={x + 12} y={AOS_Y} width={NW - 24} height={AOS_H} class="frame-dash" />
            )}
            {[0, 1].map((v) => (
              <g key={v}>
                <rect x={vx(w, v)} y={VOL_Y} width={VW} height={VOL_H} class={`cn-vol${down ? ' lost' : ''}`} rx={2} />
                <text x={vx(w, v) + 8} y={VOL_Y + 15} class="mono faint" style={{ fontSize: '10.5px' }}>
                  {s.vol}
                </text>
              </g>
            ))}
          </g>
        );
      })}

      {/* the database's volume: a persistent volume claim down to AOS */}
      {pv > 0 && fail === 0 && <line x1={DB_CX} x2={DB_CX} y1={POD_Y + POD_H} y2={POD_Y + POD_H + (AOS_Y - POD_Y - POD_H) * pv} class="cn-link" />}

      {/* blocks: first copy beside the database, second copy on another worker */}
      {BLOCKS.map((b, k) => {
        const a = WRITE[k];
        const first = prog(t, a + 0.3, a + 0.45);
        const second = prog(t, a + 0.8, a + 0.95);
        const dim = 1 - 0.75 * fail;
        const snapped = chips[1] > 0;
        return (
          <g key={k}>
            {first > 0 && <rect x={tx(...b.p)} y={TY} width={TS} height={TS} class="tile-local" style={{ opacity: first * dim }} />}
            {second > 0 && <rect x={tx(...b.c)} y={TY} width={TS} height={TS} class="tile-rep" style={{ opacity: second }} />}
            {snapped && <rect x={tx(...b.c) - 3} y={TY - 3} width={TS + 6} height={TS + 6} class="cn-snap" style={{ opacity: chips[1] }} />}
          </g>
        );
      })}
      {BLOCKS.map((b, k) => {
        const a = WRITE[k];
        if (t >= a && t < a + 0.3) return <circle key={k} cx={DB_CX} cy={POD_Y + POD_H + (AOS_CY - POD_Y - POD_H) * prog(t, a, a + 0.3)} r={4.5} class="cn-io" />;
        if (t >= a + 0.3 && t < a + 0.8) {
          const to = tx(...b.c) + TS / 2;
          return <circle key={k} cx={DB_CX + (to - DB_CX) * ease(prog(t, a + 0.3, a + 0.8))} cy={AOS_CY} r={4.5} class="cn-io" />;
        }
        return null;
      })}

      {/* after the failure: the database pod restarts on worker 3 and reads the surviving copies */}
      {restart > 0 && (
        <g style={{ opacity: restart }}>
          <rect x={NEW_DB_X} y={POD_Y} width={NEW_DB_W} height={POD_H} class={ready ? 'vm hl' : 'vm restart'} />
          <text x={NEW_DB_X + NEW_DB_W / 2} y={POD_Y + 17} text-anchor="middle" style={{ fontSize: '11.5px', fontWeight: 600 }}>
            Database
          </text>
          {ready && <line x1={NEW_DB_X + NEW_DB_W / 2} x2={NEW_DB_X + NEW_DB_W / 2} y1={POD_Y + POD_H} y2={AOS_Y} class="cn-link" />}
        </g>
      )}
      {ready &&
        t < P[3] &&
        (() => {
          const x0 = wx(1) + NW / 2;
          const x1 = NEW_DB_X + NEW_DB_W / 2;
          return flowDots(t - READY, Math.abs(x1 - x0), 2).map((f, k) => <circle key={k} cx={x0 + (x1 - x0) * f} cy={AOS_CY} r={4.5} class="cn-io" />);
        })()}

      {/* NDK snapshots the app: its Kubernetes resources and its volume data */}
      {outline > 0 && <rect x={NEW_DB_X - 4} y={POD_Y - 4} width={NEW_DB_W + 8} height={POD_H + 8} rx={4} class="cn-snap" style={{ opacity: outline }} />}
      {snap > 0 ? (
        <g style={{ opacity: snap }}>
          <rect x={PAD} y={SNAP_Y} width={CW - 2 * PAD} height={SNAP_H} class="cn-snaprow" rx={3} />
          <text x={PAD + 14} y={SNAP_Y + 26} class="muted" style={{ fontSize: '11px', letterSpacing: '0.08em' }}>
            NDK APP SNAPSHOT
          </text>
          {[
            { x: PAD + 168, w: 156, label: 'Kubernetes resources' },
            { x: PAD + 350, w: 112, label: 'Volume data' },
          ].map((c, i) => (
            <g key={c.label} style={{ opacity: chips[i] }}>
              <rect x={c.x} y={SNAP_Y + 9} width={c.w} height={26} class="vm hl" />
              <text x={c.x + c.w / 2} y={SNAP_Y + 26} text-anchor="middle" style={{ fontSize: '12px', fontWeight: 600 }}>
                {c.label}
              </text>
            </g>
          ))}
          <text x={PAD + 337} y={SNAP_Y + 27} text-anchor="middle" class="muted" style={{ fontSize: '14px', opacity: chips[1] }}>
            +
          </text>
          <text x={CW - PAD - 14} y={SNAP_Y + 26} text-anchor="end" class="muted" style={{ fontSize: '12px', opacity: note }}>
            as one unit
          </text>
        </g>
      ) : (
        <g>
          <rect x={PAD} y={SNAP_Y} width={CW - 2 * PAD} height={SNAP_H} class="frame-dash" />
          <text x={PAD + 14} y={SNAP_Y + 26} class="faint" style={{ fontSize: '12px' }}>
            app snapshots
          </text>
        </g>
      )}

      {/* DR sites */}
      <DrBox y={DC_Y} k={dc} warn={metal} head="Your data center" sub="NKP on Nutanix (AHV)" foot={s.dcLine} />
      <DrBox y={RG_Y} k={region} warn={metal} head={s.regionHead} sub={s.regionSub} foot={s.regionFoot} sel={!metal && t >= REPL[0] && t < DC_IN} />
      {region > 0 && <line x1={CW - PAD} x2={DR_X} y1={LINK_Y} y2={LINK_Y} class={`cn-link${metal ? ' warn' : ''}`} style={{ opacity: region }} />}
      {copy > 0 && (
        <g style={{ opacity: copy }}>
          <rect x={DR_X + 14} y={LINK_Y - 13} width={150} height={26} class="vm hl" />
          <text x={DR_X + 89} y={LINK_Y + 4} text-anchor="middle" style={{ fontSize: '12px', fontWeight: 600 }}>
            App snapshot copy
          </text>
        </g>
      )}
      {t >= REPL[0] &&
        t < REPL[1] &&
        (() => {
          const x0 = CW - PAD - 150;
          const x1 = DR_X + 40;
          return flowDots(t - REPL[0], Math.abs(x1 - x0), 2).map((f, k) => <circle key={k} cx={x0 + (x1 - x0) * f} cy={LINK_Y} r={4.5} class={`cn-io${metal ? ' warn' : ''}`} />);
        })()}
      {dc > 0 && <line x1={wx(2) + NW} x2={DR_X} y1={LINK2_Y} y2={LINK2_Y} class={`cn-link${metal ? ' warn' : ''}`} stroke-dasharray="5 4" style={{ opacity: dc }} />}
      {t >= DC_FLOW[0] &&
        t < DC_FLOW[1] &&
        (() => {
          const x0 = DR_X + 30;
          const x1 = wx(2) + NW - 30;
          return flowDots(t - DC_FLOW[0], Math.abs(x1 - x0), 2).map((f, k) => <circle key={k} cx={x0 + (x1 - x0) * f} cy={LINK2_Y} r={4.5} class={`cn-io${metal ? ' warn' : ''}`} />);
        })()}
    </svg>
  );
}

function DrBox({ y, k, warn, head, sub, foot, sel }: { y: number; k: number; warn: boolean; head: string; sub: string; foot: string; sel?: boolean }) {
  const on = k > 0;
  const txt = on ? undefined : 'faint';
  return (
    <g>
      <rect x={DR_X} y={y} width={DR_W} height={BOX_H} class={on ? `node-box${warn ? ' warn' : sel ? ' sel' : ''}` : 'frame-dash'} rx={6} />
      <text x={DR_X + 14} y={y + 22} class={txt} style={{ fontSize: '13.5px', fontWeight: 600 }}>
        {head}
      </text>
      <text x={DR_X + 14} y={y + 40} class={on ? 'muted' : 'faint'} style={{ fontSize: '12px' }}>
        {sub}
      </text>
      {on && (
        <text x={DR_X + 14} y={y + BOX_H - 9} class={warn ? 'cn-warn' : 'muted'} style={{ fontSize: '11px', opacity: k }}>
          {foot}
        </text>
      )}
    </g>
  );
}

export default function Cnaos() {
  const [on, setOn] = useEnum<On>('on', 'eks', ['eks', 'metal']);
  const names = phases(on);
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END, steps: paced(P, names.map((k, i) => [k, caption(on, i)])) });
  useRestartOn(clock, [on]);
  const t = clock.t;
  const phase = phaseAt(P, t);
  const tone: Tone | 'ink' = phase === 0 || phase === 3 ? 'ink' : phase === 2 ? 'ok' : phase === 4 && on === 'metal' ? 'warn' : 'flow';

  return (
    <Show
      top={
        <>
          <Choice<On>
            label="Kubernetes runs on"
            value={on}
            onChange={setOn}
            why={on === 'eks' ? 'Azure AKS and Google GKE are not confirmed yet.' : 'Early access; GA is targeted for the second half of 2026.'}
            options={[
              { value: 'eks', label: 'Amazon EKS' },
              { value: 'metal', label: 'Bare metal (NKP Metal)' },
            ]}
          />
          <Points label="Why customers choose it" items={points(on)} t={t} />
        </>
      }
      foot={
        <>
          <Follow tone={tone} k={names[phase]}>
            <p>{caption(on, phase)}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Hypervisor', v: 'None', sub: 'AOS runs as pods' },
              on === 'eks' ? { k: 'Disaster recovery', v: 'RPO ≥ 1 h', sub: 'target, through NDK, in release 1.0' } : { k: 'Moving between sites', v: 'Planned', tone: 'warn', sub: 'listed as future development' },
              on === 'eks' ? { k: 'Status', v: 'GA · 1.0', tone: 'ok', sub: 'since July 2025; 1.0 allows up to 15 workers' } : { k: 'Status', v: 'Early access', tone: 'warn', sub: 'GA targeted 2H 2026' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <CnDiagram on={on} t={t} />
      </div>
      <PlayBar clock={clock} label="Cloud Native AOS animation" fmt={() => names[phase]} />
      <div class="cn-legend">
        <Legend
          items={[
            { color: 'var(--ink)', label: 'AOS pod and first copy' },
            { color: 'var(--s2)', label: 'Second copy (RF2)' },
            { color: 'var(--flow)', label: 'Writes, reads and replication' },
          ]}
        />
        <Illus why={on === 'eks' ? 'Worker, pod and block counts are an example. Where AOS places each copy depends on the cluster.' : 'NKP Metal is early access; the two copies follow release 1.0 on Amazon EKS.'} />
      </div>
    </Show>
  );
}
