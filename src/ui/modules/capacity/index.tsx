// Protection & Capacity: raw-to-usable calculator, placement across nodes/blocks/racks,
// the "what failure can this survive?" matrix, the rules, and capacity-check gates for
// online RF2-to-RF3 conversion and enabling EC-X. Math lives in src/engine/capacity.ts,
// rules.ts and capgate.ts; this file only renders it.
import { useMemo } from 'preact/hooks';
import { useEnum, useNum } from '../../../state/route';
import { useScenario } from '../../../state/scenario';
import { computeCapacity, survivalMatrix, type CapacityInput, type ReservePolicy } from '../../../engine/capacity';
import { rf3ConversionGate, ecxEnableGate, type GateResult } from '../../../engine/capgate';
import { createCluster, blockCount } from '../../../engine/cluster';
import { blockAwareAllowed, ecAllowed, ecStrip, rackAwareAllowed, rfAllowed, METADATA_COPIES, MIN_NODES, EC_MIN_NODES, MIN_BLOCKS, minBlocks, type RF } from '../../../engine/rules';
import { Chip, Field, Follow, Illus, Seg, Slider, Stat, Tip, Toggle, fmtTB } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { go } from '../../shell/nav';
import './style.css';

const RESERVES: readonly ReservePolicy[] = ['auto', 'none', 'n1', 'n2', 'block'];
const DRIVE_SIZES = [1.92, 3.84, 7.68, 15.36];

// ── raw-to-usable bar ──
const SEG_CLS: Record<string, string> = { system: 'cp-sys', reserve: 'cp-res', protection: 'cp-prot', usable: 'cp-use' };

function CapacityBar({ c }: { c: ReturnType<typeof computeCapacity> }) {
  // Top: one stacked bar of raw capacity. Below: a waterfall, one row per labeled step.
  const W = 600;
  const VAL = 96; // value column
  const BW = W - VAL - 12;
  const raw = c.rawTB || 1;
  const sc = (tb: number) => (Math.abs(tb) / raw) * BW;
  const parts = [
    ...c.steps.filter((s) => s.tb < 0).map((s) => ({ key: s.key, tb: -s.tb })),
    { key: 'usable', tb: c.usableAfterReserveTB },
  ];
  const rows = c.steps;
  const rowH = 46;
  const top = 92;
  const H = top + rows.length * rowH + 4;
  let acc = 0;
  let run = 0;
  return (
    <svg class="diagram cp-bar" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Raw ${fmtTB(c.rawTB)} to usable after reserve ${fmtTB(c.usableAfterReserveTB)}`}>
      <text x={0} y={18} style={{ fontSize: '15px', fontWeight: 600 }}>
        Where the raw capacity goes
      </text>
      {parts.map((p) => {
        const x = sc(acc);
        acc += p.tb;
        const w = sc(p.tb);
        return (
          <g key={p.key}>
            <rect x={x} y={30} width={Math.max(0, w)} height={34} class={SEG_CLS[p.key] ?? 'cp-prot'} />
            {w > 44 && (
              <text x={x + w / 2} y={52} text-anchor="middle" class="mono cp-seg-t" style={{ fontSize: '13px', fontWeight: 700 }}>
                {Math.round((p.tb / raw) * 100)}%
              </text>
            )}
          </g>
        );
      })}
      <text x={W} y={52} text-anchor="end" class="mono" style={{ fontSize: '13px', fontWeight: 600 }}>
        100%
      </text>
      {rows.map((s, i) => {
        const y = top + i * rowH;
        const neg = s.tb < 0;
        const isTotal = !neg;
        let x = 0;
        const w = Math.min(BW, sc(s.tb));
        if (s.key === 'raw') run = s.tb;
        else if (neg) {
          run += s.tb;
          x = sc(run);
        }
        const cls = s.key === 'raw' ? 'cp-raw' : s.key === 'effective' ? 'cp-eff' : SEG_CLS[s.key] ?? 'cp-prot';
        return (
          <g key={s.key}>
            <text x={0} y={y + 15} style={{ fontSize: '14px', fontWeight: isTotal ? 600 : 400 }}>
              {neg ? '− ' : ''}
              {s.label}
            </text>
            <rect x={x} y={y + 22} width={Math.max(1, w)} height={14} class={cls} />
            <text x={W} y={y + 34} text-anchor="end" class="mono" style={{ fontSize: '14px', fontWeight: isTotal ? 700 : 500 }}>
              {neg ? '−' : ''}
              {fmtTB(Math.abs(s.tb))}
            </text>
            <line x1={0} x2={W} y1={y + rowH - 3} y2={y + rowH - 3} class="cp-rule" />
          </g>
        );
      })}
    </svg>
  );
}

// ── placement ──
function Placement({ cfg, item, onNext }: { cfg: ReturnType<typeof useScenario>['cfg']; item: number; onNext: (d: 1 | -1) => void }) {
  const s = useMemo(() => createCluster(cfg), [cfg.nodes, cfg.nodesPerBlock, cfg.racks, cfg.blockAware, cfg.rackAware, cfg.rf, cfg.ft, cfg.ecx, cfg.coldPct, cfg.drivesPerNode, cfg.driveTB, cfg.seed]);
  const pool = s.items;
  const it = pool[((item % pool.length) + pool.length) % pool.length];
  const memberAt = new Map(it.members.map((m, i) => [m.node, { m, i }]));
  const racks = Array.from({ length: cfg.racks }, (_, r) => r).filter((r) => s.nodes.some((n) => n.rack === r));
  const blocksOf = (r: number) => [...new Set(s.nodes.filter((n) => n.rack === r).map((n) => n.block))];
  const nodeW = 58;
  const nodeH = 52;
  const gap = 6;
  const bpad = 6;
  // layout: racks side by side; inside a rack, blocks fill a small grid; inside a block, nodes in a row
  const npb = cfg.nodesPerBlock;
  const blockW = npb * (nodeW + gap) - gap + bpad * 2;
  const blockH = nodeH + bpad * 2;
  const cols = Math.max(1, Math.floor(10 / (npb * racks.length)));
  const colsOf = (r: number) => Math.min(cols, blocksOf(r).length);
  const rackW = (r: number) => colsOf(r) * (blockW + 8) - 8 + 16;
  const rackX: number[] = [];
  let x = 0;
  for (const r of racks) {
    rackX[r] = x;
    x += rackW(r) + 14;
  }
  const maxRows = Math.max(...racks.map((r) => Math.ceil(blocksOf(r).length / colsOf(r))));
  const W = Math.max(320, x - 14);
  const H = 34 + maxRows * (blockH + 10) + 6;
  const shareBlock = it.members.length !== new Set(it.members.map((m) => s.nodes[m.node].block)).size;
  const shareRack = it.members.length !== new Set(it.members.map((m) => s.nodes[m.node].rack)).size;
  const domainWord = s.domain === 'rack' ? 'different racks' : s.domain === 'block' ? 'different blocks' : 'different nodes';
  const roleWord = (role: string, i: number) => (role === 'parity' ? `P${i + 1 - it.need}` : it.kind === 'ec' ? `D${i + 1}` : `#${i + 1}`);
  return (
    <div>
      <div class="spread cp-place-h">
        <p class="small">
          {it.kind === 'ec' ? (
            <>
              This piece of write-cold data is stored as an <b>EC-X strip</b> ({it.need} data + {it.target - it.need} parity), each part on a {domainWord.replace('different ', '').replace(/s$/, '')} of its own.
            </>
          ) : (
            <>
              This piece of data has <b>{it.target} copies</b>, each in {domainWord}.
            </>
          )}{' '}
          <Illus why="One sample piece of data from a representative set. Real clusters place billions of extents the same way, choosing nodes by free space and load." />
        </p>
        <div class="hstack">
          <button type="button" class="btn" onClick={() => onNext(-1)} aria-label="Previous piece of data">
            <Icon name="stepback" />
          </button>
          <button type="button" class="btn" onClick={() => onNext(1)}>
            Show another piece of data <Icon name="step" />
          </button>
        </div>
      </div>
      <div class="diagram-scroll">
        <svg class="diagram cp-place" viewBox={`-2 -2 ${W + 4} ${H + 4}`} style={{ maxWidth: `${Math.max(24, W / 16)}rem` }} role="img" aria-label={`Placement: copies on nodes ${it.members.map((m) => m.node + 1).join(', ')}`}>
          {racks.map((r) => {
            const bl = blocksOf(r);
            return (
              <g key={r}>
                <rect x={rackX[r]} y={0} width={rackW(r)} height={H} class="rack-box" />
                <text x={rackX[r] + 8} y={18} class="muted" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Rack {r + 1}
                </text>
                {bl.map((b, bi) => {
                  const ns = s.nodes.filter((n) => n.block === b);
                  const by = 28 + Math.floor(bi / colsOf(r)) * (blockH + 10);
                  const bx = rackX[r] + 8 + (bi % colsOf(r)) * (blockW + 8);
                  const hasBlock = ns.some((n) => memberAt.has(n.id));
                  return (
                    <g key={b}>
                      <rect x={bx} y={by} width={ns.length * (nodeW + gap) - gap + bpad * 2} height={blockH} class={`block-box ${hasBlock && s.domain !== 'node' ? 'cp-blk-on' : ''}`} />
                      {ns.map((n, ni) => {
                        const at = memberAt.get(n.id);
                        const nx = bx + bpad + ni * (nodeW + gap);
                        return (
                          <g key={n.id}>
                            <rect x={nx} y={by + bpad} width={nodeW} height={nodeH} class={`node-box ${at ? 'sel' : ''}`} />
                            <text x={nx + 6} y={by + bpad + 15} class="muted" style={{ fontSize: '11px' }}>
                              N{n.id + 1}
                            </text>
                            {at && (
                              <g>
                                <rect x={nx + 8} y={by + bpad + 22} width={nodeW - 16} height={22} class={at.m.role === 'parity' ? 'tile-par' : 'tile-local'} />
                                <text x={nx + nodeW / 2} y={by + bpad + 37} text-anchor="middle" class="mono" style={{ fontSize: '12px', fontWeight: 700, fill: '#fff' }}>
                                  {roleWord(at.m.role, at.i)}
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      {npb > 1 && shareBlock && (
        <p class="field-why cp-share" role="note">
          <span aria-hidden="true">!</span>
          <span>
            Two parts of this data sit in the same block (chassis). Losing that chassis would take both out.{' '}
            {cfg.blockAware ? 'Block awareness is switched on but is not in effect for this layout; see why under Block awareness.' : 'Block awareness prevents this.'}
          </span>
        </p>
      )}
      {!(npb > 1 && shareBlock) && racks.length > 1 && shareRack && (
        <p class="field-why cp-share" role="note">
          <span aria-hidden="true">!</span>
          <span>Two parts of this data sit in the same rack. Rack awareness would keep them apart.</span>
        </p>
      )}
      <div class="legend">
        <span>
          <i class="sw" style={{ background: 'var(--ink)' }} />
          {it.kind === 'ec' ? 'Data part' : 'Copy'}
        </span>
        <span>
          <i class="sw" style={{ background: 'var(--flow)' }} />
          Parity (EC-X)
        </span>
        <span>
          <i class="sw" style={{ border: '1.5px dashed var(--line-2)' }} />
          Block (chassis)
        </span>
        <span>
          <i class="sw" style={{ border: '1px solid var(--s3)' }} />
          Rack
        </span>
      </div>
    </div>
  );
}

function GateCard({ title, what, g, onApply, applyLabel, done, note }: { title: string; what: string; g: GateResult; onApply: () => void; applyLabel: string; done?: string; note?: string }) {
  const pct = g.limitTB > 0 ? Math.min(100, (g.usedAfterTB / g.limitTB) * 100) : 100;
  return (
    <div class="cp-gate">
      <div class="spread">
        <h3 class="cp-gate-t">{title}</h3>
        {done ? <Chip tone="neutral" icon="check">{done}</Chip> : g.ok ? <Chip tone="ok">Check passed</Chip> : <Chip tone="bad">Blocked</Chip>}
      </div>
      <p class="small muted">{what}</p>
      {!done && (
        <>
          <Stat k="Physical space used now" v={fmtTB(g.usedNowTB)} />
          <Stat k="Needed after the change" v={fmtTB(g.usedAfterTB)} tone={g.ok ? 'neutral' : 'bad'} />
          <Stat k="Available, keeping the reserve" v={fmtTB(g.limitTB)} tip="Raw capacity minus any system overhead and the rebuild reserve for the new setting." />
          <div class="meter cp-gate-m" aria-hidden="true">
            <i style={{ width: `${pct}%`, background: g.ok ? 'var(--ok)' : 'var(--bad)' }} />
          </div>
          {g.reasons.map((r) => (
            <p class="field-why" key={r} role="note">
              <span aria-hidden="true">!</span>
              <span>{r}</span>
            </p>
          ))}
          {note && (
            <p class="field-why" role="note">
              <span aria-hidden="true">!</span>
              <span>{note}</span>
            </p>
          )}
          <button type="button" class="btn" disabled={!g.ok} onClick={onApply} title={g.ok ? undefined : 'The capacity check must pass first'}>
            {applyLabel}
          </button>
        </>
      )}
    </div>
  );
}

export default function Capacity() {
  const { cfg, set } = useScenario();
  const [reserve, setReserve] = useEnum<ReservePolicy>('rsv', 'auto', RESERVES);
  const [drr, setDrr] = useNum('drr', 1, 1, 5);
  const [sys, setSys] = useNum('sys', 0, 0, 20);
  const [item, setItem] = useNum('it', 0, -1e6, 1e6);

  const blocks = blockCount(cfg);
  const input: CapacityInput = {
    nodes: cfg.nodes,
    drivesPerNode: cfg.drivesPerNode,
    driveTB: cfg.driveTB,
    rf: cfg.rf,
    ecx: cfg.ecx,
    coldPct: cfg.coldPct,
    reserve,
    nodesPerBlock: cfg.nodesPerBlock,
    blockAware: cfg.blockAware,
    dataReduction: drr,
    systemOverheadPct: sys,
  };
  const c = computeCapacity(input);
  const matrix = survivalMatrix({ rf: cfg.rf, nodes: cfg.nodes, nodesPerBlock: cfg.nodesPerBlock, blockAware: cfg.blockAware, racks: cfg.racks, rackAware: cfg.rackAware, ecx: cfg.ecx });
  const rf3 = rf3ConversionGate({ ...input, rf: 2, fillPct: cfg.fillPct });
  const ecg = ecxEnableGate({ ...input, ecx: false, fillPct: cfg.fillPct });
  const ftOk = rfAllowed(3, cfg.nodes);
  const ecOk = ecAllowed(cfg.rf, cfg.nodes);
  const baOk = blockAwareAllowed(cfg.ft, blocks, cfg.ecx);
  const raOk = rackAwareAllowed(cfg.ft, Math.min(cfg.racks, blocks), cfg.ecx);
  const strip = ecStrip(cfg.nodes, cfg.rf);
  const usedTB = (c.rawTB * cfg.fillPct) / 100;
  const limit = c.rawTB - c.systemTB - c.reserveTB;
  const overReserve = usedTB > limit;
  const theoretical = strip ? cfg.rf / ((strip.data + strip.parity) / strip.data) : 1;

  return (
    <>
      <div class="lab cp">
        <div class="ctl">
          <Field label="Nodes" tip="Servers in the cluster. Each adds drives and a Controller VM." value={cfg.nodes} why={cfg.nodes < 3 ? 'Below 3 nodes the cluster has special edge behavior; see Edge & ROBO.' : null}>
            <Slider label="Nodes" value={cfg.nodes} min={3} max={32} onChange={(v) => set({ nodes: v })} />
          </Field>
          <Field label="Drives per node" value={cfg.drivesPerNode}>
            <Slider label="Drives per node" value={cfg.drivesPerNode} min={2} max={24} onChange={(v) => set({ drivesPerNode: v })} />
          </Field>
          <Field label="Drive size" value={`${cfg.driveTB} TB`}>
            <Seg label="Drive size" value={cfg.driveTB} onChange={(v) => set({ driveTB: v })} options={DRIVE_SIZES.map((d) => ({ value: d, label: d }))} />
          </Field>
          <Field
            label="Cluster redundancy factor"
            tip="How many failures the cluster itself (its metadata and configuration) is built to tolerate. Set once for the cluster."
            detail="Redundancy factor 2 keeps 3 copies of metadata and configuration and tolerates 1 failure. Redundancy factor 3 keeps 5 copies and tolerates 2."
            value={`RF${cfg.ft}`}
            why={ftOk.ok ? null : ftOk.reason}
          >
            <Seg
              label="Cluster redundancy factor"
              value={cfg.ft}
              onChange={(v) => set(v === 2 ? { ft: 2, rf: 2 } : { ft: v })}
              options={[
                { value: 2 as RF, label: 'RF2' },
                { value: 3 as RF, label: 'RF3', disabled: !ftOk.ok, title: ftOk.reason },
              ]}
            />
          </Field>
          <Field
            label="Container replication factor"
            tip="How many copies of each piece of data a storage container keeps. Different containers in one cluster can use different values."
            value={`RF${cfg.rf}`}
            why={cfg.ft === 2 ? 'An RF3 container needs a cluster at redundancy factor 3.' : null}
          >
            <Seg
              label="Container replication factor"
              value={cfg.rf}
              onChange={(v) => set({ rf: v })}
              options={[
                { value: 2 as RF, label: 'RF2' },
                { value: 3 as RF, label: 'RF3', disabled: cfg.ft !== 3 },
              ]}
            />
          </Field>
          <Field
            label="Erasure coding (EC-X)"
            tip="Stores write-cold data as data plus parity instead of full copies, which uses less space."
            detail="Curator encodes data in the background once it has not been overwritten for a while. Strip size depends on node count."
            value={cfg.ecx && strip ? `${strip.data}/${strip.parity}` : 'off'}
            why={ecOk.ok ? null : ecOk.reason}
          >
            <Toggle on={cfg.ecx} disabled={!ecOk.ok} onChange={(v) => set({ ecx: v })}>
              EC-X on write-cold data
            </Toggle>
          </Field>
          <Field
            label="Write-cold data"
            tip="Share of data that is rarely overwritten. EC-X only encodes this part; hot data keeps full copies."
            value={`${cfg.coldPct}%`}
            why={cfg.ecx ? null : 'Only matters with EC-X on.'}
            note={<Illus why="Your workload decides this. Logs, backups and archives are mostly cold; databases and VDI are much less so. 60% is a placeholder, not a typical value." />}
          >
            <Slider label="Write-cold data percent" value={cfg.coldPct} min={0} max={100} step={5} onChange={(v) => set({ coldPct: v })} />
          </Field>
          <Field label="Rebuild reserve" tip="Free space held back so the cluster can fully re-protect data after a failure. The recommended values are common sizing guidance, not a product rule; Prism shows whether rebuild capacity is available." value={reserve === 'auto' ? `auto · ${c.reserveNodes}` : reserve}>
            <Seg
              label="Rebuild reserve"
              value={reserve}
              onChange={setReserve}
              options={[
                { value: 'auto', label: 'Recommended' },
                { value: 'none', label: 'None' },
                { value: 'n1', label: 'N+1' },
                { value: 'n2', label: 'N+2' },
                { value: 'block', label: 'Block', disabled: cfg.nodesPerBlock === 1, title: 'One node per block: a block is a node' },
              ]}
            />
          </Field>
          <Field label="Data reduction" tip="Optional compression and deduplication ratio to apply on top." value={`${drr.toFixed(1)}:1`} note="Real ratios depend on the workload. Leave at 1.0:1 unless you have measured data.">
            <Slider label="Data reduction ratio" value={drr} min={1} max={5} step={0.1} onChange={setDrr} />
          </Field>
          <Field label="System overhead" tip="Optional deduction for space the platform reserves for itself. Use the figure from your sizing tool." value={`${sys}%`} note="Default 0: this calculator does not guess a value.">
            <Slider label="System overhead percent" value={sys} min={0} max={20} onChange={setSys} />
          </Field>
          <Field label="Nodes per block" tip="A block is one chassis holding 1, 2 or 4 nodes. A chassis problem can take all of them out at once." value={cfg.nodesPerBlock}>
            <Seg label="Nodes per block" value={cfg.nodesPerBlock} onChange={(v) => set({ nodesPerBlock: v })} options={[1, 2, 4].map((v) => ({ value: v as 1 | 2 | 4, label: v }))} />
          </Field>
          <Field label="Block awareness" tip="Places copies in different blocks so a whole chassis can fail." value={`${blocks} blocks`} why={cfg.nodesPerBlock === 1 ? 'With one node per block, node placement already covers blocks.' : baOk.ok ? null : baOk.reason}>
            <Toggle on={cfg.blockAware} disabled={cfg.nodesPerBlock === 1 || !baOk.ok} onChange={(v) => set({ blockAware: v })}>
              Block awareness
            </Toggle>
          </Field>
          <Field label="Racks" tip="Blocks are spread across racks in turn. Rack awareness keeps copies in different racks." value={cfg.racks} why={raOk.ok ? null : raOk.reason}>
            <Slider label="Racks" value={cfg.racks} min={1} max={8} onChange={(v) => set({ racks: v })} />
            <Toggle on={cfg.rackAware} disabled={!raOk.ok} onChange={(v) => set({ rackAware: v })} title={raOk.ok ? undefined : raOk.reason}>
              Rack awareness
            </Toggle>
          </Field>
        </div>

        <div class="stage">
          <div class="cp-head">
            <div>
              <div class="eyebrow">Usable after reserve</div>
              <div class="bignum">
                {fmtTB(c.usableAfterReserveTB)}
                <small>of {fmtTB(c.rawTB)} raw</small>
              </div>
            </div>
            {drr > 1 && (
              <div>
                <div class="eyebrow">Effective at {drr.toFixed(1)}:1</div>
                <div class="bignum cp-eff-n">{fmtTB(c.effectiveTB)}</div>
              </div>
            )}
          </div>
          <div class="diagram-scroll">
            <CapacityBar c={c} />
          </div>
          {c.advisories.map((a) => (
            <Follow tone="warn" k="Advisory" key={a}>
              <p>{a}</p>
            </Follow>
          ))}
          {cfg.ecx && strip && (
            <Follow tone="ink" k="Why EC-X saves less than the strip suggests">
              <p>
                A {strip.data}/{strip.parity} strip stores data at {((strip.data + strip.parity) / strip.data).toFixed(2)}x instead of {cfg.rf}x, so if all data were cold you would get {theoretical.toFixed(2)} times the usable space of RF{cfg.rf} alone. Only the {cfg.coldPct}% write-cold share is encoded, so the blend here is {c.blendedOverhead.toFixed(2)}x. Encoding is done later in the background, so the saving builds up over time.
              </p>
            </Follow>
          )}

          <h2 class="sec-h">Where the copies go</h2>
          <Placement cfg={cfg} item={item} onNext={(d) => setItem(item + d)} />

          <h2 class="sec-h">What failure can this survive?</h2>
          <table class="tbl cp-matrix">
            <thead>
              <tr>
                <th>Failure domain</th>
                <th>Survives</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((r) => (
                <tr key={r.domain}>
                  <td>
                    <b>{r.domain}</b>
                  </td>
                  <td>{r.survives > 0 ? <Chip tone="ok">{r.survives === 1 ? '1 at a time' : `${r.survives} at a time`}</Chip> : <Chip tone="bad">Not protected</Chip>}</td>
                  <td class="small">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p class="field-note" style={{ marginTop: 'var(--sp-2)' }}>
            “Survives” means data stays available. Getting back to full protection afterwards also needs the rebuild reserve. To watch it happen, open the{' '}
            <button type="button" class="tbtn cp-inline" onClick={() => go('nci/failures')}>
              Failure Gauntlet <Icon name="arrow" />
            </button>
          </p>

          <h2 class="sec-h">Changing a running cluster</h2>
          <p class="lede small">
            Planning a new cluster? Use the controls freely. Changing one that already holds data is done online, but the cluster re-lays out data in the background, so it checks capacity first. The checks use today’s fill level.
          </p>
          <Field label="Space used today" tip="Physical space in use now, as a share of raw capacity. Used by the checks below." value={`${cfg.fillPct}% · ${fmtTB(usedTB)}`} why={overReserve ? 'The cluster is already using space set aside for rebuilds.' : null}>
            <Slider label="Space used today" value={cfg.fillPct} min={1} max={95} onChange={(v) => set({ fillPct: v })} />
          </Field>
          <div class="cols-2 cp-gates">
            <GateCard
              title="Convert RF2 → RF3"
              what="Raises the cluster redundancy factor to 3, then adds a third copy of every piece of data in the container. Needs at least 5 nodes and room for 50% more physical data."
              g={rf3}
              done={cfg.rf === 3 ? 'Container is RF3' : undefined}
              applyLabel="Convert to RF3"
              onApply={() => set({ ft: 3, rf: 3 })}
            />
            <GateCard
              title="Enable EC-X"
              what={`Turns on erasure coding for write-cold data at RF${cfg.rf}. Needs at least ${EC_MIN_NODES[cfg.rf]} nodes. Space is freed gradually as data is encoded.`}
              g={ecg}
              done={cfg.ecx ? 'EC-X is on' : undefined}
              applyLabel="Enable EC-X"
              onApply={() => set({ ecx: true })}
              note={
                !cfg.ecx && cfg.blockAware && cfg.nodesPerBlock > 1 && blocks >= MIN_BLOCKS[cfg.ft] && blocks < minBlocks(cfg.ft, true)
                  ? `Block awareness would stop applying: with EC-X it needs at least ${minBlocks(cfg.ft, true)} blocks, and this layout has ${blocks}.`
                  : undefined
              }
            />
          </div>
        </div>

        <div class="rail">
          <div class="side-sec">
            <div class="eyebrow">Capacity</div>
            <Stat k="Raw" v={fmtTB(c.rawTB)} tip="Sum of all drives in all nodes." />
            <Stat k="Usable (no reserve)" v={fmtTB(c.usableTB)} />
            <Stat k="Usable after reserve" v={fmtTB(c.usableAfterReserveTB)} tone="ok" />
            {drr > 1 && <Stat k={`Effective at ${drr.toFixed(1)}:1`} v={fmtTB(c.effectiveTB)} />}
            <Stat k="Space per TB stored" v={`${c.blendedOverhead.toFixed(2)}x`} tip="Physical TB used for each logical TB: the replication factor, blended with EC-X for the write-cold share." />
            <Stat k="Rebuild reserve" v={`${c.reserveNodes} node${c.reserveNodes === 1 ? '' : 's'}`} />
            <p class="field-note">{c.reserveWhy}</p>
          </div>
          <div class="side-sec">
            <div class="eyebrow">Rules</div>
            <ul class="cp-rules small">
              <li>
                <b>RF2</b>: 2 data copies, at least {MIN_NODES[2]} nodes, tolerates 1 failure.
              </li>
              <li>
                <b>RF3</b>: 3 data copies, at least {MIN_NODES[3]} nodes, tolerates 2 failures.
              </li>
              <li>
                <Tip text="The cluster’s own bookkeeping: where data lives and which nodes and services exist." detail="Metadata lives in a Cassandra-based ring; configuration in Zookeeper.">
                  Metadata and configuration
                </Tip>
                : {METADATA_COPIES[2]} copies at redundancy factor 2, {METADATA_COPIES[3]} at redundancy factor 3. This cluster: <b>{METADATA_COPIES[cfg.ft]}</b>.
              </li>
              <li>
                <b>Container RF</b> and <b>cluster redundancy factor</b> are separate settings. A cluster at redundancy factor 3 can host both RF2 and RF3 containers.
              </li>
              <li>
                <b>EC-X</b>: at least {EC_MIN_NODES[2]} nodes with RF2, {EC_MIN_NODES[3]} with RF3; only write-cold data is encoded.
              </li>
              <li>
                <b>Block or rack awareness</b>: at least {MIN_BLOCKS[2]} blocks or racks with RF2, {MIN_BLOCKS[3]} with RF3. With EC-X on: {minBlocks(2, true)} and {minBlocks(3, true)}.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
