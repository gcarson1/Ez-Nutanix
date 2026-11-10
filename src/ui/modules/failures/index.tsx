// Failure Gauntlet: pick what fails and watch one fixed 8-node cluster ride through it, step by
// step. The steps sit in the right-hand column (click one to jump there) with the outcome, and
// the picture plays on a loop slowly enough to read each step. The story model lives in scenarios.ts.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar } from '../../components/controls';
import { Choice, Show } from '../../components/show';
import { Icon } from '../../components/Icon';
import { GauntletDiagram, GauntletLegend } from './GauntletDiagram';
import { IDS, defFor, frameAt, stepIndex, G_NODES, VMS_PER_NODE, type Copies, type GId } from './scenarios';

const PICKS: Record<GId, { label: string; icon: string }> = {
  disk: { label: 'Drive', icon: 'disk' },
  cvm: { label: 'Controller VM', icon: 'cpu' },
  node: { label: 'Node', icon: 'server' },
  block: { label: 'Block', icon: 'layers' },
  double: { label: 'Two nodes', icon: 'zap' },
  full: { label: 'Nearly full', icon: 'gauge' },
};

const OUTCOME_ICON = { ok: 'ok', warn: 'warn', bad: 'bad' } as const;

export default function Failures() {
  const [sc, setSc] = useEnum<GId>('sc', 'node', IDS);
  const [cp, setCp] = useEnum<'2' | '3'>('cp', '2', ['2', '3']);
  const copies: Copies = sc === 'double' && cp === '3' ? 3 : 2;
  const def = useMemo(() => defFor(sc, copies), [sc, copies]);
  const clock = useClock({ rate: 1, duration: def.duration, keys: true, poster: def.poster, steps: paced(def.steps.map((s) => s.at), def.steps.map((s) => [s.label, s.text])) });
  useRestartOn(clock, [sc, copies]);
  const frame = useMemo(() => frameAt(sc, copies, clock.t), [sc, copies, clock.t]);
  const step = stepIndex(def, clock.t);
  const n = def.steps.length;

  return (
    <Show
      clock={clock}
      top={
        <>
          <Choice<GId>
            label="What fails"
            value={sc}
            onChange={setSc}
            options={IDS.map((id) => ({
              value: id,
              label: (
                <>
                  <Icon name={PICKS[id].icon} />
                  {PICKS[id].label}
                </>
              ),
            }))}
          />
          {sc === 'double' && (
            <Choice<'2' | '3'>
              label="Copies"
              value={cp}
              onChange={setCp}
              options={[
                { value: '2', label: 'RF2 · 2 copies' },
                { value: '3', label: 'RF3 · 3 copies' },
              ]}
            />
          )}
        </>
      }
      foot={
        <Follow tone="ink" k={def.steps[step].label}>
          <p>{def.steps[step].text}</p>
        </Follow>
      }
      side={
        <>
          <section>
            <h2 class="side-sec-h">Outcome</h2>
            <ul class="gx-outcome">
              {def.outcome.map((o) => (
                <li key={o.text} class={o.tone}>
                  <Icon name={OUTCOME_ICON[o.tone]} />
                  {o.text}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 class="side-sec-h">Why it matters</h2>
            <p class="gx-why">{def.why}</p>
          </section>
          <section>
            <h2 class="side-sec-h">This cluster</h2>
            <p class="gx-setup">
              {G_NODES} nodes in {G_NODES / 2} blocks of 2, each running {VMS_PER_NODE} VMs. Every piece of data is kept as {copies === 3 ? 'three copies (RF3)' : 'two copies (RF2)'}, on different nodes{copies === 2 ? ' and in different blocks' : ''}.
            </p>
          </section>
        </>
      }
    >
      <div class="diagram-scroll">
        <GauntletDiagram frame={frame} label={`Eight-node cluster in four blocks. ${PICKS[sc].label} failure: ${def.steps[n - 1].text}`} />
      </div>
      <GauntletLegend items={def.legend} />
      <PlayBar
        clock={clock}
        label="Failure animation"
        extra={<Illus why="Time is compressed so each failure plays in seconds, and timings are illustrative. In a real cluster HA restarts VMs as soon as the host is declared failed, if there is free memory; how long each VM then takes is its guest OS booting. Re-creating copies takes longer, depending on how much data there is. Whether RF2 or RF3 survives a failure depends on which failure domains hold the copies and how much free space is left. Each tile is a tenth of a drive." />}
      />
    </Show>
  );
}
