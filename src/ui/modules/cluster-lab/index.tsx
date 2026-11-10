// Cluster & DSF Lab: one fixed 4-node cluster and five stories, picked from the buttons above
// the picture. Each story plays on a loop, slowing down in steps with more to read, with pause
// and scrub; the steps, caption and why-it-matters sit in the right-hand column.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { paced, useClock, useRestartOn } from '../../components/clock';
import { Follow, Illus, PlayBar } from '../../components/controls';
import { Choice, Show } from '../../components/show';
import { Icon } from '../../components/Icon';
import { LabDiagram, LabLegend } from './LabDiagram';
import { DRIVES, NODES, ORDER, SCENARIOS, VMS_PER_NODE, frameAt, stepAt, type ScenarioId } from './scenarios';

export default function ClusterLab() {
  const [sc, setSc] = useEnum<ScenarioId>('sc', 'place', ORDER);
  const def = SCENARIOS[sc];
  const clock = useClock({ rate: 1, duration: def.duration, keys: true, poster: def.poster, steps: paced(def.steps.map((s) => s.at), def.steps.map((s) => [s.label, s.text])) });
  useRestartOn(clock, [sc]);
  const frame = useMemo(() => frameAt(sc, clock.t), [sc, clock.t]);
  const step = stepAt(def, clock.t);

  return (
    <Show
      clock={clock}
      top={
        <Choice<ScenarioId>
          label="What happens"
          value={sc}
          onChange={setSc}
          options={ORDER.map((id) => ({
            value: id,
            label: (
              <>
                <Icon name={SCENARIOS[id].icon} />
                {SCENARIOS[id].label}
              </>
            ),
          }))}
        />
      }
      foot={
        <Follow tone="ink" k={def.steps[step].label}>
          <p>{def.steps[step].text}</p>
        </Follow>
      }
      side={
        <>
          <section>
            <h2 class="side-sec-h">Why it matters</h2>
            <p class="dl-why">{def.why}</p>
          </section>
          <section>
            <h2 class="side-sec-h">This lab</h2>
            <p class="dl-setup">
              {NODES} nodes, each running {VMS_PER_NODE} VMs on {DRIVES} drives. Every piece of data is kept as two copies on different nodes (RF2).
            </p>
          </section>
        </>
      }
    >
      <div class="diagram-scroll">
        <LabDiagram frame={frame} label={`Four-node cluster. ${def.title}: ${def.lede}`} />
      </div>
      <LabLegend items={def.legend} />
      <PlayBar
        clock={clock}
        label={`${def.title} animation`}
        extra={<Illus why="Time is compressed so each story plays in seconds. In a real cluster, HA restarts VMs as soon as the host is declared failed, if there is free memory; how long each VM then takes is its guest OS booting. Re-creating copies takes longer, depending on how much data there is. Each tile stands for a slice of one VM’s data." />}
      />
    </Show>
  );
}
