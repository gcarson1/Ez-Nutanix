// Snapshots & Clones: one loop told as an admin lives it. A snapshot before a patch is taken in
// seconds and adds no space; the VM keeps writing; the patch breaks the app and the VM is restored
// from the snapshot; three clones go to dev, test and analytics; each grows only by what it writes;
// and none of it is a backup on its own. Two colors only: data shared with another disk, and data
// only this disk has. The meter compares what is stored with what full copies would need.
import { useEnum } from '../../../state/route';
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Show, Tabs, ease, phaseAt, prog } from '../../components/show';
import { Compare } from './compare';
import './style.css';

const DISK = 500;
const CHANGED = 20;
const CLONES = [
  { team: 'dev', own: 15 },
  { team: 'test', own: 30 },
  { team: 'analytics', own: 5 },
];
const S = [0, 3, 7, 11.5, 16.5, 20.5, 25];
const END = 30;
const SCENES: { tone: Tone | 'ink'; k: string; text: string }[] = [
  { tone: 'ink', k: 'A production VM', text: `An admin is about to patch sql-prod, a database VM with a ${DISK} GB disk, and wants a way back if the patch goes wrong.` },
  { tone: 'ok', k: 'Snapshot taken in seconds', text: `At 9:00 a snapshot copies the disk’s map of where its data lives, not the data, so it is done in seconds and adds no space. Production and the snapshot now share all ${DISK} GB.` },
  { tone: 'flow', k: 'The VM keeps writing', text: `New writes go to new space and only production’s map changes; the snapshot keeps pointing at the 9:00 data. Space grows only by what changed: ${CHANGED} GB.` },
  { tone: 'warn', k: 'The patch fails: restore', text: 'The patch breaks the app. The VM is restored from the 9:00 snapshot, quickly, because nothing is copied back: its map points at the 9:00 data again. Anything written after 9:00 is lost, so snapshot right before the change.' },
  { tone: 'ok', k: 'Clones for three teams', text: `Dev, test and analytics each want a copy of production. Each clone is a full, writable ${DISK} GB disk to its team, ready in seconds, and uses no new space because it starts from the snapshot’s map.` },
  { tone: 'flow', k: 'Clones grow only with their writes', text: `Each clone stores only what it writes: ${CLONES.map((c) => c.own).join(', ').replace(/, (\d+)$/, ' and $1')} GB here. Three full copies would need ${(3 * DISK).toLocaleString('en-US')} GB more; these need ${CLONES.reduce((a, c) => a + c.own, 0)} GB.` },
  { tone: 'warn', k: 'Not a backup on its own', text: 'All of these live on the same cluster as production. To survive losing the cluster, replicate snapshots to another site or use a backup product.' },
];
const STEPS = paced(S, SCENES.map((s) => [s.k, s.text]));

/** Everything the picture and the numbers need at time t. */
function stateAt(t: number) {
  const sc = phaseAt(S, t);
  const snap = ease(prog(t, S[1] + 0.3, S[1] + 1.1));
  const restoreAt = S[3] + 2;
  const changed = t < restoreAt ? CHANGED * ease(prog(t, S[2] + 0.6, S[2] + 3.4)) : 0;
  const broken = t >= S[3] + 0.3 && t < restoreAt;
  const restored = t >= restoreAt && t < S[4];
  const clones = CLONES.map((c, i) => ({ ...c, in: ease(prog(t, S[4] + 0.5 + i * 0.5, S[4] + 1.3 + i * 0.5)), wrote: c.own * ease(prog(t, S[5] + 0.5 + i * 0.4, S[5] + 2.6 + i * 0.4)) }));
  const disks = 1 + (snap > 0.5 ? 1 : 0) + clones.filter((c) => c.in > 0.5).length;
  const stored = DISK + changed + clones.reduce((a, c) => a + c.wrote, 0);
  return { sc, snap, changed, broken, restored, clones, disks, stored, full: disks * DISK };
}

// ── geometry ──
const W = 960;
const BX = 210;
const BW = 540;
const gb = (v: number) => (v / DISK) * BW;
const ROW_H = 38;
const rowY = [36, 96, 176, 232, 288];
const MY = 356;
const MW = 540;
const MMAX = 5 * DISK;
const H = MY + 66;

function Row({ y, name, sub, own, note, noteCls, dashed, o = 1, alone }: { y: number; name: string; sub: string; own: number; note: string; noteCls?: string; dashed?: boolean; o?: number; alone?: boolean }) {
  return (
    <g style={{ opacity: o }}>
      <text class="d-label" x={8} y={y + 16} style={{ fontWeight: 600 }}>
        {name}
      </text>
      <text x={8} y={y + 32} class="muted d-sub">
        {sub}
      </text>
      <rect x={BX} y={y} width={gb(DISK - own)} height={ROW_H} class={alone ? 'sn-own' : 'sn-shared'} stroke-dasharray={dashed ? '5 4' : undefined} />
      {own > 0.05 && <rect x={BX + gb(DISK - own)} y={y} width={gb(own)} height={ROW_H} class="sn-own" />}
      <text x={BX + 12} y={y + 24} class={`${alone ? 'sn-on-own' : ''} d-label`} style={{ fontWeight: 600 }}>
        {DISK} GB disk
      </text>
      <text x={BX + BW + 14} y={y + 24} class={`${noteCls ?? 'muted'} d-sub`} style={{ fontWeight: noteCls ? 600 : 400 }}>
        {note}
      </text>
    </g>
  );
}

/** In the last scene the notes give way to the other site. */
const quiet = (t: number) => phaseAt(S, t) === 6;

function SnapDiagram({ t }: { t: number }) {
  const s = stateAt(t);
  const anyShare = s.snap > 0.5;
  const prodNote = s.broken ? '✕ the patch broke the app' : s.restored ? '↺ restored from 9:00' : s.changed > 0.5 ? `${Math.round(s.changed)} GB written since 9:00` : anyShare ? 'live, writable' : 'live, writable · all its own';
  const snapNote = s.changed > 0.5 ? `keeps the 9:00 versions of ${Math.round(s.changed)} GB` : 'read-only restore point';
  const saved = s.full - s.stored;
  return (
    <svg class="diagram sn-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`sql-prod, a ${DISK} GB VM, gets a snapshot before a patch, is restored from it when the patch fails, then three clones go to dev, test and analytics. ${Math.round(s.stored)} GB are stored, against ${s.full.toLocaleString('en-US')} GB for full copies.`}>
      <defs>
        <marker id="sn-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--warn)" />
        </marker>
      </defs>
      <Row y={rowY[0]} name="sql-prod" sub="production VM disk" own={s.changed} alone={!anyShare} note={quiet(t) ? '' : prodNote} noteCls={s.broken ? 'bad-fill' : s.restored ? 'ok-fill' : undefined} />
      {s.snap > 0 && (
        <g style={{ transform: `translateY(${(1 - s.snap) * (rowY[0] - rowY[1])}px)` }}>
          <Row y={rowY[1]} name="Snapshot · 9:00" sub="before the patch" own={s.changed} dashed note={quiet(t) ? '' : snapNote} o={0.3 + 0.7 * s.snap} />
        </g>
      )}
      {s.sc >= 4 && (
        <text x={8} y={rowY[2] - 14} class="muted d-fine">
          Clones of the 9:00 snapshot
        </text>
      )}
      {s.clones.map(
        (c, i) =>
          c.in > 0 && (
            <g key={c.team} style={{ transform: `translateY(${(1 - c.in) * (rowY[1] - rowY[2 + i])}px)` }}>
              <Row y={rowY[2 + i]} name={`Clone · ${c.team}`} sub="writable, for its team" own={c.wrote} note={quiet(t) ? '' : c.wrote > 0.5 ? `${Math.round(c.wrote)} GB of its own` : 'ready, no new space'} noteCls={c.wrote > 0.5 ? undefined : 'ok-fill'} o={0.3 + 0.7 * c.in} />
            </g>
          ),
      )}

      {/* what is stored against what full copies would need */}
      <text class="d-label" x={8} y={MY + 14} style={{ fontWeight: 600 }}>
        Stored on the cluster
      </text>
      <rect x={BX} y={MY} width={MW} height={18} class="bg3" />
      <rect x={BX} y={MY} width={(s.stored / MMAX) * MW} height={18} class="sn-own" />
      <text x={BX + MW + 14} y={MY + 14} class="mono d-label" style={{ fontWeight: 600 }}>
        {Math.round(s.stored).toLocaleString('en-US')} GB
      </text>
      <text x={8} y={MY + 44} class="muted d-label">
        As full copies
      </text>
      <rect x={BX} y={MY + 30} width={MW} height={18} class="bg3" />
      <rect x={BX} y={MY + 30} width={(s.full / MMAX) * MW} height={18} class="sn-full" />
      <text x={BX + MW + 14} y={MY + 44} class="mono muted d-label">
        {s.full.toLocaleString('en-US')} GB{saved > 1 ? ` · ${Math.round(saved).toLocaleString('en-US')} GB saved` : ''}
      </text>

      {/* the closing point: all of this is on one cluster */}
      {s.sc === 6 && (
        <g>
          <rect x={2} y={rowY[0] - 14} width={BX + BW + 8} height={rowY[4] + ROW_H + 26 - rowY[0]} class="sn-cluster" />
          <text x={BX + BW + 2} y={rowY[0] - 20} text-anchor="end" class="warn-fill d-sub" style={{ fontWeight: 600 }}>
            all on the same cluster as production
          </text>
          <line x1={BX + BW + 10} x2={BX + BW + 34} y1={rowY[2] + 46} y2={rowY[2] + 46} class="sn-rep" marker-end="url(#sn-ar)" />
          <rect x={BX + BW + 40} y={rowY[2]} width={W - BX - BW - 46} height={92} class="sn-site" />
          <text class="d-label" x={BX + BW + 54} y={rowY[2] + 26} style={{ fontWeight: 600 }}>
            Another site
          </text>
          <text x={BX + BW + 54} y={rowY[2] + 46} class="muted d-sub">
            replicated snapshots
          </text>
          <text x={BX + BW + 54} y={rowY[2] + 64} class="muted d-sub">
            or a backup product
          </text>
        </g>
      )}
    </svg>
  );
}

function Story() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: END - 1, steps: STEPS });
  const t = clock.t;
  const s = stateAt(t);
  const scene = SCENES[s.sc];
  const restorePoint = s.snap > 0.5;
  return (
    <Show clock={clock}
      foot={
        <>
          <Follow tone={scene.tone} k={scene.k}>
            <p>{scene.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Restore point', v: restorePoint ? '9:00' : 'None', tone: restorePoint ? 'ok' : undefined, sub: restorePoint ? 'taken in seconds' : undefined },
              { k: 'Stored', v: `${Math.round(s.stored)} GB`, tone: s.stored < s.full ? 'ok' : undefined, tip: 'Only new writes, by the VM or by a clone, add stored data.' },
              { k: 'As full copies', v: `${s.full.toLocaleString('en-US')} GB`, sub: `${s.disks} disk${s.disks > 1 ? 's' : ''} × ${DISK} GB` },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <SnapDiagram t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--s3)', label: 'Shared with another disk: stored once' },
          { color: 'var(--ink)', label: 'Only this disk has it: takes space' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Snapshot and clone animation"
        extra={<Illus why="Example sizes and times. Space is shown before the replication factor, which multiplies stored data and full copies alike. AOS tracks changes at a fine granularity and manages snapshot chains in the background; how fast a restore completes depends on the VM and the release." />}
      />
    </Show>
  );
}

type TabId = 'day' | 'rp';
const TABS: { id: TabId; label: string }[] = [
  { id: 'day', label: 'An admin’s day' },
  { id: 'rp', label: 'Recovery points vs snapshots' },
];

export default function Snapshots() {
  const [tab, setTab] = useEnum<TabId>('tab', 'day', ['day', 'rp']);
  return (
    <Tabs label="Snapshots and clones topics" value={tab} tabs={TABS} onChange={setTab}>
      {tab === 'day' ? <Story /> : <Compare />}
    </Tabs>
  );
}
