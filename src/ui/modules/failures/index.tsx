// Failure Gauntlet: pick what fails and watch one fixed 8-node cluster ride through it, step by
// step. The steps sit above the picture (click one to jump there), the picture plays on a loop
// with pauses between steps, and the right-hand pane states the outcome and does not change
// while it plays. The story model lives in scenarios.ts.
import { useMemo } from 'preact/hooks';
import './style.css';
import { useEnum } from '../../../state/route';
import { useClock, useRestartOn } from '../../components/clock';
import { Illus, PlayBar, Seg } from '../../components/controls';
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
  const clock = useClock({ rate: 1, duration: def.duration, keys: true, poster: def.poster, stops: def.steps.map((s) => s.at) });
  useRestartOn(clock, [sc, copies]);
  const frame = useMemo(() => frameAt(sc, copies, clock.t), [sc, copies, clock.t]);
  const step = stepIndex(def, clock.t);
  const n = def.steps.length;

  return (
    <div class="lab two gx">
      <div class="stage">
        <div class="gx-top">
          <div class="gx-pick">
            <span class="choice-l">What fails</span>
            <Seg<GId>
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
          </div>
          {sc === 'double' && (
            <div class="gx-pick">
              <span class="choice-l">Copies kept</span>
              <Seg<'2' | '3'>
                label="Copies kept"
                value={cp}
                onChange={setCp}
                options={[
                  { value: '2', label: '2 (RF2)' },
                  { value: '3', label: '3 (RF3)' },
                ]}
              />
            </div>
          )}
        </div>

        <ol class="gx-steps" aria-label="Steps">
          {def.steps.map((s, k) => (
            <li key={s.label} class={k < step ? 'done' : k === step ? 'now' : ''}>
              <button
                type="button"
                aria-current={k === step ? 'step' : undefined}
                title="Jump to this step"
                onClick={() => {
                  clock.pause();
                  clock.seek(s.at + 0.01);
                }}
              >
                <span class="n" aria-hidden="true">
                  {k < step ? <Icon name="check" /> : k + 1}
                </span>
                {s.label}
              </button>
            </li>
          ))}
        </ol>
        <p class="gx-cap">{def.steps[step].text}</p>

        <div class="diagram-scroll">
          <GauntletDiagram frame={frame} label={`Eight-node cluster in four blocks. ${PICKS[sc].label} failure: ${def.steps[n - 1].text}`} />
        </div>
        <GauntletLegend items={def.legend} />
        <PlayBar
          clock={clock}
          label="Failure animation"
          fmt={(t) => `Step ${stepIndex(def, t) + 1} of ${n}`}
          extra={<Illus why="Time is compressed so each failure plays in seconds, and timings are illustrative. In a real cluster HA restarts typically take about two minutes, depending on the HA settings and free memory, and re-creating copies takes longer, depending on how much data there is. Whether RF2 or RF3 survives a failure depends on which failure domains hold the copies and how much free space is left. Each tile is a tenth of a drive." />}
        />
      </div>

      <aside class="rail gx-rail" aria-label="Outcome">
        <section class="side-sec">
          <div class="eyebrow">Outcome</div>
          <ul class="gx-outcome">
            {def.outcome.map((o) => (
              <li key={o.text} class={o.tone}>
                <Icon name={OUTCOME_ICON[o.tone]} />
                {o.text}
              </li>
            ))}
          </ul>
        </section>
        <section class="side-sec">
          <div class="eyebrow">Why it matters</div>
          <p class="gx-why">{def.why}</p>
        </section>
        <section class="side-sec">
          <div class="eyebrow">This cluster</div>
          <p class="gx-setup">
            {G_NODES} nodes in {G_NODES / 2} blocks of 2, each running {VMS_PER_NODE} VMs. Every piece of data is kept as {copies === 3 ? 'three copies (RF3)' : 'two copies (RF2)'}, on different nodes{copies === 2 ? ' and in different blocks' : ''}.
          </p>
        </section>
      </aside>
    </div>
  );
}
