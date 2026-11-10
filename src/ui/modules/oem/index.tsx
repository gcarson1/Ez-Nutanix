// OEM of Your Choice: the landing's hardware pane. The same Nutanix software lands on Nutanix NX
// and on each OEM platform in turn, then three clusters on three vendors share one Prism Central,
// then servers you already own, then public cloud. Claims: docs/facts.md section 17 (HW rows).
import { paced, useClock } from '../../components/clock';
import { Follow, Illus, PlayBar, type Tone } from '../../components/controls';
import { Kpis, Names, Show, ease, phaseAt, prog } from '../../components/show';
import './style.css';

const VENDORS = [
  { name: 'Nutanix', sub: ['NX nodes'] },
  { name: 'Dell', sub: ['XC Family'] },
  { name: 'HPE', sub: ['DX Series'] },
  { name: 'Lenovo', sub: ['ThinkAgile HX'] },
  { name: 'Cisco', sub: ['Compute', 'Hyperconverged'] },
  { name: 'Fujitsu', sub: ['PRIMEFLEX XF'] },
  { name: 'Supermicro', sub: ['Hyperconverged', 'Optimized'] },
];
/** Three clusters on three vendors, for the one-estate scene. */
const ESTATE = [
  { v: 1, label: 'Data center A' },
  { v: 2, label: 'Data center B' },
  { v: 3, label: 'Edge sites' },
];

const P = [0, 3, 9, 13.5, 18];
const END = 22.5;
const LINES: { tone: Tone | 'ink'; k: string; text: string }[] = [
  { tone: 'ink', k: 'One platform, in software', text: 'Nutanix Cloud Platform is software: AOS, AHV, Prism, Flow and DR run the same way whichever server they sit on.' },
  { tone: 'flow', k: 'The OEM of your choice', text: 'It runs on Nutanix NX nodes and on OEM platforms from Dell, HPE, Lenovo, Cisco, Fujitsu and Supermicro. Keep the vendor you already buy from, and its buying models such as HPE GreenLake, Lenovo TruScale or Fujitsu uSCALE.' },
  { tone: 'ok', k: 'One estate, many vendors', text: 'Each cluster sits on one vendor’s hardware, and different clusters can be on different vendors. Prism Central runs them all the same way.' },
  { tone: 'ok', k: 'Reuse what you own', text: 'Servers you already have can come too: vSAN ReadyNodes can move to Nutanix, and resellers offer Nutanix software on Cisco, HPE, Klas, KTNF and PacStar servers. Exact models are on the compatibility lists.' },
  { tone: 'ok', k: 'Or no hardware at all', text: 'Nutanix Cloud Clusters (NC2) run the same software on bare-metal instances in AWS, Azure, Google Cloud and OVHcloud. Changing vendor later is a hardware choice, not a platform migration.' },
];
const STEPS = paced(P, LINES.map((l) => [l.k, l.text]));

const W = 960;
const H = 340;
const TW = 128;
const TG = 10;
const tileX = (i: number) => 2 + i * (TW + TG);
const STACK = { y: 8, h: 64 };
const TILE = { y: 116, h: 104 };
const LOW = { y: 252, h: 80 };
const landAt = (i: number) => P[1] + 0.4 + i * 0.75;

function OemDiagram({ t }: { t: number }) {
  const ph = phaseAt(P, t);
  const stackIn = ease(prog(t, 0.2, 1));
  const tilesIn = (i: number) => ease(prog(t, 0.8 + i * 0.12, 1.4 + i * 0.12));
  const landed = (i: number) => t >= landAt(i) + 0.6;
  const estateIn = ease(prog(t, P[2] + 0.3, P[2] + 1.2));
  const lowIn = (a: number) => ease(prog(t, a + 0.2, a + 1));
  const cx = (i: number) => tileX(i) + TW / 2;
  return (
    <svg class="diagram oe-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The same Nutanix Cloud Platform software lands on Nutanix NX nodes and on OEM platforms from Dell, HPE, Lenovo, Cisco, Fujitsu and Supermicro. Clusters on different vendors share one Prism Central; servers you own and public clouds are options too.">
      {/* the software: one stack, the same on every option */}
      <g style={{ opacity: stackIn }}>
        <rect x={0} y={STACK.y} width={W} height={STACK.h} class="ink-fill" rx={4} />
        <text class="d-title" x={W / 2} y={STACK.y + 28} text-anchor="middle" style={{ fill: '#fff', fontWeight: 650 }}>
          Nutanix Cloud Platform
        </text>
        <text class="d-label" x={W / 2} y={STACK.y + 49} text-anchor="middle" style={{ fill: 'rgba(255,255,255,.85)' }}>
          AOS · AHV · Prism · Flow · DR, the same software on every option
        </text>
      </g>

      {/* a copy of the stack drops onto each platform in turn */}
      {ph === 1 &&
        VENDORS.map((_, i) => {
          const f = prog(t, landAt(i), landAt(i) + 0.6);
          return f > 0 && f < 1 ? <rect key={i} x={cx(i) - 30} y={STACK.y + STACK.h + (TILE.y - STACK.y - STACK.h - 14) * ease(f)} width={60} height={14} rx={3} class="oe-copy" /> : null;
        })}

      {VENDORS.map((v, i) => {
        const x = tileX(i);
        const on = ph >= 1 && landed(i);
        const inEstate = ph === 2 && ESTATE.some((e) => e.v === i);
        return (
          <g key={v.name} style={{ opacity: tilesIn(i) * (ph === 2 && !inEstate ? 0.45 : 1) }}>
            <rect x={x} y={TILE.y} width={TW} height={TILE.h} class={`oe-srv${on || inEstate ? ' on' : ''}`} />
            <text x={x + 12} y={TILE.y + 24} class="oe-name">
              {v.name}
            </text>
            {v.sub.map((s, k) => (
              <text key={s} x={x + 12} y={TILE.y + 42 + k * 15} class="muted d-sub">
                {s}
              </text>
            ))}
            {[0, 1].map((r) => (
              <line key={r} x1={x + 12} x2={x + TW - 12} y1={TILE.y + 74 + r * 8} y2={TILE.y + 74 + r * 8} class="oe-ru" />
            ))}
            <text x={x + 12} y={TILE.y + TILE.h - 8} class={`${on ? 'ok-fill' : 'faint'} d-fine`} style={{ fontWeight: on ? 600 : 400 }}>
              {on ? '✓ runs Nutanix' : i === 0 ? 'Nutanix hardware' : 'OEM platform'}
            </text>
          </g>
        );
      })}

      {/* the lower strip changes with the scene */}
      {ph === 2 && (
        <g style={{ opacity: estateIn }}>
          {ESTATE.map((e) => (
            <g key={e.label}>
              <line x1={cx(e.v)} x2={cx(e.v)} y1={TILE.y + TILE.h} y2={LOW.y} class="oe-link" />
              <rect x={cx(e.v) - 60} y={LOW.y} width={120} height={30} rx={3} class="oe-cl" />
              <text class="d-sub" x={cx(e.v)} y={LOW.y + 19} text-anchor="middle" style={{ fontWeight: 600 }}>
                {e.label}
              </text>
              <line x1={cx(e.v)} x2={cx(e.v)} y1={LOW.y + 30} y2={LOW.y + 50} class="oe-link" />
            </g>
          ))}
          <rect x={cx(1) - 60} y={LOW.y + 50} width={cx(3) - cx(1) + 120} height={30} rx={3} class="oe-pc" />
          <text class="d-label" x={(cx(1) + cx(3)) / 2} y={LOW.y + 70} text-anchor="middle" style={{ fontWeight: 650 }}>
            One Prism Central for all three
          </text>
          <text x={cx(3) + 76} y={LOW.y + 19} class="muted d-sub">
            each cluster on one vendor
          </text>
        </g>
      )}
      {ph === 3 && (
        <g style={{ opacity: lowIn(P[3]) }}>
          <rect x={0} y={LOW.y} width={W / 2 - 8} height={LOW.h} class="oe-strip" />
          <text class="d-title" x={16} y={LOW.y + 28} style={{ fontWeight: 600 }}>
            Servers you already own
          </text>
          <text x={16} y={LOW.y + 50} class="muted d-label">
            vSAN ReadyNodes can move to Nutanix
          </text>
          <rect x={W / 2 + 8} y={LOW.y} width={W / 2 - 8} height={LOW.h} class="oe-strip" />
          <text class="d-title" x={W / 2 + 24} y={LOW.y + 28} style={{ fontWeight: 600 }}>
            Through your reseller
          </text>
          <text x={W / 2 + 24} y={LOW.y + 50} class="muted d-label">
            Cisco, HPE, Klas, KTNF and PacStar servers
          </text>
        </g>
      )}
      {ph === 4 && (
        <g style={{ opacity: lowIn(P[4]) }}>
          <rect x={0} y={LOW.y} width={W} height={LOW.h} class="oe-strip" />
          <text class="d-title" x={16} y={LOW.y + 28} style={{ fontWeight: 600 }}>
            Or no hardware at all: Nutanix Cloud Clusters (NC2)
          </text>
          <text x={16} y={LOW.y + 50} class="muted d-label">
            the same software on bare-metal instances in AWS, Azure, Google Cloud and OVHcloud
          </text>
        </g>
      )}
    </svg>
  );
}

export default function Oem() {
  const clock = useClock({ rate: 1, duration: END, keys: true, poster: P[2] + 1.5, steps: STEPS });
  const t = clock.t;
  const line = LINES[phaseAt(P, t)];
  return (
    <Show clock={clock}
      top={
        <>
          <Names label="Runs on" items={VENDORS.map((v) => (v.name === 'Nutanix' ? 'Nutanix NX' : v.name))} />
          <Names label="Also" items={['Servers you own', 'Public cloud (NC2)']} />
        </>
      }
      foot={
        <>
          <Follow tone={line.tone} k={line.k}>
            <p>{line.text}</p>
          </Follow>
          <Kpis
            items={[
              { k: 'Hardware vendors', v: VENDORS.length, sub: 'Nutanix NX and six OEMs' },
              { k: 'Software', v: 'The same', tone: 'ok', sub: 'on every option' },
              { k: 'Public clouds (NC2)', v: 4 },
            ]}
          />
        </>
      }
    >
      <div class="diagram-scroll">
        <OemDiagram t={t} />
      </div>
      <PlayBar
        clock={clock}
        label="Hardware choice animation"
        extra={<Illus why="Vendors and product lines are those on Nutanix’s hardware platform and OEM partner pages; exact supported models, generations and firmware are on each vendor’s hardware compatibility list. The three-cluster estate is an example." />}
      />
    </Show>
  );
}
