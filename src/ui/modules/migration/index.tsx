// Migration with Nutanix Move: pick the source platform and watch one VM being copied while it
// runs, kept in sync with only its changes, then cut over in a short window, on a loop.
// Timeline math lives in engine/move.ts; this file maps its phases onto the animation.
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, fmtDur, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import { naiveDowntime, planMove, type MoveInput, type PhaseKind } from '../../../engine/move';
import './style.css';

type Src = 'esxi' | 'hyperv' | 'ec2' | 'azure';
const SRC: Record<Src, { label: string; box: string; sub: string; cloud: boolean; note: string }> = {
  esxi: { label: 'VMware ESXi', box: 'VMware vSphere', sub: 'ESXi hosts, through vCenter', cloud: false, note: 'From Move 6.3, ESXi to AHV can skip the copy when the disks already sit on a supported external array, such as Everpure FlashArray, shared with the AHV cluster.' },
  hyperv: { label: 'Hyper-V', box: 'Microsoft Hyper-V', sub: 'Hyper-V hosts in your data center', cloud: false, note: 'The same seed, sync and cutover pattern applies to every source Move supports.' },
  ec2: { label: 'AWS EC2', box: 'AWS EC2', sub: 'native instances in your AWS account', cloud: true, note: 'Check the Move support matrix for the exact source, target and versions before each wave.' },
  azure: { label: 'Azure', box: 'Microsoft Azure', sub: 'native VMs in your Azure subscription', cloud: true, note: 'Check the Move support matrix for the exact source, target and versions before each wave.' },
};
const SRC_IDS = Object.keys(SRC) as Src[];

/** One example VM. Every figure is an assumption, shown as such. */
const BASE: Omit<MoveInput, 'cutoverAt'> = { vmGB: 800, mbps: 250, changeGBPerHour: 6, syncEveryMin: 60, bootMin: 5 };
const SEED_MIN = (BASE.vmGB * 1024) / (BASE.mbps * 60);
/** Cut over a quarter of an hour after the second incremental sync. */
const PLAN = planMove({ ...BASE, cutoverAt: SEED_MIN + 2 * BASE.syncEveryMin + 15 }, 1000);
const COLD = naiveDowntime({ ...BASE, cutoverAt: null });

/** Seconds on screen for each kind of phase, whatever its real length. */
const SHOW_S: Record<PhaseKind, number> = { seed: 5.5, idle: 0.9, sync: 1.8, final: 1.6, boot: 1.8, done: 3.4 };
const SEGS = (() => {
  let a = 0;
  return PLAN.phases.map((p) => {
    const s = { kind: p.kind, a, b: a + SHOW_S[p.kind] };
    a = s.b;
    return s;
  });
})();
const STARTS = SEGS.map((s) => s.a);
const END = SEGS[SEGS.length - 1].b;

// The VM's disk as 24 blocks. Each later copy carries only the blocks that changed.
const COLS = 8;
const BLOCKS = 24;
const CHANGED = [[2, 9, 15, 20], [5, 18], [11]];
const CARRIERS = SEGS.filter((s) => s.kind === 'sync' || s.kind === 'final');
const FLY = 1;
const seedSeg = SEGS[0];
const seedStart = (j: number) => seedSeg.a + (j * (seedSeg.b - seedSeg.a - FLY)) / (BLOCKS - 1);
const flights = CHANGED.flatMap((set, k) =>
  set.map((block, j) => {
    const c = CARRIERS[k];
    const fly = Math.min(FLY, c.b - c.a);
    const start = c.a + (set.length > 1 ? (j * (c.b - c.a - fly)) / (set.length - 1) : 0);
    return { block, mark: c.a - 1.6 + (j * 1.4) / set.length, start, end: start + fly };
  }),
);

const WORD: Record<PhaseKind, string> = { seed: 'Seed copy', idle: 'In sync', sync: 'In sync', final: 'Cutover', boot: 'Power on', done: 'Migrated' };
const fmtMin = (m: number) => fmtDur(m / 60);

function caption(kind: PhaseKind, src: string): { tone: Tone | 'ink'; k: string; text: string } {
  if (kind === 'seed') return { tone: 'flow', k: 'Seed copy', text: `Move copies the whole VM to AHV while it keeps running on ${src}. Users notice nothing.` };
  if (kind === 'idle' || kind === 'sync') return { tone: 'flow', k: 'Keeping in sync', text: `Each sync sends only the blocks that changed since the last one, about ${Math.round((BASE.changeGBPerHour * BASE.syncEveryMin) / 60)} GB here. The target stays close behind until you pick a window.` };
  if (kind === 'final') return { tone: 'warn', k: 'Cutover', text: 'In the window you chose, the source VM shuts down so nothing changes, and the last few changes are copied.' };
  if (kind === 'boot') return { tone: 'warn', k: 'Power on at the target', text: 'The VM powers on in AHV. Downtime is only this final sync plus the power-on.' };
  return { tone: 'ok', k: 'Running on AHV', text: 'Users now work on the AHV copy. The source VM stays powered off until the app owner signs off.' };
}

export default function Migration() {
  const [src, setSrc] = useEnum<Src>('src', 'esxi', SRC_IDS);
  const syncSeg = SEGS.filter((s) => s.kind === 'sync')[1];
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: (syncSeg.a + syncSeg.b) / 2, stops: STARTS });
  useRestartOn(clock, [src]);
  const t = clock.t;
  const seg = SEGS[phaseAt(STARTS, t)];
  const cap = caption(seg.kind, SRC[src].box);

  return (
    <Show
      top={<Choice<Src> label="Source platform" value={src} onChange={setSrc} options={SRC_IDS.map((s) => ({ value: s, label: SRC[s].label }))} />}
      foot={
        <>
          <Follow tone={cap.tone} k={cap.k}>
            <p>{cap.text}</p>
            <p class="rest">{SRC[src].note}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Seed copy', v: fmtMin(PLAN.seedEnd), sub: 'while the VM runs' },
              { k: 'Downtime', v: fmtMin(PLAN.downtimeMin!), tone: 'ok', sub: 'final sync + power-on' },
              { k: 'Shut down, then copy all', v: fmtMin(COLD), tone: 'warn', sub: 'the downtime without syncs', tip: 'If the VM were stopped first and copied in one go.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <MoveDiagram src={src} kind={seg.kind} t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Data block' },
          { color: 'var(--warn)', label: 'Changed since the last copy' },
          { color: 'var(--flow)', label: 'Being copied' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Migration animation"
        fmt={() => WORD[seg.kind]}
        extra={<Illus why="Example figures: an 800 GB VM, 250 MB/s effective transfer, 6 GB of changes an hour, a sync every hour and 5 minutes to power on and check. Move’s real throughput and sync scheduling depend on version, source platform and environment." />}
      />
    </Show>
  );
}

// ── geometry ──
const W = 960;
const H = 284;
const BOX = { y: 56, w: 300, h: 216 };
const SRC_X = 10;
const TGT_X = 650;
const CARD_Y = 108;
const BS = 26;
const BG = 5;
const GRID_Y = CARD_Y + 34;
const LANE_Y = 166;

const blockXY = (boxX: number, j: number) => ({ x: boxX + 26 + (j % COLS) * (BS + BG), y: GRID_Y + Math.floor(j / COLS) * (BS + BG) });

function along(pts: { x: number; y: number }[], f: number) {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y));
  let d = f * seg.reduce((a, b) => a + b, 0);
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? Math.min(1, d / seg[i]) : 0;
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * r, y: pts[i].y + (pts[i + 1].y - pts[i].y) * r };
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

function MoveDiagram({ src, kind, t }: { src: Src; kind: PhaseKind; t: number }) {
  const S = SRC[src];
  const sourceOn = kind !== 'final' && kind !== 'boot' && kind !== 'done';
  const targetOn = kind === 'done';
  const booting = kind === 'boot';
  const users = sourceOn ? 'src' : targetOn ? 'tgt' : null;
  const center = (p: { x: number; y: number }) => ({ x: p.x + BS / 2, y: p.y + BS / 2 });
  const route = (j: number) => [center(blockXY(SRC_X, j)), { x: SRC_X + BOX.w, y: LANE_Y }, { x: 380, y: LANE_Y }, { x: 580, y: LANE_Y }, { x: TGT_X, y: LANE_Y }, center(blockXY(TGT_X, j))];

  // what each block looks like on each side right now, and which copies are in the air
  const srcCls: string[] = [];
  const tgtCls: string[] = [];
  const flying: { j: number; f: number }[] = [];
  for (let j = 0; j < BLOCKS; j++) {
    const s0 = seedStart(j);
    const f = prog(t, s0, s0 + FLY);
    srcCls.push('mig-blk');
    tgtCls.push(f >= 1 ? 'mig-blk' : 'mig-empty');
    if (f > 0 && f < 1) flying.push({ j, f });
  }
  for (const fl of flights) {
    if (t >= fl.mark && t < fl.start) srcCls[fl.block] = 'mig-chg';
    if (t > fl.start && t < fl.end) flying.push({ j: fl.block, f: prog(t, fl.start, fl.end) });
    if (t >= fl.end && t < fl.end + 0.7) tgtCls[fl.block] = 'mig-new';
  }

  const panel = (x: number, side: 'src' | 'tgt') => {
    const isSrc = side === 'src';
    const on = isSrc ? sourceOn : targetOn;
    const status = isSrc ? (sourceOn ? '● VM running, users working' : kind === 'done' ? '■ VM off, kept until sign-off' : '■ VM shut down') : targetOn ? '● VM running' : booting ? '◐ VM powering on' : '○ copy, powered off';
    const statusCls = on ? 'ok-fill' : booting && !isSrc ? 'warn-fill' : 'muted';
    return (
      <g>
        <rect x={x} y={BOX.y} width={BOX.w} height={BOX.h} class={isSrc && S.cloud ? 'frame-dash' : 'frame'} />
        <text x={x + 16} y={BOX.y + 24} class="mig-t">
          {isSrc ? S.box : 'Nutanix AHV'}
        </text>
        <text x={x + 16} y={BOX.y + 42} class="mig-xs muted">
          {isSrc ? S.sub : 'on-premises, or NC2 in the cloud'}
        </text>
        <rect x={x + 14} y={CARD_Y} width={BOX.w - 28} height={150} class={`mig-card${on ? ' on' : booting && !isSrc ? ' boot' : ''}`} stroke-dasharray={!isSrc && !on && !booting ? '5 4' : undefined} />
        <text x={x + 26} y={CARD_Y + 22} class="mig-s">
          VM
        </text>
        <text x={x + BOX.w - 26} y={CARD_Y + 22} text-anchor="end" class={`mig-xs ${statusCls}`} style={{ fontWeight: 600 }}>
          {status}
        </text>
        {(isSrc ? srcCls : tgtCls).map((c, j) => {
          const p = blockXY(x, j);
          return <rect key={j} x={p.x} y={p.y} width={BS} height={BS} class={c} style={isSrc && !sourceOn ? { opacity: 0.45 } : undefined} />;
        })}
        <text x={x + 26} y={GRID_Y + 3 * (BS + BG) + 12} class="mig-xs muted">
          {isSrc ? 'its disk' : 'the copy of its disk'}
        </text>
      </g>
    );
  };

  return (
    <svg class="diagram mig-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Moving a VM from ${S.box} to Nutanix AHV with Nutanix Move: ${WORD[kind]}.`}>
      <defs>
        <marker id="mig-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" class="mig-ar" />
        </marker>
      </defs>
      <rect x={W / 2 - 60} y={4} width={120} height={30} class="mig-users" />
      <text x={W / 2} y={24} text-anchor="middle" class="mig-s" style={{ fontWeight: 600 }}>
        Users
      </text>
      {users === 'src' && <path d={`M${W / 2 - 60} 19 H ${SRC_X + BOX.w / 2} V ${BOX.y - 4}`} class="mig-use" marker-end="url(#mig-ar)" />}
      {users === 'tgt' && <path d={`M${W / 2 + 60} 19 H ${TGT_X + BOX.w / 2} V ${BOX.y - 4}`} class="mig-use" marker-end="url(#mig-ar)" />}
      {!users && (
        <text x={W / 2} y={52} text-anchor="middle" class="mig-s warn-fill" style={{ fontWeight: 600 }}>
          Downtime: final sync + power-on
        </text>
      )}
      {panel(SRC_X, 'src')}
      {panel(TGT_X, 'tgt')}
      <line x1={SRC_X + BOX.w} x2={380} y1={LANE_Y} y2={LANE_Y} class="mig-lane" />
      <line x1={580} x2={TGT_X} y1={LANE_Y} y2={LANE_Y} class="mig-lane" />
      {/* copies in flight pass behind the Move box */}
      {flying.map(({ j, f }) => {
        const p = along(route(j), ease(f));
        return <rect key={j} x={p.x - 7} y={p.y - 7} width={14} height={14} class="mig-fly" />;
      })}
      <rect x={380} y={LANE_Y - 36} width={200} height={72} class="ink-fill" />
      <text x={480} y={LANE_Y - 6} text-anchor="middle" class="mig-t" style={{ fill: '#fff' }}>
        Nutanix Move
      </text>
      <text x={480} y={LANE_Y + 16} text-anchor="middle" class="mig-xs" style={{ fill: 'rgba(255,255,255,.85)' }}>
        {kind === 'seed' ? 'copying everything' : kind === 'final' ? 'copying the last changes' : kind === 'boot' || kind === 'done' ? 'copy complete' : 'sending only changes'}
      </text>
    </svg>
  );
}
