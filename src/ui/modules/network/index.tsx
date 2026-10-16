// AHV Networking: Open vSwitch on every host managed as one virtual switch (vs0), bridge br0 with
// its uplink bond br0-up, the internal virbr0 link between host and CVM, VLAN-backed subnets,
// bond types with a link-failure toggle, and CVM/host VLAN and segmentation options.
// Bond logic lives in src/engine/ahvnet.ts.
import './style.css';
import { useBool, useEnum, useNum, useStr } from '../../../state/route';
import { useScenario } from '../../../state/scenario';
import { useClock } from '../../components/clock';
import { Chip, Field, Follow, Illus, Seg, Stat, Tip, Toggle } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import { BONDS, BOND_ORDER, limits, linkUp, nextVlan, uplinkFor, uplinkRole, vlanLabel, type BondMode, type LinkFail } from '../../../engine/ahvnet';

const HOSTS = 2;
const VMS_PER_HOST = 3;
const VM_COUNT = HOSTS * VMS_PER_HOST;
const NAMES = ['Web', 'App', 'DB', 'Test', 'Dev', 'Backup'];
const MAX_NETS = 6;
const CVM_VLAN = 100; // example ID for the tagged option
const BACKPLANE_VLAN = 200; // example ID for logical backplane segmentation

interface Net {
  vlan: number;
  name: string;
}

function parseNets(s: string): Net[] {
  const out: Net[] = [];
  for (const part of s.split(',')) {
    const [v, n] = part.split(':');
    const vlan = Number(v);
    if (Number.isInteger(vlan) && vlan >= 2 && vlan <= 4094 && !out.some((x) => x.vlan === vlan)) out.push({ vlan, name: (n || `VLAN ${vlan}`).slice(0, 12) });
  }
  return out.length ? out : [{ vlan: 10, name: 'Web' }];
}
const fmtNets = (n: Net[]) => n.map((x) => `${x.vlan}:${x.name}`).join(',');

export default function Network() {
  const { cfg } = useScenario();
  const [bond, setBond] = useEnum<BondMode>('bond', 'ab', BOND_ORDER);
  const [fail, setFail] = useEnum<LinkFail>('lf', 'none', ['none', 'nic', 'switch']);
  const [netStr, setNetStr] = useStr('nets', '10:Web,20:App');
  const [vmStr, setVmStr] = useStr('vmn', '010101');
  const [sel, setSel] = useNum('vm', 0, 0, VM_COUNT + HOSTS - 1);
  const [tag, setTag] = useBool('tag', false);
  const [seg, setSeg] = useBool('seg', false);
  const nets = parseNets(netStr);
  const vmNet = Array.from({ length: VM_COUNT }, (_, i) => Math.min(nets.length - 1, Math.max(0, Number(vmStr[i] ?? 0) || 0)));
  const clock = useClock({ rate: 1, stepSize: 0.25, autoplay: true, keys: true });
  const twoNode = cfg.nodes === 2;
  const smallCluster = cfg.nodes <= 2;
  const segWhy = twoNode ? 'Network segmentation is not supported on two-node clusters.' : null;
  const segOn = seg && !twoNode;

  const setVmNet = (vm: number, idx: number) => {
    const arr = [...vmNet];
    arr[vm] = idx;
    setVmStr(arr.join(''));
  };
  const addNet = () => {
    const v = nextVlan(nets.map((n) => n.vlan));
    if (v === null || nets.length >= MAX_NETS) return;
    const name = NAMES.find((n) => !nets.some((x) => x.name === n)) ?? `VLAN ${v}`;
    setNetStr(fmtNets([...nets, { vlan: v, name }]));
  };
  const removeNet = (i: number) => {
    if (nets.length <= 1) return;
    const next = nets.filter((_, k) => k !== i);
    setNetStr(fmtNets(next));
    setVmStr(vmNet.map((x) => (x === i ? 0 : x > i ? x - 1 : x)).join(''));
  };

  const isCvm = sel >= VM_COUNT;
  const selHost = isCvm ? sel - VM_COUNT : Math.floor(sel / VMS_PER_HOST);
  const selName = isCvm ? `CVM on Host ${selHost + 1}` : `VM${sel + 1}`;
  const selVlan = isCvm ? (tag ? CVM_VLAN : 0) : nets[vmNet[sel]].vlan;
  const b = BONDS[bond];
  const lim = [0, 1].map((h) => limits(bond, h, fail));
  const usedVlans = [...new Set(vmNet.map((i) => nets[i].vlan))].sort((a, z) => a - z);

  return (
    <>
      <div class="lab net-lab">
        <aside class="ctl" aria-label="Network settings">
          <Field label="Bond type" tip="How a host’s physical uplinks in br0-up share traffic. Prism calls this the Bond Type." detail="Prism name / OVS mode: Active-Backup = active-backup; Active-Active with MAC pinning = balance-slb; Active-Active = balance-tcp with LACP. Every type except No Uplink Bond needs at least two uplinks per node, and all hosts should use the same type.">
            <Seg label="Bond type" value={bond} onChange={setBond} options={BOND_ORDER.map((m) => ({ value: m, label: BONDS[m].short, title: BONDS[m].prism }))} />
            <div class="field-note">
              {b.prism}
              {b.recommended ? ' · default and recommended' : ''}
            </div>
          </Field>
          <Field label="Link failure" tip="Break an uplink and watch the bond move traffic to the surviving link.">
            <Seg
              label="Link failure"
              value={fail}
              onChange={setFail}
              options={[
                { value: 'none', label: 'None' },
                { value: 'nic', label: 'Host 1 NIC A' },
                { value: 'switch', label: 'Switch A' },
              ]}
            />
          </Field>
          <Field label="VLAN-backed networks" tip="Prism calls them subnets. Each maps to one VLAN on one virtual switch (vs0 by default)." detail="A managed network adds IP address management (IPAM): AHV answers the VM’s DHCP request itself, so it never reaches the physical network. IPAM must be chosen when the network is created.">
            <ul class="net-list">
              {nets.map((n, i) => (
                <li key={n.vlan}>
                  <span class="mono">VLAN {n.vlan}</span>
                  <span>{n.name}</span>
                  <button type="button" class="tbtn" aria-label={`Remove ${n.name}`} disabled={nets.length <= 1} onClick={() => removeNet(i)}>
                    <Icon name="x" />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" class="btn" onClick={addNet} disabled={nets.length >= MAX_NETS}>
              <Icon name="plus" />
              Add network
            </button>
          </Field>
          <Field label={isCvm ? `${selName}` : `${selName}’s network`} tip="Click any VM or CVM in the diagram to select it and watch its traffic leave the host." note={isCvm ? 'The CVM’s external interface (eth0) sits on br0 with the host’s management interface. Set its VLAN below.' : undefined}>
            {!isCvm && <Seg label={`${selName} network`} value={vmNet[sel]} onChange={(i) => setVmNet(sel, i)} options={nets.map((n, i) => ({ value: i, label: `${n.vlan} · ${n.name}` }))} />}
          </Field>
          <Field label="CVM and host VLAN" tip="By default the CVM and host send untagged frames (VLAN 0), so they land on the switch port’s native VLAN." detail={`Recommended: keep CVM and host on the same native VLAN, using a VLAN other than 1, and keep guest VMs off it. To tag instead: change_cvm_vlan <id> on the CVM, and on the host (AHV 10 and later) nmcli con modify ovs-port-br0 ovs-port.tag <id> ovs-port.vlan-mode access. Plan a maintenance window.`}>
            <Seg
              label="CVM and host VLAN"
              value={tag ? 'tag' : 'native'}
              onChange={(v) => setTag(v === 'tag')}
              options={[
                { value: 'native', label: 'Native (untagged)' },
                { value: 'tag', label: `Tagged ${CVM_VLAN}` },
              ]}
            />
          </Field>
          <Field label="Network segmentation" tip="Move CVM-to-CVM backplane traffic onto its own interface (eth2) and VLAN, apart from management." why={segWhy} detail="Logical: a separate non-routable VLAN on br0. Physical: a separate bridge or virtual switch with its own uplinks. Other options isolate RDMA, Volumes (iSCSI) and disaster-recovery traffic. When configured, the backplane also carries AHV live migration.">
            <Toggle on={segOn} disabled={twoNode} onChange={setSeg}>
              Backplane on its own VLAN
            </Toggle>
          </Field>
          {smallCluster && (
            <Follow tone="warn" k={`${cfg.nodes}-node cluster`}>
              <p class="small">Creating or changing a virtual switch on a one- or two-node cluster requires powering off all user VMs.</p>
            </Follow>
          )}
        </aside>

        <section class="stage" aria-label="Host networking diagram">
          <div class="spread net-head">
            <span class="small muted">
              Click a VM or CVM to follow its traffic. <Illus why="Two hosts shown; vs0 spans every host in the cluster. Uplink choice for MAC pinning and LACP is a simplified hash; real OVS hashes by MAC or flow and rebalances by load." />
            </span>
            <button type="button" class="tbtn" onClick={clock.toggle}>
              <Icon name={clock.playing ? 'pause' : 'play'} />
              {clock.playing ? 'Pause traffic' : 'Play traffic'}
            </button>
          </div>
          <div class="diagram-scroll">
            <NetDiagram bond={bond} fail={fail} nets={nets} vmNet={vmNet} sel={sel} setSel={setSel} tag={tag} seg={segOn} t={clock.t} />
          </div>
          <TrafficNote selName={selName} isCvm={isCvm} vm={isCvm ? 0 : sel} vlan={selVlan} bond={bond} fail={fail} host={selHost} usedVlans={usedVlans} tag={tag} />
        </section>

        <aside class="rail" aria-label="Bond and VLAN status">
          <div class="side-sec">
            <div class="eyebrow">Bond type</div>
            <h3 class="net-bond">{b.prism}</h3>
            <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
              <span class="mono small muted">OVS: {b.ovs}</span>
              {b.recommended ? <Chip tone="ok">Recommended</Chip> : bond === 'slb' ? <Chip tone="warn" icon="warn">Not recommended</Chip> : <Chip tone="neutral">Needs switch LAG</Chip>}
            </div>
            <p class="small net-p">{b.spread}</p>
            <p class="small net-p">
              <strong>Switch side:</strong> {b.switchConfig}
            </p>
            <p class="small net-p muted">{b.note}</p>
          </div>
          <div class="side-sec">
            <div class="eyebrow">
              <Tip text="With two 10 Gb/s uplinks per host. Limits, not measurements.">Throughput limits</Tip>
            </div>
            {[0, 1].map((h) => (
              <div key={h} class="net-lim">
                <div class="small">
                  Host {h + 1}
                  {lim[h].host < 20 && bond !== 'ab' ? <span class="warn-text"> · one uplink left</span> : null}
                  {bond === 'ab' && !linkUp(h, 0, fail) ? <span class="warn-text"> · on backup uplink</span> : null}
                </div>
                <Stat k="Per host" v={`${lim[h].host} Gb/s`} />
                <Stat k="Per VM NIC" v={`${lim[h].vm} Gb/s`} />
                <Stat k="Per flow" v={`${lim[h].flow} Gb/s`} />
              </div>
            ))}
          </div>
          <div class="side-sec">
            <div class="eyebrow">Link status</div>
            {fail === 'none' ? (
              <p class="small net-p">
                <Chip tone="ok">All uplinks up</Chip>
              </p>
            ) : (
              <>
                <p class="small net-p">
                  <Chip tone="bad">{fail === 'nic' ? 'Host 1 NIC A down' : 'Switch A down'}</Chip>
                </p>
                <p class="small net-p">{b.onFailure} VMs keep their addresses and VLANs; nothing changes inside the guest.</p>
              </>
            )}
          </div>
        </aside>
      </div>

      <div class="cols-3 net-cards">
        <div>
          <h2 class="sec-h">One switch, many hosts</h2>
          <p class="small">
            Every AHV host runs its own Open vSwitch (OVS). Prism manages them together as a <strong>virtual switch</strong>: vs0 is the default, joining br0 and its uplink bond br0-up on every node. vs0 cannot be deleted. Changes roll out host by host: the <strong>Standard</strong> method puts each node into maintenance mode, applies the settings, checks the default gateway and moves on. The <strong>Quick</strong> method skips maintenance mode and is meant for non-production only. Do not change a virtual switch during an AOS or AHV upgrade.
          </p>
        </div>
        <div>
          <h2 class="sec-h">Inside the host</h2>
          <p class="small">
            The CVM has two interfaces by default: <span class="mono">eth0</span> on br0 for management and cluster traffic, and <span class="mono">eth1</span> on <span class="mono">virbr0</span>, a plain Linux bridge (not OVS) that links it to its own host. The host is 192.168.5.1 and reaches its local CVM at 192.168.5.254. VM traffic also passes through a bridge chain that OVS builds automatically for Flow; you never configure it. Don’t modify virbr0.
          </p>
        </div>
        <div>
          <h2 class="sec-h">MTU and tools</h2>
          <p class="small">
            CVM interfaces stay at 1500 bytes. Jumbo frames (9000) are allowed on host NICs and guest VMs if enabled end to end, and are recommended for overlay networking. Configure networking in Prism or with aCLI (<span class="mono">net.update_virtual_switch</span>). The older <span class="mono">manage_ovs</span> tool still ships, but the virtual switch reverts its changes, so use it only with Nutanix Support. To look without changing: <span class="mono">ovs-appctl bond/show br0-up</span>.
          </p>
        </div>
      </div>
      <Follow tone="ink" k="What sits on top">
        <p>
          VLAN-backed subnets need the physical network to carry each VLAN. Flow Virtual Networking adds overlay VPCs in software on these same hosts, and Flow Network Security adds policy that follows each VM.
        </p>
        <p>
          <button type="button" class="btn" onClick={() => go('nci/flow')}>
            Open Flow <Icon name="arrow" />
          </button>
        </p>
      </Follow>
    </>
  );
}

function TrafficNote({ selName, isCvm, vm, vlan, bond, fail, host, usedVlans, tag }: { selName: string; isCvm: boolean; vm: number; vlan: number; bond: BondMode; fail: LinkFail; host: number; usedVlans: number[]; tag: boolean }) {
  const u = uplinkFor(bond, host, vm, 0, fail);
  const nic = u === 1 ? 'NIC B' : 'NIC A';
  return (
    <Follow tone="flow" k={`Following ${selName}`}>
      <p>
        {isCvm
          ? `The CVM sends from eth0 onto br0 ${tag ? `and OVS tags its frames with VLAN ${CVM_VLAN}` : 'untagged, so the switch puts it on the port’s native VLAN'}.`
          : `${selName} sends ordinary untagged frames. Its port on br0 belongs to VLAN ${vlan}, so OVS adds an 802.1Q tag ${vlan} on the way out through br0-up.`}{' '}
        {bond === 'lacp' && linkUp(host, 0, fail) && linkUp(host, 1, fail) && !isCvm ? 'Its flows are hashed across both uplinks.' : `It leaves on ${nic}${!linkUp(host, 0, fail) ? ', because NIC A’s link is down' : ''}.`}
      </p>
      <p class="rest">
        Switch ports facing the hosts are trunks: native VLAN for {tag ? 'nothing management-related (CVM and host are tagged)' : 'the CVM and host'}, plus tagged VLANs {usedVlans.join(', ')}
        {tag ? ` and ${CVM_VLAN}` : ''}. Frame on the wire: {vlanLabel(vlan)}.
      </p>
    </Follow>
  );
}

// ── diagram ──
function NetDiagram({ bond, fail, nets, vmNet, sel, setSel, tag, seg, t }: { bond: BondMode; fail: LinkFail; nets: Net[]; vmNet: number[]; sel: number; setSel: (n: number) => void; tag: boolean; seg: boolean; t: number }) {
  const W = 820;
  const HW = 392; // host width
  const hx = (h: number) => 12 + h * (HW + 12);
  const swX = [125, 515];
  const swW = 180;
  const nicX = (h: number, n: number) => hx(h) + (n === 0 ? 70 : 210);
  const nicW = 112;
  const Y = { sw: 14, swH: 46, host: 104, nic: 124, nicH: 34, bond: 196, bondH: 30, br: 254, brH: 42, vm: 372, vmH: 62, vir: 474, virH: 42 };
  const H = 570;
  const vmX = (h: number, i: number) => hx(h) + 14 + i * 80;
  const vmW = 70;
  const cvmX = (h: number) => hx(h) + 262;
  const cvmW = 118;

  const key = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  // packet path for the selected element
  const isCvm = sel >= VM_COUNT;
  const sh = isCvm ? sel - VM_COUNT : Math.floor(sel / VMS_PER_HOST);
  const si = isCvm ? 0 : sel % VMS_PER_HOST;
  const sx = isCvm ? cvmX(sh) + 30 : vmX(sh, si) + vmW / 2;
  const flows = bond === 'lacp' && !isCvm ? [0, 1] : [0];
  const vlan = isCvm ? (tag ? CVM_VLAN : 0) : nets[vmNet[sel]].vlan;
  const packets = flows.map((f) => {
    const u = uplinkFor(bond, sh, isCvm ? 0 : sel, f, fail) ?? 0;
    const nx = nicX(sh, u) + nicW / 2;
    const swx = swX[u] + swW / 2;
    const pts: [number, number][] = [
      [sx, Y.vm],
      [sx, Y.br + Y.brH],
      [sx, Y.br],
      [nx, Y.bond + Y.bondH],
      [nx, Y.bond],
      [nx, Y.nic + Y.nicH],
      [nx, Y.nic],
      [swx, Y.sw + Y.swH],
    ];
    const p = ((t + f * 0.9) % 2.4) / 2.4;
    return { pts, ...along(pts, p), u, f };
  });

  return (
    <svg class="diagram net-dia" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Two AHV hosts on virtual switch vs0 with bond type ${BONDS[bond].prism}`}>
      {/* switches */}
      {[0, 1].map((s) => {
        const down = fail === 'switch' && s === 0;
        return (
          <g key={s}>
            <rect x={swX[s]} y={Y.sw} width={swW} height={Y.swH} class={down ? 'node-box down' : 'bg3'} stroke="var(--line-2)" />
            <text x={swX[s] + swW / 2} y={Y.sw + 20} text-anchor="middle" class="net-t">
              {down ? '✕ ' : ''}Switch {s === 0 ? 'A' : 'B'}
            </text>
            <text x={swX[s] + swW / 2} y={Y.sw + 37} text-anchor="middle" class="net-s muted">
              top of rack · trunk ports
            </text>
          </g>
        );
      })}
      {bond === 'lacp' && (
        <g>
          <line x1={swX[0] + swW} x2={swX[1]} y1={Y.sw + 23} y2={Y.sw + 23} class="ink-stroke" stroke-width={2} />
          <text x={(swX[0] + swW + swX[1]) / 2} y={Y.sw + 17} text-anchor="middle" class="net-s ink-text-fill">
            LAG · MLAG / vPC
          </text>
        </g>
      )}

      {/* vs0 frame */}
      <rect x={4} y={Y.bond - 14} width={W - 8} height={Y.br + Y.brH - Y.bond + 26} class="frame-dash net-vs" />
      <text x={W / 2} y={Y.br + Y.brH + 34} text-anchor="middle" class="net-s ink-text-fill">
        vs0 · one virtual switch across every host, configured in Prism
      </text>

      {[0, 1].map((h) => {
        const x = hx(h);
        return (
          <g key={h}>
            <rect x={x} y={Y.host} width={HW} height={H - Y.host - 6} class="frame" />
            <text x={x + 12} y={H - 20} class="net-t">
              Host {h + 1} · AHV
            </text>
            {/* uplinks */}
            {[0, 1].map((n) => {
              const role = uplinkRole(bond, h, n as 0 | 1, fail, VMS_PER_HOST);
              const down = role === 'down';
              const nx = nicX(h, n);
              const swx = swX[n] + swW / 2;
              const pinned = bond === 'slb' ? Array.from({ length: VMS_PER_HOST }, (_, i) => h * VMS_PER_HOST + i).filter((v) => uplinkFor('slb', h, v, 0, fail) === n) : [];
              return (
                <g key={n}>
                  <line x1={nx + nicW / 2} y1={Y.nic} x2={swx} y2={Y.sw + Y.swH} class={down ? 'bad-stroke' : role === 'standby' || role === 'idle' ? 'net-idle' : 'net-up'} stroke-dasharray={down ? '5 4' : role === 'standby' ? '3 4' : undefined} stroke-width={down ? 2 : role === 'standby' ? 1.5 : 2.5} />
                  <rect x={nx} y={Y.nic} width={nicW} height={Y.nicH} class={down ? 'node-box down' : 'bg2'} stroke={down ? undefined : 'var(--line-2)'} />
                  <text x={nx + nicW / 2} y={Y.nic + 15} text-anchor="middle" class="net-s">
                    {down ? '✕ ' : ''}NIC {n === 0 ? 'A' : 'B'} · 10G
                  </text>
                  <text x={nx + nicW / 2} y={Y.nic + 29} text-anchor="middle" class={`net-xs ${down ? 'bad-text-fill' : role === 'standby' ? 'muted' : 'ok-text-fill'}`}>
                    {down ? 'link down' : role === 'active' ? 'active' : role === 'standby' ? 'standby' : bond === 'slb' ? pinned.map((v) => `VM${v + 1}`).join(' ') || 'idle' : 'carrying flows'}
                  </text>
                  <line x1={nx + nicW / 2} y1={Y.nic + Y.nicH} x2={nx + nicW / 2} y2={Y.bond} class={down ? 'bad-stroke' : 'net-up'} stroke-dasharray={down ? '4 3' : undefined} stroke-width={1.5} />
                </g>
              );
            })}
            <rect x={x + 40} y={Y.bond} width={HW - 80} height={Y.bondH} class="bg3" stroke="var(--line-2)" />
            <text x={x + HW / 2} y={Y.bond + 20} text-anchor="middle" class="net-s">
              <tspan class="mono">br0-up</tspan> · uplink bond ({BONDS[bond].short})
            </text>
            <line x1={x + HW / 2} y1={Y.bond + Y.bondH} x2={x + HW / 2} y2={Y.br} class="net-up" stroke-width={1.5} />
            <rect x={x + 12} y={Y.br} width={HW - 24} height={Y.brH} class="ink-fill" />
            <text x={x + 24} y={Y.br + 26} class="net-t" style={{ fill: '#fff' }}>
              <tspan class="mono">br0</tspan> · Open vSwitch
            </text>
            <text x={x + HW - 24} y={Y.br + 26} text-anchor="end" class="net-xs" style={{ fill: 'rgba(255,255,255,.85)' }}>
              host port: {tag ? `VLAN ${CVM_VLAN}` : 'untagged'}
            </text>
            {/* VMs */}
            {Array.from({ length: VMS_PER_HOST }, (_, i) => {
              const v = h * VMS_PER_HOST + i;
              const on = v === sel;
              const vx = vmX(h, i);
              const n = nets[vmNet[v]];
              return (
                <g key={v} role="button" tabIndex={0} aria-pressed={on} aria-label={`VM${v + 1} on VLAN ${n.vlan} ${n.name}`} onClick={() => setSel(v)} onKeyDown={key(() => setSel(v))}>
                  <line x1={vx + vmW / 2} y1={Y.vm} x2={vx + vmW / 2} y2={Y.br + Y.brH} class="net-up" stroke-width={1.5} />
                  <rect x={vx} y={Y.vm} width={vmW} height={Y.vmH} class={`hit vm${on ? ' hl' : ''}`} />
                  <text x={vx + vmW / 2} y={Y.vm + 22} text-anchor="middle" class="net-t">
                    VM{v + 1}
                  </text>
                  <text x={vx + vmW / 2} y={Y.vm + 41} text-anchor="middle" class="net-xs mono">
                    VLAN {n.vlan}
                  </text>
                  <text x={vx + vmW / 2} y={Y.vm + 56} text-anchor="middle" class="net-xs muted">
                    {n.name}
                  </text>
                </g>
              );
            })}
            {/* CVM */}
            {(() => {
              const id = VM_COUNT + h;
              const on = sel === id;
              const cx = cvmX(h);
              return (
                <g role="button" tabIndex={0} aria-pressed={on} aria-label={`CVM on host ${h + 1}`} onClick={() => setSel(id)} onKeyDown={key(() => setSel(id))}>
                  <line x1={cx + 30} y1={Y.vm} x2={cx + 30} y2={Y.br + Y.brH} class="net-up" stroke-width={1.5} />
                  {seg && <line x1={cx + 92} y1={Y.vm} x2={cx + 92} y2={Y.br + Y.brH} class="flow-stroke" stroke-dasharray="4 3" stroke-width={2} />}
                  <rect x={cx} y={Y.vm} width={cvmW} height={Y.vmH} class={`hit cvm`} stroke={on ? 'var(--text)' : 'none'} stroke-width={on ? 2.5 : 0} />
                  <text x={cx + cvmW / 2} y={Y.vm + 22} text-anchor="middle" class="net-t" style={{ fill: '#fff' }}>
                    CVM
                  </text>
                  <text x={cx + 8} y={Y.vm + 42} class="net-xs mono" style={{ fill: 'rgba(255,255,255,.85)' }}>
                    eth0
                  </text>
                  {seg && (
                    <text x={cx + cvmW - 8} y={Y.vm + 42} text-anchor="end" class="net-xs mono" style={{ fill: 'rgba(255,255,255,.85)' }}>
                      eth2
                    </text>
                  )}
                  <text x={cx + cvmW / 2} y={Y.vm + 54} text-anchor="middle" class="net-xs mono" style={{ fill: 'rgba(255,255,255,.85)' }}>
                    eth1
                  </text>
                  <line x1={cx + cvmW / 2} y1={Y.vm + Y.vmH} x2={cx + cvmW / 2} y2={Y.vir} class="net-up" stroke-width={1.5} />
                </g>
              );
            })()}
            {seg && (
              <text x={cvmX(h) + cvmW} y={Y.vm - 8} text-anchor="end" class="net-xs flow-text-fill">
                eth2: backplane VLAN {BACKPLANE_VLAN}
              </text>
            )}
            {/* internal link */}
            <rect x={x + 14} y={Y.vir} width={130} height={Y.virH} class="bg2" stroke="var(--line-2)" />
            <text x={x + 79} y={Y.vir + 17} text-anchor="middle" class="net-s">
              AHV host
            </text>
            <text x={x + 79} y={Y.vir + 33} text-anchor="middle" class="net-xs mono muted">
              192.168.5.1
            </text>
            <line x1={x + 144} y1={Y.vir + Y.virH / 2} x2={x + 164} y2={Y.vir + Y.virH / 2} class="net-up" stroke-width={1.5} />
            <rect x={x + 164} y={Y.vir} width={HW - 176} height={Y.virH} class="bg3" stroke="var(--line-2)" stroke-dasharray="4 3" />
            <text x={x + 164 + (HW - 176) / 2} y={Y.vir + 17} text-anchor="middle" class="net-s">
              <tspan class="mono">virbr0</tspan> · internal Linux bridge
            </text>
            <text x={x + 164 + (HW - 176) / 2} y={Y.vir + 33} text-anchor="middle" class="net-xs mono muted">
              CVM 192.168.5.254 (and .2)
            </text>
          </g>
        );
      })}

      {/* packets */}
      {packets.map((pk) => (
        <g key={pk.f} class="net-pkt">
          <polyline points={pk.pts.map((p) => p.join(',')).join(' ')} class="net-path" />
          <circle cx={pk.x} cy={pk.y} r={7} class="flow-fill" />
          <text x={pk.x + 11} y={pk.y - 8} class="net-xs halo net-pkt-t">
            {pk.seg < 2 ? 'untagged' : vlan === 0 ? 'untagged · native' : `tag ${vlan}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Position at fraction p (0..1) along a polyline; seg is the index of the segment. */
function along(pts: [number, number][], p: number): { x: number; y: number; seg: number } {
  const lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0) || 1;
  let d = p * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, seg: i };
    }
    d -= lens[i];
  }
  return { x: pts[0][0], y: pts[0][1], seg: 0 };
}
