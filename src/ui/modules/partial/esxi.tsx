// ESXi on Nutanix: keep vSphere and vCenter, with Nutanix nodes and storage underneath.
// "Stay on ESXi" builds the stack (ESXi, a CVM per host, one shared datastore), then upgrades one
// host from Prism. "Convert to AHV later" changes the hypervisor in place, one host at a time.
// Every product and support claim is checked in docs/facts.md section 8.
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Points, Show, ease, phaseAt, prog, type Point } from '../../components/show';

type Go = 'stay' | 'conv';

// ── timelines ──
const STAY = [0, 3.0, 6.0, 9.4, 13.4];
const STAY_END = 15.8;
const STAY_PH = ['vSphere stays', 'A CVM on every host', 'One shared datastore', 'Upgrade a host', 'Back in service'];
const UP = { out: 9.4, down: 10.2, up: 12.4, back: STAY[4] };
const MOVE_TO = [0, 2, 3]; // where host 2's three VMs go during its upgrade

const CONV_STEP = 2.0;
const CONV = [0, 2.8, 2.8 + CONV_STEP, 2.8 + 2 * CONV_STEP, 2.8 + 3 * CONV_STEP, 2.8 + 4 * CONV_STEP];
const CONV_END = CONV[5] + 3.4;
const CONV_PH = ['Start from ESXi', 'Host 1 converts', 'Host 2 converts', 'Host 3 converts', 'Host 4 converts', 'One AHV cluster'];

const STAY_CAP = [
  'Each node runs VMware ESXi, and vCenter manages the VMs as before: vMotion, HA and DRS keep working.',
  'Each host also runs one Nutanix Controller VM (CVM). The host’s drive controller is passed straight through to it (VMDirectPath I/O), so the CVM owns the drives.',
  'The CVMs pool every host’s drives into one datastore that ESXi mounts over NFS. There is no SAN or vSAN to run, and AOS storage comes with the Nutanix license.',
  'Prism upgrades one host at a time: vMotion moves its VMs off, the host and its CVM go into maintenance, and the other CVMs keep serving all the data.',
  'The host rejoins, its VMs move back, and Prism moves on to the next host. The Nutanix storage stack can also be upgraded on its own, without touching ESXi.',
];
const CONV_CAP = (i: number) =>
  i === 0
    ? 'This cluster runs ESXi on Nutanix today: vCenter manages the VMs and the CVMs serve the storage. For an in-place conversion, vCenter has to run outside the cluster.'
    : i < 5
      ? 'Prism converts the hosts one at a time, in a rolling fashion. The storage layer runs independently of the hypervisor, so the CVMs and the data on the drives stay where they are.'
      : 'The cluster now runs AHV, which comes with Nutanix at no extra cost, and features that need AHV become available, such as Flow virtual networking and network security.';

const POINTS: Record<Go, Point[]> = {
  stay: [
    { k: 'Keep vSphere', by: 'vCenter · vMotion · HA · DRS', text: 'Admins keep the tools and skills they know, and vCenter still manages the VMs.', tone: 'ink', at: 0 },
    { k: 'No SAN to run', by: 'AOS storage, included', text: 'Storage comes from the hosts’ own drives and is part of the Nutanix license, with no separate array or vSAN cluster.', tone: 'ok', at: STAY[2] },
    { k: 'Rolling upgrades', by: 'Prism · LCM', text: 'One host at a time with its VMs moved off first, and the storage stack upgrades without touching ESXi.', tone: 'flow', at: STAY[3] },
  ],
  conv: [
    { k: 'Start on ESXi', by: 'No big-bang migration', text: 'Move onto Nutanix with vSphere first, and change the hypervisor later, on your own schedule.', tone: 'ink', at: 0 },
    { k: 'Same nodes, same data', by: 'In-place conversion', text: 'The hardware and the storage layer stay; only the hypervisor changes, one host at a time.', tone: 'flow', at: CONV[1] },
    { k: 'Drop the ESXi license', by: 'AHV included', text: 'AHV comes at no extra cost. DR sites can run AHV even before you convert, since replication works between ESXi and AHV clusters.', tone: 'ok', at: CONV[5] },
  ],
};

// ── geometry ──
const W = 960;
const GAP = 16;
const NW = (W - 3 * GAP) / 4;
const MG_H = 34;
const MG_W = (W - GAP) / 2;
const HOST_Y = MG_H + 22;
const HOST_H = 146;
const DS_Y = HOST_Y + HOST_H + 22;
const DS_H = 26;
const H = DS_Y + DS_H + 2;
const VMW = 38;
const VMH = 24;
const IN_W = NW - 48;
const nx = (i: number) => i * (NW + GAP);
const slotX = (i: number, s: number) => nx(i) + 12 + s * (VMW + 10);

interface HostState {
  /** 0 = ESXi, 1 = AHV, in between while converting. */
  ahv: number;
  /** Host (and its CVM) out of service. */
  maint: boolean;
  /** How far the hypervisor upgrade has run, 0..1, or -1 when not upgrading. */
  upgrading: number;
}

function hostsAt(go: Go, t: number): HostState[] {
  return [0, 1, 2, 3].map((i) => {
    if (go === 'conv') {
      const a = CONV[1] + i * CONV_STEP;
      return { ahv: ease(prog(t, a + 0.4, a + 1.4)), maint: t >= a && t < a + 1.8, upgrading: -1 };
    }
    const maint = i === 1 && t >= UP.down && t < UP.up;
    return { ahv: 0, maint, upgrading: maint ? prog(t, UP.down + 0.2, UP.up - 0.2) : -1 };
  });
}

function EsxiDiagram({ go, t }: { go: Go; t: number }) {
  const conv = go === 'conv';
  const hosts = hostsAt(go, t);
  const cvm = conv ? 1 : prog(t, STAY[1], STAY[1] + 0.6);
  const pass = conv ? 1 : prog(t, STAY[1] + 0.6, STAY[1] + 1.2);
  const ds = conv ? 1 : prog(t, STAY[2], STAY[2] + 0.8);
  const prism = conv ? 1 : prog(t, STAY[2], STAY[2] + 0.6);
  const vcGone = conv ? prog(t, CONV[5], CONV[5] + 0.6) : 0;
  const allAhv = hosts.every((h) => h.ahv >= 1);
  const flowing = ds >= 1;
  // host 2's VMs leave for an upgrade and come back after
  const away = conv ? 0 : ease(prog(t, UP.out, UP.down)) * (1 - ease(prog(t, UP.back, UP.back + 0.8)));

  const vms: { key: string; i: number; x: number; dim: boolean }[] = [];
  for (let i = 0; i < 4; i++)
    for (let s = 0; s < 3; s++) {
      const x = !conv && i === 1 ? slotX(i, s) + (slotX(MOVE_TO[s], 3) - slotX(i, s)) * away : slotX(i, s);
      vms.push({ key: `${i}-${s}`, i, x, dim: conv && hosts[i].maint });
    }

  return (
    <svg
      class="diagram es-dia"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={
        conv
          ? `A four-host Nutanix cluster converts from ESXi to AHV one host at a time; ${hosts.filter((h) => h.ahv >= 1).length} of 4 hosts run AHV. The CVMs and the datastore stay in place.`
          : 'Four ESXi hosts managed by vCenter, each with a Nutanix CVM that owns its drives; the CVMs pool the drives into one datastore. Prism upgrades one host at a time.'
      }
    >
      {/* management */}
      <g style={{ opacity: 1 - vcGone * 0.65 }}>
        <rect x={0} y={0} width={MG_W} height={MG_H} rx={3} class={vcGone > 0.5 ? 'frame-dash' : 'es-vc'} />
        <text x={14} y={22} style={{ fontWeight: 600, fontSize: '14px' }}>
          vCenter
        </text>
        <text x={MG_W - 14} y={22} text-anchor="end" class="muted" style={{ fontSize: '12.5px' }}>
          {vcGone > 0.5 ? 'no longer needed for this cluster' : conv ? 'VMs · runs outside this cluster' : 'VMs · vMotion · HA · DRS'}
        </text>
      </g>
      {prism > 0 ? (
        <g style={{ opacity: prism }}>
          <rect x={MG_W + GAP} y={0} width={MG_W} height={MG_H} rx={3} class="ink-fill" />
          <text x={MG_W + GAP + 14} y={22} class="es-on-ink" style={{ fontWeight: 600, fontSize: '14px' }}>
            {allAhv && conv ? 'Prism Central' : 'Prism'}
          </text>
          <text x={W - 14} y={22} text-anchor="end" class="es-on-ink soft" style={{ fontSize: '12.5px' }}>
            {allAhv && conv ? 'VMs · Flow · DR · upgrades' : 'storage · upgrades · DR'}
          </text>
        </g>
      ) : (
        <rect x={MG_W + GAP} y={0} width={MG_W} height={MG_H} rx={3} class="frame-dash" />
      )}

      {/* hosts */}
      {hosts.map((h, i) => {
        const k = conv ? 1 : prog(t, 0.3 + i * 0.3, 0.8 + i * 0.3);
        const x = nx(i);
        const label = h.ahv >= 0.5 ? 'AHV' : 'ESXi';
        return (
          <g key={i} style={{ opacity: k }}>
            <rect x={x} y={HOST_Y} width={NW} height={HOST_H} class={`node-box${h.maint ? ' warn' : ''}`} stroke-dasharray={h.maint ? '5 4' : undefined} />
            <text x={x + 12} y={HOST_Y + 20} style={{ fontSize: '13.5px', fontWeight: 600 }}>
              Host {i + 1}
            </text>
            <text x={x + NW - 12} y={HOST_Y + 20} text-anchor="end" class={`mono ${h.maint ? 'es-warn' : 'muted'}`} style={{ fontSize: '12px' }}>
              {h.maint ? (conv ? 'converting' : 'maintenance') : label}
            </text>
            {/* CVM */}
            {cvm > 0 && (
              <g style={{ opacity: cvm }}>
                <rect x={x + 12} y={HOST_Y + 62} width={IN_W} height={22} class={h.maint && !conv ? 'es-cvm-off' : 'cvm'} />
                <text x={x + 20} y={HOST_Y + 77} class={h.maint && !conv ? 'muted' : 'es-on-ink'} style={{ fontSize: '11.5px' }}>
                  {h.maint && !conv ? 'CVM · maintenance' : 'CVM · owns the drives'}
                </text>
              </g>
            )}
            {/* hypervisor */}
            <rect x={x + 12} y={HOST_Y + 92} width={IN_W} height={20} class="es-hv" />
            {h.ahv > 0 && <rect x={x + 12} y={HOST_Y + 92} width={IN_W * h.ahv} height={20} class="es-hv ahv" />}
            {h.upgrading >= 0 && <rect x={x + 12} y={HOST_Y + 92} width={IN_W * h.upgrading} height={20} class="es-hv up" />}
            <text x={x + 20} y={HOST_Y + 106} class={h.ahv >= 0.5 ? 'es-on-ink' : undefined} style={{ fontSize: '11.5px', fontWeight: 600 }}>
              {h.ahv >= 0.5 ? 'Nutanix AHV' : h.upgrading >= 0 ? 'Upgrading ESXi' : 'VMware ESXi'}
            </text>
            {/* drives, passed through to the CVM */}
            {[0, 1, 2, 3].map((d) => (
              <rect key={d} x={x + 12 + d * 28} y={HOST_Y + 122} width={22} height={13} class="disk" />
            ))}
            {pass > 0 && (
              <polyline
                points={`${x + 12 + 4 * 28 - 2},${HOST_Y + 128} ${x + NW - 20},${HOST_Y + 128} ${x + NW - 20},${HOST_Y + 128 - (128 - 73) * pass}`}
                class="es-pass"
              />
            )}
            {pass >= 1 && (
              <line x1={x + NW - 20} x2={x + 12 + IN_W} y1={HOST_Y + 73} y2={HOST_Y + 73} class="es-pass" />
            )}
            {ds > 0 && <line x1={x + NW / 2} x2={x + NW / 2} y1={HOST_Y + HOST_H} y2={DS_Y} class="es-link" />}
            {flowing && !h.maint && (
              <circle cx={x + NW / 2} cy={HOST_Y + HOST_H + (DS_Y - HOST_Y - HOST_H) * ((t * 0.9 + i * 0.31) % 1)} r={4} class="es-io" />
            )}
          </g>
        );
      })}
      {vms.map((v) => {
        const k = conv ? 1 : prog(t, 0.3 + v.i * 0.3, 0.8 + v.i * 0.3);
        return (
          <g key={v.key} style={{ opacity: k * (v.dim ? 0.25 : 1) }}>
            <rect x={v.x} y={HOST_Y + 30} width={VMW} height={VMH} class="vm" />
            <text x={v.x + VMW / 2} y={HOST_Y + 46} text-anchor="middle" class="muted" style={{ fontSize: '11px' }}>
              VM
            </text>
          </g>
        );
      })}

      {/* datastore */}
      {ds > 0 ? (
        <g>
          <rect x={0} y={DS_Y} width={W * ds} height={DS_H} class="ink-soft" stroke="var(--ink-line)" />
          <text x={12} y={DS_Y + 17} class="es-ink" style={{ fontSize: '12.5px' }}>
            {conv ? 'Same datastore, same data on the same drives' : 'One datastore across all four hosts’ drives, mounted over NFS'}
          </text>
        </g>
      ) : (
        <rect x={0} y={DS_Y} width={W} height={DS_H} class="frame-dash" />
      )}
    </svg>
  );
}

export default function EsxiOnNutanix() {
  const [go, setGo] = useEnum<Go>('go', 'stay', ['stay', 'conv']);
  const conv = go === 'conv';
  const stops = conv ? CONV : STAY;
  const clock = useClock({ rate: 1, duration: conv ? CONV_END : STAY_END, keys: true, poster: conv ? CONV_END : STAY_END, stops });
  useRestartOn(clock, [go]);
  const t = clock.t;
  const phase = phaseAt(stops, t);
  const name = (conv ? CONV_PH : STAY_PH)[phase];
  const onAhv = hostsAt(go, t).filter((h) => h.ahv >= 1).length;
  const tone: Tone | 'ink' = phase === 0 ? 'ink' : conv ? (phase === 5 ? 'ok' : 'flow') : phase === 2 ? 'ok' : phase === 3 ? 'warn' : 'flow';

  return (
    <Show
      top={
        <>
          <Choice<Go>
            label="Path"
            value={go}
            onChange={setGo}
            why={conv ? 'In-place conversion has strict prerequisites; many teams use Move or a DR failover to a new AHV cluster instead.' : null}
            options={[
              { value: 'stay', label: 'Stay on ESXi' },
              { value: 'conv', label: 'Convert to AHV later' },
            ]}
          />
          <Points label="Why customers choose it" items={POINTS[go]} t={t} />
        </>
      }
      foot={
        <>
          <Follow tone={tone} k={name}>
            <p>{conv ? CONV_CAP(phase) : STAY_CAP[phase]}</p>
          </Follow>
          <Kpis
            items={
              conv
                ? [
                    { k: 'Hosts on AHV', v: `${onAhv} of 4`, tone: onAhv === 4 ? 'ok' : undefined },
                    { k: 'Storage', v: 'Unchanged', sub: 'same CVMs and drives' },
                    { k: 'vCenter', v: 'Outside', sub: 'the cluster, for the conversion' },
                  ]
                : [
                    { k: 'VMware license', v: 'Your own', sub: 'existing VMware licenses' },
                    { k: 'Storage', v: 'AOS', sub: 'included with NCI', tone: 'ok' },
                    { k: 'Managed in', v: 'vCenter + Prism' },
                  ]
            }
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <EsxiDiagram go={go} t={t} />
      </div>
      <PlayBar clock={clock} label="ESXi on Nutanix animation" fmt={() => name} />
      <div class="xs-legend">
        <Legend
          items={[
            { color: 'var(--ink)', label: conv ? 'Controller VM (CVM), AHV' : 'Controller VM (CVM)' },
            { color: 'var(--flow)', label: 'Storage traffic' },
            { color: 'var(--line-2)', label: 'Drives passed through to the CVM', dashed: true },
          ]}
        />
        <Illus why={conv ? 'Timing is compressed. A real conversion has prerequisites and runs for much longer; how VMs move between hypervisors is not shown.' : 'Host and VM counts are an example. Which ESXi versions are qualified depends on the AOS release.'} />
      </div>
    </Show>
  );
}
