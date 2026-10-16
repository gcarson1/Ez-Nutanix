// Migration with Nutanix Move: seed copy while the source runs, incremental syncs, then a
// cutover with a short downtime window. Timeline math lives in engine/move.ts.
import { useState } from 'preact/hooks';
import { Chip, Field, Follow, Illus, PlayBar, Seg, Slider, Stat, Tip, fmtDur } from '../../components/controls';
import { useClock } from '../../components/clock';
import { Icon } from '../../components/Icon';
import { useEnum, useNum } from '../../../state/route';
import { go } from '../../shell/nav';
import { naiveDowntime, phaseAt, planMove, type PhaseKind } from '../../../engine/move';
import './style.css';

type Src = 'esxi' | 'hyperv' | 'ec2' | 'azure' | 'vmc' | 'ahv';
const SRC: Record<Src, { label: string; long: string }> = {
  esxi: { label: 'VMware vSphere / ESXi', long: 'VMware vSphere (ESXi hosts via vCenter)' },
  hyperv: { label: 'Microsoft Hyper-V', long: 'Microsoft Hyper-V' },
  ec2: { label: 'AWS EC2', long: 'Native AWS EC2 instances' },
  azure: { label: 'Azure VMs', long: 'Native Azure virtual machines' },
  vmc: { label: 'VMware Cloud', long: 'VMware Cloud (VMC on AWS, Azure VMware Solution)' },
  ahv: { label: 'Another AHV cluster', long: 'Another Nutanix AHV cluster' },
};
type Tgt = 'ahv' | 'nc2aws' | 'nc2az' | 'nc2gcp' | 'nc2ovh';
const TGT: Record<Tgt, string> = { ahv: 'AHV on-premises', nc2aws: 'NC2 on AWS', nc2az: 'NC2 on Azure', nc2gcp: 'NC2 on Google Cloud', nc2ovh: 'NC2 on OVHcloud' };

const PH: Record<PhaseKind, { label: string; cls: string }> = {
  seed: { label: 'Seed: full copy, source running', cls: 'flow-fill' },
  sync: { label: 'Incremental sync', cls: 'flow-fill' },
  idle: { label: 'Waiting for next sync', cls: 'bg3' },
  final: { label: 'Cutover: final sync, source off', cls: 'warn-fill' },
  boot: { label: 'Cutover: power on at target', cls: 'warn-fill' },
  done: { label: 'Running on target', cls: 'ok-fill' },
};

const fmtMin = (m: number) => (m < 1 ? '0 min' : fmtDur(m / 60));

export default function Migration() {
  const [src, setSrc] = useEnum<Src>('src', 'esxi', ['esxi', 'hyperv', 'ec2', 'azure', 'vmc', 'ahv']);
  const [tgt, setTgt] = useEnum<Tgt>('tgt', 'ahv', ['ahv', 'nc2aws', 'nc2az', 'nc2gcp', 'nc2ovh']);
  const [gb, setGb] = useNum('gb', 800, 50, 4000);
  const [mbps, setMbps] = useNum('mb', 250, 25, 1000);
  const [chg, setChg] = useNum('cr', 6, 0, 200);
  const [every, setEvery] = useNum('se', 60, 10, 240);
  const [boot, setBoot] = useNum('bt', 5, 1, 30);
  const [cut, setCut] = useState<number | null>(null);
  const input = { vmGB: gb, mbps, changeGBPerHour: chg, syncEveryMin: every, cutoverAt: cut, bootMin: boot };
  const seedMin = (gb * 1024) / (mbps * 60);
  const horizon = Math.max(seedMin + every * 3.2, cut !== null ? cut + every * 0.6 + boot + 30 : 0);
  const plan = planMove(input, horizon);
  const clock = useClock({ rate: horizon / 18, duration: horizon, stepSize: Math.max(5, every / 2), keys: true });
  const t = clock.t;
  const ph = phaseAt(plan, t);
  const cold = naiveDowntime(input);
  const canCut = cut === null && t >= plan.seedEnd;
  const reset = () => (setCut(null), clock.reset());
  const sourceOff = plan.cutoverStart !== null && t >= plan.cutoverStart;
  const onTarget = plan.doneAt !== null && t >= plan.doneAt;

  const W = 920;
  const l = 130;
  const r = 20;
  const sx = (m: number) => l + (m / horizon) * (W - l - r);
  const ticks: number[] = [];
  const step = horizon > 2000 ? 480 : horizon > 900 ? 240 : horizon > 400 ? 120 : 60;
  for (let m = 0; m <= horizon; m += step) ticks.push(m);

  let tone: 'ok' | 'warn' | 'bad' | 'flow' | 'ink' = 'ink';
  let k = 'Ready';
  let msg = 'Press Play. Move copies the VM while it keeps running on the source.';
  if (!plan.converges) {
    tone = 'bad';
    k = 'Syncs cannot keep up';
    msg = 'The VM changes data faster than the link can copy it, so each incremental sync is bigger than the last. Add bandwidth, migrate at a quieter time, or reduce the change rate before cutting over.';
  } else if (onTarget) {
    tone = 'ok';
    k = 'Migrated';
    msg = `The VM runs on ${TGT[tgt]}. Downtime was ${fmtMin(plan.downtimeMin!)}: the final small sync plus the power-on. Shutting down first and copying everything would have taken about ${fmtMin(cold)}.`;
  } else if (sourceOff) {
    tone = 'warn';
    k = 'Cutover in progress';
    msg = 'The source VM is shut down so nothing changes, the last changes are copied, and the VM powers on at the target.';
  } else if (t >= plan.seedEnd) {
    tone = 'flow';
    k = 'In sync, waiting for you';
    msg = `The seed is done. Move keeps the target current with incremental syncs; each one carries about ${plan.lastDeltaGB.toFixed(1)} GB. Cut over when it suits the business.`;
  } else if (t > 0) {
    tone = 'flow';
    k = 'Seeding';
    msg = 'Full copy in progress. Users keep working on the source VM.';
  }

  return (
    <>
      <div class="lab">
        <div class="ctl">
          <Field label="Source" tip="Where the VMs run today. Move also migrates file shares (SMB v2+, NFS v3) into Nutanix Files.">
            <Seg label="Source" value={src} onChange={(v) => (setSrc(v), reset())} options={(Object.keys(SRC) as Src[]).map((s) => ({ value: s, label: SRC[s].label }))} />
          </Field>
          <Field label="Target">
            <Seg label="Target" value={tgt} onChange={(v) => (setTgt(v), reset())} options={(Object.keys(TGT) as Tgt[]).map((s) => ({ value: s, label: TGT[s] }))} />
            <p class="field-note">Check the Move support matrix for your exact source and target pair and versions.</p>
          </Field>
          <Field label="VM data" value={`${gb} GB`}>
            <Slider label="VM size" value={gb} min={50} max={4000} step={50} onChange={(v) => (setGb(v), reset())} />
          </Field>
          <Field label="Effective transfer rate" value={`${mbps} MB/s`} tip="What Move actually achieves end to end: network, source storage and target together.">
            <Slider label="Transfer rate" value={mbps} min={25} max={1000} step={25} onChange={(v) => (setMbps(v), reset())} />
          </Field>
          <Field label="Change rate on the source" value={`${chg} GB/h`} tip="How much data the running VM rewrites per hour. Busy databases change more.">
            <Slider label="Change rate" value={chg} min={0} max={200} step={1} onChange={(v) => (setChg(v), reset())} />
          </Field>
          <Field label="Incremental sync every" value={`${every} min`}>
            <Slider label="Sync interval" value={every} min={10} max={240} step={10} onChange={(v) => (setEvery(v), reset())} />
          </Field>
          <Field label="Power-on and checks at target" value={`${boot} min`}>
            <Slider label="Boot minutes" value={boot} min={1} max={30} onChange={(v) => (setBoot(v), reset())} />
          </Field>
          <div class="hstack" style={{ marginTop: 'var(--sp-3)' }}>
            <Illus why="All rates and intervals are your assumptions. Move’s real sync scheduling and throughput depend on version, source platform and environment." />
          </div>
        </div>
        <div class="stage">
          <div class="spread">
            <h2 class="sec-h" style={{ margin: 0 }}>
              {SRC[src].label} → {TGT[tgt]}
            </h2>
            <Chip tone={onTarget ? 'ok' : sourceOff ? 'warn' : t > 0 ? 'flow' : 'neutral'}>{PH[ph.kind].label.split(':')[0]}</Chip>
          </div>
          <div class="diagram-scroll">
            <svg class="diagram" viewBox={`0 0 ${W} 330`} role="img" aria-label={`Migration timeline: ${PH[ph.kind].label}`}>
              {/* top: environments */}
              <rect x={10} y={10} width={260} height={80} rx={4} class={sourceOff ? 'node-box down' : 'node-box'} />
              <text x={24} y={34} style={{ fontWeight: 600, fontSize: '13.5px' }}>
                Source: {SRC[src].label}
              </text>
              <text x={24} y={56} class={sourceOff ? 'bad-fill' : 'ok-fill'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                {sourceOff ? '■ VM shut down' : '● VM running, users working'}
              </text>
              <text x={24} y={76} class="muted" style={{ fontSize: '11.5px' }}>
                {gb} GB · changes {chg} GB/h
              </text>
              <rect x={330} y={22} width={260} height={56} rx={4} class="ink-fill" />
              <text x={460} y={46} text-anchor="middle" style={{ fill: '#fff', fontWeight: 600, fontSize: '13.5px' }}>
                Nutanix Move
              </text>
              <text x={460} y={64} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.8)', fontSize: '11.5px' }}>
                appliance VM · free for Nutanix customers
              </text>
              <rect x={650} y={10} width={260} height={80} rx={4} class="node-box" />
              <text x={664} y={34} style={{ fontWeight: 600, fontSize: '13.5px' }}>
                Target: {TGT[tgt]}
              </text>
              <text x={664} y={56} class={onTarget ? 'ok-fill' : 'muted'} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                {onTarget ? '● VM running' : t > 0 ? '○ copy in progress, VM off' : '○ empty'}
              </text>
              <line x1={270} x2={330} y1={50} y2={50} class={t > 0 && !onTarget ? 'xfer' : 'line'} stroke-width={2} stroke-dasharray="6 5" stroke-dashoffset={-t * 2} />
              <line x1={590} x2={650} y1={50} y2={50} class={t > 0 && !onTarget ? 'xfer' : 'line'} stroke-width={2} stroke-dasharray="6 5" stroke-dashoffset={-t * 2} />

              {/* timeline */}
              {ticks.map((m) => (
                <g key={m}>
                  <line x1={sx(m)} x2={sx(m)} y1={124} y2={286} class="line" stroke-dasharray="2 4" />
                  <text x={sx(m)} y={304} text-anchor="middle" class="mono muted" style={{ fontSize: '11px' }}>
                    {m >= 60 ? `${(m / 60).toFixed(m % 60 ? 1 : 0)} h` : `${m} m`}
                  </text>
                </g>
              ))}
              <text x={0} y={152} style={{ fontWeight: 600, fontSize: '13px' }}>
                Data copy
              </text>
              {plan.phases
                .filter((p) => p.kind !== 'done' && p.end > p.start && p.start < horizon)
                .map((p, i) => (
                  <rect key={i} x={sx(p.start)} y={136} width={Math.max(p.kind === 'sync' || p.kind === 'final' ? 2 : 0, sx(Math.min(p.end, horizon)) - sx(p.start))} height={24} class={PH[p.kind].cls} style={{ opacity: p.kind === 'sync' ? 0.6 : p.kind === 'idle' ? 1 : 0.9 }} />
                ))}
              <text x={0} y={202} style={{ fontWeight: 600, fontSize: '13px' }}>
                Source VM
              </text>
              <rect x={sx(0)} y={186} width={sx(plan.cutoverStart ?? horizon) - sx(0)} height={24} class="ok-fill" style={{ opacity: 0.55 }} />
              <text x={0} y={252} style={{ fontWeight: 600, fontSize: '13px' }}>
                Target VM
              </text>
              {plan.doneAt !== null && <rect x={sx(plan.doneAt)} y={236} width={sx(horizon) - sx(plan.doneAt)} height={24} class="ok-fill" style={{ opacity: 0.55 }} />}
              {plan.cutoverStart !== null && plan.doneAt !== null && (
                <g>
                  <rect x={sx(plan.cutoverStart)} y={128} width={Math.max(3, sx(plan.doneAt) - sx(plan.cutoverStart))} height={140} class="warn-fill" style={{ opacity: 0.18 }} />
                  <text x={sx(plan.cutoverStart) - 6} y={282} text-anchor="end" class="warn-fill halo" style={{ fontSize: '12px', fontWeight: 600 }}>
                    downtime {fmtMin(plan.downtimeMin!)}
                  </text>
                </g>
              )}
              <line x1={sx(plan.seedEnd)} x2={sx(plan.seedEnd)} y1={124} y2={166} stroke="var(--text)" stroke-dasharray="3 2" />
              <text x={sx(plan.seedEnd) + 4} y={120} class="muted" style={{ fontSize: '11px' }}>
                seed done
              </text>
              <line x1={sx(Math.min(t, horizon))} x2={sx(Math.min(t, horizon))} y1={124} y2={290} stroke="var(--text)" stroke-width={2} />
            </svg>
          </div>
          <PlayBar
            clock={clock}
            label="Migration"
            fmt={(m) => `T+${fmtMin(m)}`}
            extra={
              <button type="button" class="btn" disabled={!canCut || !plan.converges} title={!canCut ? (cut !== null ? 'Cutover already scheduled' : 'Available once the seed is done') : undefined} onClick={() => (setCut(t), clock.play())}>
                <Icon name="power" /> Cut over now
              </button>
            }
          />
          {cut === null && t < plan.seedEnd && <p class="field-note">“Cut over now” becomes available when the seed copy is done.</p>}
          {cut !== null && (
            <button type="button" class="tbtn" onClick={reset}>
              Start over
            </button>
          )}
          <Follow tone={tone} k={k}>
            <p>{msg}</p>
          </Follow>
        </div>
        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">Numbers</div>
            <Stat k="Seed copy" v={fmtMin(plan.seedEnd)} />
            <Stat k="Typical incremental" v={`${((chg * every) / 60).toFixed(1)} GB`} tip="What changes between two syncs." />
            <Stat k="Downtime" v={plan.downtimeMin !== null ? fmtMin(plan.downtimeMin) : 'not cut over yet'} tone={plan.downtimeMin !== null ? 'ok' : undefined} />
            <Stat k="Shut down, then copy all" v={fmtMin(cold)} tone="warn" tip="The downtime if the VM were stopped first and copied in one go." />
          </div>
          <div class="side-sec">
            <div class="eyebrow">Move today</div>
            <ul class="small mig-list">
              <li>Sources: vSphere/ESXi, Hyper-V, AWS EC2, Azure, VMware Cloud (VMC, AVS), AHV, and file shares.</li>
              <li>Targets: AHV on-premises and NC2 on AWS, Azure, Google Cloud and OVHcloud.</li>
              <li>Move 6.3 (Jul 2026): zero-copy ESXi-to-AHV migration with supported external arrays (Dell PowerStore, Pure Storage).</li>
              <li>Move 6.3.3 (Oct 2026): DirectPath, ESXi to AHV without VDDK, for new deployments.</li>
            </ul>
          </div>
          <div class="side-sec">
            <button type="button" class="tbtn" onClick={() => go('cloud')}>
              Migrating to the cloud <Icon name="arrow" />
            </button>
          </div>
        </div>
      </div>
      <h2 class="sec-h">How a wave of migrations usually runs</h2>
      <ol class="mig-steps">
        <li>
          <strong>Plan.</strong> Group VMs by application, so things that talk to each other move together. Map networks on both sides.
        </li>
        <li>
          <strong>Seed.</strong> Move copies each VM while it runs. Nothing changes for users.
        </li>
        <li>
          <strong>Keep in sync.</strong> Incremental syncs carry only what changed.
        </li>
        <li>
          <strong>Cut over in a window.</strong> Shut down, final sync, power on at the target. <Tip text="Move can prepare the guest OS for the target, for example by installing drivers, automatically or manually depending on the OS and access you provide.">Guest preparation</Tip> happens before this so the VM boots cleanly.
        </li>
        <li>
          <strong>Verify, then retire the source.</strong> Keep the source VM powered off until the app owner signs off.
        </li>
      </ol>
    </>
  );
}
