// Data Lens: a ransomware attack on a file share, detection and alerting, blocking the client,
// and recovery from the last clean snapshot. Scenario logic lives in engine/ransomware.ts.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useBool, useEnum } from '../../../state/route';
import { useClock, fmtClock } from '../../components/clock';
import { Chip, Field, Follow, Illus, Legend, PlayBar, Seg, Stat, Toggle } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { FILES, SIM, attackEvents, attackState, timeline, type FileState, type Rate, type Tier, type Variant } from '../../../engine/ransomware';
import './style.css';

const COLS = 20;
const CELL = 18;
const CG = 3;

const FILE_CLS: Record<FileState, string> = {
  clean: 'dl-f',
  edited: 'dl-f edited',
  encrypted: 'dl-f enc',
  restored: 'dl-f rest',
  lostEdit: 'dl-f lost',
};

function ShareDiagram({ files, attacking, blocked, alert, detection, tier, recovering, narrow }: {
  files: FileState[];
  attacking: boolean;
  blocked: boolean;
  alert: boolean;
  detection: 'signature' | 'behavior' | 'none';
  tier: Tier;
  recovering: boolean;
  narrow: boolean;
}) {
  const gw = COLS * (CELL + CG) - CG;
  const rows = Math.ceil(FILES / COLS);
  const gh = rows * (CELL + CG) - CG;
  // Wide: client | share | Data Lens in a row. Narrow (phone): client and Data Lens on top, share below.
  const gx = narrow ? 21 : 250;
  const gy = narrow ? 334 : 78;
  const cl = narrow ? { x: 0, y: 0, w: 200, h: 100 } : { x: 0, y: 150, w: 180, h: 100 };
  const dl = narrow ? { x: 230, y: 0, w: 230 } : { x: 770, y: 34, w: 240 };
  const W = narrow ? 460 : 1010;
  const H = narrow ? gy + gh + 108 : 440;
  const link = narrow ? { x1: 100, y1: 100, x2: 100, y2: gy - 44 } : { x1: 180, y1: 200, x2: gx - 14, y2: 200 };
  const mx = (link.x1 + link.x2) / 2;
  const my = (link.y1 + link.y2) / 2;
  const act = narrow ? { x1: 345, y1: gy - 44, x2: 345, y2: dl.y + 256 } : { x1: gx + gw + 14, y1: 150, x2: dl.x, y2: 150 };
  const ccx = cl.x + cl.w / 2;
  const dcx = dl.x + dl.w / 2;
  return (
    <svg class="diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A file share under ransomware attack, with Data Lens watching file activity and a snapshot used for recovery">
      {/* client */}
      <rect class={`dl-client${attacking && !blocked ? ' bad' : ''}`} x={cl.x} y={cl.y} width={cl.w} height={cl.h} />
      <text x={ccx} y={cl.y + 36} text-anchor="middle" style={{ fontWeight: 600, fontSize: '14px' }}>
        Client PC
      </text>
      <text x={ccx} y={cl.y + 56} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
        {attacking ? 'compromised user account' : 'normal user'}
      </text>
      <text x={ccx} y={cl.y + 78} text-anchor="middle" class={blocked ? 'ok-fill' : attacking ? 'bad-fill' : 'muted'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
        {blocked ? '✓ Blocked from share' : attacking ? '✕ Encrypting files' : 'Opening and editing files'}
      </text>
      {/* client → share link */}
      <line {...link} class={blocked ? 'line' : attacking ? 'bad-stroke' : 'flow-stroke'} stroke-width={2} stroke-dasharray={blocked ? '4 4' : undefined} />
      {blocked && (
        <g>
          <circle cx={mx} cy={my} r={13} class="dl-blockdot" />
          <path d={`M${mx - 9} ${my + 9} l18 -18`} class="ok-stroke" stroke-width={2.25} />
        </g>
      )}
      <text x={narrow ? mx + 20 : mx} y={narrow ? my + 4 : my - 10 - (blocked ? 16 : 0)} text-anchor={narrow ? 'start' : 'middle'} class="muted" style={{ fontSize: '11px' }}>
        SMB
      </text>

      {/* share */}
      <rect class="frame" x={gx - 14} y={gy - 44} width={gw + 28} height={gh + 58} />
      <text x={gx} y={gy - 22} style={{ fontWeight: 600, fontSize: '14px' }}>
        File share on Nutanix Files
      </text>
      <text x={gx + gw} y={gy - 22} text-anchor="end" class="muted mono" style={{ fontSize: '12px' }}>
        {FILES} files
      </text>
      {files.map((f, i) => (
        <rect key={i} class={FILE_CLS[f]} x={gx + (i % COLS) * (CELL + CG)} y={gy + Math.floor(i / COLS) * (CELL + CG)} width={CELL} height={CELL} />
      ))}

      {/* share → Data Lens: activity events */}
      <line {...act} class="flow-stroke" stroke-width={1.5} stroke-dasharray="4 3" />
      <text x={narrow ? act.x1 + 8 : (act.x1 + act.x2) / 2} y={narrow ? (act.y1 + act.y2) / 2 + 4 : act.y1 - 8} text-anchor={narrow ? 'start' : 'middle'} class="muted" style={{ fontSize: '11px' }}>
        file activity
      </text>
      {/* Data Lens */}
      <rect class="ink-fill" x={dl.x} y={dl.y} width={dl.w} height={46} />
      <text x={dcx} y={dl.y + 29} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '15px' }}>
        Data Lens
      </text>
      <rect class="bg2" x={dl.x} y={dl.y + 46} width={dl.w} height={210} stroke="var(--line-2)" />
      <text x={dl.x + 14} y={dl.y + 72} style={{ fontSize: '13px', fontWeight: 600 }}>
        Signature detection
      </text>
      <text x={dl.x + 14} y={dl.y + 90} class="muted" style={{ fontSize: '12px' }}>
        known ransomware · Starter and Pro
      </text>
      <text x={dl.x + 14} y={dl.y + 118} style={{ fontSize: '13px', fontWeight: 600 }} class={tier === 'pro' ? '' : 'faint'}>
        Behavior analytics
      </text>
      <text x={dl.x + 14} y={dl.y + 136} class="muted" style={{ fontSize: '12px' }}>
        {tier === 'pro' ? 'unusual activity, new variants · Pro' : 'not in Starter'}
      </text>
      <rect class={`dl-alert ${alert ? 'on' : ''}`} x={dl.x + 14} y={dl.y + 156} width={dl.w - 28} height={84} />
      <text x={dcx} y={dl.y + 188} text-anchor="middle" class={alert ? 'warn-fill' : 'muted'} style={{ fontSize: '14px', fontWeight: 600 }}>
        {alert ? '⚠ Ransomware alert' : attacking && detection === 'none' ? 'No alert' : 'No alerts'}
      </text>
      <text x={dcx} y={dl.y + 210} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
        {alert ? (detection === 'signature' ? 'matched a known signature' : 'abnormal mass changes') : attacking && detection === 'none' ? 'new variant, no signature yet' : 'watching activity'}
      </text>
      <text x={dcx} y={dl.y + 228} text-anchor="middle" class="muted" style={{ fontSize: '12px' }}>
        {alert ? (blocked ? 'client blocked' : 'waiting for block') : ''}
      </text>

      {/* snapshot */}
      <rect class={`dl-snap${recovering ? ' on' : ''}`} x={gx - 14} y={gy + gh + 40} width={gw + 28} height={64} />
      <text x={gx} y={gy + gh + 66} style={{ fontWeight: 600, fontSize: '14px' }}>
        Last clean snapshot
      </text>
      <text x={gx} y={gy + gh + 86} class="muted" style={{ fontSize: '12px' }}>
        {narrow ? 'Taken before the attack. Read-only.' : 'Taken before the attack. Read-only, so the client cannot encrypt it.'}
      </text>
      {recovering && (
        <g>
          <path d={`M${gx + gw - 40} ${gy + gh + 40} V ${gy + gh + 18}`} class="ok-stroke" stroke-width={2.5} />
          <path d={`M${gx + gw - 47} ${gy + gh + 24} l7 -7 l7 7`} class="ok-stroke" fill="none" stroke-width={2.5} />
          <text x={gx + gw - 52} y={gy + gh + 66} text-anchor="end" class="ok-fill" style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Restoring
          </text>
        </g>
      )}
    </svg>
  );
}

function useNarrow(px = 700): boolean {
  const q = typeof matchMedia !== 'undefined' ? matchMedia(`(max-width: ${px}px)`) : null;
  const [n, setN] = useState(!!q?.matches);
  useEffect(() => {
    if (!q) return;
    const on = () => setN(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return n;
}

export default function Datalens() {
  const [tier, setTier] = useEnum<Tier>('tr', 'pro', ['starter', 'pro']);
  const [variant, setVariant] = useEnum<Variant>('v', 'new', ['known', 'new']);
  const [autoBlock, setAutoBlock] = useBool('ab', true);
  const [rate, setRate] = useEnum<Rate>('rt', 'fast', ['slow', 'fast']);
  const [recoverAt, setRecoverAt] = useState<number | undefined>(undefined);

  const narrow = useNarrow();
  const input = { tier, variant, autoBlock, rate, recoverAt };
  const tl = useMemo(() => timeline({ tier, variant, autoBlock, rate }), [tier, variant, autoBlock, rate]);
  const duration = recoverAt !== undefined ? recoverAt + tl.encryptedTotal / SIM.restorePerSec + 6 : tl.stopAt + 24;
  const clock = useClock({ rate: 6, duration, stepSize: 2, keys: true });
  useEffect(() => {
    setRecoverAt(undefined);
    clock.reset();
  }, [tier, variant, autoBlock, rate]);
  useEffect(() => {
    if (recoverAt !== undefined && clock.t < recoverAt) setRecoverAt(undefined);
  }, [clock.t]);

  const s = attackState(input, tl, clock.t);
  const log = attackEvents(input, tl, clock.t).slice().reverse();
  const attacking = clock.t >= SIM.attackStart && !s.blocked && clock.t < tl.stopAt;
  const detectSec = tl.detectAt === null ? null : Math.round(tl.detectAt - SIM.attackStart);
  const pct = Math.round((tl.encryptedTotal / FILES) * 100);

  // Start playing once the longer duration is in place (the clock reads it on render).
  useEffect(() => {
    if (recoverAt !== undefined) clock.play();
  }, [recoverAt]);
  const recover = () => setRecoverAt(clock.t);

  return (
    <div class="lab">
      <div class="ctl">
        <Field
          label="Data Lens tier"
          tip="Starter covers basic ransomware detection and blocking. Pro adds behavior-based detection."
          detail="From Nutanix’s software page: Starter has basic ransomware detection and blocking; Pro adds advanced, behavior-based detection, user behavior analytics and permission reporting. Check current licensing."
          value={tier === 'pro' ? 'Pro' : 'Starter'}
        >
          <Seg
            label="Data Lens tier"
            value={tier}
            onChange={setTier}
            options={[
              { value: 'starter', label: 'Starter' },
              { value: 'pro', label: 'Pro' },
            ]}
          />
        </Field>
        <Field
          label="Ransomware"
          tip="Known strains match Data Lens’s signature list. A new variant has no signature yet."
          detail="Data Lens checks activity against a list of over 65,000 known ransomware signatures. Behavior-based detection looks at who is changing what, how fast, to catch strains with no signature."
          value={variant === 'known' ? 'Known' : 'New variant'}
          note={variant === 'new' && tier === 'starter' ? 'A new variant on Starter has no signature to match, so no alert is raised.' : undefined}
        >
          <Seg
            label="Ransomware"
            value={variant}
            onChange={setVariant}
            options={[
              { value: 'known', label: 'Known strain' },
              { value: 'new', label: 'New variant' },
            ]}
          />
        </Field>
        <Field label="Response" tip="Block the offending client automatically when an attack is detected, or alert only and let an admin act." value={autoBlock ? 'Auto-block' : 'Alert only'}>
          <Toggle on={autoBlock} onChange={setAutoBlock}>
            Block the client automatically
          </Toggle>
        </Field>
        <Field label="Attack speed" tip="How fast the compromised client encrypts files." value={rate === 'fast' ? 'Fast' : 'Slow'}>
          <Seg
            label="Attack speed"
            value={rate}
            onChange={setRate}
            options={[
              { value: 'slow', label: 'Slow' },
              { value: 'fast', label: 'Fast' },
            ]}
          />
        </Field>
      </div>

      <div class="stage">
        <div class={narrow ? 'dl-narrow' : 'diagram-scroll'}>
          <ShareDiagram narrow={narrow} files={s.files} attacking={attacking} blocked={s.blocked} alert={s.alert} detection={tl.detection} tier={tier} recovering={s.phase === 'recovering'} />
        </div>
        <Legend
          items={[
            { color: 'var(--bg-3)', label: 'Clean file' },
            { color: 'var(--bad)', label: 'Encrypted' },
            { color: 'var(--ok)', label: 'Restored' },
            { color: 'var(--warn)', label: 'Restored, newest edits lost' },
            { color: 'var(--s2)', label: 'Edited since last snapshot' },
          ]}
        />
        <PlayBar
          clock={clock}
          label="Attack simulation controls"
          fmt={(t) => `${fmtClock(t)} sim`}
          extra={
            s.canRecover ? (
              <button type="button" class="btn primary" onClick={recover}>
                <Icon name="rebuild" />
                Recover from snapshot
              </button>
            ) : undefined
          }
        />
        {s.phase === 'quiet' && (
          <Follow tone="ink" k="Press Play">
            <p>A normal day on a shared drive. In a few seconds a user’s PC is compromised and starts encrypting files over SMB. Watch what Data Lens sees and does.</p>
          </Follow>
        )}
        {(s.phase === 'attack' || s.phase === 'detected') && (
          <Follow tone="bad" k={s.alert ? 'Detected' : 'Under attack'}>
            <p>
              {s.encrypted} files encrypted so far.{' '}
              {s.alert ? (autoBlock ? 'Blocking the client now.' : 'Alert raised. The client keeps encrypting until an admin blocks it.') : tl.detection === 'none' ? 'No signature matches this variant and Starter has no behavior analytics, so nothing raises an alert.' : 'Data Lens is analyzing the activity.'}
            </p>
          </Follow>
        )}
        {s.phase === 'stopped' && (
          <Follow tone={tl.blockAt !== null ? 'warn' : 'bad'} k={tl.blockAt !== null ? 'Attack stopped' : 'Share fully encrypted'}>
            <p>
              {tl.encryptedTotal} of {FILES} files ({pct}%) were encrypted.{' '}
              {tl.blockAt !== null ? `Data Lens caught it ${detectSec} s after it began.` : 'No alert was raised; in real life someone would notice when files stop opening.'} The snapshot is untouched, so press <strong>Recover from snapshot</strong>.
            </p>
          </Follow>
        )}
        {s.phase === 'recovering' && (
          <Follow tone="flow" k="Recovering">
            <p>Restoring the affected files from the last clean snapshot. Untouched files stay as they are.</p>
          </Follow>
        )}
        {s.phase === 'recovered' && (
          <Follow tone="ok" k="Recovered">
            <p>
              All {tl.encryptedTotal} encrypted files are back to their snapshot version. {s.lostEdits ? `${s.lostEdits} of them had been edited after that snapshot; those latest edits are lost. That gap is the snapshot schedule’s recovery point.` : 'None of them had been edited after the snapshot, so nothing was lost.'}
            </p>
          </Follow>
        )}
      </div>

      <div class="rail">
        <div class="side-sec">
          <div class="spread" style={{ marginBottom: 'var(--sp-3)' }}>
            <strong>Share</strong>
            {s.phase === 'recovered' ? (
              <Chip tone="ok">Recovered</Chip>
            ) : s.phase === 'recovering' ? (
              <Chip tone="flow">Restoring</Chip>
            ) : s.encrypted > 0 ? (
              <Chip tone="bad">Encrypted files</Chip>
            ) : (
              <Chip tone="ok">Healthy</Chip>
            )}
          </div>
          <Stat k="Encrypted now" v={s.encrypted} tone={s.encrypted ? 'bad' : 'neutral'} />
          <Stat k="Restored" v={s.restored} tone={s.restored ? 'ok' : 'neutral'} />
          <Stat k="Newest edits lost" v={s.lostEdits} tone={s.lostEdits ? 'warn' : 'neutral'} tip="Files edited after the last snapshot and then encrypted. Restore brings back the snapshot version." />
          <Stat k="Time to alert" v={s.alert ? `${detectSec} s` : clock.t >= tl.stopAt ? 'no alert' : '—'} tone={!s.alert && clock.t >= tl.stopAt ? 'bad' : 'neutral'} tip="From the first encrypted file to the Data Lens alert." />
          <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
            <Illus why="Detection, response and restore times are invented for the demo. Real times depend on the attack, the share and the deployment." />
          </p>
        </div>
        <div class="side-sec">
          <strong>Events</strong>
          <ul class="events" style={{ marginTop: 'var(--sp-2)' }}>
            {log.map((e, i) => (
              <li key={i}>
                <span class="t">{fmtClock(e.t)}</span>
                <span class={`${e.tone}-text`}>
                  <Icon name={e.tone === 'ok' ? 'ok' : e.tone === 'bad' ? 'bad' : e.tone === 'warn' ? 'warn' : e.tone === 'flow' ? 'rebuild' : 'info'} />
                </span>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div class="side-sec">
          <strong>Where it runs</strong>
          <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
            As a SaaS service, or on-premises. Data Lens 2.0 (GA April 2026) runs fully on-premises, including air-gapped sites. On-Prem 2.1 (August 2026) added Nutanix Objects.
          </p>
        </div>
      </div>
    </div>
  );
}
