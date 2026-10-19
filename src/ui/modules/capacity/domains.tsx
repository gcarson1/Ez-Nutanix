// Blocks and racks tab: nodes sit in blocks (chassis) or racks. With block or rack awareness,
// the two copies of every piece go to different blocks or racks, so a whole one can fail
// without losing access to anything. "Node only" shows the risk without awareness: a piece
// whose copies share a block has no copy online while that block is down. The model lives in
// src/engine/domainspread.ts; this file only animates it.
import { useMemo } from 'preact/hooks';
import { useEnum } from '../../../state/route';
import { planDomains, type Awareness, type DomainPlan } from '../../../engine/domainspread';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import { Shape } from './shapes';

const W = 960;
const PAD = 8;
const TOP = 96;
const NODE_GAP = 8;
const GROUP_GAP = 18;
const FP = 8; // frame padding
const LABEL = 22; // group label height inside the frame
const FLIGHT = 0.7;

function useDomainTimeline(plan: DomainPlan) {
  return useMemo(() => {
    const dt = 0.42;
    const t0 = 0.5;
    const writesEnd = t0 + (plan.pieces - 1) * dt + FLIGHT;
    const fail = writesEnd + 1;
    const rebuild = fail + 1.5;
    const gap = 0.16;
    const done = rebuild + Math.max(0, plan.rebuild.length - 1) * gap + 0.9 + 0.4;
    const end = done + 2.4;
    return { t0, dt, fail, rebuild, gap, done, end };
  }, [plan]);
}

function Picture({ plan, tl, t }: { plan: DomainPlan; tl: ReturnType<typeof useDomainTimeline>; t: number }) {
  const { nodes, groups, groupOf } = plan;
  const perGroup = nodes / groups;
  const avail = W - PAD * 2 - (groups - 1) * GROUP_GAP - groups * FP * 2;
  const nW = (avail - (nodes - groups) * NODE_GAP) / nodes;
  const cols = Math.max(2, Math.min(4, Math.floor((nW - 10) / 22)));
  const sz = Math.min(34, (nW - 10) / cols);
  const maxSlot = Math.max(...plan.copies.map((c) => c.slot), ...plan.rebuild.map((r) => r.slot)) + 1;
  const rows = Math.ceil(maxSlot / cols);
  const nH = 30 + rows * sz + 10;
  const frameW = perGroup * nW + (perGroup - 1) * NODE_GAP + FP * 2;
  const frameH = LABEL + nH + FP;
  const H = TOP + frameH + 34;
  const groupX = (g: number) => PAD + g * (frameW + GROUP_GAP);
  const nodeX = (n: number) => groupX(groupOf[n]) + FP + (n % perGroup) * (nW + NODE_GAP);
  const nodeY = TOP + LABEL;
  const at = (n: number, s: number) => {
    const x0 = nodeX(n) + (nW - cols * sz) / 2;
    return { x: x0 + (s % cols) * sz + sz / 2, y: nodeY + 30 + Math.floor(s / cols) * sz + sz / 2 };
  };
  const failed = t >= tl.fail;
  const down = new Set(plan.failedNodes);
  const src = { x: W / 2, y: 58 };
  const r = sz * 0.32;
  const word = plan.groupKind === 'rack' ? 'Rack' : 'Block';
  const unavailable = new Set(plan.unavailable);

  return (
    <svg
      class="diagram cp-spread"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${nodes} nodes in ${groups} ${plan.groupKind}s. ${plan.awareness === 'node' ? 'Copies are only kept on different nodes.' : `Copies are kept in different ${plan.groupKind}s.`} ${word} ${plan.failedGroup + 1} fails.`}
    >
      <rect class="cp-src" x={W / 2 - 90} y={14} width={180} height={40} />
      <text x={W / 2} y={39} text-anchor="middle" class="cp-src-t">
        Apps write data
      </text>
      {Array.from({ length: groups }, (_, g) => {
        const isDown = failed && g === plan.failedGroup;
        return (
          <g key={`g${g}`}>
            <rect class={`cp-group${isDown ? ' down' : ''}`} x={groupX(g)} y={TOP} width={frameW} height={frameH} />
            <text x={groupX(g) + FP + 2} y={TOP + 15} class={`cp-group-t${isDown ? ' bad-fill' : ''}`}>
              {word} {g + 1}
              {isDown ? ' · down' : ''}
            </text>
          </g>
        );
      })}
      {Array.from({ length: nodes }, (_, n) => {
        const isDown = failed && down.has(n);
        return (
          <g key={n}>
            <rect class={`node-box${isDown ? ' down' : ''}`} x={nodeX(n)} y={nodeY} width={nW} height={nH} />
            <text x={nodeX(n) + 8} y={nodeY + 19} style={{ fontWeight: 600, fontSize: nW < 80 ? '12px' : '13px' }}>
              N{n + 1}
            </text>
          </g>
        );
      })}
      {plan.copies.map((c) => {
        const start = tl.t0 + c.piece * tl.dt;
        if (t < start) return null;
        const to = at(c.node, c.slot);
        const k = ease(prog(t, start, start + FLIGHT));
        const lost = failed && down.has(c.node);
        const cls = lost ? (unavailable.has(c.piece) ? 'cp-lost gone' : 'cp-lost') : 'cp-copy';
        return <Shape key={`${c.piece}:${c.node}`} kind={c.piece} x={src.x + (to.x - src.x) * k} y={src.y + (to.y - src.y) * k} r={r} cls={cls} />;
      })}
      {plan.rebuild.map((rb, i) => {
        const start = tl.rebuild + i * tl.gap;
        if (t < start) return null;
        const fromCopy = plan.copies.find((c) => c.piece === rb.piece && c.node === rb.from)!;
        const from = at(fromCopy.node, fromCopy.slot);
        const to = at(rb.to, rb.slot);
        const k = ease(prog(t, start, start + 0.9));
        const fresh = t < start + 1.7;
        return <Shape key={`rb${rb.piece}`} kind={rb.piece} x={from.x + (to.x - from.x) * k} y={from.y + (to.y - from.y) * k} r={r} cls={fresh ? 'cp-new' : 'cp-copy'} />;
      })}
      {failed && plan.unavailable.length > 0 && (
        <text x={groupX(plan.failedGroup) + frameW / 2} y={TOP + frameH + 22} text-anchor="middle" class="bad-fill cp-warn-t">
          {plan.unavailable.length === 1 ? '1 piece has no copy online' : `${plan.unavailable.length} pieces have no copy online`}
        </text>
      )}
    </svg>
  );
}

const OPTIONS: { value: Awareness; label: string }[] = [
  { value: 'node', label: 'Node only' },
  { value: 'block', label: 'Block' },
  { value: 'rack', label: 'Rack' },
];

export function DomainsView() {
  const [aw, setAw] = useEnum<Awareness>('aw', 'block', ['node', 'block', 'rack']);
  const plan = useMemo(() => planDomains(aw), [aw]);
  const tl = useDomainTimeline(plan);
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.done + 0.5, stops: [tl.fail, tl.rebuild, tl.done] });
  useRestartOn(clock, [aw]);
  const t = clock.t;
  const phase = phaseAt([0, tl.fail, tl.rebuild, tl.done], t);
  const kind = plan.groupKind;
  const failedName = `${kind === 'rack' ? 'Rack' : 'Block'} ${plan.failedGroup + 1}`;
  const lost = plan.unavailable.length;

  const captions: Record<Awareness, { tone: Tone | 'ink'; k: string; text: string }[]> = {
    block: [
      { tone: 'ink', k: 'Copies in different blocks', text: '8 nodes in 4 blocks (chassis of 2 nodes). With block awareness, the two copies of every piece go to different blocks.' },
      { tone: 'bad', k: 'A block fails', text: `${failedName} loses power and both of its nodes go down at once. Every piece still has a copy in another block.` },
      { tone: 'flow', k: 'Self-healing', text: 'The other blocks re-create the missing copies, still keeping each piece’s copies in different blocks.' },
      { tone: 'ok', k: 'Protected again', text: 'No piece was unavailable at any point. Block awareness needs at least 3 blocks with RF2, or 5 with RF3.' },
    ],
    node: [
      { tone: 'ink', k: 'Copies on different nodes only', text: 'Without block awareness, copies only have to be on different nodes, so a piece can end up with both copies in one block. Here 1 piece of 8 does.' },
      { tone: 'bad', k: 'A block fails', text: `${failedName} loses power. The piece with both copies in that block has no copy online until the block comes back.` },
      { tone: 'flow', k: 'Self-healing', text: 'Pieces that still have a copy are re-created on other nodes. The unavailable piece has nothing to copy from.' },
      { tone: 'warn', k: 'Some data unavailable', text: 'That piece is back only when the block is. Block awareness prevents this once the cluster has at least 3 blocks.' },
    ],
    rack: [
      { tone: 'ink', k: 'Copies in different racks', text: '12 nodes in 3 racks. With rack awareness, the two copies of every piece go to different racks. An administrator tells the cluster which rack each block is in.' },
      { tone: 'bad', k: 'A rack fails', text: `${failedName} goes down, for example its power or top-of-rack switches. Every piece still has a copy in another rack.` },
      { tone: 'flow', k: 'Self-healing', text: 'The other racks re-create the missing copies, still keeping each piece’s copies in different racks.' },
      { tone: 'ok', k: 'Protected again', text: 'No piece was unavailable at any point. Rack awareness needs at least 3 racks with RF2, or 5 with RF3.' },
    ],
  };
  const caption = captions[aw][phase];
  const third =
    aw === 'block'
      ? { k: 'Free space to keep', v: 'One block', sub: '2 nodes here', tip: 'Common sizing guidance: with RF2, keep a block’s worth of free space (two blocks with RF3) so the cluster can fully re-protect after losing a whole block.' }
      : aw === 'rack'
        ? { k: 'Minimum racks', v: '3 · 5', sub: 'RF2 · RF3 (4 · 6 with EC-X)', tip: 'From current Nutanix documentation. Confirm it for the AOS version and design.' }
        : { k: 'Minimum blocks for awareness', v: '3 · 5', sub: 'RF2 · RF3 (4 · 6 with EC-X)', tip: 'From current Nutanix documentation. Confirm it for the AOS version and design.' };

  return (
    <Show
      top={<Choice<Awareness> label="Keep copies apart by" value={aw} onChange={setAw} options={OPTIONS} />}
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: `Survives a whole ${kind}`, v: lost ? 'No' : 'Yes', tone: lost ? 'bad' : 'ok' },
              { k: 'Unavailable during the failure', v: `${lost} of ${plan.pieces}`, sub: 'pieces', tone: lost ? 'bad' : 'ok' },
              third,
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <Picture plan={plan} tl={tl} t={t} />
      </div>
      <PlayBar
        clock={clock}
        label="Block and rack awareness animation"
        fmt={() => ['Placement', 'Failure', 'Self-healing', lost ? 'Result' : 'Protected'][phase]}
        extra={
          <Illus
            why={
              aw === 'node'
                ? 'Eight pieces with two copies each (RF2). If copies were placed at random on 8 nodes in 4 blocks, about 1 piece in 7 would have both copies in one block; this picture shows 1 of 8. Timings are compressed.'
                : 'Eight pieces with two copies each (RF2), on a layout that meets the minimum for awareness. Timings are compressed.'
            }
          />
        }
      />
    </Show>
  );
}
