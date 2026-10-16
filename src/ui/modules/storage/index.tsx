// Nutanix Unified Storage: Files (FSVMs, one namespace, failover), Volumes (iSCSI block),
// Objects (S3-compatible, tiering). A side panel maps each service down to the DSF.
import { Chip, Field, Follow, Illus, Seg, Slider, Stat, Tip, Toggle } from '../../components/controls';
import { useBool, useEnum, useNum } from '../../../state/route';
import { go } from '../../shell/nav';
import { Icon } from '../../components/Icon';
import { filesAvailable, iscsiTargets, loadPerFsvm, makeFiles, ownership, tierSplit } from '../../../engine/unistore';
import './style.css';

type Svc = 'files' | 'vol' | 'obj';

const toggleBit = (m: number, i: number) => m ^ (1 << i);
const bits = (m: number, n: number) => Array.from({ length: n }, (_, i) => i).filter((i) => m & (1 << i));
const kd = (fn: () => void) => (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fn());

// ── down to the DSF ──
const MAP: Record<Svc, { top: string; mid: string; low: string }> = {
  files: { top: 'Shares (SMB / NFS), one namespace', mid: 'File server VMs (FSVMs); each owns volume groups', low: 'Volume groups = iSCSI vDisks' },
  vol: { top: 'Volume group, attached to a VM or host', mid: 'Served by every CVM’s Stargate via the Data Services IP', low: 'Each disk in the group = one vDisk (a LUN)' },
  obj: { top: 'Buckets over the S3 API', mid: 'Object worker VMs on the Microservices Platform', low: 'Object data and metadata in vDisks' },
};

function DsfMap({ svc }: { svc: Svc }) {
  const m = MAP[svc];
  const rows = [m.top, m.mid, m.low, 'Storage container: RF, compression, erasure coding', 'Extents spread across every node’s drives'];
  return (
    <div class="side-sec">
      <div class="eyebrow">
        <Tip text="All three services are built on the same Distributed Storage Fabric (DSF), so they inherit its replication, self-healing and data-efficiency settings.">Down to the DSF</Tip>
      </div>
      <ol class="sto-map">
        {rows.map((r, i) => (
          <li key={i} class={i < 3 ? 'svc' : 'dsf'}>
            {r}
          </li>
        ))}
      </ol>
      <p class="field-note">Same fabric for files, block and objects: one place to protect, size and upgrade.</p>
      <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
        <Illus why="Layering simplified for one screen. See the Cluster & DSF Lab for how extents and replicas are placed." />
        <button type="button" class="tbtn" onClick={() => go('nci/cluster')}>
          Cluster & DSF Lab <Icon name="arrow" />
        </button>
      </div>
    </div>
  );
}

// ── Files ──
const SIZE = { s: 1, m: 2, l: 4 } as const;

function Files() {
  const [n, setN] = useNum('fv', 3, 1, 6);
  const [size, setSize] = useEnum<'s' | 'm' | 'l'>('fs', 'm', ['s', 'm', 'l']);
  const [proto, setProto] = useEnum<'smb' | 'nfs'>('pr', 'smb', ['smb', 'nfs']);
  const [downM, setDownM] = useNum('fd', 0, 0, 63);
  const down = bits(downM, n);
  const st = { ...makeFiles(n), down };
  const own = ownership(st);
  const load = loadPerFsvm(st);
  const avail = filesAvailable(st);
  const moved = own.filter((o) => o.moved);
  const path = proto === 'smb' ? '\\\\files01\\corp\\' : 'files01:/corp/';
  const W = 920;
  const colW = Math.min(250, (W - 40) / n - 14);
  const rowH = Math.min(22, 186 / Math.max(1, ...load));
  const x0 = (W - (n * colW + (n - 1) * 14)) / 2;
  const fx = (i: number) => x0 + i * (colW + 14);
  const kill = (i: number) => setDownM(toggleBit(downM, i));

  let tone: 'ok' | 'warn' | 'bad' = 'ok';
  let k = 'All shares online';
  let msg = `${n} FSVMs serve one namespace. Clients connect to ${path} and never need to know which FSVM holds a folder.`;
  if (!avail) {
    tone = 'bad';
    k = 'Shares unavailable';
    msg = n === 1 ? 'A single-FSVM file server has no high availability. With its only FSVM down, nothing can take over until it returns.' : 'Every FSVM is down, so no survivor is left to take over.';
  } else if (down.length) {
    tone = 'warn';
    k = 'Failover: a survivor took over';
    msg = `FSVM-${down.map((d) => d + 1).join(', FSVM-')} ${down.length > 1 ? 'are' : 'is'} down. ${down.length > 1 ? 'Surviving FSVMs took over their volume groups and IP addresses' : 'A surviving FSVM took over its volume group and IP address'}, so ${moved.length} folders stay reachable at the same path. When the FSVM returns it takes them back.`;
  }

  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Scale out: FSVMs" value={n} tip="A file server is a set of file server VMs (FSVMs). Three is the standard minimum for high availability." why={n === 1 ? 'One FSVM works, but has no high availability and no distributed shares.' : null}>
          <Slider label="FSVMs" value={n} min={1} max={6} onChange={(v) => (setN(v), setDownM(0))} />
        </Field>
        <Field label="Scale up: FSVM size" tip="Give each FSVM more vCPU and memory to serve more clients and throughput.">
          <Seg label="FSVM size" value={size} onChange={setSize} options={[{ value: 's', label: 'Smaller' }, { value: 'm', label: 'Medium' }, { value: 'l', label: 'Larger' }]} />
        </Field>
        <Field label="Protocol">
          <Seg label="Protocol" value={proto} onChange={setProto} options={[{ value: 'smb', label: 'SMB' }, { value: 'nfs', label: 'NFS' }]} />
          <p class="field-note">SMB 2/3 and NFS v3/v4. Encrypted NFS (TLS) arrived in Files 5.4.</p>
        </Field>
        <Field label="Break something" note="Or click an FSVM in the diagram.">
          <div class="hstack">
            {Array.from({ length: n }, (_, i) => (
              <Toggle key={i} on={down.includes(i)} onChange={() => kill(i)}>
                FSVM-{i + 1} down
              </Toggle>
            ))}
          </div>
        </Field>
      </div>
      <div class="stage">
        <div class="diagram-scroll">
          <svg class="diagram" viewBox={`0 0 ${W} 470`} role="group" aria-label="Nutanix Files: clients, one namespace, file server VMs and their volume groups">
            <rect x={W / 2 - 220} y={10} width={440} height={50} rx={4} class="bg3" stroke="var(--line-2)" />
            <text x={W / 2} y={32} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14px' }}>
              Clients see one namespace
            </text>
            <text x={W / 2} y={50} text-anchor="middle" class="mono" style={{ fontSize: '12.5px' }}>
              {path}
            </text>
            {Array.from({ length: n }, (_, i) => {
              const x = fx(i);
              const isDown = down.includes(i);
              const mine = own.filter((o) => o.servedBy === i);
              return (
                <g key={i} role="button" tabIndex={0} aria-pressed={isDown} aria-label={`FSVM-${i + 1}, ${isDown ? 'down' : 'running'}; click to ${isDown ? 'recover' : 'fail'}`} onClick={() => kill(i)} onKeyDown={kd(() => kill(i))}>
                  <path d={`M${W / 2} 60 V 80 H ${x + colW / 2} V 96`} fill="none" class={isDown ? 'line' : 'ink-stroke'} stroke-dasharray={isDown ? '4 4' : undefined} />
                  <rect class={`hit node-box${isDown ? ' down' : ''}`} x={x} y={96} width={colW} height={250} rx={4} />
                  <rect x={x} y={96} width={colW} height={30} class={isDown ? 'bad-fill' : 'ink-fill'} rx={4} />
                  <text x={x + colW / 2} y={116} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '13px' }}>
                    FSVM-{i + 1} {isDown ? '✕ down' : ''}
                  </text>
                  {!isDown && (
                    <text x={x + colW / 2} y={142} text-anchor="middle" class="muted mono" style={{ fontSize: n > 4 ? '9.5px' : '11px' }}>
                      {(() => {
                        const took = own.some((o) => o.servedBy === i && o.moved);
                        const sz = ({ s: 'smaller', m: 'medium', l: 'larger' } as const)[size];
                        if (n > 3) return took ? '+ taken-over IP' : `${sz} · IP .${11 + i}`;
                        return `${sz} · IP .${11 + i}${took ? ' + taken-over IP' : ''}`;
                      })()}
                    </text>
                  )}
                  {mine.map((o, j) => (
                    <g key={o.name}>
                      <rect x={x + 10} y={154 + j * rowH} width={colW - 20} height={rowH - 3} class={o.moved ? 'warn-fill' : 'bg3'} style={{ opacity: o.moved ? 0.25 : 1 }} />
                      <text x={x + 16} y={154 + j * rowH + rowH * 0.62} class="mono" style={{ fontSize: rowH < 18 ? '10px' : '12px', fontWeight: o.moved ? 600 : 400 }}>
                        /{o.name}
                        {o.moved ? `  ← FSVM-${o.home + 1}` : ''}
                      </text>
                    </g>
                  ))}
                  {isDown && (
                    <text x={x + colW / 2} y={200} text-anchor="middle" class="bad-fill" style={{ fontSize: '12px', fontWeight: 600 }}>
                      {avail ? 'folders moved' : 'not served'}
                    </text>
                  )}
                  {/* its volume group on the DSF */}
                  <path d={`M${x + colW / 2} 346 V 384`} fill="none" class={isDown ? 'line' : 'flow-stroke'} stroke-dasharray={isDown ? '3 3' : undefined} stroke-width={1.5} />
                </g>
              );
            })}
            <rect x={20} y={384} width={W - 40} height={74} rx={4} class="bg2" stroke="var(--line-2)" />
            <text x={36} y={404} class="muted" style={{ fontSize: '11.5px', letterSpacing: '0.06em' }}>
              DISTRIBUTED STORAGE FABRIC · ONE STORAGE CONTAINER
            </text>
            {Array.from({ length: n }, (_, i) => {
              const x = fx(i);
              const owner = down.includes(i) ? own.find((o) => o.home === i)?.servedBy ?? null : i;
              return (
                <g key={i}>
                  <rect x={x + 6} y={414} width={colW - 12} height={32} class="disk" />
                  <text x={x + colW / 2} y={434} text-anchor="middle" class="mono" style={{ fontSize: '11px' }}>
                    VG-{i + 1} {owner === null ? '· no owner' : owner !== i ? `→ FSVM-${owner + 1}` : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <Follow tone={tone} k={k}>
          <p>{msg}</p>
        </Follow>
        <div class="cols-2" style={{ marginTop: 'var(--sp-5)' }}>
          <div class="small">
            <strong>Also in Files.</strong> Smart DR replicates shares to another file server (RPO of a few minutes); Metro file server sync gives zero RPO with the Advanced Replication add-on. Smart Tiering moves cold files to S3 targets such as Nutanix Objects, AWS S3, Azure Blob, Wasabi, and (since NUS 5.3) Google Cloud Storage and OVHcloud.
          </div>
          <div class="small">
            <strong>Security.</strong> Data Lens adds ransomware detection, audit trails and permission analytics for Files and Objects.{' '}
            <button type="button" class="tbtn" style={{ height: 'auto', padding: 0 }} onClick={() => go('datalens')}>
              Open Data Lens <Icon name="arrow" />
            </button>
          </div>
        </div>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">File server</div>
          <div class="hstack" style={{ marginBottom: 'var(--sp-2)' }}>
            <Chip tone={tone}>{avail ? (down.length ? 'Degraded, serving' : 'Online') : 'Unavailable'}</Chip>
          </div>
          <Stat k="Folders" v={own.length} />
          <Stat k="FSVMs up" v={`${n - down.length} of ${n}`} tone={down.length ? 'warn' : 'ok'} />
          <Stat
            k="Relative serving capacity"
            tip="FSVMs up × size. Scale out or up to serve more clients. Illustrative."
            v={`${(n - down.length) * SIZE[size]}×`}
          />
          <div class="sto-load">
            {load.map((l, i) => (
              <div key={i} class="mrow-top small">
                <span>FSVM-{i + 1}</span>
                <span class="mono">{down.includes(i) ? 'down' : `${l} folders`}</span>
              </div>
            ))}
          </div>
        </div>
        <DsfMap svc="files" />
      </div>
    </div>
  );
}

// ── Volumes ──
function Volumes() {
  const cvms = 4;
  const [clients, setClients] = useNum('vc', 2, 1, 4);
  const [disks, setDisks] = useNum('vd', 4, 1, 8);
  const [kind, setKind] = useEnum<'ext' | 'vm'>('vk', 'ext', ['ext', 'vm']);
  const [downM, setDownM] = useNum('cd', 0, 0, 15);
  const down = bits(downM, cvms);
  const tg = iscsiTargets(clients, cvms, down);
  const W = 920;
  const cX = (i: number) => 40 + i * 220;
  const kill = (i: number) => setDownM(toggleBit(downM, i));
  const redirected = tg.filter((t, c) => t !== c % cvms).length;
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Who connects" tip="Volume groups can be attached directly to VMs in the cluster or to external hosts over iSCSI.">
          <Seg label="Client" value={kind} onChange={setKind} options={[{ value: 'ext', label: 'External hosts' }, { value: 'vm', label: 'In-cluster VMs' }]} />
        </Field>
        <Field label="Clients" value={clients}>
          <Slider label="Clients" value={clients} min={1} max={4} onChange={setClients} />
        </Field>
        <Field label="Disks in the volume group" value={disks} tip="Each disk is presented as a LUN; on the DSF each is a vDisk.">
          <Slider label="Disks" value={disks} min={1} max={8} onChange={setDisks} />
        </Field>
        <Field label="Break something" note="Or click a CVM.">
          <div class="hstack">
            {Array.from({ length: cvms }, (_, i) => (
              <Toggle key={i} on={down.includes(i)} onChange={() => kill(i)}>
                CVM-{i + 1} down
              </Toggle>
            ))}
          </div>
        </Field>
      </div>
      <div class="stage">
        <div class="diagram-scroll">
          <svg class="diagram" viewBox={`0 0 ${W} 430`} role="group" aria-label="Nutanix Volumes: iSCSI clients log in to the Data Services IP and are redirected to a CVM">
            {Array.from({ length: clients }, (_, c) => {
              const x = 40 + c * 220;
              const t = tg[c];
              return (
                <g key={c}>
                  <rect x={x} y={14} width={190} height={50} rx={4} class="vm" />
                  <text x={x + 95} y={36} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13px' }}>
                    {kind === 'ext' ? `Host ${c + 1} (bare metal)` : `VM ${c + 1} (in cluster)`}
                  </text>
                  <text x={x + 95} y={54} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
                    iSCSI initiator{kind === 'ext' ? ', no MPIO needed' : ''}
                  </text>
                  {t !== null && (
                    <path d={`M${x + 95} 64 V 104 M${x + 95} 140 C ${x + 95} 180, ${cX(t) + 95} 180, ${cX(t) + 95} 214`} fill="none" class={t !== c % cvms ? 'warn-stroke' : 'flow-stroke'} stroke-width={2} />
                  )}
                </g>
              );
            })}
            {kind === 'ext' && (
              <>
                <rect x={40} y={104} width={W - 80} height={36} rx={4} class="ink-soft" stroke="var(--ink-line)" />
                <text x={W / 2} y={127} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13px' }}>
                  Data Services IP: one address for the cluster; logins are redirected to a healthy CVM
                </text>
              </>
            )}
            {kind === 'vm' && (
              <text x={W / 2} y={127} text-anchor="middle" class="muted" style={{ fontSize: '12.5px' }}>
                In-cluster VMs reach the volume group through the hypervisor and the local CVM
              </text>
            )}
            {Array.from({ length: cvms }, (_, i) => {
              const isDown = down.includes(i);
              const x = cX(i);
              const serving = tg.filter((t) => t === i).length;
              return (
                <g key={i} role="button" tabIndex={0} aria-pressed={isDown} aria-label={`CVM-${i + 1} ${isDown ? 'down' : 'up'}`} onClick={() => kill(i)} onKeyDown={kd(() => kill(i))}>
                  <rect class={`hit node-box${isDown ? ' down' : ''}`} x={x} y={214} width={190} height={70} rx={4} />
                  <rect x={x + 12} y={226} width={70} height={46} class={isDown ? 'cvm down' : 'cvm'} />
                  <text x={x + 47} y={254} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '12px' }}>
                    CVM-{i + 1}
                  </text>
                  <text x={x + 92} y={246} style={{ fontSize: '12px', fontWeight: 600 }} class={isDown ? 'bad-fill' : ''}>
                    {isDown ? '✕ down' : 'Stargate'}
                  </text>
                  <text x={x + 92} y={264} class="muted" style={{ fontSize: '11.5px' }}>
                    {isDown ? '' : `${serving} session${serving === 1 ? '' : 's'}`}
                  </text>
                </g>
              );
            })}
            <rect x={40} y={310} width={W - 80} height={104} rx={4} class="bg2" stroke="var(--line-2)" />
            <text x={56} y={332} class="muted" style={{ fontSize: '11.5px', letterSpacing: '0.06em' }}>
              VOLUME GROUP “ORA-DATA” ON THE DSF · EACH DISK IS A vDISK
            </text>
            {Array.from({ length: disks }, (_, d) => (
              <g key={d}>
                <rect x={56 + d * 104} y={346} width={92} height={50} class="disk" />
                <text x={102 + d * 104} y={368} text-anchor="middle" class="mono" style={{ fontSize: '11.5px' }}>
                  LUN {d}
                </text>
                <text x={102 + d * 104} y={385} text-anchor="middle" class="muted mono" style={{ fontSize: '10.5px' }}>
                  vDisk
                </text>
              </g>
            ))}
          </svg>
        </div>
        <Follow tone={tg.includes(null) ? 'bad' : redirected ? 'warn' : 'ok'} k={tg.includes(null) ? 'No CVM left' : redirected ? 'Redirected' : 'Connected'}>
          <p>
            {tg.includes(null)
              ? 'With every CVM down the cluster itself is down; there is nothing to redirect to.'
              : redirected
                ? `${redirected} session(s) lost their CVM and logged in again through the same address; the cluster redirected them to a healthy CVM. The data never moved: every CVM can serve any vDisk.`
                : 'Each session is served by a CVM. Because all CVMs can reach every vDisk, any of them can take a session over.'}
          </p>
        </Follow>
        <p class="small" style={{ marginTop: 'var(--sp-4)' }}>
          <strong>Typical uses:</strong> shared-disk clusters such as Oracle RAC and Windows failover clustering, bare-metal servers that need block storage, and containers. External (non-cluster) hosts as a primary use need NCI Pro or higher, or NUS Pro.
        </p>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Sessions</div>
          {tg.map((t, c) => (
            <div key={c} class="mrow-top small" style={{ padding: 'var(--sp-1) 0' }}>
              <span>{kind === 'ext' ? 'Host' : 'VM'} {c + 1}</span>
              <span class={`mono ${t === null ? 'bad-text' : t !== c % cvms ? 'warn-text' : ''}`}>{t === null ? 'no path' : `CVM-${t + 1}`}</span>
            </div>
          ))}
          <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
            <Illus why="Session placement here is simplified. AOS balances sessions across CVMs and redirects on login." />
          </div>
        </div>
        <DsfMap svc="vol" />
      </div>
    </div>
  );
}

// ── Objects ──
const SPAN = 365;
const TARGETS = { nos: 'another Nutanix Objects store', aws: 'AWS S3', s3: 'any S3-compatible endpoint' } as const;

function Objects() {
  const [workers, setWorkers] = useNum('ow', 3, 3, 8);
  const [tier, setTier] = useBool('ot', true);
  const [days, setDays] = useNum('od', 90, 7, 360);
  const [tgt, setTgt] = useEnum<'nos' | 'aws' | 's3'>('tg', 'aws', ['nos', 'aws', 's3']);
  const [worm, setWorm] = useBool('ol', false);
  const total = 200;
  const split = tierSplit(total, tier ? days : null, SPAN);
  const W = 920;
  const wx = (i: number) => 40 + i * ((560 - 40) / workers);
  const ww = (560 - 40) / workers - 10;
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Object worker VMs" value={workers} tip="Objects runs as a set of worker VMs; at least three. Add workers to scale out.">
          <Slider label="Workers" value={workers} min={3} max={8} onChange={setWorkers} />
        </Field>
        <Field label="Lifecycle tiering" tip="A bucket rule moves objects older than N days to another S3 endpoint.">
          <Toggle on={tier} onChange={setTier}>
            Tier objects older than {days} days
          </Toggle>
        </Field>
        <Field label="Age threshold" value={`${days} days`} why={!tier ? 'Turn tiering on first.' : null}>
          <Slider label="Days" value={days} min={7} max={360} step={1} onChange={setDays} />
        </Field>
        <Field label="Tier to">
          <Seg label="Target" value={tgt} onChange={setTgt} options={[{ value: 'aws', label: 'AWS S3' }, { value: 'nos', label: 'Nutanix Objects' }, { value: 's3', label: 'S3-compatible' }]} />
        </Field>
        <Field label="Immutability" tip="WORM and S3 Object Lock stop objects from being changed or deleted until retention expires; useful against ransomware and for compliance.">
          <Toggle on={worm} onChange={setWorm}>
            WORM / Object Lock on the bucket
          </Toggle>
        </Field>
      </div>
      <div class="stage">
        <div class="diagram-scroll">
          <svg class="diagram" viewBox={`0 0 ${W} 400`} role="img" aria-label="Nutanix Objects: S3 clients, object workers, buckets on the DSF and tiering to an external S3 target">
            <rect x={40} y={14} width={520} height={46} rx={4} class="bg3" stroke="var(--line-2)" />
            <text x={300} y={34} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13.5px' }}>
              Apps and backup software speak S3
            </text>
            <text x={300} y={51} text-anchor="middle" class="mono muted" style={{ fontSize: '11.5px' }}>
              PUT / GET https://objects.corp/backups/…
            </text>
            {Array.from({ length: workers }, (_, i) => (
              <g key={i}>
                <path d={`M300 60 V 76 H ${wx(i) + ww / 2} V 92`} fill="none" class="ink-stroke" />
                <rect x={wx(i)} y={92} width={ww} height={48} rx={4} class="ink-fill" />
                <text x={wx(i) + ww / 2} y={121} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '11.5px' }}>
                  worker {i + 1}
                </text>
              </g>
            ))}
            <rect x={40} y={164} width={520} height={110} rx={4} class="node-box" />
            <text x={56} y={186} style={{ fontWeight: 600, fontSize: '13px' }}>
              Bucket “backups” {worm ? '(Object Lock on)' : ''} · {split.localTB.toFixed(0)} TB on cluster
            </text>
            {Array.from({ length: 24 }, (_, i) => {
              const age = (i / 24) * SPAN; // older to the right
              const remote = tier && age >= days;
              return <rect key={i} x={56 + i * 20.5} y={200} width={17} height={56} class={remote ? 'tile-dim tile-rep' : 'tile-local'} />;
            })}
            <text x={56} y={268} class="muted" style={{ fontSize: '11px' }}>
              newest
            </text>
            <text x={544} y={268} text-anchor="end" class="muted" style={{ fontSize: '11px' }}>
              1 year old
            </text>
            <rect x={40} y={300} width={520} height={80} rx={4} class="bg2" stroke="var(--line-2)" />
            <text x={56} y={322} class="muted" style={{ fontSize: '11.5px', letterSpacing: '0.06em' }}>
              DISTRIBUTED STORAGE FABRIC
            </text>
            <text x={56} y={346} style={{ fontSize: '12.5px' }}>
              Object data lands in vDisks; RF, erasure coding and compression
            </text>
            <text x={56} y={364} style={{ fontSize: '12.5px' }}>
              of the storage container apply.
            </text>
            {/* external target */}
            <rect x={640} y={164} width={250} height={110} rx={4} class={tier ? 'bg3' : 'bg2'} stroke="var(--line-2)" stroke-dasharray={tier ? undefined : '5 4'} />
            <text x={765} y={192} text-anchor="middle" style={{ fontWeight: 600, fontSize: '13px' }}>
              {TARGETS[tgt]}
            </text>
            <text x={765} y={222} text-anchor="middle" class="mono" style={{ fontSize: '20px', fontWeight: 600 }}>
              {split.remoteTB.toFixed(0)} TB
            </text>
            <text x={765} y={246} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
              {tier ? `objects older than ${days} days` : 'no tiering rule'}
            </text>
            {tier && <path d="M560 228 H 636" class="xfer" marker-end="url(#sto-arr)" />}
            <defs>
              <marker id="sto-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0 0 L10 5 L0 10 z" class="flow-fill" />
              </marker>
            </defs>
          </svg>
        </div>
        <Follow tone={tier ? 'flow' : 'ink'} k={tier ? 'Tiering' : 'All on cluster'}>
          <p>
            {tier
              ? `${split.remoteTB.toFixed(0)} of ${total} TB is older than ${days} days and lives on ${TARGETS[tgt]}. The cluster keeps the recent, frequently read data.`
              : `All ${total} TB stays on the cluster. Add a lifecycle rule to move older objects to cheaper capacity elsewhere.`}
          </p>
          {worm && <p class="rest">Object Lock is on: locked objects cannot be overwritten or deleted until their retention ends. Check how a tiering rule and your retention settings interact before relying on both.</p>}
        </Follow>
        <p class="small" style={{ marginTop: 'var(--sp-4)' }}>
          <strong>Also:</strong> versioning, legal hold, streaming replication between object stores, a multi-cluster global namespace and S3 Select. Objects 5.4 removed the load-balancer VMs on AHV and added rolling upgrades.
        </p>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Object store</div>
          <Stat k="Workers" v={workers} />
          <Stat k="On cluster" v={`${split.localTB.toFixed(0)} TB`} />
          <Stat k={`On ${tgt === 'nos' ? 'Objects' : tgt === 'aws' ? 'AWS S3' : 'S3 target'}`} v={`${split.remoteTB.toFixed(0)} TB`} tone={tier ? 'flow' : undefined} />
          <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
            <Illus why="Assumes objects arrive evenly over a year. Real age profiles vary." />
          </div>
        </div>
        <DsfMap svc="obj" />
      </div>
    </div>
  );
}

export default function Storage() {
  const [tab, setTab] = useEnum<Svc>('tab', 'files', ['files', 'vol', 'obj']);
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Storage services">
        {(
          [
            ['files', 'Files · SMB / NFS'],
            ['vol', 'Volumes · iSCSI block'],
            ['obj', 'Objects · S3'],
          ] as const
        ).map(([id, l]) => (
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
