// Nutanix with external storage: AHV compute-only nodes on the array the customer already owns.
// The supported arrays are listed side by side above one array-neutral loop: it keeps the array,
// adds compute nodes, connects them, maps each VM disk to its own array volume, adds a node
// without touching the array, then puts Prism on top.
// Every product and support claim is checked in docs/facts.md section 7 (NetApp: EXT-2, EXT-15).
// NetApp ONTAP is announced but not generally available, so its card says so, and the per-disk
// volume and snapshot lines are worded for the generally available arrays.
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, Tip, type Tone } from '../../components/controls';
import { Kpis, Points, Show, ease, phaseAt, prog, type Point } from '../../components/show';

/** The supported arrays: how the nodes reach each one, and when it became generally available. */
const ARRAYS: { name: string; proto: string; ga: string | null; note: string; tip: string }[] = [
  { name: 'Everpure FlashArray', proto: 'NVMe/TCP', ga: 'Dec 2025', note: 'new Nutanix cluster only', tip: 'AOS 7.5 and AHV 11 or later. Needs a new Nutanix cluster (3 to 32 nodes, one FlashArray); the array itself can be one you already own.' },
  { name: 'Dell PowerStore', proto: 'NVMe/TCP', ga: 'Jul 2026', note: 'NCI 7.6, generations 1 to 3', tip: 'Generally available with NCI 7.6, for PowerStore generations 1 to 3.' },
  { name: 'Dell PowerFlex', proto: 'Dell SDC', ga: 'Apr 2025', note: 'the first array supported', tip: 'Reached through Dell’s own client (SDC), which runs in the Controller VM on each node.' },
  { name: 'NetApp ONTAP', proto: 'NFS', ga: null, note: 'planned for an upcoming NCI release', tip: 'Announced with NetApp in April 2026 for AFF A-series and select FAS systems over NFS (NetApp names NCI 7.6.0.10). As of October 22, 2026 no general availability had been announced, so check before planning on it.' },
];

function Arrays() {
  return (
    <div class="xs-arrays">
      <span class="choice-l">Works with</span>
      <ul>
        {ARRAYS.map((a) => (
          <li key={a.name} class={a.ga ? '' : 'soon'}>
            <b>
              <Tip text={a.tip}>{a.name}</Tip>
            </b>
            <span class="xs-arr-meta">
              <span class="mono">{a.proto}</span>
              <span class={a.ga ? 'ok-text' : 'warn-text'}>{a.ga ? `GA ${a.ga}` : 'Announced'}</span>
            </span>
            <span class="xs-arr-note">{a.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const P = [0, 3.2, 6.6, 10.4, 13.8];
const END = 17.2;
const NODE_IN = [0.6, 1.1, 1.6];
const NODE4_IN = 10.6;
const LINK_IN = P[1];
const VOL_AT = (k: number) => (k < 9 ? 6.8 + k * 0.25 : 12.0 + (k - 9) * 0.25);
const SNAP_IN = 9.2;
const PC_IN = P[4];

const PHASES = ['Keep your array', 'Connect over Ethernet', 'One volume per disk', 'Add compute only', 'Run it from Prism'];
const CAPTIONS = [
  'Keep the storage array you already run. Nutanix adds compute-only nodes running AHV: each has a boot drive but no data drives.',
  'The nodes reach the array over standard Ethernet, so there is no Fibre Channel fabric to run: NVMe/TCP for FlashArray and PowerStore, Dell’s own client (SDC) for PowerFlex, and NFS for NetApp ONTAP.',
  'On the generally available arrays each VM disk is its own volume, with no shared datastore in between. Nutanix takes snapshots and clones through the array’s own APIs, per disk, and drives the replication for DR.',
  'Need more CPU and memory? Add a compute node, and the array doesn’t change. When you need capacity, grow the array on its own schedule.',
  'Prism Central runs it like any AHV cluster: VMs, networks, Flow security and DR orchestration, including failover to a full Nutanix cluster. From NCI 7.6 the array’s storage is managed in Prism Central too.',
];

const POINTS: Point[] = [
  { k: 'Keep your array', by: 'No storage refresh', text: 'Move VMs off vSphere onto AHV and keep the array you already own, instead of a forklift upgrade.', tone: 'ink', at: 0 },
  { k: 'Scale each side on its own', by: 'Compute and storage', text: 'Add compute nodes for CPU and memory, grow the array for capacity. Neither purchase forces the other.', tone: 'ok', at: P[3] },
  { k: 'Nutanix runs the VMs', by: 'AHV · Prism · Flow · DR', text: 'Licensed per core as NCI Compute, while the array keeps doing the storage, snapshots and clones included.', tone: 'flow', at: P[4] },
];

// ── geometry ──
const W = 960;
const GAP = 16;
const NW = (W - 3 * GAP) / 4;
const PC_H = 34;
const NODE_Y = PC_H + 22;
const NODE_H = 116;
const NET_Y = NODE_Y + NODE_H + 30;
const NET_H = 22;
const ARR_Y = NET_Y + NET_H + 30;
const ARR_X = 110;
const ARR_W = W - 2 * ARR_X;
const ARR_H = 160;
const H = ARR_Y + ARR_H + 2;
const VMW = 38;
const VMH = 24;
const TW = 98;
const TH = 30;
const TGAP = (ARR_W - 40 - 6 * TW) / 5;
const nx = (i: number) => i * (NW + GAP);
const vmx = (i: number, j: number) => nx(i) + 12 + j * (VMW + 10);
const tileX = (k: number) => ARR_X + 20 + (k % 6) * (TW + TGAP);
const tileY = (k: number) => ARR_Y + 52 + Math.floor(k / 6) * (TH + 12);
const LINK_X = [ARR_X + ARR_W * 0.3, ARR_X + ARR_W * 0.7];

function nodeIn(i: number, t: number): number {
  return prog(t, i < 3 ? NODE_IN[i] : NODE4_IN, (i < 3 ? NODE_IN[i] : NODE4_IN) + 0.6);
}

function ExtDiagram({ t }: { t: number }) {
  const arrIn = prog(t, 0, 0.5);
  const link = prog(t, LINK_IN, LINK_IN + 0.8);
  const flowing = t >= LINK_IN + 0.8;
  const pc = prog(t, PC_IN, PC_IN + 0.6);
  const snap = prog(t, SNAP_IN, SNAP_IN + 0.4);
  const vols = Array.from({ length: 12 }, (_, k) => prog(t, VOL_AT(k), VOL_AT(k) + 0.3));
  const latest = vols.reduce((m, v, k) => (v > 0 && v < 1 ? k : m), -1);
  const nodes = t >= NODE4_IN ? 4 : 3;

  return (
    <svg class="diagram xs-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${nodes} AHV compute-only nodes connect over Ethernet to the storage array you already own. Each VM disk is its own volume on the array. Adding a compute node leaves the array unchanged.`}>
      {/* Prism Central on top */}
      {pc > 0 ? (
        <g style={{ opacity: pc }}>
          <rect x={0} y={0} width={W} height={PC_H} class="ink-fill" rx={3} />
          <text x={14} y={22} class="xs-on-ink" style={{ fontWeight: 600, fontSize: '14px' }}>
            Prism Central
          </text>
          <text x={W - 14} y={22} text-anchor="end" class="xs-on-ink soft" style={{ fontSize: '12.5px' }}>
            VMs · networks · Flow security · DR orchestration · the array’s storage
          </text>
          {Array.from({ length: nodes }, (_, i) => (
            <line key={i} x1={nx(i) + NW / 2} x2={nx(i) + NW / 2} y1={PC_H} y2={NODE_Y} class="ink-stroke" stroke-dasharray="3 3" />
          ))}
        </g>
      ) : (
        <text x={0} y={22} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
          COMPUTE: AHV NODES WITH NO DATA DRIVES
        </text>
      )}

      {/* compute nodes */}
      {[0, 1, 2, 3].map((i) => {
        const k = nodeIn(i, t);
        if (k <= 0)
          return (
            <g key={i}>
              <rect x={nx(i)} y={NODE_Y} width={NW} height={NODE_H} class="frame-dash" />
              {i === 3 && (
                <text x={nx(i) + NW / 2} y={NODE_Y + NODE_H / 2 + 4} text-anchor="middle" class="faint" style={{ fontSize: '12.5px' }}>
                  room for more compute
                </text>
              )}
            </g>
          );
        const x = nx(i) + (1 - ease(k)) * 40;
        const vmIn = i === 3 ? prog(t, 11.6, 12.0) : 1;
        return (
          <g key={i} style={{ opacity: k }}>
            <rect x={x} y={NODE_Y} width={NW} height={NODE_H} class={`node-box${i === 3 && t < P[4] ? ' sel' : ''}`} />
            <text x={x + 12} y={NODE_Y + 20} style={{ fontSize: '13.5px', fontWeight: 600 }}>
              Node {i + 1}
            </text>
            <text x={x + NW - 12} y={NODE_Y + 20} text-anchor="end" class="mono muted" style={{ fontSize: '12px' }}>
              AHV
            </text>
            {[0, 1, 2].map((j) => (
              <g key={j} style={{ opacity: vmIn }}>
                <rect x={x + 12 + j * (VMW + 10)} y={NODE_Y + 30} width={VMW} height={VMH} class={`vm${latest === i * 3 + j ? ' hl' : ''}`} />
                <text x={x + 12 + j * (VMW + 10) + VMW / 2} y={NODE_Y + 46} text-anchor="middle" class="muted" style={{ fontSize: '11px' }}>
                  VM
                </text>
              </g>
            ))}
            <rect x={x + 12} y={NODE_Y + 64} width={NW - 24} height={20} class="cvm" />
            <text x={x + 20} y={NODE_Y + 78} class="xs-on-ink" style={{ fontSize: '11.5px' }}>
              CVM · storage client
            </text>
            <rect x={x + 12} y={NODE_Y + 92} width={30} height={12} class="disk" />
            <text x={x + 50} y={NODE_Y + 102} class="faint" style={{ fontSize: '11px' }}>
              boot drive only
            </text>
          </g>
        );
      })}

      {/* Ethernet */}
      {link > 0 && (
        <g style={{ opacity: link }}>
          {Array.from({ length: nodes }, (_, i) => {
            const l = i === 3 ? prog(t, 11.2, 11.6) : 1;
            const cx = nx(i) + NW / 2;
            return l > 0 && <line key={i} x1={cx} x2={cx} y1={NODE_Y + NODE_H} y2={NODE_Y + NODE_H + (NET_Y - NODE_Y - NODE_H) * l} class="xs-link" />;
          })}
          <rect x={0} y={NET_Y} width={W * link} height={NET_H} class="xs-net" />
          <text x={12} y={NET_Y + 15} class="mono" style={{ fontSize: '12px' }}>
            Ethernet · NVMe/TCP, Dell SDC or NFS
          </text>
          <text x={W - 12} y={NET_Y + 15} text-anchor="end" class="muted" style={{ fontSize: '11.5px' }}>
            no Fibre Channel fabric
          </text>
          {LINK_X.map((lx) => (
            <line key={lx} x1={lx} x2={lx} y1={NET_Y + NET_H} y2={ARR_Y} class="xs-link" />
          ))}
        </g>
      )}
      {flowing &&
        Array.from({ length: nodes }, (_, i) => {
          if (i === 3 && t < 12.0) return null;
          const cx = nx(i) + NW / 2;
          const f = (t * 0.8 + i * 0.29) % 1;
          const down = i % 2 === 0;
          const y = NODE_Y + NODE_H + (NET_Y - NODE_Y - NODE_H) * (down ? f : 1 - f);
          return <circle key={i} cx={cx} cy={y} r={4} class="xs-io" />;
        })}
      {flowing &&
        LINK_X.map((lx, j) => {
          const f = (t * 0.8 + j * 0.5) % 1;
          return <circle key={lx} cx={lx} cy={NET_Y + NET_H + (ARR_Y - NET_Y - NET_H) * (j ? 1 - f : f)} r={4} class="xs-io" />;
        })}

      {/* the array */}
      <g style={{ opacity: arrIn }}>
        <rect x={ARR_X} y={ARR_Y} width={ARR_W} height={ARR_H} class="xs-array" rx={4} />
        <text x={ARR_X + 20} y={ARR_Y + 24} style={{ fontWeight: 600, fontSize: '15px' }}>
          Your storage array
        </text>
        <text x={ARR_X + ARR_W - 20} y={ARR_Y + 24} text-anchor="end" class="muted" style={{ fontSize: '12.5px' }}>
          {t >= P[3] && t < P[4] + 1 ? 'unchanged' : 'already in your data center'}
        </text>
        {vols.map((v, k) =>
          v <= 0 ? (
            <rect key={k} x={tileX(k)} y={tileY(k)} width={TW} height={TH} class="xs-slot" />
          ) : (
            <g key={k} style={{ opacity: v }}>
              {snap > 0 && k < 9 && <rect x={tileX(k) + 5} y={tileY(k) - 5} width={TW} height={TH} class="xs-snap" style={{ opacity: snap }} />}
              <rect x={tileX(k)} y={tileY(k)} width={TW} height={TH} class={`xs-vol${k === latest ? ' hl' : ''}`} />
              <text x={tileX(k) + 10} y={tileY(k) + 19} class="mono" style={{ fontSize: '11.5px' }}>
                N{Math.floor(k / 3) + 1} VM{(k % 3) + 1} disk
              </text>
            </g>
          ),
        )}
        <text x={ARR_X + 20} y={ARR_Y + ARR_H - 12} class="muted" style={{ fontSize: '12px' }}>
          {snap > 0 ? 'One volume per VM disk, with the array’s own snapshots per disk' : 'One volume per VM disk · no datastore'}
        </text>
      </g>
      {latest >= 0 &&
        (() => {
          const i = Math.floor(latest / 3);
          const j = latest % 3;
          const x0 = vmx(i, j) + VMW / 2;
          const tx = tileX(latest) + TW / 2;
          return <polyline points={`${x0},${NODE_Y + 54} ${x0},${NET_Y + NET_H / 2} ${tx},${NET_Y + NET_H / 2} ${tx},${tileY(latest)}`} class="xs-map" />;
        })()}
    </svg>
  );
}

const STEPS = paced(P, PHASES.map((k, i) => [k, CAPTIONS[i]]));

export default function ExtStorage() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END, steps: STEPS });
  const t = clock.t;
  const phase = phaseAt(P, t);
  const tone: Tone | 'ink' = phase === 0 ? 'ink' : phase === 3 ? 'ok' : 'flow';

  return (
    <Show
      top={
        <>
          <Arrays />
          <Points label="Why customers choose it" items={POINTS} t={t} />
        </>
      }
      foot={
        <>
          <Follow tone={tone} k={PHASES[phase]}>
            <p>{CAPTIONS[phase]}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Connects over', v: 'Ethernet', sub: 'NVMe/TCP, Dell SDC or NFS' },
              { k: 'Supported arrays', v: '4', sub: '3 generally available, NetApp announced' },
              { k: 'Licensed as', v: 'NCI-C', sub: 'per core', tip: 'NCI Compute: AHV, Prism and DR automation, priced per core. Snapshots and clones are left to the storage array.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <ExtDiagram t={t} />
      </div>
      <PlayBar clock={clock} label="External storage animation" fmt={() => PHASES[phase]} />
      <div class="xs-legend">
        <Legend
          items={[
            { color: 'var(--ink)', label: 'Controller VM (CVM)' },
            { color: 'var(--flow)', label: 'Storage traffic' },
            { color: 'var(--line-2)', label: 'Array snapshot', dashed: true },
          ]}
        />
        <Illus why="Node, VM and volume counts are an example. Supported servers, array models, versions and limits differ by array and release; check the Compatibility Matrix." />
      </div>
    </Show>
  );
}
