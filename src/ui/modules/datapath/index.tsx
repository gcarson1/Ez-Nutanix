// Data Path: looping write and read animations (RF2/RF3) and the data-locality sequence
// after a live migration. All behavior comes from src/engine/datapath.ts; this file only
// draws it.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, Tip } from '../../components/controls';
import { Choice, Kpis, Show } from '../../components/show';
import {
  DP_NODES,
  localitySequence,
  localitySummary,
  readSequence,
  replicaTargets,
  writeSequence,
  type CacheState,
  type DpStep,
  type Hop,
  type LocalityFrame,
  type Place,
  type ReadSource,
} from '../../../engine/datapath';
import type { RF } from '../../../engine/rules';
import './style.css';

type Mode = 'wr' | 'ws' | 'rd' | 'loc';
const MODES: readonly Mode[] = ['wr', 'ws', 'rd', 'loc'];
const SEED = 3;

const THRESHOLD_TIP =
  'Stargate watches how much write data is outstanding for each virtual disk. Past a threshold it treats the stream as sequential and writes straight to the extent store, still with all of its copies. Current Nutanix documentation gives about 1.5 MB of outstanding writes per vDisk; the threshold is tunable.';

// ── geometry ──
const NW = 176; // node width
const NG = 14; // gap
const X0 = 8;
const W = X0 * 2 + DP_NODES * NW + (DP_NODES - 1) * NG;
const H = 372;
const NET_Y = 350;
const nx = (n: number) => X0 + n * (NW + NG);
/** Left edge of the CVM service boxes; the strip to their left carries in-node arrows. */
const BX = (n: number) => nx(n) + 26;
const Y = { vm: 44, sg: 110, cache: 156, oplog: 202, extent: 250 } as const;
const BOX_H = { vm: 36, sg: 36, cache: 36, oplog: 38, extent: 62 } as const;

function anchor(p: Place, vmNode: number): [number, number] {
  if (p.at === 'vm') return [nx(vmNode) + NW / 2, Y.vm + BOX_H.vm];
  const key = p.at === 'stargate' ? 'sg' : p.at;
  return [nx(p.node) + NW / 2, Y[key] + BOX_H[key] / 2];
}

function hopPoints(h: Hop, vmNode: number): [number, number][] {
  const a = anchor(h.from, vmNode);
  const b = anchor(h.to, vmNode);
  const na = 'node' in h.from ? h.from.node : vmNode;
  const nb = 'node' in h.to ? h.to.node : vmNode;
  const cx = nx(vmNode) + NW / 2;
  if (h.from.at === 'vm') return [[cx - 24, Y.vm + BOX_H.vm], [cx - 24, Y.sg]];
  if (h.to.at === 'vm') return [[cx + 24, Y.sg], [cx + 24, Y.vm + BOX_H.vm]];
  if (h.kind === 'tier') return [[nx(na) + NW - 22, Y.extent + 30], [nx(na) + NW - 22, Y.extent + 58]];
  if (na === nb) {
    const ch = nx(na) + 15;
    return [[BX(na), a[1]], [ch, a[1]], [ch, b[1]], [BX(na), b[1]]];
  }
  // across nodes: out through the gap between nodes, along the network lane, into the target
  const isAck = h.kind === 'ack';
  const dir = nb > na ? 1 : -1;
  const gut = (n: number, side: 1 | -1) => (side === 1 ? nx(n) + NW + NG / 2 : nx(n) - NG / 2) + (isAck ? -3 : 3);
  const edge = (n: number, side: 1 | -1) => (side === 1 ? nx(n) + NW - 10 : BX(n));
  const lane = isAck ? NET_Y + 2 : NET_Y - 8;
  const gs = gut(na, dir);
  const gt = gut(nb, dir === 1 ? -1 : 1);
  return [
    [edge(na, dir), a[1]],
    [gs, a[1]],
    [gs, lane],
    [gt, lane],
    [gt, b[1]],
    [edge(nb, dir === 1 ? -1 : 1), b[1]],
  ];
}

function along(pts: [number, number][], f: number): [number, number] {
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let d = Math.max(0, Math.min(1, f)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (d <= seg[i] || i === seg.length - 1) {
      const r = seg[i] ? d / seg[i] : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r];
    }
    d -= seg[i];
  }
  return pts[pts.length - 1];
}

const HOP_CLS: Record<Hop['kind'], string> = {
  io: 'dp-hop io',
  replicate: 'dp-hop rep',
  ack: 'dp-hop ack',
  drain: 'dp-hop drain',
  read: 'dp-hop io',
  'network-read': 'dp-hop rep',
  tier: 'dp-hop drain',
};

const isAt = (list: Place[], p: Place) => list.some((q) => q.at === p.at && ('node' in q ? q.node : -1) === ('node' in p ? p.node : -1));

function PathDiagram({ step, frac, rf, mode, cache }: { step: DpStep; frac: number; rf: RF; mode: Mode; cache: CacheState }) {
  const vmNode = 0;
  const label = mode === 'rd' ? 'Read path' : mode === 'ws' ? 'Sequential write path' : 'Random write path';
  const missed = (s: ReadSource, n: number) => n === 0 && step.misses?.includes(s);
  const served = (s: ReadSource) => step.servedFrom === s;
  const remoteNode = replicaTargets(2, SEED)[0];
  return (
    <svg class="diagram dp-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}, RF${rf}: ${step.title}`}>
      <defs>
        {['io', 'rep', 'ack', 'drain'].map((k) => (
          <marker key={k} id={`dp-ar-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" class={`dp-mk ${k}`} />
          </marker>
        ))}
      </defs>
      <rect x={X0} y={NET_Y - 16} width={W - X0 * 2} height={24} class="bg3" />
      <text x={W - X0 - 8} y={NET_Y + 1} text-anchor="end" class="muted" style={{ fontSize: '11px', letterSpacing: '0.06em' }}>
        CLUSTER NETWORK
      </text>
      {Array.from({ length: DP_NODES }, (_, n) => {
        const x = nx(n);
        const box = (key: keyof typeof Y, p: Place, title: string, sub?: string, extra?: string) => {
          const on = isAt(step.active, p);
          return (
            <g>
              <rect x={BX(n)} y={Y[key]} width={NW - 36} height={BOX_H[key]} class={`dp-box ${on ? 'on' : ''} ${extra ?? ''}`} />
              <text x={BX(n) + 8} y={Y[key] + 16} style={{ fontSize: '14px', fontWeight: 600 }}>
                {title}
              </text>
              {sub && (
                <text x={BX(n) + 8} y={Y[key] + 30} class="muted" style={{ fontSize: '11.5px' }}>
                  {sub}
                </text>
              )}
            </g>
          );
        };
        const hasOp = step.oplogCopies.includes(n);
        const hasEx = step.extentCopies.includes(n);
        return (
          <g key={n}>
            <rect x={x} y={8} width={NW} height={NET_Y - 30} class="node-box" />
            <text x={x + 10} y={27} style={{ fontSize: '14px', fontWeight: 600 }}>
              Node {n + 1}
            </text>
            {n === vmNode ? (
              <g>
                <rect x={x + 10} y={Y.vm} width={NW - 20} height={BOX_H.vm} class={`vm ${isAt(step.active, { at: 'vm' }) ? 'hl' : ''}`} />
                <text x={x + 18} y={Y.vm + 23} style={{ fontSize: '14px', fontWeight: 600 }}>
                  App VM
                </text>
                {step.acked && (
                  <g>
                    <rect x={x + NW - 74} y={Y.vm + 8} width={56} height={18} class="ok-fill" />
                    <text x={x + NW - 46} y={Y.vm + 21} text-anchor="middle" style={{ fontSize: '11px', fontWeight: 700, fill: '#08130c' }}>
                      ✓ ACK
                    </text>
                  </g>
                )}
                {mode === 'rd' && step.id === 'return' && (
                  <g>
                    <rect x={x + NW - 82} y={Y.vm + 8} width={64} height={18} class="ok-fill" />
                    <text x={x + NW - 50} y={Y.vm + 21} text-anchor="middle" style={{ fontSize: '11px', fontWeight: 700, fill: '#08130c' }}>
                      ✓ DATA
                    </text>
                  </g>
                )}
              </g>
            ) : (
              <text x={x + 18} y={Y.vm + 21} class="faint" style={{ fontSize: '11.5px' }}>
                other VMs
              </text>
            )}
            <rect x={x + 4} y={Y.sg - 14} width={NW - 8} height={Y.extent + BOX_H.extent - Y.sg + 22} class="dp-cvm" />
            <text x={x + NW - 10} y={Y.sg - 3} text-anchor="end" class="ink-text dp-cvm-l" style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em' }}>
              CVM
            </text>
            {box('sg', { at: 'stargate', node: n }, 'Stargate', 'serves all I/O')}
            {box('cache', { at: 'cache', node: n }, 'Content cache', mode === 'rd' && n === 0 ? `single ${cache.single.length} · multi ${cache.multi.length}` : 'memory', missed('cache', n) ? 'miss' : served('cache') && n === 0 ? 'hit' : '')}
            {box('oplog', { at: 'oplog', node: n }, 'OpLog', mode === 'ws' ? 'bypassed' : 'fast write buffer', `${mode === 'ws' ? 'dim' : ''} ${missed('oplog', n) ? 'miss' : served('oplog') && n === 0 ? 'hit' : ''}`)}
            {box('extent', { at: 'extent', node: n }, 'Extent store', 'long-term storage', `${missed('local', n) ? 'miss' : (served('local') && n === 0) || (served('remote') && n === remoteNode) ? 'hit' : ''}`)}
            {hasOp && <CopyTile x={x + NW - 40} y={Y.oplog + 10} n={step.oplogCopies.indexOf(n) + 1} />}
            {hasEx && <CopyTile x={x + NW - 40} y={Y.extent + 10} n={step.extentCopies.indexOf(n) + 1} />}
            {step.id === 'ilm' && step.extentCopies.includes(n) && (
              <text x={BX(n) + 8} y={Y.extent + 52} class="flow-fill" style={{ fontSize: '10.5px', fontWeight: 600 }}>
                ILM: hot → fast tier
              </text>
            )}
          </g>
        );
      })}
      {step.hops.map((h, i) => {
        const pts = hopPoints(h, vmNode);
        const cls = HOP_CLS[h.kind];
        const mk = cls.split(' ')[1];
        const [dx, dy] = along(pts, frac);
        return (
          <g key={i}>
            <polyline points={pts.map((p) => p.join(',')).join(' ')} class={cls} marker-end={`url(#dp-ar-${mk})`} />
            <circle cx={dx} cy={dy} r={5} class={`dp-dot ${mk}`} />
          </g>
        );
      })}
    </svg>
  );
}

function CopyTile({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <rect x={x} y={y} width={26} height={18} class="ink-fill" />
      <text x={x + 13} y={y + 13} text-anchor="middle" class="mono" style={{ fontSize: '10.5px', fill: '#fff', fontWeight: 600 }}>
        #{n}
      </text>
    </g>
  );
}

function LocalityDiagram({ f }: { f: LocalityFrame }) {
  const n = f.local.length;
  const tw = 16;
  const lw = 520;
  const lh = 230;
  const nodeX = [20, 280];
  const replicaOn = 0; // the original node keeps a copy of every extent
  const tileX = (node: number, e: number) => nodeX[node] + 10 + e * (tw + 8) + tw / 2;
  const readPts: [number, number][] | null =
    f.read === null
      ? null
      : f.readRemote
        ? [[nodeX[1] + 204, 110], [nodeX[1] + 204, 205], [tileX(0, f.read), 205], [tileX(0, f.read), 159]]
        : [[tileX(f.vmNode, f.read), 110], [tileX(f.vmNode, f.read), 137]];
  return (
    <svg class="diagram dp-loc" viewBox={`0 0 ${lw} ${lh}`} role="img" aria-label={`Data locality: ${f.text}`}>
      {nodeX.map((x, i) => (
        <g key={i}>
          <rect x={x} y={20} width={220} height={170} class="node-box" />
          <text x={x + 10} y={38} style={{ fontSize: '12.5px', fontWeight: 600 }}>
            Node {i + 1}
          </text>
          {f.vmNode === i ? (
            <g>
              <rect x={x + 10} y={50} width={200} height={34} class="vm hl" />
              <text x={x + 20} y={72} style={{ fontSize: '12.5px', fontWeight: 600 }}>
                App VM
              </text>
            </g>
          ) : (
            <text x={x + 20} y={72} class="faint" style={{ fontSize: '11.5px' }}>
              {f.phase === 'before' || i === 1 ? '' : 'VM moved away'}
            </text>
          )}
          <rect x={x + 10} y={96} width={200} height={14} class="dp-cvm" />
          <text x={x + 16} y={107} class="ink-text" style={{ fontSize: '10px', fontWeight: 600 }}>
            CVM · Stargate
          </text>
          <text x={x + 10} y={130} class="muted" style={{ fontSize: '10.5px' }}>
            Extent store: this VM’s hot extents
          </text>
          {Array.from({ length: n }, (_, e) => {
            const has = i === replicaOn ? true : f.local[e] && f.phase !== 'before';
            const isRead = f.read === e && ((f.readRemote && i === 0) || (!f.readRemote && i === f.vmNode));
            return <rect key={e} x={x + 10 + e * (tw + 8)} y={140} width={tw} height={tw} class={`${has ? (i === f.vmNode ? 'tile-local' : 'tile-rep') : 'dp-empty'} ${isRead ? 'dp-read' : ''}`} />;
          })}
        </g>
      ))}
      <rect x={10} y={198} width={500} height={14} class="bg3" />
      <text x={505} y={209} text-anchor="end" class="muted" style={{ fontSize: '10px', letterSpacing: '0.06em' }}>
        NETWORK
      </text>
      {readPts && <polyline points={readPts.map((p) => p.join(',')).join(' ')} class={`dp-hop ${f.readRemote ? 'rep' : 'io'}`} marker-end={`url(#dp-lar-${f.readRemote ? 'rep' : 'io'})`} />}
      {f.phase === 'migrate' && <path d={`M ${nodeX[0] + 210} 67 H ${nodeX[1] + 10}`} class="dp-hop ack" marker-end="url(#dp-lar-ack)" />}
      <defs>
        {['io', 'rep', 'ack'].map((k) => (
          <marker key={k} id={`dp-lar-${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" class={`dp-mk ${k}`} />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

const SRC_WORD: Record<ReadSource, string> = { cache: 'Memory cache', oplog: 'OpLog', local: 'Local drive', remote: 'Another node' };

export default function Datapath() {
  const [mode, setMode] = useEnum<Mode>('m', 'wr', MODES);
  const [rfS, setRf] = useEnum<'2' | '3'>('drf', '2', ['2', '3']);
  const rf = Number(rfS) as RF;
  const cache: CacheState = { single: ['B'], multi: ['A'] };

  const steps = useMemo(() => (mode === 'rd' ? readSequence({ source: 'local', seed: SEED }) : mode === 'loc' ? [] : writeSequence({ rf, kind: mode === 'ws' ? 'sequential' : 'random', seed: SEED })), [mode, rf]);
  const frames = useMemo(() => localitySequence({ extents: 8, seed: SEED }), []);
  const len = mode === 'loc' ? frames.length : steps.length;
  const clock = useClock({ rate: mode === 'loc' ? 1.4 : 0.6, duration: len - 0.001, keys: true, poster: len - 0.001, stops: Array.from({ length: len }, (_, k) => k) });
  useRestartOn(clock, [mode, rf]);

  const i = Math.min(len - 1, Math.floor(clock.t));
  const frac = clock.t - Math.floor(clock.t);
  const step = steps[i];
  const f = frames[i];
  const sum = localitySummary(frames);

  const isWrite = mode === 'wr' || mode === 'ws';
  const copies = step ? new Set([...step.oplogCopies, ...step.extentCopies]).size : 0;
  const tone = mode === 'loc' ? (f.readRemote ? 'flow' : f.phase === 'migrate' ? 'warn' : 'ok') : step.acked || step.servedFrom ? 'ok' : step.hops.some((h) => h.kind === 'replicate' || h.kind === 'network-read') ? 'flow' : 'ink';
  const k = mode === 'loc' ? (f.phase === 'before' ? 'Before the move' : f.phase === 'migrate' ? 'Live migration' : f.readRemote ? 'Remote read, then copied here' : 'Local again') : step.title;
  const text = mode === 'loc' ? f.text : step.text;

  return (
    <Show
      top={
        <>
          <Choice<Mode>
            label="What to follow"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'wr', label: 'Small write' },
              { value: 'ws', label: 'Large sequential write' },
              { value: 'rd', label: 'Read' },
              { value: 'loc', label: 'Read after a VM moves' },
            ]}
          />
          <Choice<'2' | '3'>
            label="Copies"
            value={rfS}
            onChange={setRf}
            why={isWrite ? null : 'Reads use one copy, so RF does not change this view.'}
            options={[
              { value: '2', label: 'RF2', disabled: !isWrite },
              { value: '3', label: 'RF3', disabled: !isWrite },
            ]}
          />
        </>
      }
      foot={
        <>
          <Follow tone={tone} k={k}>
            <p>{text}</p>
            {mode === 'ws' && step.id === 'classify' && (
              <p class="rest">
                <Tip text={THRESHOLD_TIP}>How a write counts as sequential</Tip> <Illus why="The diagram treats the whole write as one sequential stream. Real workloads mix patterns, and Stargate decides per virtual disk as I/O arrives." />
              </p>
            )}
          </Follow>
          {isWrite && (
            <Kpis
              items={[
                { k: 'Copies written', v: `${copies} of ${rf}`, tone: copies === rf ? 'ok' : undefined },
                { k: 'Path', v: mode === 'ws' ? 'Direct' : 'OpLog first', tip: mode === 'ws' ? 'Large sequential streams skip the OpLog and go straight to the extent store, still with all of their copies.' : 'Small and bursty writes land in the OpLog, a fast write buffer, and drain to the extent store later.' },
                { k: 'App told “done”', v: step.acked ? 'Yes' : 'Not yet', tone: step.acked ? 'ok' : undefined },
              ]}
            />
          )}
          {mode === 'rd' && <Kpis items={[{ k: 'Served from', v: step.servedFrom ? SRC_WORD[step.servedFrom] : 'Looking…', tone: step.servedFrom ? 'ok' : undefined }, { k: 'Network hops', v: 0, tip: 'Reads normally prefer the copy on the VM’s own node, as here, so they stay on the server. They may still use a remote copy, for example after the VM moves.' }]} />}
          {mode === 'loc' && (
            <Kpis
              items={[
                { k: 'Read latency now', v: `${f.latency} units`, tone: f.readRemote ? 'flow' : 'ok', tip: 'Relative units: memory, then flash, then a network hop. The shape (a bump after the move that settles) is the point, not the numbers.' },
                { k: 'Before the move', v: `${sum.beforeLatency} units` },
                { k: 'After it settles', v: `${sum.settledLatency} units`, tone: 'ok' },
              ]}
            />
          )}
        </>
      }
    >
      <div class="diagram-scroll">{mode === 'loc' ? <LocalityDiagram f={f} /> : <PathDiagram step={step} frac={clock.playing ? frac : 1} rf={rf} mode={mode} cache={cache} />}</div>
      {mode === 'loc' && (
        <div class="legend">
          <span>
            <i class="sw" style={{ background: 'var(--ink)' }} />
            Copy on the VM’s node (local read)
          </span>
          <span>
            <i class="sw" style={{ background: 'var(--s2)' }} />
            Copy on another node
          </span>
          <span>
            <i class="sw" style={{ border: '1.5px dashed var(--line-2)' }} />
            Not on this node yet
          </span>
          <span>
            <i class="sw" style={{ background: 'var(--flow)' }} />
            Remote read over the network
          </span>
        </div>
      )}
      <PlayBar clock={clock} label="Data path animation" fmt={() => (mode === 'loc' ? k : step.title)} />
    </Show>
  );
}
