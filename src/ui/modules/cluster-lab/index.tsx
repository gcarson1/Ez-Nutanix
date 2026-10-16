// Cluster & DSF Lab: one fixed 4-node cluster and five stories, picked from the buttons above
// the picture. Each story plays on a loop, pausing briefly after each step, with pause and
// scrub. The right-hand pane explains the chosen story and does not change while it plays.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Illus, PlayBar, Seg } from '../../components/controls';
import { Icon } from '../../components/Icon';
import { LabDiagram, LabLegend } from './LabDiagram';
import { DRIVES, NODES, ORDER, SCENARIOS, VMS_PER_NODE, frameAt, stepAt, type ScenarioId } from './scenarios';

export default function ClusterLab() {
  const [sc, setSc] = useEnum<ScenarioId>('sc', 'place', ORDER);
  const def = SCENARIOS[sc];
  const clock = useClock({ rate: 1, duration: def.duration, keys: true, poster: def.poster, stops: def.steps.map((s) => s.at) });
  useRestartOn(clock, [sc]);
  const frame = useMemo(() => frameAt(sc, clock.t), [sc, clock.t]);
  const step = stepAt(def, clock.t);
  const n = def.steps.length;

  return (
    <div class="lab two dl">
      <div class="stage">
        <div class="dl-pick">
          <span class="choice-l">Choose what to show</span>
          <Seg<ScenarioId>
            label="Choose what to show"
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
        </div>

        <div class="dl-cap">
          <span class="dl-n" aria-hidden="true">
            {step + 1}/{n}
          </span>
          <p>{def.steps[step].text}</p>
        </div>

        <div class="diagram-scroll">
          <LabDiagram frame={frame} label={`Four-node cluster. ${def.title}: ${def.lede}`} />
        </div>
        <LabLegend items={def.legend} />
        <PlayBar
          clock={clock}
          label={`${def.title} animation`}
          fmt={(t) => `Step ${stepAt(def, t) + 1} of ${n}`}
          extra={<Illus why="Time is compressed so each story plays in seconds. In a real cluster, HA restarts take about two minutes and re-creating copies takes longer, depending on how much data there is. Each tile stands for a slice of one VM’s data." />}
        />
      </div>

      <aside class="rail dl-rail" aria-label={`What happens: ${def.title}`}>
        <section class="side-sec">
          <div class="eyebrow">What happens</div>
          <h2>{def.title}</h2>
          <p class="dl-lede">{def.lede}</p>
          <ol>
            {def.steps.map((s) => (
              <li key={s.at}>{s.text}</li>
            ))}
          </ol>
        </section>
        <section class="side-sec">
          <div class="eyebrow">Why it matters</div>
          <p class="dl-why">{def.why}</p>
        </section>
        <section class="side-sec">
          <div class="eyebrow">This lab</div>
          <p class="dl-setup">
            {NODES} nodes, each running {VMS_PER_NODE} VMs on {DRIVES} drives. Every piece of data is kept as two copies on different nodes (RF2).
          </p>
        </section>
      </aside>
    </div>
  );
}
