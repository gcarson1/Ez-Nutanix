// Edge & ROBO: 1-node, 2-node (with Witness) and 3-node clusters at small sites, what each one
// survives, and how they are all managed from one Prism Central. Scenario steps live in data.ts.
import './style.css';
import { useEnum } from '../../../state/route';
import { useClock } from '../../components/clock';
import { Chip, Field, Follow, Illus, Seg, Tip, type Tone as ChipTone } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import { edgeAdvisory } from '../../../engine/rules';
import { EVENTS, MATRIX, SIZES, STEPS, type EventId, type Size, type Step } from './data';

const SIZE_IDS = SIZES.map((s) => s.id);
const EVENT_IDS = EVENTS.map((e) => e.id);
const TONE_WORD = { ok: 'Keeps running', warn: 'Degraded', bad: 'Down', na: 'n/a' } as const;

export default function Edge() {
  const [size, setSize] = useEnum<Size>('sz', '2', SIZE_IDS);
  const [ev, setEv] = useEnum<EventId>('ev', 'node', EVENT_IDS);
  const steps = STEPS[size][ev] ?? [];
  const avail = (e: EventId) => !!STEPS[size][e];
  const clock = useClock({ rate: 0.4, duration: Math.max(0, steps.length - 1), stepSize: 1, keys: true });
  const idx = Math.min(steps.length - 1, Math.floor(clock.t + 1e-6));
  const step: Step | undefined = steps[idx];
  const nodes = SIZES.find((s) => s.id === size)!.nodes;

  const pick = (s: Size, e: EventId) => {
    if (!STEPS[s][e]) e = 'node';
    setSize(s);
    setEv(e);
    clock.reset();
  };

  return (
    <>
      <div class="lab ctl-only edge-lab">
        <aside class="ctl" aria-label="Site settings">
          <Field label="Cluster size at the site" tip="Small sites often run one, two or three nodes. Each size trades cost and rack space against what it survives." note={edgeAdvisory(nodes) ?? 'Three-node cluster: the standard minimum for RF2, with self-healing after a node or drive failure when there is free capacity.'}>
            <Seg label="Cluster size" value={size} onChange={(s) => pick(s, ev)} options={SIZES.map((s) => ({ value: s.id, label: s.label }))} />
          </Field>
          <Field label="What happens" tip="Pick an event and step through how the cluster responds." note={size !== '2' ? '“Nodes lose contact” applies to two-node clusters, where a Witness breaks the tie.' : undefined}>
            <div class="edge-events" role="group" aria-label="Event">
              {EVENTS.map((e) => (
                <button key={e.id} type="button" class="btn" aria-pressed={ev === e.id} disabled={!avail(e.id)} title={avail(e.id) ? e.tip : 'Applies to two-node clusters'} onClick={() => pick(size, e.id)}>
                  {e.label}
                </button>
              ))}
            </div>
          </Field>
          <div class="edge-steps-ctl">
            <div class="hstack">
              <button type="button" class="btn primary" onClick={clock.toggle}>
                <Icon name={clock.playing ? 'pause' : 'play'} />
                {clock.playing ? 'Pause' : 'Play'}
              </button>
              <button type="button" class="btn" onClick={() => clock.step(-1)} aria-label="Previous step">
                <Icon name="stepback" />
              </button>
              <button type="button" class="btn" onClick={() => clock.step(1)} aria-label="Next step">
                <Icon name="step" />
              </button>
              <button type="button" class="tbtn" onClick={clock.reset}>
                <Icon name="reset" />
                Reset
              </button>
            </div>
            <ol class="edge-steps">
              {steps.map((s, i) => (
                <li key={i} class={i === idx ? 'on' : i < idx ? 'past' : ''}>
                  <button type="button" onClick={() => (clock.pause(), clock.seek(i))} aria-current={i === idx ? 'step' : undefined}>
                    <span class={`edge-dot ${s.tone}`} aria-hidden="true" />
                    <span>{s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>
        <section class="stage" aria-label="Site diagram">
          <div class="diagram-scroll">
            <SiteDiagram size={size} nodes={nodes} step={step} />
          </div>
          {step && (
            <Follow tone={step.tone === 'ok' ? 'ok' : step.tone === 'bad' ? 'bad' : 'warn'} k={`Step ${idx + 1} of ${steps.length}`}>
              <p>
                {step.text} {step.illus && <Illus why={step.illus} />}
              </p>
            </Follow>
          )}
        </section>
      </div>

      <h2 class="sec-h">What each size survives</h2>
      <div class="diagram-scroll edge-matrix-wrap">
        <table class="tbl edge-matrix">
          <thead>
            <tr>
              <th>Event</th>
              {SIZES.map((s) => (
                <th key={s.id} class={s.id === size ? 'on' : ''}>
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((r) => (
              <tr key={r.row}>
                <td>{r.row}</td>
                {SIZES.map((s) => {
                  const c = r.cells[s.id];
                  return (
                    <td key={s.id} class={s.id === size ? 'on' : ''}>
                      {c.tone === 'na' ? <span class="muted">{c.text}</span> : (
                        <>
                          <Chip tone={c.tone as ChipTone}>{TONE_WORD[c.tone]}</Chip>
                          <div class="small edge-cell">{c.text}</div>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="cols-3 edge-cards">
        <div>
          <h2 class="sec-h">1 node</h2>
          <p class="small">
            Lowest cost and footprint, with lowered resiliency: there is no node-level redundancy, so a node outage is site downtime. Plan backups or replication to another site. Upgrades of AOS and AHV need the guest VMs shut down, and firmware is updated manually.
          </p>
        </div>
        <div>
          <h2 class="sec-h">2 nodes + Witness</h2>
          <p class="small">
            Survives a node failure without a third server. A small <Tip text="A VM that runs at a separate site, often the data center. It breaks the tie when the two nodes cannot agree which one should carry on, and LCM and node maintenance require it to be registered.">Witness VM</Tip> at another site gives automatic failover. Size each node to carry the whole site. From AOS 7.6, a two-node AHV cluster can be expanded to three nodes.
          </p>
        </div>
        <div>
          <h2 class="sec-h">3 nodes</h2>
          <p class="small">
            The standard minimum for RF2. Self-heals after a node or drive failure if there is free capacity, and upgrades roll through with no VM downtime. With RF2 there is no spare tolerance while one node is out, so keep N+1 headroom.
          </p>
        </div>
      </div>

      <Follow tone="ink" k="Managed centrally">
        <p>
          Each site keeps running on its own, with Prism Element on the cluster. Prism Central, usually in the data center, manages many registered sites as one fleet: health, alerts, capacity and LCM upgrades. It can upgrade different clusters in parallel, while each cluster still goes one node at a time. Nutanix Central sits above several Prism Central instances.
        </p>
        <p class="hstack">
          <button type="button" class="btn" onClick={() => go('central')}>
            Nutanix Central <Icon name="arrow" />
          </button>
          <button type="button" class="btn" onClick={() => go('nci/lcm', size === '2' ? { nodes: '2', mem: '40' } : { nodes: size })}>
            Upgrade this size in LCM <Icon name="arrow" />
          </button>
        </p>
      </Follow>
    </>
  );
}

function SiteDiagram({ size, nodes, step }: { size: Size; nodes: number; step?: Step }) {
  const W = 820;
  const H = 360;
  const dc = { x: 10, y: 40, w: 230, h: 290 };
  const site = { x: 300, y: 40, w: 510, h: 290 };
  const nW = 140;
  const gap = 22;
  const rowW = nodes * nW + (nodes - 1) * gap;
  const nx = (i: number) => site.x + (site.w - rowW) / 2 + i * (nW + gap);
  const nY = site.y + 70;
  const nH = 190;
  const down = new Set(step?.down ?? []);
  const wanCut = !!step?.wan;
  const peerCut = !!step?.peer;
  const vmsPer = nodes === 1 ? 4 : 3;
  const two = size === '2';
  const witY = dc.y + 170;

  const vmHost = (owner: number) => (down.has(owner) && step?.vmsTo !== undefined ? step.vmsTo : owner);
  const vms: { owner: number; host: number; k: number }[] = [];
  for (let o = 0; o < nodes; o++) for (let k = 0; k < vmsPer; k++) vms.push({ owner: o, host: vmHost(o), k });
  const perHost = new Map<number, number>();

  return (
    <svg class="diagram edge-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${SIZES.find((s) => s.id === size)!.label} cluster at a branch site, managed from the data center. ${step?.text ?? ''}`}>
      {/* data center */}
      <rect x={dc.x} y={dc.y} width={dc.w} height={dc.h} class="frame" />
      <text x={dc.x + 12} y={dc.y - 10} class="edge-cap muted">
        DATA CENTER
      </text>
      <rect x={dc.x + 16} y={dc.y + 20} width={dc.w - 32} height={70} class="ink-fill" />
      <text x={dc.x + dc.w / 2} y={dc.y + 48} text-anchor="middle" class="edge-t" style={{ fill: '#fff' }}>
        Prism Central
      </text>
      <text x={dc.x + dc.w / 2} y={dc.y + 68} text-anchor="middle" class="edge-s" style={{ fill: 'rgba(255,255,255,.82)' }}>
        manages every site
      </text>
      {['Site 2', 'Site 3', 'Site 4'].map((s, i) => (
        <g key={s}>
          <rect x={dc.x + 16 + i * 68} y={dc.y + 104} width={60} height={34} class="bg3" stroke="var(--line-2)" />
          <text x={dc.x + 46 + i * 68} y={dc.y + 126} text-anchor="middle" class="edge-xs muted">
            {s}
          </text>
        </g>
      ))}
      {two && (
        <g>
          <rect x={dc.x + 16} y={witY} width={dc.w - 32} height={52} class="bg2" stroke="var(--ink)" stroke-width={1.5} />
          <text x={dc.x + dc.w / 2} y={witY + 22} text-anchor="middle" class="edge-t">
            Witness VM
          </text>
          <text x={dc.x + dc.w / 2} y={witY + 40} text-anchor="middle" class="edge-xs muted">
            separate failure domain
          </text>
        </g>
      )}

      {/* WAN */}
      <line x1={dc.x + dc.w} y1={dc.y + 55} x2={site.x} y2={dc.y + 55} class={wanCut ? 'bad-stroke' : 'edge-link'} stroke-width={2.5} stroke-dasharray={wanCut ? '6 5' : undefined} />
      <text x={(dc.x + dc.w + site.x) / 2} y={dc.y + 46} text-anchor="middle" class={`edge-xs ${wanCut ? 'bad-fill' : 'muted'}`}>
        {wanCut ? '✕ WAN' : 'WAN'}
      </text>
      {two &&
        [0, 1].map((i) => (
          <path
            key={i}
            d={`M${dc.x + dc.w - 16} ${witY + 26} C ${site.x + 40} ${nY + nH + 44}, ${nx(i) + nW / 2} ${nY + nH + 44}, ${nx(i) + nW / 2} ${nY + nH}`}
            fill="none"
            class={wanCut ? 'bad-stroke' : 'edge-wit'}
            stroke-dasharray="4 4"
            stroke-width={1.5}
          />
        ))}

      {/* site */}
      <rect x={site.x} y={site.y} width={site.w} height={site.h} class="frame" />
      <text x={site.x + 12} y={site.y - 10} class="edge-cap muted">
        BRANCH SITE
      </text>
      {step?.mode && (
        <text x={site.x + site.w - 12} y={site.y + 26} text-anchor="end" class={`edge-s ${step.mode === 'Two-node mode' ? 'ok-fill' : 'warn-fill'}`}>
          {step.mode}
        </text>
      )}
      <text x={site.x + 14} y={site.y + 26} class="edge-s muted">
        Prism Element runs on the cluster
      </text>
      {two && (
        <g>
          <line x1={nx(0) + nW} y1={nY + 40} x2={nx(1)} y2={nY + 40} class={peerCut ? 'bad-stroke' : 'edge-link'} stroke-width={2.5} stroke-dasharray={peerCut ? '6 5' : undefined} />
          {peerCut && (
            <text x={(nx(0) + nW + nx(1)) / 2} y={nY + 32} text-anchor="middle" class="edge-s bad-fill">
              ✕
            </text>
          )}
        </g>
      )}
      {nodes === 3 && <line x1={nx(0) + nW} y1={nY + 40} x2={nx(2)} y2={nY + 40} class="edge-link" stroke-width={1.5} />}
      {Array.from({ length: nodes }, (_, i) => {
        const isDown = down.has(i);
        const planned = isDown && step?.planned;
        const x = nx(i);
        return (
          <g key={i}>
            <rect x={x} y={nY} width={nW} height={nH} class={`node-box ${isDown ? (planned ? 'warn' : 'down') : ''}`} />
            <text x={x + 10} y={nY + 22} class="edge-t">
              N{i + 1}
            </text>
            <text x={x + nW - 10} y={nY + 22} text-anchor="end" class={`edge-xs ${isDown ? (planned ? 'warn-fill' : 'bad-fill') : 'ok-fill'}`}>
              {isDown ? (planned ? '⚠ upgrading' : '✕ down') : '✓ up'}
            </text>
            <rect x={x + 10} y={nY + 32} width={nW - 20} height={20} class={`cvm ${isDown ? (planned ? 'warn' : 'down') : ''}`} />
            <text x={x + 18} y={nY + 46} class="edge-xs" style={{ fill: planned ? '#16161b' : '#fff' }}>
              CVM
            </text>
            {/* drives */}
            {Array.from({ length: 4 }, (_, d) => {
              const bad = step?.disk && step.disk[0] === i && step.disk[1] === d;
              return <rect key={d} x={x + 10 + d * 31} y={nY + nH - 34} width={26} height={22} class={`disk${bad ? ' failed' : ''}`} />;
            })}
            <text x={x + 10} y={nY + nH - 42} class="edge-xs muted">
              drives
            </text>
          </g>
        );
      })}
      {vms.map((v, i) => {
        const n = perHost.get(v.host) ?? 0;
        perHost.set(v.host, n + 1);
        const x = nx(v.host) + 10 + (n % 6) * 21;
        const y = nY + 64 + Math.floor(n / 6) * 21;
        const off = step?.vmsOff || (down.has(v.host) && !step?.planned);
        const moved = v.host !== v.owner;
        return <rect key={i} x={x} y={y} width={16} height={16} class={`vm${off ? ' failed' : moved ? (step?.planned ? ' hl' : ' restart') : ''}`} />;
      })}
    </svg>
  );
}
