// Nutanix Database Service (NDB): provisioning, Time Machine point-in-time recovery,
// thin clones and patching. Engine list limited to the verified set (NDB 2.11).
import { useState } from 'preact/hooks';
import { Chip, Field, Follow, Illus, PlayBar, Seg, Slider, Stat, Toggle, fmtTB } from '../../components/controls';
import { useClock } from '../../components/clock';
import { useEnum, useNum } from '../../../state/route';
import { cloneCapacity, logCatchups, patchDowntime, planRecovery, snapshots, type DbServer, type TmPolicy } from '../../../engine/ndb';
import './style.css';

type Eng = 'ora' | 'mss' | 'pg' | 'edb' | 'my' | 'maria' | 'mongo';
const ENGINES: { id: Eng; label: string; ha: string | null }[] = [
  { id: 'ora', label: 'Oracle', ha: null },
  { id: 'mss', label: 'SQL Server', ha: 'Always On availability group' },
  { id: 'pg', label: 'PostgreSQL', ha: 'PostgreSQL HA cluster' },
  { id: 'edb', label: 'EDB Postgres', ha: null },
  { id: 'my', label: 'MySQL', ha: null },
  { id: 'maria', label: 'MariaDB', ha: null },
  { id: 'mongo', label: 'MongoDB', ha: 'Replica set or sharded cluster' },
];
const engLabel = (e: Eng) => ENGINES.find((x) => x.id === e)!.label;

// ── provisioning ──
const PROV = [
  { id: 'val', label: 'Validate request against profiles and network', dur: 2 },
  { id: 'vm', label: 'Create database server VM(s) from the software profile', dur: 4 },
  { id: 'db', label: 'Create the database and apply parameter profile', dur: 4 },
  { id: 'tm', label: 'Register with Time Machine, take the first snapshot', dur: 3 },
  { id: 'ok', label: 'Ready: connection details to the owner', dur: 1 },
];
const PROV_TOTAL = PROV.reduce((s, x) => s + x.dur, 0);

function Provision() {
  const [eng, setEng] = useEnum<Eng>('en', 'pg', ['ora', 'mss', 'pg', 'edb', 'my', 'maria', 'mongo']);
  const [topo, setTopo] = useEnum<'single' | 'ha'>('tp', 'single', ['single', 'ha']);
  const [comp, setComp] = useEnum<'s' | 'm' | 'l'>('cp', 'm', ['s', 'm', 'l']);
  const [sla, setSla] = useEnum<'gold' | 'silver' | 'bronze'>('sla', 'silver', ['gold', 'silver', 'bronze']);
  const [started, setStarted] = useState(false);
  const clock = useClock({ rate: 1, duration: PROV_TOTAL, stepSize: 1, keys: true });
  const E = ENGINES.find((e) => e.id === eng)!;
  const haOk = !!E.ha;
  const ha = topo === 'ha' && haOk;
  let acc = 0;
  const idx = PROV.findIndex((s) => clock.t < (acc += s.dur));
  const cur = idx < 0 ? PROV.length : idx;
  const done = started && clock.t >= PROV_TOTAL;
  const vms = ha ? 3 : 1;
  const reset = () => (setStarted(false), clock.reset());
  const SLA = { gold: 'snapshots daily, logs every 15 min, keep 30 days', silver: 'snapshots daily, logs every 30 min, keep 14 days', bronze: 'snapshots daily, logs every 60 min, keep 7 days' };
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Database engine" tip="Engines supported by NDB 2.11.">
          <Seg label="Engine" value={eng} onChange={(v) => (setEng(v), reset())} options={ENGINES.map((e) => ({ value: e.id, label: e.label }))} />
        </Field>
        <Field label="Topology" why={topo === 'ha' && !haOk ? `HA for ${E.label} is not modeled in this demo; check NDB documentation for its options.` : null}>
          <Seg label="Topology" value={topo} onChange={(v) => (setTopo(v), reset())} options={[{ value: 'single', label: 'Single instance' }, { value: 'ha', label: 'High availability' }]} />
          {ha && <p class="field-note">{E.ha}</p>}
        </Field>
        <Field label="Compute profile" tip="Profiles are reusable templates: software (version and OS), compute, network and database parameters. DBAs define them once.">
          <Seg label="Compute" value={comp} onChange={(v) => (setComp(v), reset())} options={[{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }, { value: 'l', label: 'Large' }]} />
        </Field>
        <Field label="Time Machine SLA" tip="How often snapshots and log catch-ups run, and how long they are kept.">
          <Seg label="SLA" value={sla} onChange={(v) => (setSla(v), reset())} options={[{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }, { value: 'bronze', label: 'Bronze' }]} />
          <p class="field-note">{SLA[sla]}</p>
        </Field>
        <Field label="Provision">
          <button type="button" class="btn primary" disabled={started && !done} onClick={() => (setStarted(true), clock.seek(0), clock.play())}>
            {done ? 'Provision another' : `Provision ${E.label}`}
          </button>
        </Field>
      </div>
      <div class="stage">
        <h2 class="sec-h">A few choices, then automation does the rest</h2>
        <svg class="diagram" viewBox="0 0 900 200" role="img" aria-label={`${vms} database server VM(s) being provisioned`}>
          <rect class="frame" x={1} y={1} width={898} height={198} rx={4} />
          <text x={16} y={26} class="muted" style={{ fontSize: '12px', letterSpacing: '0.08em' }}>
            NUTANIX CLUSTER · {engLabel(eng).toUpperCase()} {ha ? '· HA' : ''}
          </text>
          {Array.from({ length: vms }, (_, i) => {
            const up = started && cur > 0;
            const dbUp = started && cur > 1;
            const x = 24 + i * 290;
            return (
              <g key={i}>
                <rect x={x} y={46} width={270} height={130} rx={4} class={up ? 'vm hl' : 'vm'} stroke-dasharray={up ? undefined : '5 4'} style={{ opacity: up ? 1 : 0.55 }} />
                <text x={x + 14} y={72} style={{ fontWeight: 600, fontSize: '14px' }}>
                  DB server {i + 1}
                  {ha ? (i === 0 ? ' · primary' : ' · replica') : ''}
                </text>
                <text x={x + 14} y={94} class="muted mono" style={{ fontSize: '11.5px' }}>
                  {({ s: 'small', m: 'medium', l: 'large' } as const)[comp]} compute · {engLabel(eng)}
                </text>
                <rect x={x + 14} y={110} width={242} height={30} class={dbUp ? 'ink-fill' : 'bg3'} />
                <text x={x + 135} y={130} text-anchor="middle" style={{ fontSize: '12.5px', fontWeight: 600, fill: dbUp ? '#fff' : undefined }}>
                  {dbUp ? 'database online' : 'database'}
                </text>
                <text x={x + 14} y={162} class={done ? 'ok-fill' : 'muted'} style={{ fontSize: '12px', fontWeight: 600 }}>
                  {done ? '✓ protected by Time Machine' : started && cur >= 3 ? '→ first snapshot' : ''}
                </text>
              </g>
            );
          })}
        </svg>
        <ol class="ndb-steps">
          {PROV.map((s, i) => {
            const st = !started ? 'todo' : done || i < cur ? 'done' : i === cur ? 'now' : 'todo';
            return (
              <li key={s.id} class={st}>
                <span class="ic" aria-hidden="true">
                  {st === 'done' ? '✓' : st === 'now' ? '→' : i + 1}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>
        {started && <PlayBar clock={clock} label="Provisioning" scrub={false} fmt={(t) => `${t.toFixed(0)} s`} />}
        <Follow tone={done ? 'ok' : started ? 'flow' : 'ink'} k={done ? 'Ready' : started ? 'Provisioning' : 'Self-service for databases'}>
          <p>
            {done
              ? 'The database is running, follows the standard profiles, and is protected from its first minute. No tickets between DBA, storage and VM teams.'
              : 'A developer or DBA picks the engine, size and protection level. NDB builds the VMs, the database and the protection the same way every time.'}
          </p>
        </Follow>
        <p class="field-note" style={{ marginTop: 'var(--sp-3)' }}>
          Durations compressed. <Illus why="Real provisioning time depends on the engine, profile and environment. SLA names and schedules here are examples; you define your own." />
        </p>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Supported engines (NDB 2.11)</div>
          <ul class="ndb-eng">
            {ENGINES.map((e) => (
              <li key={e.id} class={e.id === eng ? 'on' : ''}>
                {e.label}
                {e.id === 'pg' ? ' (incl. pgvector)' : ''}
              </li>
            ))}
          </ul>
          <p class="field-note">Supported versions and features differ by engine; check the NDB compatibility matrix.</p>
        </div>
      </div>
    </div>
  );
}

// ── Time Machine ──
const DAY = 1440;
const WINDOW = 7 * DAY;
const NOW = WINDOW - 12; // "now" is just before the end of the window
const MISTAKE = 5 * DAY + 14 * 60 + 38; // Sat 14:38
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmtT = (m: number) => {
  const mm = Math.round(m);
  return `${DOW[Math.floor(mm / DAY) % 7]} ${String(Math.floor((mm % DAY) / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};

function TimeMachine() {
  const [target, setTarget] = useNum('tt', MISTAKE - 1, 0, WINDOW);
  const [logEvery, setLogEvery] = useEnum<'15' | '30' | '60'>('lg', '30', ['15', '30', '60']);
  const [mode, setMode] = useEnum<'restore' | 'clone'>('rm', 'clone', ['restore', 'clone']);
  const pol: TmPolicy = { windowMin: WINDOW, snapEveryMin: DAY, snapOffsetMin: 60, logEveryMin: Number(logEvery) };
  const snaps = snapshots(pol, NOW);
  const logs = logCatchups(pol, NOW);
  const plan = planRecovery(pol, NOW, target);
  const W = 920;
  const l = 20;
  const r = 20;
  const sx = (m: number) => l + (m / WINDOW) * (W - l - r);
  const afterMistake = plan.effective >= MISTAKE;
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Recover to" value={fmtT(target)} tip="Pick any point in the retention window, to the minute here (NDB goes to the second).">
          <Slider label="Recovery point" value={target} min={0} max={WINDOW} step={1} onChange={setTarget} />
          <div class="hstack">
            <button type="button" class="btn" onClick={() => setTarget(MISTAKE - 1)}>
              1 minute before the mistake
            </button>
            <button type="button" class="tbtn" onClick={() => setTarget(NOW)}>
              Latest
            </button>
          </div>
        </Field>
        <Field label="Log catch-up every" value={`${logEvery} min`} tip="How often captured transaction logs are copied into Time Machine. It bounds how close to “now” you can recover.">
          <Seg label="Log interval" value={logEvery} onChange={setLogEvery} options={[{ value: '15', label: '15 min' }, { value: '30', label: '30 min' }, { value: '60', label: '60 min' }]} />
        </Field>
        <Field label="Recovery type">
          <Seg label="Recovery type" value={mode} onChange={setMode} options={[{ value: 'clone', label: 'Clone side by side' }, { value: 'restore', label: 'Restore in place' }]} />
          <p class="field-note">{mode === 'clone' ? 'Bring up a copy at that point next to production, pull back what you need.' : 'Roll the production database back to that point. Changes after it are lost.'}</p>
        </Field>
      </div>
      <div class="stage">
        <h2 class="sec-h">Time Machine: snapshots plus transaction logs</h2>
        <div class="diagram-scroll">
          <svg class="diagram" viewBox={`0 0 ${W} 230`} role="img" aria-label={`Seven-day timeline with daily snapshots and log catch-ups; recovering to ${fmtT(plan.effective)}`}>
            {Array.from({ length: 7 }, (_, d) => (
              <g key={d}>
                <line x1={sx(d * DAY)} x2={sx(d * DAY)} y1={30} y2={170} class="line" stroke-dasharray="2 4" />
                <text x={sx(d * DAY + DAY / 2)} y={196} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
                  {DOW[d]}
                </text>
              </g>
            ))}
            <text x={l} y={50} class="muted" style={{ fontSize: '11.5px' }}>
              Snapshots
            </text>
            {snaps.map((s) => (
              <rect key={s} x={sx(s) - 5} y={58} width={10} height={22} class={s === plan.snapshot ? 'ink-fill' : 'bg3'} stroke="var(--ink-line)" />
            ))}
            <text x={l} y={108} class="muted" style={{ fontSize: '11.5px' }}>
              Transaction logs captured
            </text>
            <rect x={sx(0)} y={116} width={sx(logs[logs.length - 1] ?? 0) - sx(0)} height={14} class="flow-fill" style={{ opacity: 0.35 }} />
            {logs.map((c) => (
              <line key={c} x1={sx(c)} x2={sx(c)} y1={116} y2={130} stroke="var(--flow)" stroke-width={0.8} />
            ))}
            <rect x={sx(logs[logs.length - 1] ?? 0)} y={116} width={sx(NOW) - sx(logs[logs.length - 1] ?? 0)} height={14} fill="none" stroke="var(--warn)" stroke-dasharray="3 2" />
            {/* replay span */}
            {plan.snapshot !== null && plan.effective > plan.snapshot && <rect x={sx(plan.snapshot)} y={138} width={sx(plan.effective) - sx(plan.snapshot)} height={10} class="ink-fill" />}
            {/* mistake */}
            <line x1={sx(MISTAKE)} x2={sx(MISTAKE)} y1={22} y2={170} class="bad-stroke" stroke-width={2} />
            <text x={sx(MISTAKE) - 6} y={20} text-anchor="end" class="bad-fill" style={{ fontSize: '12px', fontWeight: 600 }}>
              ✕ table dropped {fmtT(MISTAKE)}
            </text>
            {/* target */}
            <line x1={sx(plan.effective)} x2={sx(plan.effective)} y1={40} y2={172} stroke="var(--text)" stroke-width={2} />
            <circle cx={sx(plan.effective)} cy={172} r={5} fill="var(--text)" />
            <text x={sx(NOW)} y={222} text-anchor="end" class="muted" style={{ fontSize: '11px' }}>
              now
            </text>
          </svg>
        </div>
        <div class="legend">
          <span>
            <i class="sw" style={{ background: 'var(--ink)' }} />
            Snapshot used, and log replayed on top of it
          </span>
          <span>
            <i class="sw" style={{ background: 'var(--flow)', opacity: 0.5 }} />
            Logs in Time Machine
          </span>
          <span>
            <i class="sw" style={{ border: '1.5px dashed var(--warn)' }} />
            Not caught up yet
          </span>
        </div>
        <Follow tone={!plan.ok ? 'warn' : afterMistake ? 'bad' : 'ok'} k={!plan.ok ? 'Nearest reachable point' : afterMistake ? 'Includes the mistake' : 'Recoverable'}>
          <p>
            {plan.snapshot !== null && (
              <>
                Start from the {fmtT(plan.snapshot)} snapshot and replay {Math.floor(plan.logMin / 60)} h {Math.round(plan.logMin % 60)} min of transaction log to reach <strong>{fmtT(plan.effective)}</strong>.{' '}
              </>
            )}
            {plan.reason ? `${plan.reason}: the latest reachable point is ${fmtT(plan.lastCaptured)}.` : ''}
            {afterMistake && plan.ok ? ' This point is after the table was dropped, so the table would still be missing.' : ''}
            {!afterMistake && plan.ok ? (mode === 'clone' ? ' A clone at this point comes up beside production in minutes, using AOS snapshots rather than a full copy.' : ' Production is rolled back to this point; anything written after it is gone, so many teams clone first and copy back what they need.') : ''}
          </p>
        </Follow>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Recovery plan</div>
          <Stat k="Base snapshot" v={plan.snapshot !== null ? fmtT(plan.snapshot) : '—'} />
          <Stat k="Log to replay" v={`${Math.floor(plan.logMin / 60)} h ${Math.round(plan.logMin % 60)} m`} />
          <Stat k="Recovered to" v={fmtT(plan.effective)} tone={plan.ok ? 'ok' : 'warn'} />
          <Stat k="Last log catch-up" v={fmtT(plan.lastCaptured)} />
          <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
            <Illus why="Schedule and retention are examples. Snapshots are application-consistent; logs are captured continuously and copied into Time Machine at the catch-up interval." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── thin clones ──
function Clones() {
  const [src, setSrc] = useNum('src', 2, 0.5, 20);
  const [n, setN] = useNum('nc', 5, 1, 20);
  const [chg, setChg] = useNum('chg', 5, 1, 100);
  const c = cloneCapacity(src, n, chg);
  const max = c.fullCopiesTB;
  const W = 900;
  const sx = (v: number) => (v / max) * (W - 220);
  return (
    <div class="lab">
      <div class="ctl">
        <Field label="Source database" value={fmtTB(src)}>
          <Slider label="Source size" value={src} min={0.5} max={20} step={0.5} onChange={setSrc} />
        </Field>
        <Field label="Clones for dev, test, analytics" value={n}>
          <Slider label="Clones" value={n} min={1} max={20} onChange={setN} />
        </Field>
        <Field label="Data each clone changes" value={`${chg}%`} tip="A clone shares the source’s snapshot and only stores blocks it writes.">
          <Slider label="Change per clone" value={chg} min={1} max={100} onChange={setChg} />
        </Field>
      </div>
      <div class="stage">
        <h2 class="sec-h">Capacity: full copies vs thin clones</h2>
        <svg class="diagram" viewBox={`0 0 ${W} 170`} role="img" aria-label={`Full copies ${fmtTB(c.fullCopiesTB)} versus thin clones ${fmtTB(c.thinTB)}`}>
          <text x={0} y={42} style={{ fontWeight: 600, fontSize: '13.5px' }}>
            Before: full copies
          </text>
          {Array.from({ length: n + 1 }, (_, i) => (
            <rect key={i} x={180 + sx(src) * i} y={22} width={Math.max(1, sx(src) - 1)} height={30} class={i === 0 ? 'ink-fill' : 'tile-rep'} />
          ))}
          <text x={186 + sx(c.fullCopiesTB)} y={42} class="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
            {fmtTB(c.fullCopiesTB)}
          </text>
          <text x={0} y={112} style={{ fontWeight: 600, fontSize: '13.5px' }}>
            After: thin clones
          </text>
          <rect x={180} y={92} width={sx(src)} height={30} class="ink-fill" />
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x={180 + sx(src) + i * sx((src * chg) / 100)} y={92} width={Math.max(1, sx((src * chg) / 100) - 1)} height={30} class="flow-fill" />
          ))}
          <text x={186 + sx(c.thinTB)} y={112} class="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
            {fmtTB(c.thinTB)}
          </text>
          <text x={180} y={150} class="muted" style={{ fontSize: '12px' }}>
            Purple: source data (shared) · Blue: blocks each clone changed
          </text>
        </svg>
        <Follow tone={c.savedTB > 0.01 ? 'ok' : 'warn'} k={c.savedTB > 0.01 ? `${fmtTB(c.savedTB)} not needed` : 'No saving'}>
          <p>
            {c.savedTB > 0.01
              ? `${n} clones start as metadata pointing at the same snapshot and grow only by what they change. They are created in minutes instead of hours of copying.`
              : 'If every clone rewrites all of its data, it ends up as big as a full copy. Thin clones pay off when clones change a fraction of the data.'}
          </p>
        </Follow>
        <p class="small" style={{ marginTop: 'var(--sp-4)' }}>
          Clones can be refreshed on a schedule to a newer point in time, so test teams work with recent data without asking for a new copy. Sensitive data in clones still needs masking according to your policy.
        </p>
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Capacity</div>
          <Stat k="Full copies" v={fmtTB(c.fullCopiesTB)} />
          <Stat k="Thin clones" v={fmtTB(c.thinTB)} tone="ok" />
          <Stat k="Saved" v={`${((c.savedTB / c.fullCopiesTB) * 100).toFixed(0)}%`} />
          <div class="hstack" style={{ marginTop: 'var(--sp-2)' }}>
            <Illus why="Ignores compression, RF overhead and metadata. Shows the shape of the saving, not a sizing." />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── patching ──
const FLEET: DbServer[] = [
  { name: 'pg-orders', engine: 'PostgreSQL', version: 1, ha: true },
  { name: 'pg-reporting', engine: 'PostgreSQL', version: 1, ha: false },
  { name: 'pg-dev-01', engine: 'PostgreSQL', version: 1, ha: false },
  { name: 'pg-crm', engine: 'PostgreSQL', version: 2, ha: true },
];

function Patching() {
  const [sel, setSel] = useState<string[]>(['pg-orders', 'pg-dev-01']);
  const [patched, setPatched] = useState<string[]>([]);
  const ver = (d: DbServer) => (patched.includes(d.name) ? 2 : d.version);
  const todo = sel.filter((n) => ver(FLEET.find((d) => d.name === n)!) < 2);
  return (
    <div class="lab two">
      <div class="stage">
        <h2 class="sec-h">Patch a fleet from one software profile</h2>
        <svg class="diagram" viewBox="0 0 900 120" role="img" aria-label="Software profile versions across the database fleet">
          <rect x={0} y={10} width={150} height={100} rx={4} class="ink-fill" />
          <text x={75} y={50} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '13px' }}>
            Software profile
          </text>
          <text x={75} y={74} text-anchor="middle" class="mono" style={{ fill: '#fff', fontSize: '12px' }}>
            v1 → v2
          </text>
          {FLEET.map((d, i) => {
            const x = 200 + i * 175;
            const v = ver(d);
            return (
              <g key={d.name}>
                <path d={`M150 60 C 175 60, ${x - 25} 60, ${x} 60`} fill="none" class={v >= 2 ? 'ok-stroke' : 'line'} stroke-width={1.5} />
                <rect x={x} y={30} width={160} height={60} rx={4} class={`node-box${v >= 2 ? '' : ' warn'}`} />
                <text x={x + 12} y={54} class="mono" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {d.name}
                </text>
                <text x={x + 12} y={76} class={v >= 2 ? 'ok-fill' : 'warn-fill'} style={{ fontSize: '12px', fontWeight: 600 }}>
                  {v >= 2 ? '✓ v2' : '⚠ v1, patch due'}
                  {d.ha ? ' · HA' : ''}
                </text>
              </g>
            );
          })}
        </svg>
        <p class="lede">The DBA publishes a new software profile version (OS and database patches). Every database built from that profile can be moved to it in one operation, inside a maintenance window.</p>
        <div class="ndb-tblwrap" style={{ marginTop: 'var(--sp-4)' }}>
        <table class="tbl">
          <thead>
            <tr>
              <th>Select</th>
              <th>Database</th>
              <th>Topology</th>
              <th>Profile version</th>
              <th>Impact while patching</th>
            </tr>
          </thead>
          <tbody>
            {FLEET.map((d) => {
              const v = ver(d);
              const on = sel.includes(d.name);
              return (
                <tr key={d.name} class={on ? 'sel' : ''}>
                  <td>
                    <Toggle on={on} disabled={v >= 2} onChange={(x) => setSel(x ? [...sel, d.name] : sel.filter((n) => n !== d.name))} title={v >= 2 ? 'Already on the latest profile' : undefined}>
                      <span class="sr-only">Select {d.name}</span>
                    </Toggle>
                  </td>
                  <td class="mono">{d.name}</td>
                  <td>{d.ha ? 'HA cluster' : 'Single instance'}</td>
                  <td>
                    <Chip tone={v >= 2 ? 'ok' : 'warn'}>{v >= 2 ? 'v2 · current' : 'v1 · patch available'}</Chip>
                  </td>
                  <td class="small">{patchDowntime(d) === 'rolling' ? 'Rolling: one member at a time, brief role switch' : 'Restart window for this database'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        <div class="hstack" style={{ marginTop: 'var(--sp-4)' }}>
          <button type="button" class="btn primary" disabled={!todo.length} onClick={() => (setPatched([...patched, ...todo]), setSel([]))}>
            Patch {todo.length} database{todo.length === 1 ? '' : 's'} to v2
          </button>
          {patched.length > 0 && (
            <button type="button" class="tbtn" onClick={() => (setPatched([]), setSel(['pg-orders', 'pg-dev-01']))}>
              Reset
            </button>
          )}
          <Illus why="Simplified: real patching runs pre-checks and follows the maintenance window you schedule. Check per-engine patching behavior in NDB documentation." />
        </div>
        {patched.length > 0 && (
          <Follow tone="ok" k="Patched">
            <p>{patched.join(', ')} now run the v2 profile. HA databases were patched one member at a time; single instances needed a short restart.</p>
          </Follow>
        )}
      </div>
      <div class="rail">
        <div class="side-sec">
          <div class="eyebrow">Fleet</div>
          <Stat k="On latest profile" v={`${FLEET.filter((d) => ver(d) >= 2).length} of ${FLEET.length}`} />
          <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>
            Consistent profiles mean fewer one-off builds to patch by hand.
          </p>
        </div>
      </div>
    </div>
  );
}

type Tab = 'prov' | 'tm' | 'clone' | 'patch';
export default function Ndb() {
  const [tab, setTab] = useEnum<Tab>('tab', 'tm', ['prov', 'tm', 'clone', 'patch']);
  const tabs: [Tab, string][] = [
    ['tm', 'Time Machine'],
    ['clone', 'Thin clones'],
    ['prov', 'Provisioning'],
    ['patch', 'Patching'],
  ];
  return (
    <>
      <div class="tabs" role="tablist" aria-label="Database Service">
        {tabs.map(([id, l]) => (
          <button type="button" role="tab" key={id} aria-selected={tab === id} onClick={() => setTab(id)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'prov' && <Provision />}
      {tab === 'tm' && <TimeMachine />}
      {tab === 'clone' && <Clones />}
      {tab === 'patch' && <Patching />}
    </>
  );
}
