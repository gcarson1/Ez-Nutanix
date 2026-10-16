// Scale-out vs 3-tier: add a node and watch capacity and controller count grow together,
// compared neutrally with a design where hosts share one array's controller pair. Includes the
// honest CVM-overhead discussion with the user's own sizing figure. Math in src/engine/scaleout.ts.
import { useEffect, useState } from 'preact/hooks';
import './style.css';
import { useNum } from '../../../state/route';
import { useScenario } from '../../../state/scenario';
import { useClock } from '../../components/clock';
import { Field, Follow, Illus, Slider, Stat, Tip, fmtTB } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import { JOIN_STEPS, scaleModel } from '../../../engine/scaleout';

const MAX = 32;

export default function Scale() {
  const { cfg, set } = useScenario();
  const base = Math.max(3, cfg.nodes);
  const [arrays, setArrays] = useNum('arr', 1, 1, 4);
  const [cvm, setCvm] = useNum('cvm', 0, 0, 40);
  const [joining, setJoining] = useState(false);
  const clock = useClock({ rate: 0.45, duration: JOIN_STEPS.length - 1, stepSize: 1, keys: true });
  const stepIdx = Math.min(JOIN_STEPS.length - 1, Math.floor(clock.t + 1e-6));
  const step = joining ? JOIN_STEPS[stepIdx] : null;

  useEffect(() => {
    if (joining && clock.t >= JOIN_STEPS.length - 1 && !clock.playing) {
      set({ nodes: Math.min(MAX, base + 1) });
      setJoining(false);
      clock.reset();
    }
  }, [joining, clock.t, clock.playing]);

  const counted = base + (step && step.joined ? 1 : 0);
  const m = scaleModel({ nodes: counted, drivesPerNode: cfg.drivesPerNode, driveTB: cfg.driveTB, cvmShare: cvm / 100, arrays });
  const mb = scaleModel({ nodes: base, drivesPerNode: cfg.drivesPerNode, driveTB: cfg.driveTB, cvmShare: cvm / 100, arrays });
  const startJoin = () => {
    if (base >= MAX || joining) return;
    setJoining(true);
    clock.reset();
    clock.play();
  };

  return (
    <>
      <div class="lab scale-lab">
        <aside class="ctl" aria-label="Scale settings">
          <Field label="Nodes" tip="Cluster size from the shared scenario (three or more here)." value={base} why={cfg.nodes < 3 ? 'Shown with 3 nodes: this comparison starts at the standard RF2 minimum.' : null}>
            <Slider value={base} min={3} max={MAX} label="Nodes" onChange={(v) => !joining && set({ nodes: v })} />
          </Field>
          <Field label="Grow the cluster" tip="Add one node and step through what happens." why={base >= MAX ? `This explorer stops at ${MAX} nodes.` : null}>
            <div class="hstack">
              <button type="button" class="btn primary" disabled={joining || base >= MAX} onClick={startJoin}>
                <Icon name="plus" />
                Add a node
              </button>
              <button type="button" class="btn" disabled={joining || base <= 3} onClick={() => set({ nodes: base - 1 })} title="A graceful removal re-protects the node’s data elsewhere first.">
                <Icon name="minus" />
                Remove
              </button>
            </div>
            {joining && (
              <ol class="scale-steps">
                {JOIN_STEPS.map((s, i) => (
                  <li key={s.id} class={i === stepIdx ? 'on' : i < stepIdx ? 'past' : ''}>
                    {s.text}
                  </li>
                ))}
              </ol>
            )}
          </Field>
          <Field label="Arrays in the 3-tier design" tip="Each array here has a pair of controllers. Adding arrays adds controllers, but each array is its own pool to manage." value={arrays}>
            <Slider value={arrays} min={1} max={4} label="Arrays" onChange={setArrays} />
          </Field>
          <Field
            label="CVM reservation (your figure)"
            tip="Share of each node’s CPU and memory you reserve for its Controller VM. Take it from your sizing: it depends on the features you enable and the node size."
            value={cvm ? `${cvm}%` : 'not set'}
            note={<Illus why="No default is shown on purpose. Nutanix sizing tools calculate the CVM reservation from node size and enabled features." />}
          >
            <Slider value={cvm} min={0} max={40} label="CVM reservation percent" onChange={setCvm} />
          </Field>
        </aside>
        <section class="stage" aria-label="Scale-out compared with 3-tier">
          <div class="diagram-scroll">
            <ScaleDiagram base={base} step={step} arrays={arrays} drives={cfg.drivesPerNode} />
          </div>
          {step ? (
            <Follow tone={step.id === 'done' ? 'ok' : 'flow'} k={`Adding N${base + 1} · step ${stepIdx + 1} of ${JOIN_STEPS.length}`}>
              <p>{step.text}</p>
            </Follow>
          ) : (
            <Follow tone="ink" k="Every node brings its own controller">
              <p>
                In this cluster, {base} nodes means {base} storage controllers (one CVM each) working on {fmtTB(m.hci.rawTB)} of raw capacity. Add a node and both grow by one node’s worth. In the 3-tier layout, every host’s storage traffic goes through {m.tier3.controllers} array controllers ({m.tier3.hostsPerController.toFixed(1)} hosts per controller).
              </p>
            </Follow>
          )}
        </section>
        <aside class="rail" aria-label="Growth figures">
          <div class="side-sec">
            <div class="eyebrow">Storage controllers</div>
            <Stat k="Scale-out (one CVM per node)" v={m.hci.controllers} tone="ok" />
            <Stat k={`3-tier (${arrays} array${arrays > 1 ? 's' : ''})`} v={m.tier3.controllers} />
            <Stat k="Hosts per controller, 3-tier" v={m.tier3.hostsPerController.toFixed(1)} />
            <ControllerChart n={counted} arrays={arrays} />
          </div>
          <div class="side-sec">
            <div class="eyebrow">
              <Tip text="Drives per node and drive size come from the shared scenario. Usable capacity depends on RF and data reduction: see Protection & Capacity.">Raw capacity</Tip>
            </div>
            <div class="bignum" style={{ marginTop: 'var(--sp-2)' }}>{fmtTB(m.hci.rawTB)}</div>
            <p class="small muted" style={{ marginTop: 'var(--sp-2)' }}>
              +{fmtTB(cfg.drivesPerNode * cfg.driveTB)} per node ({cfg.drivesPerNode} × {cfg.driveTB} TB)
            </p>
            <button type="button" class="tbtn" onClick={() => go('nci/capacity')}>
              Usable capacity <Icon name="arrow" />
            </button>
          </div>
        </aside>
      </div>

      <h2 class="sec-h">The honest part: the CVM uses resources</h2>
      <div class="cols-2">
        <div>
          <p class="lede">
            Every design spends resources on storage controllers. An array puts them in a separate box. Here, each node reserves part of its CPU and memory for its CVM, and that reservation is not available to VMs.
          </p>
          <ul class="scale-list">
            <li>The size of the reservation depends on the features you turn on (for example deduplication, RF3 or replication) and on the node’s size. Get it from Nutanix sizing for your configuration rather than from a rule of thumb.</li>
            <li>Because every node reserves a similar share, the overhead grows in step with the cluster, and so does the controller capacity it buys.</li>
            <li>Count it once, in the sizing, and include it when you compare designs: the array’s controllers have a cost too, in hardware, space and power.</li>
          </ul>
        </div>
        <div>
          <OverheadBars n={base} share={cvm / 100} />
          {cvm > 0 ? (
            <p class="small" style={{ marginTop: 'var(--sp-3)' }}>
              With your {cvm}% figure, {base} nodes give about {mb.hci.vmNodeEquivalents.toFixed(1)} nodes’ worth of CPU and memory to VMs and {mb.hci.controllerNodeEquivalents.toFixed(1)} to {base} storage controllers. <Illus why="Simple proportion of your own input; real sizing also accounts for HA reserve, CPU versus memory and growth." />
            </p>
          ) : (
            <p class="small muted" style={{ marginTop: 'var(--sp-3)' }}>
              Set the CVM reservation from your sizing to see the split.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function ControllerChart({ n, arrays }: { n: number; arrays: number }) {
  const W = 260;
  const H = 120;
  const pad = 22;
  const x = (v: number) => pad + ((v - 3) / (MAX - 3)) * (W - pad - 8);
  const y = (v: number) => H - pad - (v / MAX) * (H - pad - 8);
  const hci = Array.from({ length: MAX - 2 }, (_, i) => i + 3);
  return (
    <svg class="scale-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Controllers versus hosts: scale-out grows to ${n}, 3-tier stays at ${2 * arrays}`}>
      <line x1={pad} x2={W - 8} y1={y(0)} y2={y(0)} class="scale-axis" />
      <line x1={pad} x2={pad} y1={8} y2={y(0)} class="scale-axis" />
      <path d={hci.map((v, i) => `${i ? 'L' : 'M'}${x(v)} ${y(v)}`).join(' ')} class="scale-hci" fill="none" />
      <path d={`M${x(3)} ${y(2 * arrays)} L${x(MAX)} ${y(2 * arrays)}`} class="scale-t3" fill="none" />
      <line x1={x(n)} x2={x(n)} y1={8} y2={y(0)} class="scale-axis dash" />
      <circle cx={x(n)} cy={y(n)} r={4} class="scale-dot" />
      <text x={pad} y={H - 6} class="scale-lbl">3 hosts</text>
      <text x={W - 8} y={H - 6} text-anchor="end" class="scale-lbl">
        {MAX}
      </text>
      <text x={x(MAX) - 10} y={y(MAX) + 24} text-anchor="end" class="scale-lbl scale-hci-t">
        scale-out
      </text>
      <text x={x(MAX) - 4} y={y(2 * arrays) - 6} text-anchor="end" class="scale-lbl">
        3-tier
      </text>
    </svg>
  );
}

function ScaleDiagram({ base, step, arrays, drives }: { base: number; step: (typeof JOIN_STEPS)[number] | null; arrays: number; drives: number }) {
  const W = 820;
  const total = base + (step ? 1 : 0);
  const perRow = 8;
  const gap = 8;
  const nW = (W - 20 - gap * (perRow - 1)) / perRow;
  const nH = 66;
  const rows = Math.ceil(total / perRow);
  const hTop = 34;
  const nodeXY = (i: number, top: number, h: number) => ({ x: 10 + (i % perRow) * (nW + gap), y: top + Math.floor(i / perRow) * (h + gap) });
  const poolY = hTop + rows * (nH + gap) + 2;
  const t3Top = poolY + 70;
  const sH = 40;
  const t3Rows = Math.ceil(total / perRow);
  const fabY = t3Top + t3Rows * (sH + gap) + 30;
  const arrY = fabY + 56;
  const arrW = Math.min(240, (W - 20 - (arrays - 1) * 16) / arrays);
  const arrX = (a: number) => (W - (arrays * arrW + (arrays - 1) * 16)) / 2 + a * (arrW + 16);
  const H = arrY + 110;
  const newIdx = step ? base : -1;
  const dShow = Math.min(drives, 6);

  return (
    <svg class="diagram scale-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Scale-out cluster of ${total} nodes compared with ${total} hosts on a 3-tier design with ${arrays} array(s)`}>
      <text x={10} y={20} class="scale-h">
        Scale-out: each node adds compute, drives and a storage controller (CVM)
      </text>
      {Array.from({ length: total }, (_, i) => {
        const { x, y } = nodeXY(i, hTop, nH);
        const isNew = i === newIdx;
        const joined = !isNew || !!step?.joined;
        return (
          <g key={i} class={isNew && !joined ? 'scale-pending' : ''}>
            <rect x={x} y={y} width={nW} height={nH} class={`node-box${isNew ? ' sel' : ''}`} stroke-dasharray={isNew && !joined ? '5 4' : undefined} />
            <text x={x + 8} y={y + 18} class="scale-s">
              N{i + 1}
              {isNew ? ' (new)' : ''}
            </text>
            <rect x={x + 8} y={y + 26} width={nW - 16} height={14} class={joined ? 'cvm' : 'bg3'} />
            <text x={x + 13} y={y + 37} class="scale-xs" style={{ fill: joined ? '#fff' : undefined }}>
              CVM
            </text>
            {Array.from({ length: dShow }, (_, d) => (
              <rect key={d} x={x + 8 + d * ((nW - 16) / dShow)} y={y + 46} width={(nW - 16) / dShow - 3} height={12} class="disk" />
            ))}
          </g>
        );
      })}
      <rect x={10} y={poolY} width={W - 20} height={26} class="ink-soft" stroke="var(--ink-line)" stroke-dasharray={step && !step.joined ? '4 3' : undefined} />
      <text x={W / 2} y={poolY + 17} text-anchor="middle" class="scale-s ink-text-fill">
        One storage pool across all {base + (step?.joined ? 1 : 0)} nodes{step?.balancing ? ' · disk balancing in progress' : ''}
      </text>
      {step?.balancing &&
        Array.from({ length: Math.min(4, base) }, (_, k) => {
          const a = nodeXY(k * 2 < base ? k * 2 : k, hTop, nH);
          const b = nodeXY(newIdx, hTop, nH);
          return <path key={k} d={`M${a.x + nW / 2} ${a.y + nH} Q ${(a.x + b.x) / 2 + nW / 2} ${poolY + 10}, ${b.x + nW / 2} ${b.y + nH}`} class="xfer balance" />;
        })}

      <line x1={10} x2={W - 10} y1={t3Top - 34} y2={t3Top - 34} class="scale-axis" />
      <text x={10} y={t3Top - 12} class="scale-h">
        3-tier: hosts, a storage network, and {arrays === 1 ? 'an array with a controller pair' : `${arrays} arrays, each with a controller pair`}
      </text>
      {Array.from({ length: total }, (_, i) => {
        const { x, y } = nodeXY(i, t3Top, sH);
        const isNew = i === newIdx;
        return (
          <g key={i}>
            <line x1={x + nW / 2} y1={y + sH} x2={x + nW / 2} y2={fabY} class="scale-link" />
            <rect x={x} y={y} width={nW} height={sH} class={`node-box${isNew ? ' sel' : ''}`} />
            <text x={x + 8} y={y + 24} class="scale-s">
              Host {i + 1}
            </text>
          </g>
        );
      })}
      <rect x={10} y={fabY} width={W - 20} height={22} class="bg3" stroke="var(--line-2)" />
      <text x={W / 2} y={fabY + 15} text-anchor="middle" class="scale-xs muted">
        storage network (SAN)
      </text>
      {Array.from({ length: arrays }, (_, a) => {
        const ax = arrX(a);
        return (
          <g key={a}>
            {[0, 1].map((c) => (
              <line key={c} x1={ax + arrW * (c ? 0.72 : 0.28)} y1={fabY + 22} x2={ax + arrW * (c ? 0.72 : 0.28)} y2={arrY + 10} class="scale-link strong" />
            ))}
            <rect x={ax} y={arrY} width={arrW} height={96} class="frame" />
            {[0, 1].map((c) => (
              <g key={c}>
                <rect x={ax + 10 + c * ((arrW - 30) / 2 + 10)} y={arrY + 10} width={(arrW - 30) / 2} height={34} class="ink-fill" />
                <text x={ax + 10 + c * ((arrW - 30) / 2 + 10) + (arrW - 30) / 4} y={arrY + 32} text-anchor="middle" class="scale-xs" style={{ fill: '#fff' }}>
                  Controller {c ? 'B' : 'A'}
                </text>
              </g>
            ))}
            <rect x={ax + 10} y={arrY + 54} width={arrW - 20} height={32} class="bg2" stroke="var(--line-2)" />
            <text x={ax + arrW / 2} y={arrY + 74} text-anchor="middle" class="scale-xs muted">
              drive shelves
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function OverheadBars({ n, share }: { n: number; share: number }) {
  const W = 520;
  const show = Math.min(n, 16);
  const bw = (W - 10) / show - 6;
  const H = 120;
  return (
    <svg class="scale-over" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={share ? `Each node reserves ${Math.round(share * 100)} percent for its CVM` : 'CVM reservation not set'}>
      {Array.from({ length: show }, (_, i) => {
        const x = 5 + i * (bw + 6);
        const ch = share ? Math.max(3, (H - 40) * share) : 0;
        return (
          <g key={i}>
            <rect x={x} y={10} width={bw} height={H - 40} class="scale-vm" />
            {share > 0 ? <rect x={x} y={10 + (H - 40) - ch} width={bw} height={ch} class="scale-cvm" /> : <rect x={x} y={10 + (H - 40) - 18} width={bw} height={18} class="scale-cvm-unset" />}
            {show <= 12 && (
              <text x={x + bw / 2} y={H - 14} text-anchor="middle" class="scale-lbl">
                N{i + 1}
              </text>
            )}
          </g>
        );
      })}
      <text x={5} y={H - 1} class="scale-lbl">
        {share ? 'Purple: CVM reservation · gray: available to VMs' : 'Dashed: CVM reservation, size from your sizing'}
        {n > show ? ` · first ${show} of ${n} nodes` : ''}
      </text>
    </svg>
  );
}
