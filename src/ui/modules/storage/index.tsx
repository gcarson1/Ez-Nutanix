// Nutanix Unified Storage: Files (an FSVM fails and a survivor takes over its folders), Volumes
// (an iSCSI host is redirected to a healthy CVM) and Objects (a lifecycle rule tiers old objects
// off the cluster). Each tab is one looping picture; the models are in engine/unistore.ts.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import { iscsiTargets, loadPerFsvm, makeFiles, ownership, tierSplit } from '../../../engine/unistore';
import './style.css';

type Svc = 'files' | 'vol' | 'obj';
type Cap = { tone: Tone | 'ink'; k: string; text: string };

const W = 960;

/** Point at fraction f along a polyline. */
function along(pts: [number, number][], f: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? d / seg[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

/** The fabric under every service: one strip at the bottom of each picture. */
function Fabric({ y, h, note }: { y: number; h: number; note: string }) {
  return (
    <g>
      <rect class="sto-dsf" x={20} y={y} width={W - 40} height={h} />
      <text x={36} y={y + h - 10} class="muted" style={{ fontSize: '11.5px', letterSpacing: '0.06em' }}>
        DISTRIBUTED STORAGE FABRIC
      </text>
      <text x={W - 36} y={y + h - 10} text-anchor="end" class="muted" style={{ fontSize: '12px' }}>
        {note}
      </text>
    </g>
  );
}

// ── Files ──
const F = { fail: 3, take: 4, taken: 5.2, back: 9.5, give: 10.3, given: 11.5, end: 13.5 };
const F_STARTS = [0, F.fail, F.take, F.taken, F.back, F.give, F.given];
const NS = { x: W / 2 - 210, y: 8, w: 420, h: 50 };
const FS_Y = 96;
const FS_H = 190;
const CHIP_H = 24;

function Files() {
  const [nS, setN] = useEnum<'3' | '1'>('fv', '3', ['3', '1']);
  const n = Number(nS);
  const clock = useClock({ rate: 1, duration: F.end, keys: true, poster: F.taken + 1 });
  useRestartOn(clock, [n]);
  const t = clock.t;
  const ph = phaseAt(F_STARTS, t);
  const failed = n === 1 ? 0 : 1;
  const down = t >= F.fail && t < F.back;
  const base = useMemo(() => makeFiles(n), [n]);
  const home = useMemo(() => ownership(base), [base]);
  const taken = useMemo(() => ownership({ ...base, down: [failed] }), [base, failed]);
  // Takeover only happens with a survivor: it slides in after the failure and back after the return.
  const ha = n > 1;
  const k = !ha ? 0 : t < F.take ? 0 : t < F.taken ? ease(prog(t, F.take, F.taken)) : t < F.give ? 1 : t < F.given ? 1 - ease(prog(t, F.give, F.given)) : 0;
  const load = loadPerFsvm({ ...base, down: down ? [failed] : [] });
  const unreachable = (home: number) => down && home === failed && !(ha && t >= F.taken);
  const reachable = home.filter((o) => !unreachable(o.home)).length;

  const colW = n === 1 ? 420 : 270;
  const gap = 30;
  const x0 = (W - (n * colW + (n - 1) * gap)) / 2;
  const fx = (i: number) => x0 + i * (colW + gap);
  const chipCols = n === 1 ? 3 : 2;
  const chipW = (colW - 20 - (chipCols - 1) * 8) / chipCols;
  const slot = (fs: number, s: number) => ({ x: fx(fs) + 10 + (s % chipCols) * (chipW + 8), y: FS_Y + 56 + Math.floor(s / chipCols) * (CHIP_H + 6) });
  const homeSlot = home.map((o, i) => slot(o.home, home.slice(0, i).filter((q) => q.home === o.home).length));
  const ownCount = (fs: number) => home.filter((o) => o.home === fs).length;
  const takenSlot = taken.map((o, i) => (o.moved ? slot(o.servedBy!, ownCount(o.servedBy!) + taken.slice(0, i).filter((q) => q.moved && q.servedBy === o.servedBy).length) : homeSlot[i]));
  const survivor = taken.find((o) => o.moved)?.servedBy ?? null;

  const cap: Cap = ha
    ? [
        { tone: 'ink' as const, k: 'One namespace', text: 'Three file server VMs (FSVMs) share the work. Users connect to one path and never need to know which FSVM serves a folder.' },
        { tone: 'bad' as const, k: 'An FSVM fails', text: `FSVM-${failed + 1} goes down. Its folders are out of reach for a moment.` },
        { tone: 'warn' as const, k: 'Takeover', text: `FSVM-${(survivor ?? 0) + 1} takes over FSVM-${failed + 1}’s volume group and IP address, so its folders come back at the same path.` },
        { tone: 'ok' as const, k: 'Still serving', text: 'Every folder is reachable. Users may have seen a short pause or reconnect, but the path never changed.' },
        { tone: 'flow' as const, k: `FSVM-${failed + 1} is back`, text: `FSVM-${failed + 1} is running again and ready to take its work back.` },
        { tone: 'flow' as const, k: 'Handing back', text: `FSVM-${failed + 1} takes its volume group and IP address back, and the work is spread evenly again.` },
        { tone: 'ok' as const, k: 'Back to normal', text: 'All three FSVMs serve their own folders again. Nobody had to change a path or a drive mapping.' },
      ][ph]
    : t < F.fail
      ? { tone: 'ink', k: 'One FSVM', text: 'A single file server VM serves every folder. It works, but nothing can take over if it fails.' }
      : down
        ? { tone: 'bad', k: 'No high availability', text: 'The only FSVM is down, so every folder is out of reach until it comes back. Three FSVMs is the minimum for high availability.' }
        : { tone: 'ok', k: 'Back', text: 'The FSVM is back and serves every folder again.' };
  const word = ha ? ['Normal', 'Failure', 'Takeover', 'Serving', 'Return', 'Hand back', 'Normal'][ph] : t < F.fail ? 'Normal' : down ? 'Down' : 'Back';

  const H = FS_Y + FS_H + 94;
  const DSF_Y = FS_Y + FS_H + 26;
  return (
    <Show
      top={
        <Choice<'3' | '1'>
          label="File server"
          value={nS}
          onChange={setN}
          options={[
            { value: '3', label: '3 FSVMs' },
            { value: '1', label: '1 FSVM' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Folders reachable', v: `${reachable} of ${home.length}`, tone: reachable === home.length ? 'ok' : 'bad' },
              { k: 'FSVMs up', v: `${n - (down ? 1 : 0)} of ${n}`, tone: down ? 'warn' : 'ok' },
              ...(ha ? [{ k: 'Folders per FSVM', v: load.join(' · '), tip: 'How many top-level folders each FSVM serves right now.' }] : []),
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ha ? 'Nutanix Files: users see one path. Three file server VMs serve the folders. When one fails, another takes over its volume group and IP address, and hands them back when it returns.' : 'Nutanix Files with a single file server VM: when it fails, every folder is out of reach until it returns.'}>
          <rect class="sto-ns" x={NS.x} y={NS.y} width={NS.w} height={NS.h} />
          <text x={W / 2} y={NS.y + 21} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14px' }}>
            Users see one path
          </text>
          <text x={W / 2} y={NS.y + 39} text-anchor="middle" class="mono" style={{ fontSize: '12.5px' }}>
            \\files01\corp
          </text>
          {Array.from({ length: n }, (_, i) => {
            const isDown = down && i === failed;
            const x = fx(i);
            const ip = i === survivor && k > 0.5 ? `IP .${11 + i} + .${11 + failed}` : isDown ? 'IP moved away' : `IP .${11 + i}`;
            return (
              <g key={i}>
                <path d={`M${W / 2} ${NS.y + NS.h} V ${FS_Y - 18} H ${x + colW / 2} V ${FS_Y}`} fill="none" class={isDown ? 'bad-stroke' : 'line'} stroke-dasharray={isDown ? '4 4' : undefined} />
                <rect class={`node-box${isDown ? ' down' : ''}`} x={x} y={FS_Y} width={colW} height={FS_H} />
                <rect x={x} y={FS_Y} width={colW} height={30} class={isDown ? 'bad-fill' : 'ink-fill'} />
                <text x={x + 12} y={FS_Y + 20} style={{ fill: '#fff', fontWeight: 600, fontSize: '13.5px' }}>
                  FSVM-{i + 1}
                </text>
                <text x={x + colW - 12} y={FS_Y + 20} text-anchor="end" style={{ fill: '#fff', fontWeight: 600, fontSize: '12.5px' }}>
                  {isDown ? '✕ down' : 'running'}
                </text>
                <text x={x + 12} y={FS_Y + 46} class={i === survivor && k > 0.5 ? 'warn-fill mono' : 'muted mono'} style={{ fontSize: '12px' }}>
                  {ip}
                </text>
              </g>
            );
          })}
          {home.map((o, i) => {
            const a = homeSlot[i];
            const b = takenSlot[i];
            const x = a.x + (b.x - a.x) * k;
            const y = a.y + (b.y - a.y) * k;
            const lost = unreachable(o.home) && k < 0.02;
            const moving = taken[i].moved && k > 0;
            return (
              <g key={o.name}>
                <rect class={`sto-chip${lost ? ' lost' : moving ? ' moved' : ''}`} x={x} y={y} width={chipW} height={CHIP_H} />
                <text x={x + 8} y={y + 16} class={`mono${lost ? ' faint' : ''}`} style={{ fontSize: '12px' }}>
                  /{o.name}
                </text>
                {lost && (
                  <text x={x + chipW - 8} y={y + 16} text-anchor="end" class="bad-fill" style={{ fontSize: '12px', fontWeight: 700 }}>
                    ✕
                  </text>
                )}
              </g>
            );
          })}
          {/* requests: users opening files in each folder */}
          {home.map((o, i) => {
            const period = 2.4;
            const q = (t + i * 0.37) % period;
            if (q > 0.8) return null;
            if (unreachable(o.home)) return null;
            const s = k > 0.5 ? takenSlot[i] : homeSlot[i];
            const tx = s.x + chipW / 2;
            const [dx, dy] = along([[W / 2, NS.y + NS.h], [W / 2, FS_Y - 18], [tx, FS_Y - 18], [tx, s.y]], q / 0.8);
            return <circle key={o.name} class="sto-dot" cx={dx} cy={dy} r={4} />;
          })}
          <Fabric y={DSF_Y} h={64} note="each FSVM keeps its folders in its own volume group" />
          {Array.from({ length: n }, (_, i) => {
            const x = fx(i);
            const owner = down && i === failed ? (ha && t >= F.taken ? survivor : null) : i;
            const vx = x + colW / 2;
            const ox = owner === null ? vx : fx(owner) + colW / 2 + (owner !== i ? 30 : 0);
            return (
              <g key={i}>
                <path d={`M${vx} ${DSF_Y + 10} C ${vx} ${DSF_Y - 10}, ${ox} ${DSF_Y - 8}, ${ox} ${FS_Y + FS_H}`} fill="none" class={owner === null ? 'line' : owner !== i ? 'warn-stroke' : 'flow-stroke'} stroke-width={1.5} stroke-dasharray={owner === null ? '3 3' : undefined} />
                <rect class="disk" x={vx - 60} y={DSF_Y + 10} width={120} height={24} />
                <text x={vx} y={DSF_Y + 26} text-anchor="middle" class="mono" style={{ fontSize: '11.5px' }}>
                  VG-{i + 1} {owner === null ? '· no owner' : owner !== i ? `→ FSVM-${owner + 1}` : ''}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <PlayBar clock={clock} label="File server failover animation" fmt={() => word} />
    </Show>
  );
}

// ── Volumes ──
const V = { work: 1.6, fail: 5, relog: 6, back: 7.4, end: 11.5 };
const V_STARTS = [0, V.work, V.fail, V.relog, V.back];
const CVMS = 4;
const HOSTS = 2;
const HOST_Y = 10;
const IP_Y = 100;
const CVM_Y = 192;
const VG_Y = 296;
const cvmW = 190;
const cvmX = (i: number) => (W - (CVMS * cvmW + (CVMS - 1) * 30)) / 2 + i * (cvmW + 30);
const hostX = (c: number) => [180, 580][c];
const HOST_W = 200;

function sessionPath(c: number, cvm: number): [number, number][] {
  const hx = hostX(c) + HOST_W / 2;
  const cx = cvmX(cvm) + cvmW / 2;
  const pts: [number, number][] = [[hx, HOST_Y + 52], [hx, IP_Y + 36]];
  for (let s = 1; s <= 8; s++) {
    const u = s / 8;
    pts.push([hx + (cx - hx) * ease(u), IP_Y + 36 + (CVM_Y - IP_Y - 36) * u]);
  }
  return pts;
}

function Volumes() {
  const clock = useClock({ rate: 1, duration: V.end, keys: true, poster: V.back + 1.5 });
  const t = clock.t;
  const ph = phaseAt(V_STARTS, t);
  const before = useMemo(() => iscsiTargets(HOSTS, CVMS, []), []);
  const after = useMemo(() => iscsiTargets(HOSTS, CVMS, [0]), []);
  const cvmDown = t >= V.fail;
  const lostHost = before.findIndex((c) => c === 0);
  // Every CVM but one stays up, so each host always has a CVM to go to.
  const target = (c: number) => (t >= V.relog ? after[c] : before[c]) ?? 0;
  const connected = (c: number) => (c === lostHost ? !cvmDown || t >= V.back : true) && t >= V.work;
  const nConn = Array.from({ length: HOSTS }, (_, c) => c).filter(connected).length;
  const newCvm = after[lostHost]!;

  const cap: Cap = [
    { tone: 'ink' as const, k: 'One address', text: 'Hosts outside the cluster log in to one Data Services IP. The cluster points each host to a CVM that will serve it.' },
    { tone: 'ok' as const, k: 'Connected', text: 'Each host’s disk reads and writes go to its CVM. Every CVM can reach every disk in the volume group, because the data is spread across all nodes.' },
    { tone: 'bad' as const, k: 'A CVM fails', text: `CVM-1 goes down and Host ${lostHost + 1} loses its session.` },
    { tone: 'warn' as const, k: 'Redirected', text: `Host ${lostHost + 1} logs in again to the same address and is sent to a healthy CVM. No multipath setup is needed on the host.` },
    { tone: 'ok' as const, k: 'Back to work', text: `Host ${lostHost + 1} carries on through CVM-${newCvm + 1}. The data never moved: CVM-${newCvm + 1} reads and writes the same disks.` },
  ][ph];

  const H = VG_Y + 92;
  return (
    <Show
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Hosts connected', v: `${nConn} of ${HOSTS}`, tone: nConn === HOSTS ? 'ok' : 'warn' },
              { k: 'CVMs up', v: `${CVMS - (cvmDown ? 1 : 0)} of ${CVMS}`, tone: cvmDown ? 'warn' : 'ok' },
              { k: 'Data moved', v: 'None', tone: 'ok', tip: 'A redirected session is served by another CVM. The disks stay where they are; every CVM can reach them.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Nutanix Volumes: hosts log in to one Data Services IP and are sent to a CVM. When that CVM fails, the host logs in again and is redirected to a healthy CVM that reaches the same disks.">
          {Array.from({ length: HOSTS }, (_, c) => {
            const cvm = target(c);
            const pts = sessionPath(c, cvm);
            const broken = c === lostHost && cvmDown && t < V.back;
            const loggingIn = t < V.work || (c === lostHost && t >= V.relog && t < V.back);
            const live = connected(c);
            const p0 = t < V.work ? 0 : V.relog;
            const p1 = t < V.work ? V.work : V.back;
            return (
              <g key={c}>
                <rect class="vm" x={hostX(c)} y={HOST_Y} width={HOST_W} height={52} />
                <text x={hostX(c) + HOST_W / 2} y={HOST_Y + 22} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13.5px' }}>
                  Host {c + 1}
                </text>
                <text x={hostX(c) + HOST_W / 2} y={HOST_Y + 40} text-anchor="middle" class={broken ? (t < V.relog ? 'bad-fill' : 'warn-fill') : 'muted'} style={{ fontSize: '12px', fontWeight: broken ? 600 : 400 }}>
                  {broken ? (t < V.relog ? '✕ lost its session' : 'logging in again') : 'server outside the cluster'}
                </text>
                {(live || loggingIn || broken) && (
                  <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" class={broken && t < V.relog ? 'bad-stroke' : c === lostHost && t >= V.relog ? 'warn-stroke' : 'flow-stroke'} stroke-width={2} stroke-dasharray={broken || loggingIn ? '5 4' : undefined} />
                )}
                {loggingIn &&
                  (() => {
                    const [x, y] = along(pts, ease(prog(t, p0, p1)));
                    return <circle class="sto-dot login" cx={x} cy={y} r={5} />;
                  })()}
                {live &&
                  !loggingIn &&
                  [0, 0.33, 0.66].map((off) => {
                    const [x, y] = along(pts, (t * 0.9 + off + c * 0.15) % 1);
                    return <circle key={off} class="sto-dot" cx={x} cy={y} r={4} />;
                  })}
              </g>
            );
          })}
          <rect class="sto-ip" x={40} y={IP_Y} width={W - 80} height={36} />
          <text x={W / 2} y={IP_Y + 23} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13.5px' }}>
            Data Services IP: one address for the whole cluster
          </text>
          {Array.from({ length: CVMS }, (_, i) => {
            const isDown = cvmDown && i === 0;
            const x = cvmX(i);
            const sessions = Array.from({ length: HOSTS }, (_, c) => c).filter((c) => connected(c) && target(c) === i).length;
            return (
              <g key={i}>
                <rect class={`node-box${isDown ? ' down' : ''}`} x={x} y={CVM_Y} width={cvmW} height={64} />
                <rect class={isDown ? 'cvm down' : 'cvm'} x={x + 10} y={CVM_Y + 10} width={72} height={44} />
                <text x={x + 46} y={CVM_Y + 37} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '12.5px' }}>
                  CVM-{i + 1}
                </text>
                <text x={x + 94} y={CVM_Y + 28} class={isDown ? 'bad-fill' : ''} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {isDown ? '✕ down' : 'up'}
                </text>
                <text x={x + 94} y={CVM_Y + 46} class="muted" style={{ fontSize: '12px' }}>
                  {isDown ? '' : `${sessions} host${sessions === 1 ? '' : 's'}`}
                </text>
                <line x1={x + cvmW / 2} y1={CVM_Y + 64} x2={x + cvmW / 2} y2={VG_Y} class={isDown ? 'line' : 'sto-reach'} stroke-dasharray="3 3" />
              </g>
            );
          })}
          <Fabric y={VG_Y} h={78} note="every CVM can reach every disk" />
          <text x={36} y={VG_Y + 34} style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Volume group
          </text>
          {Array.from({ length: 4 }, (_, d) => {
            const x = 170 + d * 190;
            return (
              <g key={d}>
                <rect class="disk" x={x} y={VG_Y + 12} width={150} height={34} />
                <text x={x + 75} y={VG_Y + 34} text-anchor="middle" class="mono" style={{ fontSize: '12px' }}>
                  Disk {d + 1}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <PlayBar clock={clock} label="iSCSI redirection animation" fmt={() => ['Log in', 'Working', 'CVM fails', 'Log in again', 'Working'][ph]} />
    </Show>
  );
}

// ── Objects ──
type Rule = 'off' | '90' | '30';
const YEAR = 365;
const TILES = 24;
const TOTAL_TB = 200;
const ARRIVE = 8;
const MOVE = 12;
const arriveAt = (i: number) => (i + 0.5) * (YEAR / TILES);
const BKT = { x: 40, y: 84, w: 540, h: 150 };
const TGT = { x: 660, y: 84, w: 260, h: 150 };
const SRC = { x: 40, y: 8, w: 540, h: 46 };
const TILE_W = 16;
const TILE_GAP = 4.6;
const bucketTile = (i: number) => ({ x: BKT.x + 20 + i * (TILE_W + TILE_GAP), y: BKT.y + 54 });
const targetTile = (i: number) => ({ x: TGT.x + 18 + (i % 8) * 29, y: TGT.y + 62 + Math.floor(i / 8) * 26 });

function Objects() {
  const [rule, setRule] = useEnum<Rule>('ot', '90', ['off', '90', '30']);
  const days = rule === 'off' ? null : Number(rule);
  const clock = useClock({ rate: 24, duration: YEAR + 30, keys: true, poster: YEAR });
  useRestartOn(clock, [rule]);
  const d = clock.t;
  const today = Math.min(YEAR, d);
  const written = (TOTAL_TB * today) / YEAR;
  const split = tierSplit(written, days, today);
  const month = Math.min(12, Math.floor(today / (YEAR / 12)) + 1);

  const cap: Cap =
    days === null
      ? d >= YEAR
        ? { tone: 'ink', k: 'After one year', text: `All ${TOTAL_TB} TB is still on the cluster. A lifecycle rule would move older objects to cheaper capacity elsewhere.` }
        : { tone: 'ink', k: 'No rule', text: 'Apps and backup software write objects over the S3 API. Without a lifecycle rule, every object stays on the cluster as the bucket grows.' }
      : d >= YEAR
        ? { tone: 'ok', k: 'After one year', text: `${Math.round(split.localTB)} TB of recent data stays on the cluster and ${Math.round(split.remoteTB)} TB lives on cheaper storage. Reading a tiered object is slower and may cost cloud egress.` }
        : today < days
          ? { tone: 'ink', k: 'Filling the bucket', text: 'Apps and backup software write objects over the S3 API, and the bucket fills up on the cluster.' }
          : { tone: 'flow', k: 'Tiering', text: `A lifecycle rule on the bucket moves objects older than ${days} days to cheaper S3 storage. The cluster keeps the recent data, which is read most.` };

  const H = BKT.y + BKT.h + 78;
  const DSF_Y = BKT.y + BKT.h + 16;
  return (
    <Show
      top={
        <Choice<Rule>
          label="Lifecycle rule"
          value={rule}
          onChange={setRule}
          options={[
            { value: 'off', label: 'No rule' },
            { value: '90', label: 'Tier after 90 days' },
            { value: '30', label: 'Tier after 30 days' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Written so far', v: `${Math.round(written)} TB` },
              { k: 'On the cluster', v: `${Math.round(split.localTB)} TB` },
              { k: 'On cheaper storage', v: `${Math.round(split.remoteTB)} TB`, tone: split.remoteTB > 0.5 ? 'flow' : undefined },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Nutanix Objects: apps write objects over S3 into a bucket on the cluster over a year. ${days === null ? 'With no lifecycle rule every object stays on the cluster.' : `A lifecycle rule moves objects older than ${days} days to cheaper S3 storage.`}`}>
          <defs>
            <marker id="sto-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" class="flow-fill" />
            </marker>
          </defs>
          <rect class="sto-ns" x={SRC.x} y={SRC.y} width={SRC.w} height={SRC.h} />
          <text x={SRC.x + SRC.w / 2} y={SRC.y + 28} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13.5px' }}>
            Apps and backup software write over the S3 API
          </text>
          <path d={`M${SRC.x + SRC.w / 2} ${SRC.y + SRC.h} V ${BKT.y}`} class="line" />
          <rect class="node-box" x={BKT.x} y={BKT.y} width={BKT.w} height={BKT.h} />
          <text x={BKT.x + 20} y={BKT.y + 26} style={{ fontWeight: 600, fontSize: '14px' }}>
            Bucket on the cluster
          </text>
          <text x={BKT.x + BKT.w - 20} y={BKT.y + 26} text-anchor="end" class="muted" style={{ fontSize: '12px' }}>
            object workers · 3 or more VMs
          </text>
          <rect class={days === null ? 'sto-tgt off' : 'sto-tgt'} x={TGT.x} y={TGT.y} width={TGT.w} height={TGT.h} />
          <text x={TGT.x + TGT.w / 2} y={TGT.y + 26} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14px' }}>
            Cheaper S3 storage
          </text>
          <text x={TGT.x + TGT.w / 2} y={TGT.y + 44} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
            AWS S3 or any S3-compatible target
          </text>
          {days !== null && <path d={`M${BKT.x + BKT.w + 4} ${BKT.y + BKT.h / 2} H ${TGT.x - 4}`} class="xfer" marker-end="url(#sto-arr)" />}
          {days !== null && (
            <text text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
              <tspan x={(BKT.x + BKT.w + TGT.x) / 2} y={BKT.y + BKT.h / 2 - 26}>
                older than
              </tspan>
              <tspan x={(BKT.x + BKT.w + TGT.x) / 2} y={BKT.y + BKT.h / 2 - 10}>
                {days} days
              </tspan>
            </text>
          )}
          {Array.from({ length: TILES }, (_, i) => {
            const a = arriveAt(i);
            const b = bucketTile(i);
            if (d < a) return null;
            const tierAt = days === null ? Infinity : a + days;
            const src = { x: SRC.x + SRC.w / 2 - TILE_W / 2, y: SRC.y + SRC.h };
            let x = b.x;
            let y = b.y;
            let h = 56;
            let cls = 'sto-obj';
            if (d < a + ARRIVE) {
              const q = ease(prog(d, a, a + ARRIVE));
              x = src.x + (b.x - src.x) * q;
              y = src.y + (b.y - src.y) * q;
            } else if (d >= tierAt) {
              const tt = targetTile(i);
              const q = ease(prog(d, tierAt, tierAt + MOVE));
              x = b.x + (tt.x - b.x) * q;
              y = b.y + (tt.y - b.y) * q;
              h = 56 + (20 - 56) * q;
              cls = 'sto-obj tiered';
            }
            return (
              <g key={i}>
                {d >= tierAt && <rect class="sto-slot" x={b.x} y={b.y} width={TILE_W} height={56} />}
                <rect class={cls} x={x} y={y} width={TILE_W} height={h} />
              </g>
            );
          })}
          <text x={BKT.x + 20} y={BKT.y + BKT.h - 14} class="muted" style={{ fontSize: '11.5px' }}>
            ← older
          </text>
          <text x={BKT.x + BKT.w - 20} y={BKT.y + BKT.h - 14} text-anchor="end" class="muted" style={{ fontSize: '11.5px' }}>
            newer →
          </text>
          <Fabric y={DSF_Y} h={56} note="the bucket gets the container’s copies, erasure coding and compression" />
          <text x={36} y={DSF_Y + 22} style={{ fontSize: '12.5px' }}>
            Object data and metadata live in vDisks, like any VM’s data.
          </text>
        </svg>
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Two weeks of objects, on the cluster' },
          { color: 'var(--flow)', label: 'Moved to cheaper storage' },
        ]}
      />
      <PlayBar clock={clock} label="Object tiering over one year" fmt={() => (d >= YEAR ? 'One year' : `Month ${month}`)} />
    </Show>
  );
}

const TABS: [Svc, string][] = [
  ['files', 'Files · SMB / NFS'],
  ['vol', 'Volumes · iSCSI block'],
  ['obj', 'Objects · S3'],
];

export default function Storage() {
  const [tab, setTab] = useEnum<Svc>('tab', 'files', ['files', 'vol', 'obj']);
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Storage services">
        {TABS.map(([id, l]) => (
          <button type="button" role="tab" key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'files' && <Files />}
      {tab === 'vol' && <Volumes />}
      {tab === 'obj' && <Objects />}
    </>
  );
}
