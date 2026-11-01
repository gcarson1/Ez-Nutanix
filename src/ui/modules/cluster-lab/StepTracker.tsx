// The step tracker above the picture in the Cluster & DSF Lab and the Failure Gauntlet: one
// numbered button per step, the current one underlined; click one to pause and jump there.
import './StepTracker.css';
import type { Clock } from '../../components/clock';
import { Icon } from '../../components/Icon';

export function StepTracker({ steps, step, clock }: { steps: { at: number; label: string }[]; step: number; clock: Clock }) {
  return (
    <ol class="lab-steps" aria-label="Steps">
      {steps.map((s, k) => (
        <li key={s.at} class={k < step ? 'done' : k === step ? 'now' : ''}>
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
  );
}
