// Data Security: pick whether data at rest is encrypted (and where its keys live) and a theft, and
// watch data being written to a small cluster, a drive or a whole node being carried off, and
// whether the stolen data can be read, on a loop.
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Choice, Kpis, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

type Enc = 'off' | 'native' | 'ext';
type Threat = 'drive' | 'node';

const ENC_LABEL: Record<Enc, string> = { off: 'Off', native: 'On · built-in key manager', ext: 'On · external key manager' };
const THREAT_LABEL: Record<Threat, string> = { drive: 'A drive is stolen', node: 'A whole node is stolen' };

// ── timeline (sim seconds) ──
const NODES = 3;
const DRIVES = 3;
const PER_DRIVE = 3;
const PIECES = NODES * DRIVES * PER_DRIVE;
const W0 = 0.3;
const DT = 0.09;
const FLIGHT = 0.8;
const STEAL = 4;
const MOVED = 5.4;
const RESULT = 5.6;
const END = 9.4;

// ── geometry ──
const W = 960;
const H = 366;
const SRC = { x: 300, y: 42 };
const GATE = { x: 262, y: 62, w: 76, h: 32 };
const CL = { x: 10, y: 54, w: 580, h: 244 };
const NODE = { y: 106, w: 176, h: 180 };
const nodeX = (n: number) => 24 + n * 190;
const DRIVE = { dx: 12, w: 152, h: 40 };
const driveY = (d: number) => NODE.y + 32 + d * 48;
const OUT = { x: 630, y: 106, w: 320, h: 256 };
const KMS = { x: 630, y: 58, w: 320, h: 40 };
const STOLEN_NODE = 2;
const STOLEN_DRIVE = 1;
/** Where the stolen thing ends up, as an offset from where it was. */
const DRIVE_TO = { x: OUT.x + (OUT.w - DRIVE.w) / 2 - (nodeX(STOLEN_NODE) + DRIVE.dx), y: 196 - driveY(STOLEN_DRIVE) };
const NODE_TO = { x: OUT.x + (OUT.w - NODE.w) / 2 - nodeX(STOLEN_NODE), y: 142 - NODE.y };
const R = 8;

interface Verdict {
  tone: Tone;
  word: string;
  k: string;
  text: string;
  mark: string;
}

function verdict(enc: Enc, th: Threat): Verdict {
  if (enc === 'off')
    return {
      tone: 'bad',
      word: 'Readable',
      k: 'Readable',
      mark: '✕ Readable: data is stored as written',
      text: th === 'drive' ? 'The drive holds data exactly as it was written. Anyone who has it can read it.' : 'Every drive in the node holds data exactly as it was written. Anyone who has the node can read it.',
    };
  if (th === 'drive')
    return {
      tone: 'ok',
      word: 'Unreadable',
      k: 'Unreadable',
      mark: '✓ Unreadable: scrambled, no key on it',
      text: 'The drive holds only scrambled data and the keys are not on it, so it is useless to whoever has it. The same goes for a drive sent back for repair or thrown away.',
    };
  if (enc === 'ext')
    return {
      tone: 'ok',
      word: 'Unreadable',
      k: 'Unreadable',
      mark: '✓ Unreadable: key server out of reach',
      text: 'The keys live on your own key server, which a stolen node cannot reach from somewhere else. Keys and data are never in the same place.',
    };
  return {
    tone: 'warn',
    word: 'Depends',
    k: 'Depends on the setup',
    mark: '! Depends on the setup',
    text: 'With the built-in key manager the cluster itself holds the keys, so how well a whole stolen node is protected depends on the configuration and release. If this is in your threat model, use an external key manager.',
  };
}

function writeCaption(enc: Enc): string {
  if (enc === 'off') return 'Apps write as usual, and with encryption off the data lands on the drives exactly as written.';
  return `Apps write as usual. Nutanix software encrypts every piece before it reaches a drive, with keys ${enc === 'ext' ? 'from your own key server, kept apart from the data' : 'held by the cluster itself, so no extra server is needed'}.`;
}

/** Plain data: one of four simple shapes. */
function Piece({ kind, x, y, cls }: { kind: number; x: number; y: number; cls: string }) {
  const k = kind % 4;
  if (k === 0) return <circle class={cls} cx={x} cy={y} r={R} />;
  if (k === 1) return <rect class={cls} x={x - R * 0.85} y={y - R * 0.85} width={R * 1.7} height={R * 1.7} />;
  const pts = k === 2 ? [[0, -1.15], [1.05, 0.75], [-1.05, 0.75]] : [[0, -1.2], [1.2, 0], [0, 1.2], [-1.2, 0]];
  return <polygon class={cls} points={pts.map(([px, py]) => `${(x + px * R).toFixed(1)},${(y + py * R).toFixed(1)}`).join(' ')} />;
}

/** Encrypted data: the same piece, scrambled. */
function Cipher({ x, y }: { x: number; y: number }) {
  return <rect class="sc-cipher" x={x - R} y={y - R} width={R * 2} height={R * 2} fill="url(#sc-hatch)" />;
}

function Lock({ x, y }: { x: number; y: number }) {
  return (
    <g class="sc-lock">
      <path d={`M${x - 5} ${y - 1} v-4 a5 5 0 0 1 10 0 v4`} />
      <rect x={x - 8} y={y - 1} width={16} height={12} />
    </g>
  );
}

function Key({ x, y }: { x: number; y: number }) {
  return (
    <g class="sc-key">
      <circle cx={x} cy={y} r={6} />
      <path d={`M${x + 6} ${y} h14 m-4 0 v5 m-5 -5 v4`} />
    </g>
  );
}

const slot = (n: number, d: number, s: number) => ({ x: nodeX(n) + DRIVE.dx + 30 + s * 46, y: driveY(d) + DRIVE.h / 2 });

function TheftDiagram({ enc, th, t }: { enc: Enc; th: Threat; t: number }) {
  const on = enc !== 'off';
  const move = ease(prog(t, STEAL, MOVED));
  const v = verdict(enc, th);
  const result = t >= RESULT;
  const nodeOff = th === 'node' ? { x: NODE_TO.x * move, y: NODE_TO.y * move } : { x: 0, y: 0 };
  const driveOff = th === 'drive' ? { x: DRIVE_TO.x * move, y: DRIVE_TO.y * move } : { x: 0, y: 0 };
  const off = (n: number, d: number) => (n !== STOLEN_NODE ? { x: 0, y: 0 } : th === 'node' ? nodeOff : d === STOLEN_DRIVE ? driveOff : { x: 0, y: 0 });
  const gateEnd = GATE.y + GATE.h;

  const pieces = Array.from({ length: PIECES }, (_, i) => {
    const t0 = W0 + i * DT;
    if (t < t0) return null;
    const n = i % NODES;
    const d = Math.floor(i / NODES) % DRIVES;
    const s = Math.floor(i / (NODES * DRIVES));
    const to = slot(n, d, s);
    const o = off(n, d);
    const k = ease(prog(t, t0, t0 + FLIGHT));
    // straight down through the encryption step, then out to its drive
    const lead = (gateEnd + 6 - SRC.y) / (gateEnd + 6 - SRC.y + Math.hypot(to.x - SRC.x, to.y - gateEnd - 6));
    let x: number;
    let y: number;
    if (k < lead) {
      x = SRC.x;
      y = SRC.y + (gateEnd + 6 - SRC.y) * (k / lead);
    } else {
      const f = (k - lead) / (1 - lead);
      x = SRC.x + (to.x - SRC.x) * f + o.x;
      y = gateEnd + 6 + (to.y - gateEnd - 6) * f + o.y;
    }
    const stolen = n === STOLEN_NODE && (th === 'node' || d === STOLEN_DRIVE);
    if (on && y > gateEnd) return <Cipher key={i} x={x} y={y} />;
    return <Piece key={i} kind={i} x={x} y={y} cls={`sc-piece${stolen && result && !on ? ' exposed' : ''}`} />;
  });

  const stolenBox = th === 'node' ? { x: nodeX(STOLEN_NODE) + NODE_TO.x, y: NODE.y + NODE_TO.y, w: NODE.w, h: NODE.h } : { x: nodeX(STOLEN_NODE) + DRIVE.dx + DRIVE_TO.x, y: driveY(STOLEN_DRIVE) + DRIVE_TO.y, w: DRIVE.w, h: DRIVE.h };
  const keyCut = enc === 'ext' && th === 'node' && t >= MOVED;

  return (
    <svg class="diagram sc-dia" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`A three-node cluster with encryption ${ENC_LABEL[enc]}. ${THREAT_LABEL[th]}. Result: ${v.k}.`}>
      <defs>
        <pattern id="sc-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="5" height="5" class="sc-hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="5" class="sc-hatch-l" />
        </pattern>
      </defs>

      {/* apps and the encryption step */}
      <rect x={SRC.x - 90} y={8} width={180} height={34} class="bg3" stroke="var(--line-2)" />
      <text x={SRC.x} y={31} text-anchor="middle" class="sc-t">
        Apps write data
      </text>
      <rect x={CL.x} y={CL.y} width={CL.w} height={CL.h} class="frame" />
      <text x={CL.x + 4} y={CL.y - 8} class="sc-t">
        Cluster
      </text>
      <rect x={GATE.x} y={GATE.y} width={GATE.w} height={GATE.h} class={on ? 'sc-gate on' : 'sc-gate'} />
      {on && <Lock x={GATE.x + 13} y={GATE.y + 12} />}
      <text x={GATE.x - 10} y={GATE.y + 21} text-anchor="end" class={on ? 'sc-s sc-ink' : 'sc-s muted'} style={{ fontWeight: 600 }}>
        {on ? 'Encrypted by Nutanix software' : 'Not encrypted'}
      </text>

      {/* key manager */}
      {enc === 'native' && (
        <g>
          <line x1={GATE.x + GATE.w} y1={GATE.y + GATE.h / 2} x2={390} y2={GATE.y + GATE.h / 2} class="sc-keyline" />
          <rect x={390} y={GATE.y} width={186} height={GATE.h} class="sc-km" />
          <Key x={406} y={GATE.y + GATE.h / 2} />
          <text x={436} y={GATE.y + 21} class="sc-s" style={{ fontWeight: 600 }}>
            Built-in key manager
          </text>
        </g>
      )}
      {enc === 'ext' && (
        <g>
          <line x1={GATE.x + GATE.w} y1={GATE.y + GATE.h / 2} x2={KMS.x} y2={GATE.y + GATE.h / 2} class="sc-keyline" />
          <rect x={KMS.x} y={KMS.y} width={KMS.w} height={KMS.h} class="sc-km" />
          <Key x={KMS.x + 16} y={KMS.y + KMS.h / 2} />
          <text x={KMS.x + 46} y={KMS.y + 25} class="sc-s" style={{ fontWeight: 600 }}>
            External key manager <tspan class="muted" style={{ fontWeight: 400 }}>· your key server</tspan>
          </text>
        </g>
      )}

      {/* legend */}
      <Piece kind={0} x={CL.x + 14} y={CL.y + CL.h + 24} cls="sc-piece" />
      <text x={CL.x + 30} y={CL.y + CL.h + 29} class="sc-s">
        Plain data: anyone with the drive can read it
      </text>
      <Cipher x={CL.x + 14} y={CL.y + CL.h + 52} />
      <text x={CL.x + 30} y={CL.y + CL.h + 57} class="sc-s">
        Encrypted data: scrambled without the key
      </text>

      {/* outside */}
      <rect x={OUT.x} y={OUT.y} width={OUT.w} height={OUT.h} class="sc-out" />
      <text x={OUT.x + 14} y={OUT.y + 22} class="sc-s muted" style={{ fontWeight: 600, letterSpacing: '0.04em' }}>
        OUTSIDE YOUR DATA CENTER
      </text>

      {/* nodes and drives */}
      {Array.from({ length: NODES }, (_, n) => {
        const o = n === STOLEN_NODE ? nodeOff : { x: 0, y: 0 };
        const x = nodeX(n) + o.x;
        const y = NODE.y + o.y;
        return (
          <g key={n}>
            {n === STOLEN_NODE && th === 'node' && t >= STEAL && <rect x={nodeX(n)} y={NODE.y} width={NODE.w} height={NODE.h} class="sc-gone" />}
            <rect x={x} y={y} width={NODE.w} height={NODE.h} class="node-box" />
            <text x={x + 12} y={y + 22} style={{ fontSize: '14px', fontWeight: 600 }}>
              Node {n + 1}
            </text>
            {Array.from({ length: DRIVES }, (_, d) => {
              const stolenDrive = n === STOLEN_NODE && d === STOLEN_DRIVE && th === 'drive';
              const dx = nodeX(n) + DRIVE.dx + (stolenDrive ? driveOff.x : o.x);
              const dy = driveY(d) + (stolenDrive ? driveOff.y : o.y);
              return (
                <g key={d}>
                  {stolenDrive && t >= STEAL && <rect x={nodeX(n) + DRIVE.dx} y={driveY(d)} width={DRIVE.w} height={DRIVE.h} class="sc-gone" />}
                  <rect x={dx} y={dy} width={DRIVE.w} height={DRIVE.h} class="disk" />
                </g>
              );
            })}
          </g>
        );
      })}

      {pieces}

      {keyCut && (
        <g>
          <line x1={stolenBox.x + stolenBox.w - 16} y1={KMS.y + KMS.h} x2={stolenBox.x + stolenBox.w - 16} y2={stolenBox.y} class="sc-keyline cut" />
          <text x={stolenBox.x + stolenBox.w - 8} y={(KMS.y + KMS.h + stolenBox.y) / 2 + 5} class="sc-s bad-fill halo" style={{ fontWeight: 600 }}>
            ✕ no key
          </text>
        </g>
      )}
      {result && (
        <text x={OUT.x + OUT.w / 2} y={stolenBox.y + stolenBox.h + 24} text-anchor="middle" class={`sc-s halo ${v.tone}-fill`} style={{ fontWeight: 700 }}>
          {v.mark}
        </text>
      )}
    </svg>
  );
}

export default function Security() {
  const [enc, setEnc] = useEnum<Enc>('enc', 'native', ['off', 'native', 'ext']);
  const [th, setTh] = useEnum<Threat>('th', 'drive', ['drive', 'node']);
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: RESULT + 1 });
  useRestartOn(clock, [enc, th]);
  const t = clock.t;
  const phase = phaseAt([0, STEAL, RESULT], t);
  const v = verdict(enc, th);

  const caption: { tone: Tone | 'ink'; k: string; text: string } = [
    { tone: 'ink' as const, k: enc === 'off' ? 'Writing, not encrypted' : 'Writing, encrypted', text: writeCaption(enc) },
    { tone: 'warn' as const, k: THREAT_LABEL[th], text: th === 'drive' ? 'Someone pulls a drive out of node 3 and walks out of the data center with it.' : 'Someone takes node 3, with all of its drives, out of the data center.' },
    { tone: v.tone, k: v.k, text: v.text },
  ][phase];

  return (
    <Show
      top={
        <>
          <Choice<Enc> label="Encryption" value={enc} onChange={setEnc} options={(['off', 'native', 'ext'] as Enc[]).map((e) => ({ value: e, label: ENC_LABEL[e] }))} />
          <Choice<Threat> label="Threat" value={th} onChange={setTh} options={(['drive', 'node'] as Threat[]).map((x) => ({ value: x, label: THREAT_LABEL[x] }))} />
        </>
      }
      foot={
        <>
          <Follow tone={caption.tone} k={caption.k}>
            <p>{caption.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Stolen data', v: v.word, tone: v.tone },
              { k: 'Keys kept', v: enc === 'off' ? 'No keys' : enc === 'ext' ? 'Your key server' : 'On the cluster' },
              { k: 'Extra server to run', v: enc === 'ext' ? 'Yes' : 'No', sub: enc === 'ext' ? 'keep it reachable and backed up' : undefined },
              { k: 'Changes for apps', v: 'None', tip: 'Encryption at rest is invisible to VMs and applications: they read and write plain data.' },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <TheftDiagram enc={enc} th={th} t={t} />
      </div>
      <PlayBar
        clock={clock}
        label="Theft animation"
        fmt={() => ['Writing', 'Stolen', 'Result'][phase]}
        extra={<Illus why="Three nodes and one copy of each piece shown; real clusters keep two or three copies on different nodes. Key handling (key types, rotation, caching) is simplified." />}
      />
    </Show>
  );
}
