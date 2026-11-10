// Disaster Recovery: pick how data is replicated and a planned or unplanned failover, and watch
// two sites on a loop: the app writes at Site A, copies reach Site B, then the apps move to
// Site B. NearSync and Sync share one choice; Metro Availability (sync plus a Witness) has its
// own. The scene (what is copied when, what is lost) comes from src/engine/dr.ts.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { STAGES, buildScene, type DrEvent, type DrPhase, type DrScene, type Tier } from '../../../engine/dr';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Drive, VmBox } from '../../components/parts';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const TIERS: readonly Tier[] = ['async', 'nearsync', 'metro'];
const EVENTS: readonly DrEvent[] = ['planned', 'unplanned'];


// ── geometry ──
const W = 960;
const H = 440;
const SW = 350; // site width
const ST = 10; // site top
const SH = 292; // site height
const AX = 8;
const BX = W - 8 - SW;
const VMW = 92;
const VMH = 28;
const ROW_Y = ST + 64;
const ROW = 38;
const DISK_DX = 106; // disk left edge, from the site's left edge + 14
const CELL = 14;
const PITCH = 17;
const DISK_W = 132;
const MID = W / 2;
const LINK_Y = ST + 142;
const LINK_A = AX + SW + 6;
const LINK_B = BX - 6;
// the three VMs the recovery plan starts, in stage order (STAGES: Database, App, Web)
const VMS = ['db01', 'app01', 'web01'] as const;
// timeline strip
const TL_Y = 374;
const TL_X0 = 140;
const TL_X1 = 930;

const LINK_WORDS: Record<Tier, [string, string]> = {
  async: ['Async', 'a copy every 1 hour or more'],
  nearsync: ['NearSync', 'a copy every 1 to 15 minutes'],
  metro: ['Metro Availability', 'every write, both sites'],
};
// what the protection policy says per choice: schedule, RPO (a range), retention is set by the admin
const POLICY: Record<Tier, [string, string]> = {
  async: ['every 1 hour or more', '1 hour or more'],
  nearsync: ['every 1 to 15 minutes', '1 to 15 minutes'],
  metro: ['every write, both sites', 'zero'],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function caption(s: DrScene, ph: DrPhase): { tone: Tone | 'ink'; k: string; text: string } {
  switch (ph) {
    case 'replicate':
      return {
        tone: 'ink',
        k: 'Data replicating',
        text:
          s.tier === 'async'
            ? 'The apps write at Site A. On a schedule (async policies run every 1 to 24 hours) a recovery point is copied to Site B, so anything written since then exists only at Site A.'
            : s.tier === 'nearsync'
              ? 'With NearSync a small recovery point reaches Site B every 1 to 15 minutes, so only the last few minutes exist only at Site A. Sync replication, for sites under 5 ms apart, copies every write instead.'
              : 'Metro Availability: every write is stored at both sites before the app is told it is done, so Site B is never behind. The sites must be under 5 ms round trip apart, and each write waits about one round trip.',
      };
    case 'shutdown':
      return { tone: 'warn', k: 'Apps shut down', text: 'The apps at Site A shut down cleanly, so nothing new is written while they move.' };
    case 'final':
      return { tone: 'flow', k: 'Final changes copied', text: 'The changes made since the last recovery point are copied to Site B, so nothing is left behind.' };
    case 'migrate':
      return { tone: 'flow', k: 'Apps live-migrate', text: 'For a planned move the apps live-migrate to Site B one at a time and never stop. Every write is already there, so nothing waits for a final copy.' };
    case 'lost':
      return {
        tone: 'bad',
        k: 'Site A is lost',
        text: s.lost
          ? `Power, network or the whole building is gone. ${plural(s.lost, 'recent write', 'recent writes')} had not reached Site B yet and ${s.lost === 1 ? 'is' : 'are'} lost with it${s.tier === 'nearsync' ? '; with sync replication they would already be there' : ''}.`
          : 'Power, network or the whole building is gone. Every write the apps were told was done is already at Site B, so nothing is lost.',
      };
    case 'decide':
      return s.decision === 'witness'
        ? { tone: 'warn', k: 'The Witness decides', text: 'The Witness, in a third location, can tell a lost site from a broken link. It gives Site B the lock, so Site B takes over on its own.' }
        : { tone: 'warn', k: 'A person decides', text: 'Someone confirms the outage and starts the recovery plan. Without Metro Availability’s Witness a person makes this call, even with sync replication.' };
    case 'boot':
      return s.decision === 'witness'
        ? { tone: 'flow', k: 'Restarting at Site B', text: 'The VMs restart at Site B automatically, in the recovery plan’s order: database first, then the app, then the web tier. It is a restart, so it takes minutes.' }
        : { tone: 'flow', k: 'Starting at Site B', text: 'The admin runs the recovery plan, which starts the VMs at Site B in the order it sets: database first, then the app, then the web tier.' };
    default:
      return s.live
        ? { tone: 'ok', k: 'Running at Site B', text: 'Running at Site B with no data lost and no downtime. The apps can move back the same way.' }
        : s.event === 'planned'
        ? { tone: 'ok', k: 'Running at Site B', text: 'Running at Site B with no data lost. Site A is still healthy, so the apps can move back later the same way.' }
        : s.lost
          ? { tone: 'warn', k: 'Running at Site B', text: `Running at Site B from the last recovery point that arrived. The ${plural(s.lost, 'write', 'writes')} made after it ${s.lost === 1 ? 'is' : 'are'} gone.` }
          : { tone: 'ok', k: 'Running at Site B', text: 'Running at Site B with no data lost.' };
  }
}


function Sites({ s, t }: { s: DrScene; t: number }) {
  const unplanned = s.event === 'unplanned';
  const aLost = unplanned && t >= s.fail;
  const aOff = !unplanned && !s.live && t >= s.fail + 1;
  const aStopping = !unplanned && !s.live && t >= s.fail && !aOff;
  const moved = s.live && t >= s.done;
  const decideAt = s.phases.find((p) => p.id === 'decide')?.t ?? Infinity;
  const deciding = t >= decideAt && t < s.go;
  const [tierWord, cadence] = LINK_WORDS[s.tier];
  const ship = s.ships.find((p) => t >= p.t && t < p.land && !(p.lost && t >= s.fail));

  const aWord = aLost ? { w: '✕ site lost', c: 'bad' } : moved ? { w: 'apps moved · site still healthy', c: 'muted' } : s.live && t >= s.fail ? { w: 'apps moving live', c: 'flow' } : aOff ? { w: 'apps off · site still healthy', c: 'muted' } : aStopping ? { w: 'shutting the apps down', c: 'warn' } : { w: '✓ apps running', c: 'ok' };
  const bWord = t >= s.done ? { w: '✓ apps running here', c: 'ok' } : s.live && t >= s.go ? { w: 'apps arriving live', c: 'flow' } : t >= s.go ? { w: s.decision === 'witness' ? 'restarting the apps' : 'starting the apps in order', c: 'flow' } : aLost ? { w: 'waiting for the go', c: 'warn' } : { w: 'standby · receiving copies', c: 'flow' };

  const linkLabel = aLost ? ['Link lost', 'no more copies'] : s.live && t >= s.fail ? ['Live migration', 'memory and state cross over'] : t >= s.fail + 1 && t < s.go && !unplanned ? ['Final copy', 'last changes'] : [tierWord, cadence];
  const linkCls = aLost ? 'bad broken' : s.tier === 'metro' ? 'ok' : 'flow';

  const rowY = (i: number) => ROW_Y + i * ROW;
  // write i lands on the disk of VM i % 3, in cell floor(i / 3)
  const cell = (site: number, i: number) => ({ x: site + 14 + DISK_DX + 5 + Math.floor(i / 3) * PITCH, y: rowY(i % 3) + (VMH - CELL) / 2 });

  const vm = (site: number, i: number, cls: string, word: string) => {
    const state = ({ on: 'new', off: 'off', boot: 'moving', stopping: 'warn', lost: 'down' } as const)[cls as 'on'];
    return (
      <g key={`${site}-${i}`}>
        <VmBox x={site + 14} y={rowY(i)} w={VMW} h={VMH} name={VMS[i]} state={state} />
        <Drive x={site + 14 + DISK_DX} y={rowY(i)} w={DISK_W} h={VMH} state={cls === 'lost' ? 'down' : undefined} />
        <text x={site + 14 + DISK_DX + DISK_W + 10} y={rowY(i) + 18} class={`dr-st ${cls} d-fine`}>
          {word}
        </text>
      </g>
    );
  };

  const site = (x: number, title: string, sub: string, down: boolean, word: { w: string; c: string }) => (
    <>
      <rect x={x} y={ST} width={SW} height={SH} class={`node-box${down ? ' down' : ''}`} />
      <text class="d-title" x={x + 14} y={ST + 26} style={{ fontWeight: 600 }}>
        {title}
      </text>
      <text x={x + 14} y={ST + 44} class="muted d-sub">
        {sub}
      </text>
      <text x={x + 14 + DISK_DX} y={ROW_Y - 6} class="muted d-fine">
        Disk: the data the apps wrote
      </text>
      <text x={x + 14} y={ST + SH - 12} class={`${`dr-st ${word.c}`} d-label`} style={{ fontWeight: 600 }}>
        {word.w}
      </text>
    </>
  );

  // recovery plan stages tick off as each VM is running at Site B
  const running = (i: number) => t >= s.boot[i] + 0.5;
  const planState = s.live ? (t >= s.go ? 'VMs move live' : 'waiting') : t < s.go ? 'waiting' : s.decision === 'witness' ? 'started by the Witness' : 'run by an admin';
  const planOn = t >= s.go;
  const CX = BX + 14;
  const CW = SW - 28;
  const CY = ST + 170;

  // RPO timeline: recovery points taken so far, the failure, and the gap between them
  const tmax = s.fail + 2.2;
  const tx = (u: number) => TL_X0 + (u / tmax) * (TL_X1 - TL_X0);
  const taken = s.ships.filter((p) => !p.final && p.t <= t);
  const arrived = taken.filter((p) => !p.lost && p.land <= t);
  const last = arrived.length ? arrived[arrived.length - 1].t : 0;
  const failed = t >= s.fail;
  const gapEnd = Math.min(t, s.fail);
  const hasGap = s.tier !== 'metro' && unplanned && gapEnd > last;
  const finalTick = s.ships.find((p) => p.final && p.t <= t);
  const failX = tx(s.fail);
  const riskWord = s.tier === 'metro' ? 'Data at risk: none' : unplanned ? 'Data at risk' : 'Data at risk: none';

  const appX = AX + 14 + VMW;

  return (
    <svg
      class="diagram dr-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Two sites, each with three VMs: db01, app01 and web01. A protection policy sets how Site A replicates to Site B (${tierWord}). The recovery plan at Site B starts the VMs in stages: 1 Database, 2 App, 3 Web. ${s.event === 'planned' ? 'A planned failover moves the apps to Site B with no data lost.' : `Site A is lost; ${s.lost ? `${s.lost} recent writes are lost and` : 'nothing is lost and'} the apps start at Site B.`}`}
    >
      <defs>
        <marker id="dr-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" class={aLost ? 'dr-mk bad' : s.tier === 'metro' ? 'dr-mk ok' : 'dr-mk flow'} />
        </marker>
      </defs>

      {/* protection policy: above the link; decides what is replicated and how much can be lost */}
      <g>
        <rect x={AX + SW + 8} y={ST + 4} width={BX - AX - SW - 16} height={92} rx={3} class="dr-card" />
        <text x={AX + SW + 20} y={ST + 24} class="d-sub" style={{ fontWeight: 600 }}>
          Protection policy
        </text>
        <text x={AX + SW + 20} y={ST + 44} class="d-fine muted">
          Schedule: {POLICY[s.tier][0]}
        </text>
        <text x={AX + SW + 20} y={ST + 60} class="d-fine muted">
          RPO: {POLICY[s.tier][1]}
        </text>
        <text x={AX + SW + 20} y={ST + 76} class="d-fine muted">
          Retention: you set it
        </text>
      </g>

      {/* link */}
      <path d={`M${LINK_A} ${LINK_Y} H${LINK_B}`} class={`dr-link ${linkCls}`} marker-end="url(#dr-ar)" />
      <text x={MID} y={LINK_Y - 30} text-anchor="middle" class={`${aLost ? 'bad-fill' : ''} d-label`} style={{ fontWeight: 600 }}>
        {linkLabel[0]}
      </text>
      <text x={MID} y={LINK_Y - 14} text-anchor="middle" class="muted d-fine">
        {linkLabel[1]}
      </text>

      {/* who decides */}
      {s.tier === 'metro' && (
        <g>
          <path d={`M${MID - 66} ${ST + 214} H${AX + SW}`} class="dr-wline" />
          <path d={`M${MID + 66} ${ST + 214} H${BX}`} class="dr-wline" />
          <rect x={MID - 66} y={ST + 190} width={132} height={44} class={`dr-witness${deciding ? ' on' : ''}`} />
          <text class="d-label" x={MID} y={ST + 208} text-anchor="middle" style={{ fontWeight: 600 }}>
            Witness
          </text>
          <text x={MID} y={ST + 225} text-anchor="middle" class={`${deciding ? 'dr-st warn' : 'muted'} d-fine`}>
            {deciding ? 'Site A is gone: fail over' : 'in a third location'}
          </text>
        </g>
      )}
      {s.decision === 'person' && deciding && (
        <g>
          <circle cx={MID} cy={ST + 192} r={7} class="dr-person" />
          <path d={`M${MID - 12} ${ST + 216} a12 12 0 0 1 24 0 z`} class="dr-person" />
          <text x={MID} y={ST + 236} text-anchor="middle" class="dr-st warn d-fine" style={{ fontWeight: 600 }}>
            someone declares a disaster
          </text>
        </g>
      )}

      {/* Site A */}
      <g class={aLost ? 'dr-dim' : ''}>
        {site(AX, 'Site A', 'runs the apps', aLost, aWord)}
        {VMS.map((_, i) => {
          if (s.live) {
            const b = s.boot[i];
            return vm(AX, i, t >= b + 0.5 ? 'off' : t >= b ? 'boot' : 'on', t >= b + 0.5 ? 'moved' : t >= b ? 'moving' : 'running');
          }
          return vm(AX, i, aLost ? 'lost' : aOff ? 'off' : aStopping ? 'stopping' : 'on', aLost ? 'down' : aOff ? 'off' : aStopping ? 'stopping' : 'running');
        })}
        <text x={AX + 14} y={ST + 190} class="muted d-fine">
          All three VMs are in the protection
        </text>
        <text x={AX + 14} y={ST + 206} class="muted d-fine">
          policy through a category.
        </text>
        {s.writes.map((w, i) => {
          const p = cell(AX, i);
          if (t < w.t) return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-slot" />;
          const cls = aLost && w.lost ? 'dr-cell lost' : t >= w.atB ? 'dr-cell both' : 'dr-cell here';
          const inShip = ship && ship.writes.includes(i);
          return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class={`${cls}${inShip ? ' snap' : ''}`} />;
        })}
      </g>

      {/* Site B */}
      {site(BX, 'Site B', 'recovery site', false, bWord)}
      {VMS.map((_, i) => {
        const b = s.boot[i];
        return vm(BX, i, t >= b + 0.5 ? 'on' : t >= b ? 'boot' : 'off', t >= b + 0.5 ? 'running' : t >= b ? (s.live ? 'arriving' : 'starting') : 'off');
      })}
      {s.writes.map((w, i) => {
        const p = cell(BX, i);
        if (t >= w.atB) return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-cell both" />;
        if (w.lost && t >= s.fail) return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-cell lost" />;
        return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-slot" />;
      })}

      {/* recovery plan: on the recovery site; decides how the apps start */}
      <g>
        <rect x={CX} y={CY} width={CW} height={68} rx={3} class={`dr-card${planOn ? ' on' : ''}`} />
        <text x={CX + 12} y={CY + 20} class="d-sub" style={{ fontWeight: 600 }}>
          Recovery plan
        </text>
        <text x={CX + CW - 12} y={CY + 20} text-anchor="end" class="d-fine muted">
          {planState}
        </text>
        <text x={CX + 12} y={CY + 38} class="d-fine muted">
          Stages in this recovery plan:
        </text>
        <text x={CX + CW - 12} y={CY + 38} text-anchor="end" class="d-fine muted">
          the admin sets the order
        </text>
        {STAGES.map((st, k) => (
          <text key={st} x={CX + 12 + k * 104} y={CY + 58} class={`d-fine${running(k) ? ' ok-fill' : ''}`} style={{ fontWeight: running(k) ? 600 : 400 }}>
            {running(k) ? '✓' : ''} {k + 1} {st}
          </text>
        ))}
      </g>

      {/* live migration: each app crosses while it keeps running */}
      {s.live &&
        VMS.map((n, i) => {
          const b = s.boot[i];
          if (t < b || t >= b + 0.5) return null;
          const cx = AX + SW + 40 + (BX - AX - SW - 80) * ease(prog(t, b, b + 0.5)); // stays in the gap between the sites
          return (
            <g key={`lm${i}`}>
              <rect x={cx - 34} y={LINK_Y - 11} width={68} height={22} class="dr-vm boot" />
              <text class="d-fine" x={cx} y={LINK_Y + 4} text-anchor="middle" style={{ fontWeight: 600 }}>
                {n}
              </text>
            </g>
          );
        })}

      {/* writes dropping from the VM onto its disk at Site A */}
      {s.writes.map((w, i) => {
        if (t < w.t - 0.3 || t >= w.t) return null;
        const p = cell(AX, i);
        const k = ease(prog(t, w.t - 0.3, w.t));
        const y0 = rowY(i % 3) + VMH / 2;
        return <circle key={`d${i}`} cx={appX + (p.x + CELL / 2 - appX) * k} cy={y0 + (p.y + CELL / 2 - y0) * k} r={4} class="dr-dot" />;
      })}
      {/* synchronous writes crossing the link */}
      {s.tier === 'metro' &&
        s.writes.map((w, i) => {
          if (t < w.t || t >= w.atB) return null;
          const k = prog(t, w.t, w.atB);
          return <circle key={`s${i}`} cx={LINK_A + (LINK_B - LINK_A) * k} cy={LINK_Y} r={5} class="dr-dot ok" />;
        })}
      {/* a recovery point on its way */}
      {ship &&
        (() => {
          const n = Math.min(ship.writes.length, 8);
          const bw = 12 + n * 9;
          const k = ease(prog(t, ship.t, ship.land));
          const cx = LINK_A + (LINK_B - LINK_A) * k;
          return (
            <g>
              <rect x={cx - bw / 2} y={LINK_Y - 11} width={bw} height={22} class="dr-ship" />
              {Array.from({ length: n }, (_, j) => (
                <rect key={j} x={cx - bw / 2 + 6 + j * 9} y={LINK_Y - 3.5} width={7} height={7} class="dr-cell here" />
              ))}
            </g>
          );
        })()}

      {/* RPO timeline: recovery points, the failure, and the data at risk between them */}
      <g>
        <text x={8} y={TL_Y - 40} class="d-label" style={{ fontWeight: 600 }}>
          RPO timeline
        </text>
        <text x={TL_X0} y={TL_Y - 40} class="muted d-fine">
          {s.tier === 'metro'
            ? 'Every write is copied to Site B as it happens, so there is no gap. Time is compressed.'
            : 'Each tick is a recovery point (a snapshot) taken on the policy’s schedule and copied to Site B. Time is compressed.'}
        </text>
        <text x={8} y={TL_Y + 4} class="d-sub muted">
          Recovery points
        </text>
        {hasGap && (
          <rect x={tx(last)} y={TL_Y - 14} width={Math.max(0, tx(gapEnd) - tx(last))} height={28} class="dr-gap" />
        )}
        <line x1={TL_X0} x2={TL_X1} y1={TL_Y} y2={TL_Y} class="dr-axis" />
        {s.tier === 'metro' && <line x1={TL_X0} x2={Math.min(tx(t), TL_X1)} y1={TL_Y} y2={TL_Y} class="dr-axis sync" />}
        {taken.map((p, k) => {
          const x = tx(p.t);
          const cls = p.lost && failed ? 'lost' : t >= p.land ? 'got' : 'wait';
          return <line key={k} x1={x} x2={x} y1={TL_Y - 12} y2={TL_Y + 12} class={`dr-tick ${cls}`} />;
        })}
        {finalTick && <line x1={tx(finalTick.t)} x2={tx(finalTick.t)} y1={TL_Y - 12} y2={TL_Y + 12} class={`dr-tick ${t >= finalTick.land ? 'got' : 'wait'}`} />}
        {failed && (
          <g>
            <line x1={failX} x2={failX} y1={TL_Y - 24} y2={TL_Y + 40} class="dr-fail" />
            <text x={failX + 8} y={TL_Y + 36} class="d-sub bad-fill" style={{ fontWeight: 600 }}>
              {unplanned ? '✕ Site A lost' : 'Failover starts'}
            </text>
            <text x={failX - 8} y={TL_Y + 36} text-anchor="end" class={`d-sub ${s.tier === 'metro' || !unplanned ? 'ok-fill' : 'warn-fill'}`} style={{ fontWeight: 600 }}>
              {s.tier === 'metro' || !unplanned ? '✓ ' : ''}
              {riskWord}
            </text>
          </g>
        )}
        {finalTick && !unplanned && s.tier !== 'metro' && (
          <text x={tx(finalTick.t) + 8} y={TL_Y - 18} class="d-fine muted">
            final copy
          </text>
        )}
      </g>
    </svg>
  );
}

export default function Dr() {
  const [tier, setTier] = useEnum<Tier>('rep', 'async', TIERS);
  const [event, setEvent] = useEnum<DrEvent>('ev', 'unplanned', EVENTS);
  const s = useMemo(() => buildScene(tier, event), [tier, event]);
  const steps = useMemo(
    () =>
      paced(
        s.phases.map((p) => p.t),
        s.phases.map((p) => [caption(s, p.id).k, caption(s, p.id).text]),
      ),
    [s],
  );
  const clock = useClock({ rate: 1, duration: s.end, keys: true, poster: s.done + 0.6, steps });
  useRestartOn(clock, [tier, event]);
  const t = clock.t;
  const ph = s.phases[phaseAt(s.phases.map((p) => p.t), t)].id;
  const cap = caption(s, ph);

  const none = event === 'planned' || tier === 'metro';
  const rpo = none
    ? { v: 'None', sub: event === 'planned' && tier !== 'metro' ? 'the last changes are copied first' : 'RPO 0' }
    : tier === 'async'
      ? { v: 'Hours', sub: 'RPO 1 hour or more' }
      : { v: 'Minutes', sub: 'NearSync 1 to 15 min · Sync none' };
  const rto = s.live
    ? { v: 'No downtime', sub: 'live migration' }
    : { v: 'Minutes', sub: event === 'planned' ? 'a move you schedule' : s.decision === 'witness' ? 'restarts on its own' : 'after someone declares a disaster' };

  return (
    <Show clock={clock}
      top={
        <>
          <Choice<Tier>
            label="Replication"
            value={tier}
            onChange={setTier}
            options={[
              { value: 'async', label: 'Async' },
              { value: 'nearsync', label: 'NearSync / Sync' },
              { value: 'metro', label: 'Metro Availability' },
            ]}
          />
          <Choice<DrEvent>
            label="What happens"
            value={event}
            onChange={setEvent}
            options={[
              { value: 'planned', label: 'Planned failover' },
              { value: 'unplanned', label: 'Unplanned (site lost)' },
            ]}
          />
        </>
      }
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Data you could lose', v: rpo.v, sub: rpo.sub, tone: none ? 'ok' : 'warn', tip: 'The recovery point objective (RPO): how much recent data a failover can lose. The protection policy sets it as a target; link bandwidth and change rate decide whether it is met.' },
              { k: 'Running again in', v: rto.v, sub: rto.sub, tone: s.live ? 'ok' : undefined, tip: 'The recovery time objective (RTO): how long until the apps are back. Mostly the recovery plan starting the apps in order, plus the time to decide in a real disaster. With Metro Availability a planned move can live-migrate the apps instead.' },
              { k: 'Each write waits for', v: tier === 'metro' ? 'Both sites' : 'Site A only', sub: tier === 'metro' ? 'sites under 5 ms round trip' : tier === 'nearsync' ? 'Sync: both sites, under 5 ms' : 'copies follow in the background' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Sites s={s} t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'At both sites' },
          ...(tier === 'metro' ? [] : [{ color: 'var(--warn)', label: 'Only at Site A so far' }, { color: 'var(--flow)', label: 'Recovery point on its way' }]),
          ...(s.lost ? [{ color: 'var(--bad)', label: 'Lost with Site A', dashed: true }] : []),
        ]}
      />
      <PlayBar
        clock={clock}
        label="Disaster recovery animation"
        extra={<Illus why="Time is compressed: an hour between async copies is drawn as a few seconds. The RPO ranges, the 5 ms round-trip limit for synchronous replication and the Witness for automatic failover follow Nutanix sources. RPOs are targets, not guarantees. Metro Availability is shown as on AHV, set up in Prism Central: unplanned failover restarts the VMs, and a planned move can live-migrate them. On ESXi, Metro stretches a storage container and vSphere HA restarts the VMs. Site layout and boot timing are simplified." />}
      />
    </Show>
  );
}
