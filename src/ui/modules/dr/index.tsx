// Disaster Recovery: pick a replication tier and a planned or unplanned failover, and watch
// two sites on a loop: the app writes at Site A, copies reach Site B, then the apps move to
// Site B. The scene (what is copied when, what is lost) comes from src/engine/dr.ts.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { STAGES, buildScene, type DrEvent, type DrPhase, type DrScene, type Tier } from '../../../engine/dr';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const TIERS: readonly Tier[] = ['async', 'nearsync', 'sync'];
const EVENTS: readonly DrEvent[] = ['planned', 'unplanned'];

// ── geometry ──
const W = 960;
const H = 262;
const SW = 380; // site width
const ST = 10; // site top
const SH = 240; // site height
const AX = 8;
const BX = W - 8 - SW;
const VMW = 110;
const CELL = 28;
const PITCH = 33;
const COLS = 10;
const GRID_Y = ST + 132;
const LINK_Y = ST + 162;
const MID = W / 2;
const gridX = (site: number) => site + 14;
const slot = (site: number, i: number) => ({ x: gridX(site) + (i % COLS) * PITCH, y: GRID_Y + Math.floor(i / COLS) * PITCH });
const LINK_A = gridX(AX) + COLS * PITCH - 5;
const LINK_B = gridX(BX);

const LINK_WORDS: Record<Tier, [string, string]> = {
  async: ['Async', 'a copy every 1 to 24 h'],
  nearsync: ['NearSync', 'a copy every 1 to 15 min'],
  sync: ['Sync', 'every write, both sites'],
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function caption(s: DrScene, ph: DrPhase): { tone: Tone | 'ink'; k: string; text: string } {
  switch (ph) {
    case 'replicate':
      return {
        tone: 'ink',
        k: 'Replicating',
        text:
          s.tier === 'async'
            ? 'The apps write at Site A. On a schedule (async policies run every 1 to 24 hours) a recovery point is taken and copied to Site B. Anything written since the last copy exists only at Site A.'
            : s.tier === 'nearsync'
              ? 'The apps write at Site A. Every 1 to 15 minutes a small recovery point is copied to Site B, so only the last few minutes exist only at Site A.'
              : 'Every write is stored at both sites before the app is told it is done, so Site B is never behind. The sites must be under 5 ms apart, and each write waits about one round trip.',
      };
    case 'shutdown':
      return { tone: 'warn', k: 'Planned move', text: 'The apps at Site A shut down cleanly, so nothing new is written while they move.' };
    case 'final':
      return s.tier === 'sync'
        ? { tone: 'flow', k: 'Final copy', text: 'Nothing is left to copy: with synchronous replication every write is already at Site B.' }
        : { tone: 'flow', k: 'Final copy', text: 'The changes made since the last recovery point are copied to Site B, so nothing is left behind.' };
    case 'lost':
      return {
        tone: 'bad',
        k: 'Site A is lost',
        text: s.lost
          ? `Power, network or the whole building is gone. ${plural(s.lost, 'recent write', 'recent writes')} had not reached Site B yet and ${s.lost === 1 ? 'is' : 'are'} lost with it.`
          : 'Power, network or the whole building is gone. Every write the apps were told was done is already at Site B, so nothing is lost.',
      };
    case 'decide':
      return s.decision === 'witness'
        ? { tone: 'warn', k: 'The Witness decides', text: 'The Witness, in a third location, can tell a lost site from a broken link, so Site B takes over on its own.' }
        : { tone: 'warn', k: 'A person decides', text: 'Someone confirms the outage and starts the recovery plan. Without a Witness and synchronous replication, a person makes this call.' };
    case 'boot':
      return { tone: 'flow', k: 'Starting at Site B', text: 'The recovery plan starts the apps at Site B in order: database first, then the app, then the web tier.' };
    default:
      return s.event === 'planned'
        ? { tone: 'ok', k: 'Running at Site B', text: 'Running at Site B with no data lost. Site A is still healthy, so the apps can move back later the same way.' }
        : s.lost
          ? { tone: 'warn', k: 'Running at Site B', text: `Running at Site B from the last recovery point that arrived. The ${plural(s.lost, 'write', 'writes')} made after it ${s.lost === 1 ? 'is' : 'are'} gone.` }
          : { tone: 'ok', k: 'Running at Site B', text: 'Running at Site B with no data lost.' };
  }
}

function Sites({ s, t }: { s: DrScene; t: number }) {
  const unplanned = s.event === 'unplanned';
  const aLost = unplanned && t >= s.fail;
  const aOff = !unplanned && t >= s.fail + 1;
  const aStopping = !unplanned && t >= s.fail && !aOff;
  const decideAt = s.phases.find((p) => p.id === 'decide')?.t ?? Infinity;
  const deciding = t >= decideAt && t < s.go;
  const [tierWord, cadence] = LINK_WORDS[s.tier];
  const ship = s.ships.find((p) => t >= p.t && t < p.land && !(p.lost && t >= s.fail));

  const aWord = aLost ? { w: '✕ site lost', c: 'bad' } : aOff ? { w: 'apps off · site still healthy', c: 'muted' } : aStopping ? { w: 'shutting the apps down', c: 'warn' } : { w: '✓ apps running', c: 'ok' };
  const bWord = t >= s.done ? { w: '✓ apps running here', c: 'ok' } : t >= s.go ? { w: 'starting the apps in order', c: 'flow' } : aLost ? { w: 'waiting for the go', c: 'warn' } : { w: 'standby · receiving copies', c: 'flow' };

  const linkLabel = aLost ? ['Link lost', 'no more copies'] : t >= s.fail + 1 && t < s.go && !unplanned ? ['Final copy', s.tier === 'sync' ? 'already there' : 'last changes'] : [tierWord, cadence];
  const linkCls = aLost ? 'bad broken' : s.tier === 'sync' ? 'ok' : 'flow';

  const vm = (site: number, i: number, cls: string, word: string) => {
    const x = site + 14 + i * (VMW + 10);
    const y = ST + 60;
    return (
      <g key={`${site}-${i}`}>
        <rect x={x} y={y} width={VMW} height={36} class={`dr-vm ${cls}`} />
        <text x={x + 10} y={y + 15} style={{ fontSize: '13px', fontWeight: 600 }}>
          {STAGES[i]}
        </text>
        <text x={x + 10} y={y + 29} class={`dr-st ${cls}`} style={{ fontSize: '10.5px' }}>
          {word}
        </text>
      </g>
    );
  };

  const site = (x: number, title: string, sub: string, down: boolean, word: { w: string; c: string }) => (
    <>
      <rect x={x} y={ST} width={SW} height={SH} class={`node-box${down ? ' down' : ''}`} />
      <text x={x + 14} y={ST + 26} style={{ fontSize: '16px', fontWeight: 600 }}>
        {title}
      </text>
      <text x={x + 14} y={ST + 44} class="muted" style={{ fontSize: '12px' }}>
        {sub}
      </text>
      <text x={x + 14} y={GRID_Y - 10} class="muted" style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}>
        DATA THE APPS WROTE
      </text>
      <text x={x + 14} y={ST + SH - 12} class={`dr-st ${word.c}`} style={{ fontSize: '12.5px', fontWeight: 600 }}>
        {word.w}
      </text>
    </>
  );

  const appX = AX + 14 + VMW + 10 + VMW / 2;

  return (
    <svg
      class="diagram dr-svg"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Two sites. Site A runs the apps and replicates to Site B with ${tierWord} replication. ${s.event === 'planned' ? 'A planned failover moves the apps to Site B with no data lost.' : `Site A is lost; ${s.lost ? `${s.lost} recent writes are lost and` : 'nothing is lost and'} the apps start at Site B.`}`}
    >
      <defs>
        <marker id="dr-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" class={aLost ? 'dr-mk bad' : s.tier === 'sync' ? 'dr-mk ok' : 'dr-mk flow'} />
        </marker>
      </defs>

      {/* link */}
      <path d={`M${LINK_A + 6} ${LINK_Y} H${LINK_B - 8}`} class={`dr-link ${linkCls}`} marker-end="url(#dr-ar)" />
      <text x={MID} y={LINK_Y - 42} text-anchor="middle" class={aLost ? 'bad-fill' : ''} style={{ fontSize: '15px', fontWeight: 600 }}>
        {linkLabel[0]}
      </text>
      <text x={MID} y={LINK_Y - 24} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
        {linkLabel[1]}
      </text>

      {/* who decides */}
      {s.tier === 'sync' && (
        <g>
          <path d={`M${MID - 70} ${ST + 206} H${AX + SW}`} class="dr-wline" />
          <path d={`M${MID + 70} ${ST + 206} H${BX}`} class="dr-wline" />
          <rect x={MID - 70} y={ST + 186} width={140} height={40} class={`dr-witness${deciding ? ' on' : ''}`} />
          <text x={MID} y={ST + 202} text-anchor="middle" style={{ fontSize: '13px', fontWeight: 600 }}>
            Witness
          </text>
          <text x={MID} y={ST + 218} text-anchor="middle" class={deciding ? 'dr-st warn' : 'muted'} style={{ fontSize: '10.5px' }}>
            {deciding ? 'Site A is gone: fail over' : 'in a third location'}
          </text>
        </g>
      )}
      {s.decision === 'person' && deciding && (
        <g>
          <circle cx={MID} cy={ST + 194} r={7} class="dr-person" />
          <path d={`M${MID - 12} ${ST + 218} a12 12 0 0 1 24 0 z`} class="dr-person" />
          <text x={MID} y={ST + 236} text-anchor="middle" class="dr-st warn" style={{ fontSize: '11px', fontWeight: 600 }}>
            someone declares a disaster
          </text>
        </g>
      )}

      {/* Site A */}
      <g class={aLost ? 'dr-dim' : ''}>
        {site(AX, 'Site A', 'runs the apps', aLost, aWord)}
        {STAGES.map((_, i) => vm(AX, i, aLost ? 'lost' : aOff ? 'off' : aStopping ? 'stopping' : 'on', aLost ? 'down' : aOff ? 'off' : aStopping ? 'stopping' : 'running'))}
        {s.writes.map((w, i) => {
          const p = slot(AX, i);
          if (t < w.t) return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-slot" />;
          const cls = aLost && w.lost ? 'dr-cell lost' : t >= w.atB ? 'dr-cell both' : 'dr-cell here';
          const inShip = ship && ship.writes.includes(i);
          return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class={`${cls}${inShip ? ' snap' : ''}`} />;
        })}
      </g>

      {/* Site B */}
      {site(BX, 'Site B', 'recovery site', false, bWord)}
      {STAGES.map((_, i) => {
        const b = s.boot[i];
        return vm(BX, i, t >= b + 0.5 ? 'on' : t >= b ? 'boot' : 'off', t >= b + 0.5 ? 'running' : t >= b ? 'starting' : 'off');
      })}
      {s.writes.map((w, i) => {
        const p = slot(BX, i);
        if (t >= w.atB) return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-cell both" />;
        if (w.lost && t >= s.fail) return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-cell lost" />;
        return <rect key={i} x={p.x} y={p.y} width={CELL} height={CELL} class="dr-slot" />;
      })}

      {/* writes dropping from the app into Site A */}
      {s.writes.map((w, i) => {
        if (t < w.t - 0.3 || t >= w.t) return null;
        const p = slot(AX, i);
        const k = ease(prog(t, w.t - 0.3, w.t));
        return <circle key={`d${i}`} cx={appX + (p.x + CELL / 2 - appX) * k} cy={ST + 96 + (p.y + CELL / 2 - ST - 96) * k} r={4.5} class="dr-dot" />;
      })}
      {/* synchronous writes crossing the link */}
      {s.tier === 'sync' &&
        s.writes.map((w, i) => {
          if (t < w.t || t >= w.atB) return null;
          const k = prog(t, w.t, w.atB);
          return <circle key={`s${i}`} cx={LINK_A + (LINK_B - LINK_A) * k} cy={LINK_Y} r={5} class="dr-dot ok" />;
        })}
      {/* a recovery point on its way */}
      {ship &&
        (() => {
          const n = ship.writes.length;
          const bw = 12 + n * 9;
          const k = ease(prog(t, ship.t, ship.land));
          const cx = LINK_A + (LINK_B - LINK_A) * k;
          return (
            <g>
              <rect x={cx - bw / 2} y={LINK_Y - 11} width={bw} height={22} class="dr-ship" />
              {ship.writes.map((_, j) => (
                <rect key={j} x={cx - bw / 2 + 6 + j * 9} y={LINK_Y - 3.5} width={7} height={7} class="dr-cell here" />
              ))}
            </g>
          );
        })()}
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

  const none = event === 'planned' || tier === 'sync';
  const rpo = none
    ? { v: 'None', sub: event === 'planned' ? 'the last changes are copied first' : 'RPO zero' }
    : tier === 'async'
      ? { v: 'Hours', sub: 'RPO target 1 to 24 hours' }
      : { v: 'Minutes', sub: 'RPO target 1 to 15 minutes' };
  const rto = event === 'planned' ? 'a move you schedule' : s.decision === 'witness' ? 'starts on its own' : 'after someone declares a disaster';

  return (
    <Show
      top={
        <>
          <Choice<Tier>
            label="Replication"
            value={tier}
            onChange={setTier}
            options={[
              { value: 'async', label: 'Async' },
              { value: 'nearsync', label: 'NearSync' },
              { value: 'sync', label: 'Sync' },
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
              { k: 'Running again in', v: 'Minutes', sub: rto, tip: 'The recovery time objective (RTO): how long until the apps are back. Mostly the recovery plan starting the apps in order, plus the time to decide in a real disaster.' },
              { k: 'Each write waits for', v: tier === 'sync' ? 'Both sites' : 'Site A only', sub: tier === 'sync' ? 'sites under 5 ms apart' : 'copies follow in the background' },
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
          { color: 'var(--warn)', label: 'Only at Site A so far' },
          { color: 'var(--bad)', label: 'Lost with Site A', dashed: true },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Disaster recovery animation"
        fmt={() => cap.k}
        extra={<Illus why="Time is compressed: an hour between async copies is drawn as a few seconds. The RPO ranges, the 5 ms limit for synchronous replication and the Witness for automatic failover follow Nutanix documentation. RPOs are targets, not guarantees, and automatic failover needs a supported synchronous setup with a Witness. Site layout and boot timing are simplified." />}
      />
    </Show>
  );
}
