import { memo, useEffect, useRef, useState } from 'react';
import { useRuntime } from '../state/jarvisContext';
import { useJarvis } from '../state/useJarvis';
import './ApprovalDialog.css';

/**
 * APPROVAL — the operator gate.
 *
 * Anything that is not a plain read stops here. Destructive and financial
 * actions never reach this dialog at all: the policy blocks them before an
 * approve button could exist, so a misclick cannot delete data or move money.
 *
 * Silence is not consent — an unanswered request auto-denies.
 */
export const ApprovalDialog = memo(function ApprovalDialog() {
  const runtime = useRuntime();
  const { pendingApproval } = useJarvis();
  const [remaining, setRemaining] = useState(0);
  const denyRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!pendingApproval) return;
    // Focus lands on Deny, never on Approve: the safe option is the default.
    denyRef.current?.focus();

    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((pendingApproval.expiresAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [pendingApproval]);

  useEffect(() => {
    if (!pendingApproval) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') runtime.approvals.resolve(pendingApproval.id, 'denied');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pendingApproval, runtime]);

  if (!pendingApproval) return null;

  const { id, kind, target, summary, detail } = pendingApproval;

  return (
    <div
      className="jv-approval"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="jv-approval-title"
    >
      <div className="jv-approval__card">
        <div className="jv-approval__head">
          <span className="jv-approval__kind">{kind.toUpperCase()}</span>
          <h2 className="jv-approval__title" id="jv-approval-title">
            APPROVAL REQUIRED
          </h2>
          <span className="jv-approval__target">{target}</span>
        </div>

        <p className="jv-approval__summary">{summary}</p>

        {detail?.length ? (
          <ul className="jv-approval__detail">
            {detail.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : null}

        <div className="jv-approval__foot">
          <span className="jv-approval__timer">AUTO-DENIES IN {remaining}s</span>
          <button
            ref={denyRef}
            type="button"
            className="jv-approval__btn jv-approval__btn--deny"
            onClick={() => runtime.approvals.resolve(id, 'denied')}
          >
            DENY
          </button>
          <button
            type="button"
            className="jv-approval__btn jv-approval__btn--approve"
            onClick={() => runtime.approvals.resolve(id, 'approved')}
          >
            APPROVE
          </button>
        </div>

        <p className="jv-approval__note">
          Destructive and financial actions are blocked by policy and never
          reach this dialog. Escape denies.
        </p>
      </div>
    </div>
  );
});
