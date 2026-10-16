// The cluster drawn as racks > blocks > nodes. Each node shows its CVM (with heartbeat),
// its VMs, the hypervisor and its drives; drives hold extent tiles colored by role.
// Lines show data moving (rebuild, disk balancing, localization), HA restarts and
// I/O redirected away from a stopped CVM. Renders engine state only.
import type { JSX } from 'preact';
import { useMemo, useRef } from 'preact/hooks';
import type { ClusterState, SimNode } from '../../../engine/cluster';
import { memberLive, MAX_FILL } from '../../../engine/placement';
import { itemState } from '../../../engine/status';
import { TRANSFER_WINDOW_S } from '../../../engine/rebuild';
import { layoutCluster, type Layout, type NodeGeo } from './layout';

export type Sel = { k: 'node'; id: number } | { k: 'cvm'; id: number } | { k: 'disk'; id: string } | { k: 'vm'; id: number };
export type TileRole = 'local' | 'rep' | 'par' | 'under' | 'lost' | 'off';

const ORDER: Record<TileRole, number> = { local: 0, rep: 1, par: 2, under: 3, lost: 4, off: 5 };
const TILE_CLS: Record<TileRole, string> = {
  local: 'tile-local',
  rep: 'tile-rep',
  par: 'tile-par',
  under: 'tile-under',
  lost: 'tile-lost',
  off: 'cl-tile-off',
};

export const STATE_WORD: Record<SimNode['state'], string> = {
  up: 'Up',
  down: 'Powered off',
  'cvm-down': 'CVM down',
  isolated: 'Isolated',
  maintenance: 'Maintenance',
  'cvm-restart': 'CVM restart',
  removing: 'Removing',
  removed: 'Removed',
};

const SHORT_WORD: Record<SimNode['state'], string> = {
  up: 'Up',
  down: 'Off',
  'cvm-down': 'No CVM',
  isolated: 'Cut off',
  maintenance: 'Maint.',
  'cvm-restart': 'CVM restart',
  removing: 'Leaving',
  removed: 'Gone',
};

interface Tile {
  role: TileRole;
  vm: number;
}

/** Extent tiles per drive, sorted so each drive reads like a fill level. */
export function tilesByDisk(s: ClusterState): Map<string, Tile[]> {
  const out = new Map<string, Tile[]>();
  for (const it of s.items) {
    const st = itemState(s, it);
    const vmNode = it.vm >= 0 ? s.vms[it.vm]?.node : -1;
    for (const m of it.members) {
      let role: TileRole;
      if (!memberLive(s, m)) role = 'off';
      else if (st === 'unavailable') role = 'lost';
      else if (st === 'under') role = 'under';
      else if (it.kind === 'ec') role = m.role === 'parity' ? 'par' : 'rep';
      else role = m.node === vmNode ? 'local' : 'rep';
      let arr = out.get(m.disk);
      if (!arr) out.set(m.disk, (arr = []));
      arr.push({ role, vm: it.vm });
    }
  }
  for (const arr of out.values()) arr.sort((a, b) => ORDER[a.role] - ORDER[b.role]);
  return out;
}

function press(fn: () => void, focusable = true) {
  return {
    role: 'button' as const,
    tabIndex: focusable ? 0 : -1,
    onClick: (e: JSX.TargetedMouseEvent<SVGGElement>) => {
      e.stopPropagation();
      fn();
    },
    onKeyDown: (e: JSX.TargetedKeyboardEvent<SVGGElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        fn();
      }
    },
  };
}

function center(g: NodeGeo) {
  return { x: g.x + g.w / 2, y: g.y + 12 };
}

function curve(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${(mx - dy * bend).toFixed(1)} ${(my + dx * bend).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export interface DiagramProps {
  s: ClusterState;
  hlVm?: number | null;
  sel?: Sel | null;
  onSel?: (s: Sel) => void;
  compact?: boolean;
  label?: string;
  showXfer?: boolean;
}

export function ClusterDiagram({ s, hlVm = null, sel = null, onSel, compact = false, label, showXfer = true }: DiagramProps) {
  const tiles = useMemo(() => tilesByDisk(s), [s]);
  // Size tiles for the fullest drive at the start, with headroom for rebuilds, so the tile
  // size does not jump while the timeline plays.
  const capPerDisk = useMemo(() => {
    let most = 0;
    for (const arr of tiles.values()) most = Math.max(most, arr.length);
    const sizes = s.items.map((it) => it.memberGB).sort((a, b) => a - b);
    const med = sizes[Math.floor(sizes.length / 2)] || 1;
    const physical = Math.ceil((s.cfg.driveTB * 1000 * MAX_FILL) / med);
    return Math.max(6, Math.min(physical, Math.ceil(most * 1.6)));
  }, [s.cfg.driveTB, s.cfg.nodes, s.cfg.drivesPerNode, s.cfg.fillPct, s.cfg.seed, s.items.length]);
  const L: Layout = useMemo(() => layoutCluster(s, compact, capPerDisk), [s.nodes.length, s.cfg.nodesPerBlock, s.cfg.racks, s.cfg.drivesPerNode, compact, capPerDisk]);
  const pick = (x: Sel) => onSel && onSel(x);
  const cache = useRef(new Map<number, { sig: string; v: JSX.Element }>());
  const cacheL = useRef<Layout | null>(null);
  const isSel = (k: Sel['k'], id: number | string) => !!sel && sel.k === k && sel.id === id;
  const hl = hlVm !== null && hlVm >= 0;
  const vmsBy = new Map<number, typeof s.vms>();
  for (const v of s.vms) {
    let a = vmsBy.get(v.node);
    if (!a) vmsBy.set(v.node, (a = []));
    a.push(v);
  }
  const diskMap = new Map(s.disks.map((d) => [d.id, d]));
  const down = s.nodes.filter((n) => n.state !== 'up' && n.state !== 'removed').length;
  const aria = label ?? `Cluster of ${s.nodes.filter((n) => n.state !== 'removed').length} nodes, ${down} not healthy`;
  const minW = Math.round(L.W * (compact ? 0.8 : 0.62));

  return (
    <svg class={`diagram cl-dia${compact ? ' compact' : ''}`} viewBox={`0 0 ${L.W} ${L.H}`} role="group" aria-label={aria} style={{ minWidth: `${minW}px` }}>
      {L.racks.map((r) => (
        <g key={r.label}>
          <rect class="rack-box" x={r.x} y={r.y} width={r.w} height={r.h} />
          <text x={r.x + 8} y={r.y + 15} class="muted cl-lbl">
            {r.label.toUpperCase()}
          </text>
        </g>
      ))}
      {L.blocks.map((b) => (
        <g key={b.label}>
          <rect class="block-box" x={b.x} y={b.y} width={b.w} height={b.h} />
          <text x={b.x + 6} y={b.y + 12} class="faint cl-blbl">
            {b.label}
          </text>
        </g>
      ))}

      {s.nodes.map((node) => {
        const g = L.nodes.get(node.id);
        if (!g) return null;
        // Reuse the node's drawing when nothing it shows has changed (keeps 32 nodes at 60 fps).
        const sig = nodeSig(node.id);
        const hit = cache.current.get(node.id);
        if (hit && hit.sig === sig && cacheL.current === L) return hit.v;
        const v = drawNode(node, g);
        cache.current.set(node.id, { sig, v });
        return v;
      })}
      {(cacheL.current = L) && null}

      {/* Data in motion, HA restarts, redirected I/O */}
      {showXfer && <Motion s={s} L={L} />}
    </svg>
  );

  function nodeSig(id: number): string {
    const n = s.nodes[id];
    const g = L.nodes.get(id)!;
    let out = `${n.state}|${n.zk ? 1 : 0}|${n.storageOnly ? 1 : 0}|${isSel('node', id) ? 1 : 0}${isSel('cvm', id) ? 1 : 0}|`;
    for (const v of vmsBy.get(id) || []) out += `${v.id}${v.state[0]}${hlVm === v.id ? 'h' : ''}${isSel('vm', v.id) ? 's' : ''},`;
    for (const d of g.disks) {
      out += `|${diskMap.get(d.id)?.state === 'failed' ? 'F' : ''}${isSel('disk', d.id) ? 'S' : ''}`;
      for (const tl of tiles.get(d.id) || []) out += tl.role[0] + tl.role[1] + (hl ? (tl.vm === hlVm ? '1' : '0') : '');
    }
    return out;
  }

  function drawNode(node: SimNode, g: NodeGeo) {
        const vms = (vmsBy.get(node.id) || []).slice().sort((a, b) => a.id - b.id);
        const st = node.state;
        const dead = st === 'down' || st === 'isolated' || st === 'removed';
        const boxCls = `hit node-box${st === 'down' || st === 'isolated' ? ' down' : st === 'cvm-down' || st === 'removing' || st === 'maintenance' ? ' warn' : ''}${
          st === 'removed' ? ' removed' : ''
        }${isSel('node', node.id) ? ' sel' : ''}`;
        const cvmUp = st === 'up' || st === 'removing';
        const word = STATE_WORD[st];
        const disksFailed = g.disks.filter((d) => diskMap.get(d.id)?.state === 'failed').length;
        return (
          <g key={node.id} class={`cl-node${dead ? ' dead' : ''}`}>
            <g
              {...press(() => pick({ k: 'node', id: node.id }))}
              aria-label={`${node.name}, ${word}${node.zk ? ', Zookeeper' : ''}, ${vms.length} VMs${disksFailed ? `, ${disksFailed} failed drives` : ''}`}
              aria-pressed={isSel('node', node.id)}
            >
              <rect class={boxCls} x={g.x} y={g.y} width={g.w} height={g.h} />
              <text x={g.x + 7} y={g.y + 16} class="cl-name">
                {node.name}
              </text>
              {node.zk && !compact && (
                <g>
                  <rect class="cl-zk" x={g.x + 36} y={g.y + 6} width={20} height={13} />
                  <text x={g.x + 46} y={g.y + 16} text-anchor="middle" class="cl-zkt">
                    ZK
                  </text>
                </g>
              )}
              <text
                x={compact ? g.x + 34 : g.x + g.w - 7}
                y={g.y + 16}
                text-anchor={compact ? 'start' : 'end'}
                class={`cl-state ${st === 'up' ? 'ok' : st === 'down' || st === 'isolated' ? 'bad' : st === 'removed' ? 'muted' : 'warn'}`}
              >
                {compact ? (st === 'up' ? `${vms.length} VM${vms.length === 1 ? '' : 's'}` : SHORT_WORD[st]) : word}
              </text>
            </g>

            {/* CVM with heartbeat */}
            {st !== 'removed' && (
              <g {...press(() => pick({ k: 'cvm', id: node.id }))} aria-label={`CVM on ${node.name}: ${cvmUp ? 'running' : 'not running'}`}>
                <rect
                  class={`hit cvm${cvmUp ? '' : dead ? ' down' : ' warn'}${isSel('cvm', node.id) ? ' cl-selr' : ''}`}
                  x={g.cvm.x}
                  y={g.cvm.y}
                  width={g.cvm.w}
                  height={g.cvm.h}
                />
                {!compact && (
                  <text x={g.cvm.x + g.cvm.w / 2} y={g.cvm.y + 13} text-anchor="middle" class="cl-cvmt">
                    CVM
                  </text>
                )}
                {cvmUp ? (
                  <circle class="cl-beat beat" cx={g.cvm.x + g.cvm.w / 2} cy={g.cvm.y + (compact ? 6 : 22)} r={compact ? 2.6 : 3.2} />
                ) : (
                  <path
                    class="cl-x"
                    d={`M${g.cvm.x + g.cvm.w / 2 - 3} ${g.cvm.y + (compact ? 3 : 19)} l6 6 m0 -6 l-6 6`}
                  />
                )}
              </g>
            )}

            {/* VMs and hypervisor */}
            {!compact && st !== 'removed' && (
              <g>
                {vms.slice(0, vms.length > 12 ? 11 : 12).map((vm, i) => {
                  const x = g.vmArea.x + (i % 6) * 14;
                  const y = g.vmArea.y + Math.floor(i / 6) * 15 + 1;
                  const cls = `hit vm${hlVm === vm.id ? ' hl' : ''}${vm.state === 'restarting' ? ' restart' : vm.state === 'failed' ? ' failed' : ''}${
                    isSel('vm', vm.id) ? ' cl-selv' : ''
                  }`;
                  return (
                    <g key={vm.id} {...press(() => pick({ k: 'vm', id: vm.id }), false)} aria-label={`${vm.name}, ${vm.state}`}>
                      <rect class={cls} x={x} y={y} width={11} height={11} />
                      <title>{`${vm.name} · ${vm.memGB} GB · ${vm.state === 'running' ? 'running' : vm.state === 'restarting' ? 'waiting for HA restart' : 'could not restart'}`}</title>
                    </g>
                  );
                })}
                {vms.length > 12 && (
                  <text x={g.vmArea.x + 5 * 14 + 5} y={g.vmArea.y + 25} text-anchor="middle" class="cl-more">
                    +{vms.length - 11}
                  </text>
                )}
                {!vms.length && (
                  <text x={g.vmArea.x} y={g.vmArea.y + 18} class="faint cl-more">
                    {node.storageOnly ? 'storage only' : 'no VMs'}
                  </text>
                )}
                <rect class={`cl-hyp${dead ? ' off' : ''}`} x={g.hyp.x} y={g.hyp.y} width={g.hyp.w} height={g.hyp.h} />
                <text x={g.hyp.x + g.hyp.w / 2} y={g.hyp.y + 10.5} text-anchor="middle" class="cl-hypt">
                  {dead ? 'AHV · off' : 'AHV hypervisor'}
                </text>
              </g>
            )}

            {/* Drives with extent tiles */}
            {g.disks.map((d) => {
              const disk = diskMap.get(d.id);
              const failed = disk?.state === 'failed';
              const list = tiles.get(d.id) || [];
              const { s: ts, cols, rows } = L.tile;
              const cap = cols * rows;
              const offX = d.x + (d.w - cols * (ts + 1) + 1) / 2;
              return (
                <g key={d.id} {...press(() => pick({ k: 'disk', id: d.id }), false)} aria-label={`Drive ${disk ? disk.idx + 1 : ''} in ${node.name}${failed ? ', failed' : ''}`}>
                  <rect class={`hit disk${failed ? ' failed' : ''}${disk?.tier === 'hdd' ? ' cl-hdd' : ''}${isSel('disk', d.id) ? ' cl-selr' : ''}`} x={d.x} y={d.y} width={d.w} height={d.h} />
                  {failed ? (
                    <path class="cl-x" d={`M${d.x + 3} ${d.y + 3} L${d.x + d.w - 3} ${d.y + d.h - 3} M${d.x + d.w - 3} ${d.y + 3} L${d.x + 3} ${d.y + d.h - 3}`} />
                  ) : (
                    list.slice(0, cap).map((tl, i) => {
                      const c = i % cols;
                      const r = Math.floor(i / cols);
                      const dim = hl && tl.vm !== hlVm;
                      return (
                        <rect
                          key={i}
                          class={`${TILE_CLS[tl.role]}${dim ? ' tile-dim' : ''}${hl && !dim ? ' cl-tile-hl' : ''}`}
                          x={offX + c * (ts + 1)}
                          y={d.y + d.h - 1 - (r + 1) * (ts + 1)}
                          width={ts}
                          height={ts}
                        />
                      );
                    })
                  )}
                </g>
              );
            })}
          </g>
        );
  }
}

function Motion({ s, L }: { s: ClusterState; L: Layout }) {
  const lines: JSX.Element[] = [];
  const seen = new Map<string, number>();
  s.transfers.forEach((x, i) => {
    const a = L.nodes.get(x.from);
    const b = L.nodes.get(x.to);
    if (!a || !b || x.from === x.to) return;
    const age = s.time - x.t;
    const key = `${x.from}-${x.to}-${x.kind}`;
    const k = seen.get(key) || 0;
    seen.set(key, k + 1);
    if (k > 1) return;
    const op = Math.max(0.18, 1 - age / TRANSFER_WINDOW_S);
    const cls = x.kind === 'rebuild' ? 'xfer' : x.kind === 'balance' ? 'xfer balance' : x.kind === 'localize' ? 'xfer cl-loc' : 'xfer cl-evac';
    const p1 = center(a);
    const p2 = center(b);
    lines.push(
      <g key={`t${i}`} style={{ opacity: op }}>
        <path class={cls} d={curve(p1, p2, 0.12 + k * 0.08)} />
        <circle class={`cl-head ${x.kind}`} cx={p2.x} cy={p2.y} r={3} />
      </g>,
    );
  });
  // HA restarts in the last two minutes: old host -> new host
  for (const r of s.ha || []) {
    if (r.restartedAt === null || r.to === null || s.time - r.restartedAt > 120) continue;
    const a = L.nodes.get(r.from);
    const b = L.nodes.get(r.to);
    if (!a || !b) continue;
    lines.push(<path key={`h${r.vm}-${r.restartedAt}`} class="cl-ha" d={curve({ x: a.vmArea.x + 20, y: a.vmArea.y + 8 }, { x: b.vmArea.x + 20, y: b.vmArea.y + 8 }, -0.15)} />);
  }
  // CVM down: the host's I/O goes to other CVMs over the network
  for (const n of s.nodes) {
    if (n.state !== 'cvm-down') continue;
    const a = L.nodes.get(n.id);
    if (!a) continue;
    const peers = s.nodes
      .filter((x) => x.state === 'up' && L.nodes.has(x.id))
      .map((x) => ({ x, d: Math.abs(x.id - n.id) }))
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const p of peers) {
      const b = L.nodes.get(p.x.id)!;
      lines.push(
        <path
          key={`r${n.id}-${p.x.id}`}
          class="cl-redirect"
          d={curve({ x: a.vmArea.x + a.vmArea.w / 2, y: a.vmArea.y + 15 }, { x: b.cvm.x + b.cvm.w / 2, y: b.cvm.y + b.cvm.h / 2 }, 0.2)}
        />,
      );
    }
    if (!L.compact)
      lines.push(
        <text key={`rl${n.id}`} x={a.x + a.w / 2} y={a.y + a.h + 11} text-anchor="middle" class="cl-note halo">
          I/O redirected to other CVMs
        </text>,
      );
  }
  return <g class="cl-motion" aria-hidden="true">{lines}</g>;
}
