// Nutanix Database Service (NDB): three looping pictures. Time Machine rebuilds a moment from
// a snapshot plus transaction logs; provisioning turns one request into a protected database;
// patching moves a fleet to a new software profile. Recovery math and patch behavior come from
// src/engine/ndb.ts.
import { useEnum } from '../../../state/route';
import { lastCaptured, patchDowntime, planRecovery, snapshots, type DbServer, type TmPolicy } from '../../../engine/ndb';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const W = 960;
type Line = { tone: Tone | 'ink'; k: string; text: string };

/** A database drawn as a cylinder. */
function Cylinder({ x, y, w, h, cls }: { x: number; y: number; w: number; h: number; cls: string }) {
  const ry = 6;
  return (
    <g class={cls}>
      <path d={`M${x} ${y + ry} v${h - 2 * ry} a${w / 2} ${ry} 0 0 0 ${w} 0 v${-(h - 2 * ry)}`} />
      <ellipse cx={x + w / 2} cy={y + ry} rx={w / 2} ry={ry} />
    </g>
  );
}

/** The point a fraction f of the way along a polyline. */
function along(pts: [number, number][], f: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.max(0, Math.min(1, f)) * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}
const poly = (pts: [number, number][]) => pts.map((p) => p.join(',')).join(' ');

// ── Time Machine ──
const DAY = 1440;
const WINDOW = 7 * DAY;
const NOW = WINDOW - 12;
const MISTAKE = 5 * DAY + 14 * 60 + 38; // Sat 14:38
const TARGET = MISTAKE - 1;
const POLICY: TmPolicy = { windowMin: WINDOW, snapEveryMin: DAY, snapOffsetMin: 60, logEveryMin: 30 };
const PLAN = planRecovery(POLICY, NOW, TARGET);
const BASE = PLAN.snapshot ?? 0;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const fmtT = (m: number) => {
  const mm = Math.round(m);
  return `${DOW[Math.floor(mm / DAY) % 7]} ${String(Math.floor((mm % DAY) / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};
const fmtSpan = (m: number) => `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`;
const SWEEP: [number, number] = [0.2, 4.6];
const T_MISTAKE = SWEEP[0] + ((SWEEP[1] - SWEEP[0]) * MISTAKE) / NOW;
const TM_PH = [0, T_MISTAKE, 4.6, 6, 8.8];
const TM_END = 12.4;

function tmLines(clone: boolean): Line[] {
  return [
      { tone: 'ink', k: 'Protecting', text: 'Time Machine takes a snapshot of the database every day and copies its transaction log every 30 minutes, so any moment in the window can be rebuilt.' },
      { tone: 'bad', k: 'A mistake', text: 'Saturday 14:38: someone drops a table. Time Machine keeps capturing, so the moment just before it is still there.' },
      { tone: 'flow', k: 'Pick a moment', text: 'Go back to one minute before the mistake. NDB can recover to the second, anywhere in the retention window up to the last captured log.' },
      { tone: 'flow', k: 'Rebuild it', text: `NDB starts from the nearest earlier snapshot (${fmtT(BASE)}) and replays ${fmtSpan(TARGET - BASE)} of transaction log on top of it, up to ${fmtT(TARGET)}.` },
      clone
        ? { tone: 'ok', k: 'Clone ready', text: 'A copy of the database at 14:37 comes up beside production, using snapshots rather than a full copy. Production keeps running; copy the dropped table back.' }
        : { tone: 'warn', k: 'Restored', text: 'Production is rolled back to 14:37 and the table is back. Anything written after 14:37 is gone, which is why many teams clone first.' },
  ];
}

function TimeMachine() {
  const [mode, setMode] = useEnum<'clone' | 'restore'>('rm', 'clone', ['clone', 'restore']);
  const clock = useClock({ rate: 1, duration: TM_END, keys: true, poster: TM_END - 0.5, steps: paced(TM_PH, tmLines(mode === 'clone').map((l) => [l.k, l.text])) });
  useRestartOn(clock, [mode]);
  const t = clock.t;
  const ph = phaseAt(TM_PH, t);
  const now = NOW * prog(t, SWEEP[0], SWEEP[1]);
  const cursor = ph >= 2 ? NOW + (TARGET - NOW) * ease(prog(t, TM_PH[2], TM_PH[2] + 1.2)) : null;
  const replay = ph >= 3 ? BASE + (TARGET - BASE) * ease(prog(t, TM_PH[3] + 0.6, TM_PH[3] + 2.4)) : null;
  const result = ph >= 4 ? ease(prog(t, TM_PH[4], TM_PH[4] + 0.8)) : 0;
  const clone = mode === 'clone';

  const l = 20;
  const sx = (m: number) => l + (m / WINDOW) * (W - 2 * l);
  const logTo = lastCaptured(POLICY, now);
  const broken = t >= T_MISTAKE;

  const lines = tmLines(clone);
  const line = lines[ph];

  const prodStatus =
    !clone && ph >= 4 ? { w: '✓ rolled back to Sat 14:37 · table is back', c: 'ok' } : !clone && ph === 3 ? { w: 'being rolled back…', c: 'warn' } : broken ? { w: 'running · a table is missing', c: 'bad' } : { w: '✓ running', c: 'ok' };

  return (
    <Show
      top={
        <Choice<'clone' | 'restore'>
          label="Recover as"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'clone', label: 'Clone beside production' },
            { value: 'restore', label: 'Restore in place' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Recovered to', v: fmtT(TARGET), sub: 'one minute before the mistake' },
              { k: 'Starting snapshot', v: fmtT(BASE), sub: `plus ${fmtSpan(TARGET - BASE)} of log` },
              clone ? { k: 'Production', v: 'Keeps running', tone: 'ok', sub: 'copy the table back' } : { k: 'Production', v: 'Rolled back', tone: 'warn', sub: 'changes after 14:37 are lost' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} 300`} role="img" aria-label={`Seven days of daily snapshots and transaction logs. A table is dropped on ${fmtT(MISTAKE)}; the database is rebuilt at ${fmtT(TARGET)} from the ${fmtT(BASE)} snapshot plus logs, ${clone ? 'as a clone beside production' : 'by rolling production back'}.`}>
          {DOW.map((d, i) => (
            <g key={d}>
              <line x1={sx(i * DAY)} x2={sx(i * DAY)} y1={34} y2={176} class="line" stroke-dasharray="2 4" />
              <text x={sx(i * DAY + DAY / 2)} y={194} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
                {d}
              </text>
            </g>
          ))}
          <text x={l + 4} y={50} class="muted" style={{ fontSize: '11.5px' }}>
            Daily snapshots
          </text>
          {snapshots(POLICY, now).map((s) => (
            <rect key={s} x={sx(s) - 6} y={58} width={12} height={22} class={replay !== null && s === BASE ? 'ndb-snap on' : 'ndb-snap'} />
          ))}
          <text x={l + 4} y={106} class="muted" style={{ fontSize: '11.5px' }}>
            Transaction log, copied every 30 min
          </text>
          {logTo > 0 && <rect x={sx(0)} y={113} width={sx(logTo) - sx(0)} height={14} class="ndb-log" />}
          {replay !== null && replay > BASE && <rect x={sx(BASE)} y={134} width={sx(replay) - sx(BASE)} height={10} class="ndb-replay" />}
          {t < SWEEP[1] + 0.05 && (
            <g>
              <line x1={sx(now)} x2={sx(now)} y1={34} y2={176} class="ndb-now" />
              <text x={Math.max(sx(now), 34)} y={212} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
                now
              </text>
            </g>
          )}
          {broken && (
            <g>
              <line x1={sx(MISTAKE)} x2={sx(MISTAKE)} y1={34} y2={176} class="bad-stroke" stroke-width={2} />
              <text x={sx(MISTAKE) + 6} y={24} class="bad-fill halo" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                ✕ table dropped {fmtT(MISTAKE)}
              </text>
            </g>
          )}
          {cursor !== null && (
            <g>
              <line x1={sx(cursor)} x2={sx(cursor)} y1={40} y2={176} class="ndb-cursor" />
              <circle cx={sx(cursor)} cy={176} r={5} class="ndb-cursor-dot" />
              <text x={sx(cursor) - 8} y={214} text-anchor="end" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                recover to {fmtT(cursor)}
              </text>
            </g>
          )}
          <g>
            <rect x={20} y={228} width={430} height={60} class={`node-box${broken && (clone || ph < 4) ? ' warn' : ''}`} />
            <Cylinder x={34} y={240} w={30} h={36} cls="ndb-db" />
            <text x={78} y={252} style={{ fontSize: '14px', fontWeight: 600 }}>
              Production database
            </text>
            <text x={78} y={272} class={`ndb-st ${prodStatus.c}`} style={{ fontSize: '12px', fontWeight: 600 }}>
              {prodStatus.w}
            </text>
          </g>
          {clone && ph >= 3 && (
            <g style={{ opacity: ph >= 4 ? 0.4 + 0.6 * result : 0.5 }}>
              <rect x={500} y={228} width={440} height={60} class={`node-box${ph >= 4 ? ' sel' : ''}`} stroke-dasharray={ph >= 4 ? undefined : '5 4'} />
              <Cylinder x={514} y={240} w={30} h={36} cls={ph >= 4 ? 'ndb-db on' : 'ndb-db'} />
              <text x={558} y={252} style={{ fontSize: '14px', fontWeight: 600 }}>
                Clone at {fmtT(TARGET)}
              </text>
              <text x={558} y={272} class={`ndb-st ${ph >= 4 ? 'ok' : 'flow'}`} style={{ fontSize: '12px', fontWeight: 600 }}>
                {ph >= 4 ? '✓ the table is there · beside production' : 'building from snapshot + log…'}
              </text>
            </g>
          )}
        </svg>
      </div>
      <div class="legend">
        <span>
          <i class="sw" style={{ background: 'var(--ink)' }} />
          Snapshot used, and log replayed on top of it
        </span>
        <span>
          <i class="sw" style={{ background: 'var(--flow)', opacity: 0.5 }} />
          Transaction log kept by Time Machine
        </span>
      </div>
      <PlayBar clock={clock} label="Time Machine animation" fmt={() => line.k} extra={<Illus why="Schedule and retention are examples; you set your own. Snapshots are application-consistent; logs are captured continuously and copied into Time Machine at the catch-up interval, which bounds how close to now you can recover. Recovery options vary by engine." />} />
    </Show>
  );
}

// ── Provisioning ──
const PROFILES = [
  { t: 'Software', s: 'PostgreSQL and OS version' },
  { t: 'Compute', s: 'CPU and memory size' },
  { t: 'Network', s: 'where it connects' },
  { t: 'Database settings', s: 'tuned parameters' },
];
const PV_PH = [0, 1.4, 3.2, 5, 6.6];
const PV_END = 10;

function pvLines(ha: boolean): Line[] {
  return [
      { tone: 'ink', k: 'One request', text: 'A developer or DBA asks for a database: engine, size and protection level. Everything else comes from profiles the DBA defined once.' },
      { tone: 'flow', k: 'Build the servers', text: ha ? 'NDB creates the database server VMs for a high-availability cluster from the software and compute profiles.' : 'NDB creates the database server VM from the software and compute profiles.' },
      { tone: 'flow', k: 'Create the database', text: ha ? 'It creates the database on the primary and sets up standby copies that follow every change, so one server can fail without an outage.' : 'It creates the database and applies the database settings, the same way every time.' },
      { tone: 'ok', k: 'Protect it', text: 'Time Machine takes the first snapshot, so the database is protected from its first minute.' },
      { tone: 'ok', k: 'Ready', text: 'The connection details go back to whoever asked. No tickets passed between the DBA, storage and VM teams.' },
  ];
}

function Provisioning() {
  const [topo, setTopo] = useEnum<'single' | 'ha'>('tp', 'single', ['single', 'ha']);
  const clock = useClock({ rate: 1, duration: PV_END, keys: true, poster: PV_END - 0.5, steps: paced(PV_PH, pvLines(topo === 'ha').map((l) => [l.k, l.text])) });
  useRestartOn(clock, [topo]);
  const t = clock.t;
  const ph = phaseAt(PV_PH, t);
  const ha = topo === 'ha';
  const n = ha ? 3 : 1;

  const PX = 214;
  const PW = 210;
  const cardY = (i: number) => 54 + i * 52;
  const CX = 470;
  const CWID = W - 8 - CX;
  const VW = 140;
  const vmX = (i: number) => CX + (CWID - (n * VW + (n - 1) * 20)) / 2 + i * (VW + 20);
  const VY = 62;
  const VH = 150;
  const reqIn = ease(prog(t, 0.1, 0.8));
  const vmIn = (i: number) => prog(t, PV_PH[1] + 0.4 + i * 0.3, PV_PH[1] + 1 + i * 0.3);
  const dbIn = (i: number) => t >= PV_PH[2] + 0.3 + i * 0.3;
  const tmIn = t >= PV_PH[3] + 0.4;
  const back = prog(t, PV_PH[4], PV_PH[4] + 1);
  const BACK: [number, number][] = [
    [CX, 262],
    [88, 262],
    [88, 164],
  ];

  const lines = pvLines(ha);
  const line = lines[ph];

  return (
    <Show
      top={
        <Choice<'single' | 'ha'>
          label="Topology"
          value={topo}
          onChange={setTopo}
          options={[
            { value: 'single', label: 'Single instance' },
            { value: 'ha', label: 'High availability' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Asked for', v: 'One request', sub: 'no tickets between teams' },
              ha ? { k: 'If a server fails', v: 'Failover', tone: 'ok', sub: 'a standby takes over' } : { k: 'If a server fails', v: 'Restart', sub: 'the VM restarts on another host' },
              { k: 'Time Machine', v: tmIn ? 'Protecting' : 'Not yet', tone: tmIn ? 'ok' : undefined, sub: tmIn ? 'from the first snapshot' : undefined },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} 280`} role="img" aria-label={`One request becomes a ${ha ? 'high-availability PostgreSQL cluster' : 'single PostgreSQL database'}, built from shared profiles and protected by Time Machine.`}>
          <rect x={8} y={96} width={160} height={66} class={`node-box${back >= 1 ? ' sel' : ''}`} />
          <text x={22} y={122} style={{ fontSize: '14px', fontWeight: 600 }}>
            Developer or DBA
          </text>
          <text x={22} y={142} class={`ndb-st ${back >= 1 ? 'ok' : 'muted'}`} style={{ fontSize: '12px', fontWeight: back >= 1 ? 600 : 400 }}>
            {back >= 1 ? '✓ has a database' : 'asks for a database'}
          </text>

          <text x={PX} y={40} class="muted" style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}>
            PROFILES, DEFINED ONCE
          </text>
          {PROFILES.map((p, i) => {
            const on = t >= 0.5 + i * 0.2 && ph < 3;
            return (
              <g key={p.t}>
                <rect x={PX} y={cardY(i)} width={PW} height={42} class={`ndb-card${on ? ' on' : ''}`} />
                <text x={PX + 12} y={cardY(i) + 18} style={{ fontSize: '13px', fontWeight: 600 }}>
                  {p.t}
                </text>
                <text x={PX + 12} y={cardY(i) + 33} class="muted" style={{ fontSize: '11px' }}>
                  {p.s}
                </text>
              </g>
            );
          })}

          <rect x={CX} y={20} width={CWID} height={250} class="frame" />
          <text x={CX + 12} y={40} class="muted" style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}>
            NUTANIX CLUSTER
          </text>
          {Array.from({ length: n }, (_, i) => {
            const f = vmIn(i);
            const x = vmX(i);
            const role = ha ? (i === 0 ? 'Primary' : 'Standby') : 'DB server';
            return (
              <g key={i} style={{ opacity: f > 0 ? 0.3 + 0.7 * f : 0 }}>
                <rect x={x} y={VY} width={VW} height={VH} class={`vm${f >= 1 ? ' hl' : ''}`} stroke-dasharray={f >= 1 ? undefined : '5 4'} />
                <text x={x + 12} y={VY + 22} style={{ fontSize: '13px', fontWeight: 600 }}>
                  {role}
                </text>
                <text x={x + 12} y={VY + 38} class="muted" style={{ fontSize: '11px' }}>
                  database server VM
                </text>
                <Cylinder x={x + VW / 2 - 22} y={VY + 54} w={44} h={50} cls={dbIn(i) ? 'ndb-db on' : 'ndb-db'} />
                <text x={x + VW / 2} y={VY + 126} text-anchor="middle" class={dbIn(i) ? '' : 'faint'} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                  {dbIn(i) ? (ha && i > 0 ? 'standby copy' : 'PostgreSQL') : 'database'}
                </text>
              </g>
            );
          })}
          {ha &&
            t >= PV_PH[2] + 1 &&
            [1, 2].map((i) => (
              <path key={i} d={`M${vmX(i - 1) + VW} ${VY + 80} H${vmX(i)}`} class="ndb-rep" marker-end="url(#ndb-ar)" />
            ))}
          <defs>
            <marker id="ndb-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" class="ndb-mk" />
            </marker>
          </defs>
          {tmIn && (
            <g>
              <rect x={CX + 20} y={VY + VH + 14} width={CWID - 40} height={30} class="ndb-tm" />
              <rect x={CX + 32} y={VY + VH + 21} width={10} height={16} class="ndb-snap on" />
              <text x={CX + 52} y={VY + VH + 34} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                Time Machine · first snapshot taken
              </text>
            </g>
          )}

          {/* request travelling to the profiles, profiles to the cluster, details back */}
          {ph === 0 && reqIn < 1 && <circle cx={168 + (PX - 168) * reqIn} cy={129} r={6} class="ndb-dot" />}
          {ph === 1 &&
            PROFILES.map((_, i) => {
              const k = ease(prog(t, PV_PH[1] + i * 0.15, PV_PH[1] + 0.8 + i * 0.15));
              if (k <= 0 || k >= 1) return null;
              return <circle key={i} cx={PX + PW + (vmX(0) - PX - PW) * k} cy={cardY(i) + 21 + (VY + 75 - cardY(i) - 21) * k} r={5} class="ndb-dot" />;
            })}
          {back > 0 && <polyline points={poly(BACK)} class="ndb-back" />}
          {back > 0 && back < 1 && <circle cx={along(BACK, ease(back))[0]} cy={along(BACK, ease(back))[1]} r={6} class="ndb-dot ok" />}
        </svg>
      </div>
      <PlayBar
        clock={clock}
        label="Provisioning animation"
        fmt={() => line.k}
        extra={<Illus why="Durations are compressed. NDB 2.11 supports Oracle, SQL Server, PostgreSQL, EDB Postgres, MySQL, MariaDB and MongoDB; high-availability layouts differ by engine (for example SQL Server availability groups, PostgreSQL HA clusters, MongoDB replica sets) and are simplified here." />}
      />
    </Show>
  );
}

// ── Patching ──
const FLEET: DbServer[] = [
  { name: 'pg-orders', engine: 'PostgreSQL', version: 1, ha: true },
  { name: 'pg-crm', engine: 'PostgreSQL', version: 1, ha: true },
  { name: 'pg-reporting', engine: 'PostgreSQL', version: 1, ha: false },
  { name: 'pg-dev', engine: 'PostgreSQL', version: 1, ha: false },
];
const PT_PH = [0, 1.6, 4.6, 6.6];
const PT_END = 8.8;
const START = 2.2;
const MEMBER = 1.2;
const SWITCH = START + 2 * MEMBER; // primary role moves to a patched standby
/** When each member of a database is patched: [start, end]. Rolling for HA, one restart for a single instance. */
function patchWindows(db: DbServer): [number, number][] {
  if (patchDowntime(db) === 'restart-window') return [[START, START + 1.8]];
  return [
    [SWITCH + 0.6, SWITCH + 0.6 + MEMBER],
    [START, START + MEMBER],
    [START + MEMBER, SWITCH],
  ];
}

const PT_LINES: Line[] = [
  { tone: 'ink', k: 'New profile version', text: 'The DBA publishes a new version of the software profile, with OS and database patches. Every database built from it shows a patch is due.' },
  { tone: 'flow', k: 'Patching', text: 'One operation patches every database built from that profile, inside a maintenance window. HA databases are patched one member at a time; single instances restart briefly.' },
  { tone: 'flow', k: 'Role switch', text: 'On the HA databases the primary role moves to a member that is already patched, so apps keep running, then the old primary is patched.' },
  { tone: 'ok', k: 'All patched', text: 'Every database runs the new version, built and patched the same way. No one-off servers to patch by hand.' },
];

function Patching() {
  const clock = useClock({ rate: 1, duration: PT_END, keys: true, poster: PT_END - 0.5, steps: paced(PT_PH, PT_LINES.map((l) => [l.k, l.text])) });
  const t = clock.t;
  const ph = phaseAt(PT_PH, t);
  const v2 = t >= 0.8;
  const done = (db: DbServer) => patchWindows(db).every(([, e]) => t >= e);
  const onNew = FLEET.filter(done).length;

  const GX = 250;
  const GW = 162;
  const gx = (i: number) => GX + i * (GW + 12);
  const line = PT_LINES[ph];

  return (
    <Show
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'On the new version', v: `${onNew} of ${FLEET.length}`, tone: onNew === FLEET.length ? 'ok' : undefined },
              { k: 'HA databases', v: 'Stay online', tone: 'ok', sub: 'one member at a time' },
              { k: 'Single instances', v: 'Short restart', sub: 'inside the maintenance window' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram" viewBox={`0 0 ${W} 270`} role="img" aria-label="A software profile moves from version 1 to version 2 and four databases built from it are patched: HA databases one member at a time, single instances with a short restart.">
          <rect x={8} y={84} width={190} height={100} class={`ndb-card${v2 && t < 1.6 ? ' on' : ''}`} />
          <text x={22} y={110} style={{ fontSize: '14px', fontWeight: 600 }}>
            Software profile
          </text>
          <text x={22} y={146} class="mono" style={{ fontSize: '26px', fontWeight: 600 }}>
            {v2 ? 'v2' : 'v1'}
          </text>
          <text x={22} y={170} class="muted" style={{ fontSize: '11px' }}>
            OS and database patches
          </text>
          {FLEET.map((db, i) => {
            const x = gx(i);
            const wins = patchWindows(db);
            const isDone = done(db);
            const busy = wins.some(([s, e]) => t >= s && t < e);
            const restarting = !db.ha && busy;
            const wire: [number, number][] = [
              [198, 134],
              [224, 134],
              [224, 14],
              [x + GW / 2, 14],
              [x + GW / 2, 30],
            ];
            const k = ease(prog(t, PT_PH[1], START));
            const status = isDone ? { w: '✓ on v2', c: 'ok' } : restarting ? { w: 'restarting', c: 'warn' } : busy || (db.ha && t >= START) ? { w: 'online · rolling', c: 'ok' } : { w: 'v1 · patch due', c: 'warn' };
            return (
              <g key={db.name}>
                <polyline points={poly(wire)} class={`ndb-wire${isDone ? ' done' : ''}`} />
                {k > 0 && k < 1 && <circle cx={along(wire, k)[0]} cy={along(wire, k)[1]} r={5} class="ndb-dot" />}
                <rect x={x} y={30} width={GW} height={210} class={`node-box${restarting ? ' warn' : ''}`} />
                <text x={x + 12} y={52} class="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
                  {db.name}
                </text>
                <text x={x + 12} y={68} class="muted" style={{ fontSize: '11px' }}>
                  {db.ha ? 'HA cluster' : 'single instance'}
                </text>
                {wins.map(([s, e], m) => {
                  const y = 80 + m * 40;
                  const st = t >= e ? 'v2' : t >= s ? 'busy' : 'v1';
                  const primary = db.ha ? (t >= SWITCH ? m === 1 : m === 0) : true;
                  return (
                    <g key={m}>
                      <rect x={x + 10} y={y} width={GW - 20} height={32} class={`ndb-member ${st}`} />
                      <text x={x + 20} y={y + 20} style={{ fontSize: '12px', fontWeight: primary && db.ha ? 600 : 400 }}>
                        {db.ha ? (primary ? 'primary' : 'standby') : 'database'}
                      </text>
                      <text x={x + GW - 20} y={y + 20} text-anchor="end" class={`mono ndb-st ${st === 'v2' ? 'ok' : st === 'busy' ? 'flow' : 'warn'}`} style={{ fontSize: '11.5px', fontWeight: 600 }}>
                        {st === 'busy' ? 'patching' : st}
                      </text>
                    </g>
                  );
                })}
                <text x={x + 12} y={80 + wins.length * 40 + 18} class={`ndb-st ${status.c}`} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                  {status.w}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <PlayBar clock={clock} label="Patching animation" fmt={() => line.k} extra={<Illus why="Simplified: real patching runs pre-checks and follows the maintenance window you schedule. Patching behavior differs by engine and topology; check the NDB documentation." />} />
    </Show>
  );
}

type Tab = 'tm' | 'prov' | 'patch';
export default function Ndb() {
  const [tab, setTab] = useEnum<Tab>('tab', 'tm', ['tm', 'prov', 'patch']);
  const tabs: [Tab, string][] = [
    ['tm', 'Time Machine'],
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
      {tab === 'tm' && <TimeMachine />}
      {tab === 'prov' && <Provisioning />}
      {tab === 'patch' && <Patching />}
    </>
  );
}
