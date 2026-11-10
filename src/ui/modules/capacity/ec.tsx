// Erasure coding tab: data is written as RF copies, write-cold data is encoded into one strip
// (data pieces plus parity, each on a different node) and the extra copies are deleted. A node
// fails, the lost strip piece is recomputed from the rest of its strip and lost hot copies are
// copied again. The model lives in src/engine/stripspread.ts; this file only animates it.
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { useScenario } from '../../../state/scenario';
import { planStrip, blendedOverhead, type StripPlan } from '../../../engine/stripspread';
import type { RF } from '../../../engine/rules';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, Legend, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import { Shape } from './shapes';

const W = 960;
const PAD = 8;
const TOP = 160;
const GAP = 14;
const FLIGHT = 0.7;
/** Illustrative share of data that is write-cold, for the blended number. */
const COLD_SHARE = 0.5;

type Item = { key: string; piece: number; node: number; slot: number; parity?: boolean };

function useEcTimeline(plan: StripPlan) {
  return useMemo(() => {
    const pieces = plan.cold.length + plan.hot.length;
    const dt = 0.45;
    const t0 = 0.5;
    const writesEnd = t0 + (pieces - 1) * dt + FLIGHT;
    const encode = writesEnd + 0.8;
    const free = encode + 1.9;
    const fail = free + 1.8;
    const rebuild = fail + 1.4;
    const done = rebuild + 1.4 + 0.7;
    const end = done + 2.4;

    // Slots in arrival order per node: writes, then parity, then rebuilt pieces.
    const count = Array.from({ length: plan.nodes }, () => 0);
    const writes: (Item & { at: number })[] = [];
    const all = [...plan.cold, ...plan.hot].sort((a, b) => a.piece - b.piece);
    for (const p of all) p.copies.forEach((node, k) => writes.push({ key: `w${p.piece}.${k}`, piece: p.piece, node, slot: count[node]++, at: t0 + p.piece * dt }));
    const parity = plan.members.filter((m) => m.role === 'parity').map((m) => ({ key: `p${-m.id}`, piece: m.id, node: m.node, slot: count[m.node]++, parity: true }));
    const remade = plan.recompute.map((r) => ({ key: `r${r.id}`, piece: r.id, node: r.to, slot: count[r.to]++, parity: r.role === 'parity', reads: r.reads }));
    const recopied = plan.recopy.map((r, i) => ({ key: `c${r.piece}.${i}`, piece: r.piece, node: r.to, slot: count[r.to]++, from: r.from }));
    const freed = new Set(plan.freed.map((f) => `${f.piece}@${f.node}`));
    const strip = new Set(plan.members.filter((m) => m.role === 'data').map((m) => `${m.id}@${m.node}`));
    const maxSlot = Math.max(...count);
    return { t0, dt, writesEnd, encode, free, fail, rebuild, done, end, writes, parity, remade, recopied, freed, strip, maxSlot };
  }, [plan]);
}

function Picture({ plan, tl, t }: { plan: StripPlan; tl: ReturnType<typeof useEcTimeline>; t: number }) {
  const nodes = plan.nodes;
  const nW = (W - PAD * 2 - GAP * (nodes - 1)) / nodes;
  const cols = Math.max(2, Math.min(4, Math.floor((nW - 10) / 22)));
  const sz = Math.min(36, (nW - 10) / cols);
  const rows = Math.ceil((tl.maxSlot || 1) / cols);
  const nH = 34 + rows * sz + 12;
  const H = TOP + nH + 30;
  const down = new Set(plan.failed);
  const isDown = (n: number) => down.has(n) && t >= tl.fail;
  const nodeX = (n: number) => PAD + n * (nW + GAP);
  const at = (n: number, s: number) => {
    const x0 = nodeX(n) + (nW - cols * sz) / 2;
    return { x: x0 + (s % cols) * sz + sz / 2, y: TOP + 34 + Math.floor(s / cols) * sz + sz / 2 };
  };
  const src = { x: W / 2, y: 62 };
  const r = sz * 0.32;
  const parityAt = tl.encode + 1.2;
  // Arcs bow up over the row of pieces so each line stays distinct.
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const c = { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 18 - Math.abs(b.x - a.x) * 0.16 };
    const pt = (p: number) => ({ x: (1 - p) ** 2 * a.x + 2 * (1 - p) * p * c.x + p * p * b.x, y: (1 - p) ** 2 * a.y + 2 * (1 - p) * p * c.y + p * p * b.y });
    return { d: `M${a.x} ${a.y} Q${c.x} ${c.y} ${b.x} ${b.y}`, pt };
  };
  const lines: JSX.Element[] = [];
  const dots: JSX.Element[] = [];

  // Parity being computed: every data piece of the strip feeds the parity piece(s).
  if (t >= tl.encode && t < parityAt + 0.2) {
    const p = ease(prog(t, tl.encode, parityAt));
    for (const par of tl.parity) {
      const to = at(par.node, par.slot);
      for (const w of tl.writes.filter((x) => tl.strip.has(`${x.piece}@${x.node}`))) {
        const g = arc(at(w.node, w.slot), to);
        lines.push(<path key={`pl${par.key}${w.key}`} class="cp-arc" d={g.d} />);
        if (t < parityAt) {
          const d = g.pt(p);
          dots.push(<circle key={`pd${par.key}${w.key}`} class="cp-dot" cx={d.x} cy={d.y} r={3.5} />);
        }
      }
    }
  }
  // A lost strip piece is recomputed by reading every surviving piece of its strip.
  const remadeAt = tl.rebuild + 1.4;
  if (t >= tl.rebuild && t < remadeAt + 0.2) {
    const p = ease(prog(t, tl.rebuild, remadeAt));
    for (const m of tl.remade) {
      const to = at(m.node, m.slot);
      const sources = [...tl.writes.filter((w) => tl.strip.has(`${w.piece}@${w.node}`) && !down.has(w.node)), ...tl.parity.filter((x) => !down.has(x.node))];
      for (const s of sources) {
        const g = arc(at(s.node, s.slot), to);
        lines.push(<path key={`rl${m.key}${s.key}`} class="cp-arc" d={g.d} />);
        if (t < remadeAt) {
          const d = g.pt(p);
          dots.push(<circle key={`rd${m.key}${s.key}`} class="cp-dot" cx={d.x} cy={d.y} r={3.5} />);
        }
      }
    }
  }

  const items: JSX.Element[] = [];
  for (const w of tl.writes) {
    if (t < w.at) continue;
    const to = at(w.node, w.slot);
    const k = ease(prog(t, w.at, w.at + FLIGHT));
    const x = src.x + (to.x - src.x) * k;
    const y = src.y + (to.y - src.y) * k;
    const isFreed = tl.freed.has(`${w.piece}@${w.node}`);
    if (isFreed && t >= tl.free + 0.9) continue;
    const fading = isFreed && t >= tl.free;
    const cls = isDown(w.node) ? 'cp-lost' : fading ? 'cp-freed' : 'cp-copy';
    items.push(<Shape key={w.key} kind={w.piece} x={x} y={y} r={r} cls={cls} style={fading ? { opacity: 1 - prog(t, tl.free, tl.free + 0.9) } : undefined} />);
  }
  const parityTile = (key: string, c: { x: number; y: number }, cls: string) => (
    <g key={key} class={cls}>
      <rect x={c.x - 16} y={c.y - 12} width={32} height={24} rx={3} />
      <text x={c.x} y={c.y + 4} text-anchor="middle">
        P
      </text>
    </g>
  );
  if (t >= parityAt) for (const par of tl.parity) items.push(parityTile(par.key, at(par.node, par.slot), isDown(par.node) ? 'cp-par lost' : 'cp-par'));
  if (t >= remadeAt)
    for (const m of tl.remade) {
      const c = at(m.node, m.slot);
      const fresh = t < remadeAt + 0.9;
      if (m.parity) items.push(parityTile(m.key, c, fresh ? 'cp-par new' : 'cp-par'));
      else items.push(<Shape key={m.key} kind={m.piece} x={c.x} y={c.y} r={r} cls={fresh ? 'cp-new' : 'cp-copy'} />);
    }
  plan.recopy.forEach((rc, i) => {
    const m = tl.recopied[i];
    const start = tl.rebuild + 0.3 + i * 0.15;
    if (t < start) return;
    const fromItem = tl.writes.find((w) => w.piece === rc.piece && w.node === rc.from)!;
    const from = at(fromItem.node, fromItem.slot);
    const to = at(m.node, m.slot);
    const k = ease(prog(t, start, start + 0.9));
    const fresh = t < start + 1.7;
    items.push(<Shape key={m.key} kind={m.piece} x={from.x + (to.x - from.x) * k} y={from.y + (to.y - from.y) * k} r={r} cls={fresh ? 'cp-new' : 'cp-copy'} />);
  });

  // The strip as one row, A B C D | P, with a line to the node where each member lives.
  const remadeAt2 = tl.rebuild + 1.4;
  const members = [...plan.members.filter((m) => m.role === 'data'), ...plan.members.filter((m) => m.role === 'parity')];
  const cw = 40;
  const gapP = 22;
  const rowW = members.length * cw + gapP;
  const rx0 = W / 2 - rowW / 2;
  const rowY = 118;
  const ties: JSX.Element[] = [];
  const cells = members.map((m, i) => {
    const cx = rx0 + i * cw + cw / 2 + (m.role === 'parity' ? gapP : 0);
    const shown = t >= (m.role === 'parity' ? parityAt : tl.encode);
    let node = m.node;
    let slot = m.role === 'parity' ? tl.parity.find((p) => p.piece === m.id)!.slot : tl.writes.find((w) => w.piece === m.id && w.node === m.node)!.slot;
    const re = tl.remade.find((x) => x.piece === m.id);
    if (re && t >= remadeAt2) {
      node = re.node;
      slot = re.slot;
    }
    const gone = isDown(node);
    if (shown) {
      const to = at(node, slot);
      ties.push(<line key={`tie${m.id}`} class={`cp-tie${gone ? ' lost' : ''}`} x1={cx} y1={rowY + 13} x2={to.x} y2={TOP} />);
    }
    if (!shown) return <rect key={`s${m.id}`} class="cp-slot" x={cx - 16} y={rowY - 12} width={32} height={24} rx={3} />;
    if (m.role === 'parity') return parityTile(`sp${m.id}`, { x: cx, y: rowY }, gone ? 'cp-par lost' : 'cp-par');
    return <Shape key={`sd${m.id}`} kind={m.id} x={cx} y={rowY} r={r} cls={gone ? 'cp-lost' : 'cp-copy'} />;
  });
  const sepX = rx0 + plan.strip.data * cw + gapP / 2;

  return (
    <svg class="diagram cp-spread" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Erasure coding on ${nodes} nodes: write-cold data is encoded into a ${plan.strip.data}/${plan.strip.parity} strip, each piece on a different node, and a lost piece is rebuilt from the rest of its strip.`}>
      <rect class="cp-src" x={W / 2 - 90} y={18} width={180} height={40} />
      <text x={W / 2} y={43} text-anchor="middle" class="cp-src-t">
        Apps write data
      </text>
      {Array.from({ length: nodes }, (_, n) => (
        <g key={n}>
          <rect class={`node-box${isDown(n) ? ' down' : ''}`} x={nodeX(n)} y={TOP} width={nW} height={nH} />
          <text x={nodeX(n) + 10} y={TOP + 21} class="cp-nl d-title" style={{ fontWeight: 600 }}>
            N{n + 1}
          </text>
          {isDown(n) && (
            <text x={nodeX(n) + nW - 8} y={TOP + 21} text-anchor="end" class="bad-fill d-fine" style={{ fontWeight: 600 }}>
              ✕ down
            </text>
          )}
        </g>
      ))}
      <text x={rx0 - 12} y={rowY + 4} text-anchor="end" class="d-label cp-strip-t">
        Example {plan.strip.data}+{plan.strip.parity} strip
      </text>
      <line x1={sepX} x2={sepX} y1={rowY - 14} y2={rowY + 14} class="cp-slot" />
      <g aria-hidden="true">{ties}</g>
      {cells}
      <g aria-hidden="true">{lines}</g>
      {items}
      <g aria-hidden="true">{dots}</g>
    </svg>
  );
}

const x2 = (v: number) => `${v.toFixed(2).replace(/0$/, '')}×`;

export function EcView() {
  const { cfg, set } = useScenario();
  const rf: RF = cfg.rf === 3 ? 3 : 2;
  const plan = useMemo(() => planStrip(rf), [rf]);
  const tl = useEcTimeline(plan);
  const { data, parity } = plan.strip;
  const ec = plan.overhead.strip;
  const blend = blendedOverhead(rf, ec, COLD_SHARE);
  const names = plan.failed.map((n) => `N${n + 1}`).join(' and ');
  const lostPieces = plan.recompute.length;

  const captions: { tone: Tone | 'ink'; k: string; text: string }[] = [
    { tone: 'ink' as const, k: 'Copies written', text: `New data is written as ${rf} copies on different nodes, like any other data.` },
    { tone: 'flow' as const, k: 'Cold data encoded', text: `Data that has not been overwritten for a while is encoded in the background into a strip: ${data} data pieces and ${parity} parity piece${parity === 1 ? '' : 's'} (P), each on a different node. The lines show where each member lives.` },
    { tone: 'ok' as const, k: 'Extra copies deleted', text: `The encoded data’s extra copies are deleted, so cold data uses ${x2(ec)} its size instead of ${rf}×. Hot data keeps its copies.` },
    { tone: 'bad' as const, k: rf === 2 ? 'A node fails' : 'Two nodes fail at once', text: `${names} ${rf === 2 ? 'goes' : 'go'} down. The strip loses ${lostPieces === 1 ? 'a piece' : `${lostPieces} pieces`} and some hot copies are gone, but nothing is lost.` },
    { tone: 'flow' as const, k: 'Lost pieces rebuilt', text: `A lost strip piece is recomputed by reading the rest of its strip, which takes more work than copying. Lost hot copies are simply copied again.` },
    { tone: 'ok' as const, k: 'Protected again', text: `Full protection again, with less capacity spent on cold data than ${rf} copies would use.` },
  ];
  const starts = [0, tl.encode, tl.free, tl.fail, tl.rebuild, tl.done];
  const clock = useClock({ rate: 1, duration: tl.end, keys: true, poster: tl.done + 0.5, steps: paced(starts, captions.map((c) => [c.k, c.text])) });
  useRestartOn(clock, [rf]);
  const t = clock.t;
  const phase = phaseAt(starts, t);
  const caption = captions[phase];

  const bars = [
    { k: `Copies only (RF${rf})`, v: 1 / rf, note: '' },
    { k: 'Half the data write-cold', v: 1 / blend, note: 'illustrative' },
    { k: 'All data write-cold', v: 1 / ec, note: 'theoretical maximum, rarely reached' },
  ];

  return (
    <Show clock={clock}
      top={
        <Choice<RF>
          label="Copies"
          value={rf}
          onChange={(v) => set({ rf: v, ft: v, ecx: false })}
          options={[
            { value: 2, label: 'RF2 · 4/1 strip' },
            { value: 3, label: 'RF3 · 4/2 strip' },
          ]}
        />
      }
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: `Copies (RF${rf})`, v: `${rf}×`, sub: 'space per unit of data' },
              { k: `Strip ${data}/${parity}`, v: x2(ec), sub: 'for write-cold data', tone: 'ok' },
              { k: 'Half the data cold', v: x2(blend), sub: 'illustrative blend', tip: 'Assumes half the data is write-cold. Real savings depend on how much of your data stays cold, so size on copies and treat erasure coding as a bonus until measured.' },
            ]}
          />
          <div class="cp-ec" role="img" aria-label={`Usable share of raw capacity before the rebuild reserve: ${bars.map((b) => `${b.k} ${Math.round(b.v * 100)}%`).join(', ')}`}>
            <div class="cp-ec-h">Usable share of raw, before the rebuild reserve</div>
            {bars.map((b) => (
              <div class="cp-ec-row" key={b.k}>
                <span class="k">{b.k}</span>
                <span class="bar">
                  <i style={{ width: `${Math.round(b.v * 100)}%` }} />
                </span>
                <span class="v">
                  {Math.round(b.v * 100)}%{b.note && <small> {b.note}</small>}
                </span>
              </div>
            ))}
          </div>
        </>
      }
    >
      <div class="diagram-scroll">
        <Picture plan={plan} tl={tl} t={t} />
      </div>
      <Legend
        items={[
          { color: 'var(--ink)', label: 'Copy of a piece of data' },
          { color: 'var(--flow)', label: 'Strip member line, parity (P) or re-created piece' },
          { color: 'var(--bad)', dashed: true, label: 'Piece lost with the failed node' },
        ]}
      />
      <PlayBar
        clock={clock}
        label="Erasure coding animation"
        extra={<Illus why={`Shown on 8 nodes with one strip of ${data} cold pieces and three hot pieces. Encoding happens in the background long after data is written; it is compressed here. Strip width depends on the configuration and cluster size.`} />}
      />
    </Show>
  );
}
