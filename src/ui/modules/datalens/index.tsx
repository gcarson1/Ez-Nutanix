// Data Lens: a ransomware attack on a file server's shares, on a loop. Data Lens spots it and,
// with auto-block, cuts the PC off right away; with alert only, the PC keeps going until an admin
// acts. Then the hit files come back from the last clean snapshot. Logic is in engine/ransomware.ts.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, prog } from '../../components/show';
import { FILES, PER_SHARE, SHARES, SIM, attackState, encryptTime, restoreTime, timeline, type FileState, type Phase, type Response, type Timeline } from '../../../engine/ransomware';
import './style.css';

// ── geometry ──
const W = 960;
const H = 300;
const COLS = 6;
const CELL = 15;
const CG = 3;
const GRID = COLS * (CELL + CG) - CG;
const PC = { x: 0, y: 100, w: 160, h: 100 };
const SRV = { x: 280, y: 40, w: 410, h: 178 };
const SNAP = { x: 280, y: 236, w: 410, h: 56 };
const DL = { x: 770, y: 40, w: 190, h: 252 };
const LINK_Y = 150;
const GRID_Y = 96;
const gridX = (s: number) => SRV.x + 18 + s * (GRID + 31);
const FLIGHT = 0.5;
const EVENT = 0.4;

const FILE_CLS: Record<FileState, string> = { clean: 'dl-f', encrypted: 'dl-f enc', restored: 'dl-f rest' };

function cell(f: number): { x: number; y: number } {
  const s = Math.floor(f / PER_SHARE);
  const k = f % PER_SHARE;
  return { x: gridX(s) + (k % COLS) * (CELL + CG), y: GRID_Y + Math.floor(k / COLS) * (CELL + CG) };
}

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

/** Dots in flight at time t: file operations from the PC, activity events to Data Lens, restores from the snapshot. */
function dots(tl: Timeline, t: number) {
  const out: { x: number; y: number; cls: string; r: number }[] = [];
  const fromPc = (f: number, k: number, cls: string) => {
    const c = cell(f);
    const [x, y] = along([[PC.x + PC.w, LINK_Y], [SRV.x, LINK_Y], [c.x + CELL / 2, c.y + CELL / 2]], k);
    out.push({ x, y, cls, r: 4.5 });
  };
  const event = (ta: number) => {
    if (t < ta || t > ta + EVENT) return;
    out.push({ x: SRV.x + SRV.w + (DL.x - SRV.x - SRV.w) * prog(t, ta, ta + EVENT), y: LINK_Y, cls: 'dl-dot ev', r: 3.5 });
  };
  for (const n of tl.normal) {
    if (t >= n.t - FLIGHT && t <= n.t) fromPc(n.file, prog(t, n.t - FLIGHT, n.t), 'dl-dot norm');
    event(n.t);
  }
  for (let n = 0; n < tl.hit; n++) {
    const te = encryptTime(n);
    if (te - FLIGHT > t) break;
    if (t <= te) fromPc(tl.order[n], prog(t, te - FLIGHT, te), 'dl-dot bad');
    event(te);
  }
  if (t >= tl.recoverAt)
    for (let n = 0; n < tl.hit; n++) {
      const tr = restoreTime(tl, n);
      if (t < tr - FLIGHT || t > tr) continue;
      const c = cell(tl.order[n]);
      const k = prog(t, tr - FLIGHT, tr);
      out.push({ x: c.x + CELL / 2, y: SNAP.y + (c.y + CELL / 2 - SNAP.y) * k, cls: 'dl-dot ok', r: 3.5 });
    }
  return out;
}

function ShareDiagram({ tl, t, response }: { tl: Timeline; t: number; response: Response }) {
  const s = attackState(tl, t);
  const infected = t >= SIM.attackStart;
  const attacking = infected && !s.blocked;
  const pcWord = s.blocked ? '✓ Blocked' : infected ? '✕ Infected' : 'Working normally';
  const pcSub = s.blocked ? 'cut off from the shares' : infected ? 'encrypting files' : 'opens and saves files';
  const mx = (PC.x + PC.w + SRV.x) / 2;
  const dcx = DL.x + DL.w / 2;
  const restoring = s.phase === 'recovering';
  let resp: { cls: string; text: string } | null = null;
  if (s.blocked) resp = { cls: 'ok-fill', text: response === 'block' ? '✓ PC blocked at once' : '✓ Admin blocked the PC' };
  else if (s.alert) resp = response === 'block' ? { cls: 'ok-fill', text: 'Blocking the PC…' } : { cls: 'warn-fill', text: 'Waiting for an admin…' };
  return (
    <svg class="diagram dl-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A user’s PC is infected and encrypts files on three file shares. Data Lens watches the file activity, spots the attack and ${response === 'block' ? 'blocks the PC at once' : 'raises an alert; the PC keeps encrypting until an admin blocks it'}. The hit files are then restored from the last clean snapshot.`}>
      {/* PC */}
      <rect class={`dl-pc${attacking ? ' bad' : s.blocked ? ' off' : ''}`} x={PC.x} y={PC.y} width={PC.w} height={PC.h} />
      <text x={PC.x + PC.w / 2} y={PC.y + 28} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14px' }}>
        User’s PC
      </text>
      <text x={PC.x + PC.w / 2} y={PC.y + 52} text-anchor="middle" class={s.blocked ? 'ok-fill' : infected ? 'bad-fill' : 'muted'} style={{ fontSize: '13px', fontWeight: 600 }}>
        {pcWord}
      </text>
      <text x={PC.x + PC.w / 2} y={PC.y + 72} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
        {pcSub}
      </text>
      {/* PC → shares */}
      <line x1={PC.x + PC.w} y1={LINK_Y} x2={SRV.x} y2={LINK_Y} class={s.blocked ? 'line' : attacking ? 'bad-stroke' : 'dl-link'} stroke-width={2} stroke-dasharray={s.blocked ? '4 4' : undefined} />
      <text x={mx} y={LINK_Y - 22} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
        file access (SMB)
      </text>
      {s.blocked && (
        <g>
          <circle cx={mx} cy={LINK_Y} r={13} class="dl-stop" />
          <path d={`M${mx - 9} ${LINK_Y + 9} l18 -18`} class="ok-stroke" stroke-width={2.5} />
        </g>
      )}
      {/* file server and its shares */}
      <rect class="dl-srv" x={SRV.x} y={SRV.y} width={SRV.w} height={SRV.h} />
      <text x={SRV.x + 18} y={SRV.y + 24} style={{ fontWeight: 600, fontSize: '14px' }}>
        File server · {SHARES.length} shares
      </text>
      <text x={SRV.x + SRV.w - 18} y={SRV.y + 24} text-anchor="end" class="muted" style={{ fontSize: '12px' }}>
        {FILES} files
      </text>
      {SHARES.map((name, i) => (
        <text key={name} x={gridX(i)} y={GRID_Y - 8} class="mono" style={{ fontSize: '12px' }}>
          \\{name}
        </text>
      ))}
      {s.files.map((f, i) => {
        const c = cell(i);
        return <rect key={i} class={FILE_CLS[f]} x={c.x} y={c.y} width={CELL} height={CELL} />;
      })}
      {/* snapshot */}
      <rect class={`dl-snap${restoring ? ' on' : ''}`} x={SNAP.x} y={SNAP.y} width={SNAP.w} height={SNAP.h} />
      <text x={SNAP.x + 18} y={SNAP.y + 23} style={{ fontWeight: 600, fontSize: '13.5px' }}>
        Last clean snapshot
      </text>
      <text x={SNAP.x + 18} y={SNAP.y + 42} class="muted" style={{ fontSize: '12px' }}>
        Taken before the attack. Read-only, so the PC cannot touch it.
      </text>
      {/* shares → Data Lens */}
      <line x1={SRV.x + SRV.w} y1={LINK_Y} x2={DL.x} y2={LINK_Y} class="flow-stroke" stroke-width={1.5} stroke-dasharray="4 3" />
      <text x={(SRV.x + SRV.w + DL.x) / 2} y={LINK_Y - 22} text-anchor="middle" class="muted" style={{ fontSize: '11.5px' }}>
        activity
      </text>
      {/* Data Lens */}
      <rect class="bg2" x={DL.x} y={DL.y} width={DL.w} height={DL.h} stroke="var(--line-2)" />
      <rect class="ink-fill" x={DL.x} y={DL.y} width={DL.w} height={40} />
      <text x={dcx} y={DL.y + 26} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '15px' }}>
        Data Lens
      </text>
      <text x={dcx} y={DL.y + 62} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
        watches every file operation
      </text>
      <rect class={`dl-alert${s.alert ? ' on' : ''}`} x={DL.x + 12} y={DL.y + 78} width={DL.w - 24} height={76} />
      <text x={dcx} y={DL.y + 106} text-anchor="middle" class={s.alert ? 'warn-fill' : 'muted'} style={{ fontSize: '14px', fontWeight: 600 }}>
        {s.alert ? '⚠ Ransomware alert' : 'No alerts'}
      </text>
      {s.alert && (
        <>
          <text x={dcx} y={DL.y + 126} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
            one user is rewriting
          </text>
          <text x={dcx} y={DL.y + 142} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
            files far too fast
          </text>
        </>
      )}
      <text x={dcx} y={DL.y + 180} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
        Response: {response === 'block' ? 'auto-block' : 'alert only'}
      </text>
      {resp && (
        <text x={dcx} y={DL.y + 202} text-anchor="middle" class={resp.cls} style={{ fontSize: '12.5px', fontWeight: 600 }}>
          {resp.text}
        </text>
      )}
      {(s.phase === 'recovering' || s.phase === 'recovered') && (
        <text x={dcx} y={DL.y + 230} text-anchor="middle" class={s.phase === 'recovered' ? 'ok-fill' : 'flow-fill'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
          {s.phase === 'recovered' ? '✓ Files restored' : '↺ Restoring from snapshot'}
        </text>
      )}
      {dots(tl, t).map((d, i) => (
        <circle key={i} class={d.cls} cx={d.x} cy={d.y} r={d.r} />
      ))}
    </svg>
  );
}

const PHASE_WORD: Record<Phase, string> = { quiet: 'Normal day', attack: 'Attack', detected: 'Spotted', stopped: 'Stopped', recovering: 'Restoring', recovered: 'Recovered' };

function caption(response: Response, tl: Timeline, phase: Phase): { tone: Tone | 'ink'; k: string; text: string } {
  const pct = Math.round((tl.hit / FILES) * 100);
  switch (phase) {
    case 'quiet':
      return { tone: 'ink', k: 'A normal day', text: 'People open and save files on the shares. Data Lens watches every file operation in the background.' };
    case 'attack':
      return { tone: 'bad', k: 'Attack starts', text: 'A user’s PC is infected. It starts encrypting every file it can reach on the shares, one after another.' };
    case 'detected':
      return response === 'block'
        ? { tone: 'warn', k: 'Spotted', text: 'Data Lens sees one user rewriting files far faster than normal, a ransomware pattern. It raises an alert and blocks that PC.' }
        : { tone: 'warn', k: 'Spotted, alert only', text: 'Data Lens raises an alert, but nothing stops the PC yet. It keeps encrypting until an admin reads the alert and blocks it.' };
    case 'stopped':
      return response === 'block'
        ? { tone: 'ok', k: 'Stopped', text: `The PC was cut off from the shares seconds after the attack began. Only ${tl.hit} of ${FILES} files (${pct}%) were hit.` }
        : { tone: 'warn', k: 'Blocked, late', text: `By the time an admin blocked the PC, ${tl.hit} of ${FILES} files (${pct}%) were encrypted.` };
    case 'recovering':
      return { tone: 'flow', k: 'Restoring', text: 'One action restores the hit files from the last clean snapshot. The PC could never touch it: snapshots are read-only.' };
    case 'recovered':
      return { tone: 'ok', k: 'Recovered', text: 'Every hit file is back as it was at that snapshot. Changes made to those files since then are lost, so how often you take snapshots sets how much you can lose.' };
  }
}

export default function Datalens() {
  const [response, setResponse] = useEnum<Response>('rsp', 'block', ['alert', 'block']);
  const tl = useMemo(() => timeline(response), [response]);
  const clock = useClock({ rate: 1.2, duration: tl.end, keys: true, poster: tl.stopAt + 1 });
  useRestartOn(clock, [response]);
  const s = attackState(tl, clock.t);
  const cap = caption(response, tl, s.phase);

  return (
    <Show
      top={
        <Choice<Response>
          label="When Data Lens spots an attack"
          value={response}
          onChange={setResponse}
          options={[
            { value: 'alert', label: 'Alert only' },
            { value: 'block', label: 'Auto-block' },
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
              { k: 'Files hit', v: s.hit, sub: `of ${FILES}`, tone: s.hit ? 'bad' : undefined },
              { k: 'Alert', v: s.alert ? 'Raised' : 'None', tone: s.alert ? 'warn' : undefined },
              { k: 'PC blocked', v: s.blocked ? (response === 'block' ? 'Auto' : 'By admin') : 'No', tone: s.blocked ? 'ok' : undefined },
              { k: 'Restored', v: s.restored, sub: 'from the snapshot', tone: s.restored ? 'ok' : undefined },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <ShareDiagram tl={tl} t={clock.t} response={response} />
      </div>
      <Legend
        items={[
          { color: 'var(--line-2)', label: 'Clean file' },
          { color: 'var(--bad)', label: 'Encrypted' },
          { color: 'var(--ok)', label: 'Restored' },
          { color: 'var(--flow)', label: 'File activity Data Lens sees' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Ransomware attack animation"
        fmt={() => PHASE_WORD[s.phase]}
        extra={<Illus why="Detection, response and restore times are invented for the demo; real times depend on the attack, the shares and the deployment. Behavior-based detection, which catches strains with no known signature, is a Pro feature." />}
      />
    </Show>
  );
}
