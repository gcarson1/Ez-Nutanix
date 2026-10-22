// Flow Network Security: a small three-tier app with app traffic flowing on a loop, while
// unwanted connections are tried one after another. Pick the policy state (Off, Monitor,
// Enforce) and whether Web-2 is quarantined; every verdict comes from src/engine/flow.ts.
import { useMemo } from 'preact/hooks';
import { useBool, useEnum } from '../../../state/route';
import { evaluate, setQuarantine, type FlowVm, type Packet, type Policies, type Verdict } from '../../../engine/flow';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';

type Mode = 'off' | 'monitor' | 'enforce';
type Pt = { x: number; y: number };
type Curve = [Pt, Pt, Pt];

const prod = (tier: string) => ({ AppType: 'HR', AppTier: tier, Environment: 'Production' });
const VMS: FlowVm[] = [
  { id: 'web1', name: 'Web-1', cats: prod('Web'), host: 'h1', ip: '10.10.1.11' },
  { id: 'web2', name: 'Web-2', cats: prod('Web'), host: 'h2', ip: '10.10.1.12' },
  { id: 'app', name: 'App', cats: prod('App'), host: 'h2', ip: '10.10.2.21' },
  { id: 'db', name: 'Database', cats: prod('DB'), host: 'h3', ip: '10.10.3.31' },
  { id: 'dev', name: 'Dev web', cats: { AppType: 'HR', AppTier: 'Web', Environment: 'Dev' }, host: 'h1', ip: '10.20.1.11' },
];

// ── geometry (viewBox units) ──
const W = 960;
const H = 396;
const VM_W = 196;
const VM_H = 56;
const BOX: Record<string, { x: number; y: number; w: number }> = {
  external: { x: 16, y: 130, w: 124 },
  web1: { x: 196, y: 66, w: VM_W },
  web2: { x: 196, y: 194, w: VM_W },
  app: { x: 470, y: 130, w: VM_W },
  db: { x: 724, y: 130, w: VM_W },
  dev: { x: 470, y: 316, w: VM_W },
};
const left = (id: string): Pt => ({ x: BOX[id].x, y: BOX[id].y + VM_H / 2 });
const right = (id: string, dy = 0): Pt => ({ x: BOX[id].x + BOX[id].w, y: BOX[id].y + VM_H / 2 + dy });
const straight = (a: Pt, b: Pt): Curve => [a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, b];

function at(c: Curve, s: number): Pt {
  const u = 1 - s;
  return { x: u * u * c[0].x + 2 * u * s * c[1].x + s * s * c[2].x, y: u * u * c[0].y + 2 * u * s * c[1].y + s * s * c[2].y };
}
/** Curve position `d` units in from its start (or from its end): where a policy stops a packet. */
function inset(c: Curve, d: number, fromEnd: boolean): number {
  const end = fromEnd ? c[2] : c[0];
  for (let i = 1; i <= 80; i++) {
    const s = fromEnd ? 1 - i / 80 : i / 80;
    const p = at(c, s);
    if (Math.hypot(p.x - end.x, p.y - end.y) >= d) return s;
  }
  return fromEnd ? 0 : 1;
}
const pathD = (c: Curve) => `M${c[0].x} ${c[0].y} Q${c[1].x} ${c[1].y} ${c[2].x} ${c[2].y}`;

interface Lane extends Packet {
  id: string;
  c: Curve;
}

/** The app's own traffic: the only paths the policy allows. */
const APP_LANES: (Lane & { off: number })[] = [
  { id: 'u1', src: 'external', dst: 'web1', port: 443, off: 0, c: straight(right('external'), left('web1')) },
  { id: 'u2', src: 'external', dst: 'web2', port: 443, off: 1, c: straight(right('external'), left('web2')) },
  { id: 'wa1', src: 'web1', dst: 'app', port: 8080, off: 0.6, c: straight(right('web1'), left('app')) },
  { id: 'wa2', src: 'web2', dst: 'app', port: 8080, off: 1.6, c: straight(right('web2'), left('app')) },
  { id: 'ad', src: 'app', dst: 'db', port: 5432, off: 1.2, c: straight(right('app'), left('db')) },
];

/** Unwanted connections, tried one per phase. Labels sit next to where the packet ends up. */
const TRIES: (Lane & { what: string; word: string; lblStart: Pt; lblEnd: Pt; lblLeft?: boolean })[] = [
  {
    id: 'x1',
    src: 'web2',
    dst: 'db',
    port: 5432,
    word: 'Web → database',
    what: 'Web-2 tries to reach the database directly, skipping the app tier.',
    c: [right('web2', 14), { x: 620, y: 300 }, { x: 822, y: 186 }],
    lblStart: { x: 420, y: 230 },
    lblEnd: { x: 838, y: 214 },
  },
  {
    id: 'x2',
    src: 'web2',
    dst: 'web1',
    port: 22,
    word: 'Web → web',
    what: 'Web-2 tries to open a remote shell on Web-1, though web servers never need to talk to each other.',
    c: straight({ x: 330, y: 194 }, { x: 330, y: 122 }),
    lblStart: { x: 314, y: 186 },
    lblEnd: { x: 314, y: 158 },
    lblLeft: true,
  },
  {
    id: 'x3',
    src: 'dev',
    dst: 'db',
    port: 5432,
    word: 'Dev → production',
    what: 'A Dev VM tries to reach the production database.',
    c: [right('dev'), { x: 800, y: 340 }, { x: 822, y: 186 }],
    lblStart: { x: 674, y: 380 },
    lblEnd: { x: 838, y: 214 },
  },
];

const PHASE = 4;
const LOOP = PHASE * (TRIES.length + 1);
const APP_EVERY = 2;
const APP_FLIGHT = 1.1;
const TRY_FLIGHT = 1.3;
const TRY_AT = [0.3, 2];
const STOP_GAP = 14;

function policies(mode: Mode, quarantined: boolean): Policies {
  const q = { vms: {}, forensicFrom: { AppType: 'Forensics' } };
  return {
    apps: [
      {
        id: 'hr',
        type: 'app',
        name: 'HR app',
        mode: mode === 'enforce' ? 'enforce' : 'monitor',
        enabled: mode !== 'off',
        target: { AppType: 'HR', Environment: 'Production' },
        intraTier: false,
        rules: [
          { id: 'r1', from: 'any', toTier: 'Web', port: 443 },
          { id: 'r2', from: prod('Web'), toTier: 'App', port: 8080 },
          { id: 'r3', from: prod('App'), toTier: 'DB', port: 5432 },
        ],
      },
    ],
    isolations: [{ id: 'iso', type: 'isolation', name: 'Production / Dev', mode: mode === 'enforce' ? 'enforce' : 'monitor', enabled: mode !== 'off', a: { Environment: 'Production' }, b: { Environment: 'Dev' } }],
    quarantine: quarantined ? setQuarantine(q, 'web2', 'strict') : q,
  };
}

const flagged = (v: Verdict) => v.hits.find((h) => h.action !== 'allow');
const nameOf = (id: string) => VMS.find((v) => v.id === id)?.name ?? id;

/** What happened to one unwanted try, in words. */
function outcome(v: Verdict, dst: string): { tone: Tone; k: string; text: string; lbl: string } {
  const hit = flagged(v);
  if (!v.allowed) {
    const text =
      hit?.kind === 'quarantine'
        ? `${nameOf(v.atVm)} is quarantined, so it is stopped right there.`
        : hit?.kind === 'isolation'
          ? 'Production and Dev are walled off, so it is stopped as it leaves the Dev VM.'
          : `No rule allows it, so it is stopped at the ${nameOf(dst).toLowerCase()}'s network connection.`;
    return { tone: 'ok', k: 'Stopped', text, lbl: 'Stopped' };
  }
  if (v.wouldDrop)
    return { tone: 'warn', k: 'Logged, not stopped', text: `${hit?.kind === 'isolation' ? 'The Production and Dev wall' : 'No rule allows it, so the policy'} flags it in the log, but Monitor lets it through.`, lbl: 'Logged only' };
  return { tone: 'bad', k: 'Got through', text: 'No policy is applied, so nothing stops it.', lbl: 'Got through' };
}

interface Shot {
  key: string;
  c: Curve;
  t0: number;
  flight: number;
  until: number;
  v: Verdict;
  src: string;
  unwanted: boolean;
}

function useShots(pol: Policies) {
  return useMemo(() => {
    const shots: Shot[] = [];
    for (const l of APP_LANES) {
      const v = evaluate(l, VMS, pol);
      for (let t0 = l.off; t0 < LOOP; t0 += APP_EVERY) shots.push({ key: `${l.id}${t0}`, c: l.c, t0, flight: APP_FLIGHT, until: t0 + APP_FLIGHT + 0.4, v, src: l.src, unwanted: false });
    }
    const verdicts = TRIES.map((x) => evaluate(x, VMS, pol));
    TRIES.forEach((x, i) => {
      const p0 = PHASE * (i + 1);
      for (const a of TRY_AT) shots.push({ key: `${x.id}${a}`, c: x.c, t0: p0 + a, flight: TRY_FLIGHT, until: p0 + PHASE, v: verdicts[i], src: x.src, unwanted: true });
    });
    return { shots, verdicts };
  }, [pol]);
}

/** How far along its path a packet gets (1 = all the way), and how long it takes to get there. */
function reach(c: Curve, v: Verdict, src: string, flight: number) {
  const stopAt = v.allowed ? 1 : inset(c, STOP_GAP, v.atVm !== src);
  return { stopAt, dur: flight * Math.max(0.2, stopAt) };
}

function Packets({ shots, t }: { shots: Shot[]; t: number }) {
  return (
    <g aria-hidden="true">
      {shots.map((s) => {
        if (t < s.t0 || t >= s.until) return null;
        const { stopAt, dur } = reach(s.c, s.v, s.src, s.flight);
        const p = at(s.c, ease(prog(t, s.t0, s.t0 + dur)) * stopAt);
        const arrived = t >= s.t0 + dur;
        const fade = s.unwanted ? 1 : 1 - prog(t, s.until - 0.4, s.until);
        return (
          <g key={s.key} style={{ opacity: fade }}>
            <circle cx={p.x} cy={p.y} r={6} class={`fl-dot ${s.unwanted ? 'bad' : 'app'}`} />
            {arrived && !s.v.allowed && (
              <g class="fl-stop">
                <circle cx={p.x} cy={p.y} r={s.unwanted ? 11 : 8} />
                <path d={`M${p.x - 4} ${p.y - 4} L${p.x + 4} ${p.y + 4} M${p.x + 4} ${p.y - 4} L${p.x - 4} ${p.y + 4}`} />
              </g>
            )}
            {arrived && s.unwanted && s.v.wouldDrop && <circle class="fl-logged" cx={p.x} cy={p.y} r={11} />}
          </g>
        );
      })}
    </g>
  );
}

function VmBox({ id, mode, quar }: { id: string; mode: Mode; quar: boolean }) {
  const b = BOX[id];
  const vm = VMS.find((v) => v.id === id)!;
  return (
    <g>
      {(mode !== 'off' || quar) && <rect class={`fl-guard ${quar ? 'quar' : mode}`} x={b.x - 5} y={b.y - 5} width={b.w + 10} height={VM_H + 10} />}
      <rect class={`fl-vm${quar ? ' quar' : ''}`} x={b.x} y={b.y} width={b.w} height={VM_H} />
      <text x={b.x + 12} y={b.y + 23} style={{ fontSize: '14px', fontWeight: 600 }}>
        {vm.name}
      </text>
      <text x={b.x + 12} y={b.y + 43} class="mono muted" style={{ fontSize: '11.5px' }}>
        AppTier: {vm.cats.AppTier}
      </text>
      {quar && (
        <text x={b.x + b.w - 10} y={b.y + 23} text-anchor="end" class="bad-fill" style={{ fontSize: '12px', fontWeight: 600 }}>
          Quarantined
        </text>
      )}
    </g>
  );
}

const MODE_WORD: Record<Mode, string> = { off: 'No policy applied', monitor: 'Policy: Monitor (log only)', enforce: 'Policy: Enforce' };

export function NetSec() {
  const [mode, setMode] = useEnum<Mode>('pm', 'enforce', ['off', 'monitor', 'enforce']);
  const [quar, setQuar] = useBool('q', false);
  const pol = useMemo(() => policies(mode, quar), [mode, quar]);
  const { shots, verdicts } = useShots(pol);
  const starts = TRIES.map((_, i) => PHASE * i).concat(PHASE * TRIES.length);
  const captionAt = (p: number) => {
    const res = p > 0 ? outcome(verdicts[p - 1], TRIES[p - 1].dst) : null;
    return res
      ? { tone: res.tone, k: `${TRIES[p - 1].word} · ${res.k}`, text: `${TRIES[p - 1].what} ${res.text}` }
      : {
          tone: 'flow' as const,
          k: 'App traffic',
          text: `Users reach the web servers, web talks to app, and app talks to the database. ${
            quar
              ? 'Web-2 is quarantined, so nothing gets in or out of it; Web-1 keeps the app running.'
              : mode === 'off'
                ? 'No policy is applied, so any VM could also reach any other.'
                : mode === 'monitor'
                  ? 'These are the only paths the policy allows; in Monitor it logs anything else but blocks nothing.'
                  : 'These are the only paths the policy allows; anything else is denied by default.'
          }`,
        };
  };
  const steps = paced(
    starts,
    starts.map((_, p) => [captionAt(p).k, captionAt(p).text]),
  );
  const clock = useClock({ rate: 1, duration: LOOP, keys: true, poster: PHASE + TRY_AT[0] + TRY_FLIGHT + 0.6, steps });
  useRestartOn(clock, [mode, quar]);
  const t = clock.t;
  const phase = phaseAt(starts, t);
  const tryNow = phase > 0 ? TRIES[phase - 1] : null;
  const vNow = phase > 0 ? verdicts[phase - 1] : null;
  const res = tryNow && vNow ? outcome(vNow, tryNow.dst) : null;
  const shownAt = tryNow && vNow ? PHASE * phase + TRY_AT[0] + reach(tryNow.c, vNow, tryNow.src, TRY_FLIGHT).dur : Infinity;

  const stopped = verdicts.filter((v) => !v.allowed).length;
  const logged = verdicts.filter((v) => flagged(v)).length;
  const caption = captionAt(phase);
  const lbl =
    tryNow && vNow && res && t >= shownAt
      ? { at: !vNow.allowed && vNow.atVm === tryNow.src ? tryNow.lblStart : tryNow.lblEnd, cls: res.tone === 'ok' ? 'ok-fill' : res.tone === 'warn' ? 'warn-fill' : 'bad-fill', text: res.lbl, end: tryNow.lblLeft }
      : null;

  return (
    <Show
      top={
        <>
          <Choice<Mode>
            label="Policy"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'monitor', label: 'Monitor' },
              { value: 'enforce', label: 'Enforce' },
            ]}
          />
          <Choice<'off' | 'on'>
            label="Quarantine Web-2"
            value={quar ? 'on' : 'off'}
            onChange={(v) => setQuar(v === 'on')}
            options={[
              { value: 'off', label: 'Off' },
              { value: 'on', label: 'On' },
            ]}
          />
        </>
      }
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Unwanted tries stopped', v: `${stopped} of ${TRIES.length}`, tone: stopped === TRIES.length ? 'ok' : stopped === 0 ? 'bad' : 'warn' },
              { k: 'Flagged in the log', v: `${logged} of ${TRIES.length}`, tip: 'Every flow a policy would block is logged with the rule it hit. In Monitor this shows what a new policy would break, before you enforce it.' },
              { k: 'IP addresses in the rules', v: 0, tip: 'Rules name labels (categories) such as AppTier: Web, not addresses. A new web VM with that label is covered at once, and a VM keeps its rules when it moves to another host.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <svg class="diagram fl-sec" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A three-tier app in Production and one Dev VM. ${MODE_WORD[mode]}${quar ? ', Web-2 quarantined' : ''}. ${caption.k}: ${caption.text}`}>
          <rect class="fl-ext" x={BOX.external.x} y={BOX.external.y} width={BOX.external.w} height={VM_H} />
          <text x={BOX.external.x + BOX.external.w / 2} y={BOX.external.y + 23} text-anchor="middle" style={{ fontSize: '14px', fontWeight: 600 }}>
            Users
          </text>
          <text x={BOX.external.x + BOX.external.w / 2} y={BOX.external.y + 42} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
            outside the app
          </text>

          <rect class="fl-env" x={168} y={28} width={776} height={240} />
          <text x={184} y={50} class="fl-envlbl">
            Environment: Production
          </text>
          <text x={928} y={50} text-anchor="end" class={`fl-st ${mode}`}>
            {MODE_WORD[mode]}
          </text>
          <rect class="fl-env dev" x={168} y={302} width={776} height={84} />
          <text x={184} y={349} class="fl-envlbl">
            Environment: Dev
          </text>
          {mode !== 'off' && (
            <g>
              <line x1={168} x2={944} y1={285} y2={285} class={`fl-wall ${mode}`} />
              <text x={184} y={298} class="fl-st muted halo" style={{ fontSize: '11.5px' }}>
                Production and Dev kept apart
              </text>
            </g>
          )}

          {APP_LANES.map((l) => (
            <path key={l.id} d={pathD(l.c)} class="fl-lane" />
          ))}
          {tryNow && <path d={pathD(tryNow.c)} class="fl-try" />}
          {VMS.map((v) => (
            <VmBox key={v.id} id={v.id} mode={mode} quar={quar && v.id === 'web2'} />
          ))}
          <Packets shots={shots} t={t} />
          {lbl && (
            <text x={lbl.at.x} y={lbl.at.y} text-anchor={lbl.end ? 'end' : 'start'} class={`fl-out halo ${lbl.cls}`}>
              {lbl.text}
            </text>
          )}
        </svg>
      </div>
      <Legend
        items={[
          { color: 'var(--flow)', label: 'App traffic' },
          { color: 'var(--bad)', label: 'Unwanted traffic' },
          { color: 'var(--ok)', label: 'Stopped by the policy' },
          { color: 'var(--warn)', label: 'Logged, but let through (Monitor)', dashed: true },
          ...(mode === 'off' ? [] : [{ color: mode === 'monitor' ? 'var(--warn)' : 'var(--ink)', label: 'Outline: the policy, checked at each VM', dashed: true }]),
        ]}
      />
      <PlayBar
        clock={clock}
        label="Network security animation"
        fmt={() => (tryNow ? tryNow.word : 'App traffic')}
        extra={<Illus why="A small sample app. Flow checks traffic in the AHV virtual switch at each VM's network connection; the packets, ports and timings shown are simplified." />}
      />
    </Show>
  );
}
