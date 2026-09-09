import { memo } from 'react';
import type { CommandStage } from '../contracts';

const STEPS: { id: Exclude<CommandStage, 'idle'>; label: string }[] = [
  { id: 'input', label: 'INPUT' },
  { id: 'processing', label: 'PROCESSING' },
  { id: 'result', label: 'RESULT' },
];

const ORDER: Record<CommandStage, number> = { idle: -1, input: 0, processing: 1, result: 2 };

/**
 * Makes the command pipeline visible: input → processing → result.
 * `stage` comes from the kernel, so what is lit is what actually happened.
 */
export const CommandPipeline = memo(function CommandPipeline({ stage }: { stage: CommandStage }) {
  const current = ORDER[stage];

  return (
    <div className="jv-pipeline" role="status" aria-label={`Command stage: ${stage}`}>
      {STEPS.map((step, i) => {
        const index = ORDER[step.id];
        const state = index === current ? 'active' : index < current ? 'done' : 'idle';
        return (
          <span key={step.id} style={{ display: 'contents' }}>
            {i > 0 ? <span className="jv-pipeline__arrow" /> : null}
            <span className={`jv-pipeline__step jv-pipeline__step--${state}`}>
              <span className="jv-pipeline__dot" />
              {step.label}
            </span>
          </span>
        );
      })}
    </div>
  );
});
