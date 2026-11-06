"use client";

import { ArrowLeft, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getRecoveryPlan, isActionOnHold } from "@/lib/engine";
import { occurrenceHref } from "@/lib/shell";
import { HoldForm } from "../action-parts";
import { useHubStore } from "../hub-store";
import { DemoClock } from "../top-bar";
import { HoldBadge, LoadingState, remainingLabel } from "../ui";
import { OccurrenceNotFound } from "./occurrence-view";

/**
 * Recovery mode (9.6): a separate, always-dark place. Grouping, explanations and actions are the
 * existing Rapid Recovery behaviour from `getRecoveryPlan`; only the presentation is new.
 */
export function RecoveryView({ id }: { id: string }) {
  const { hydrated, getActivity, now, completeAction, applyFallback, saveHold, releaseHold } = useHubStore();
  const [holdTarget, setHoldTarget] = useState<string | null>(null);
  const activity = hydrated ? getActivity(id) : undefined;

  return (
    <div className="recovery-mode" data-mode="recovery">
      <header className="rc-bar">
        <span className="rc-mode-label mono">Recovery mode</span>
        <span className="rc-bar-title">{activity?.title ?? ""}</span>
        <div className="rc-bar-tools">
          <DemoClock />
          <Link className="btn btn-rc btn-sm" href={activity ? occurrenceHref(activity.id) : "/"}>
            <ArrowLeft size={13} aria-hidden /> Leave recovery
          </Link>
        </div>
      </header>

      <main className="rc-main" id="main">
        {!hydrated ? (
          <LoadingState label="Preparing recovery mode…" />
        ) : !activity ? (
          <OccurrenceNotFound id={id} tone="recovery" />
        ) : (
          <>
            <section className="rc-intro" aria-labelledby="rc-title">
              <div>
                <div className="rc-kicker mono">Rapid Recovery · {activity.coordinator}</div>
                <h1 className="rc-title" id="rc-title">{activity.title}</h1>
                <p className="rc-copy">A time-aware action order based on criticality, available time, dependencies, holds and playbook fallbacks.</p>
              </div>
              <div className="rc-countdown mono" aria-live="polite">{remainingLabel(activity.startsAt, now)}</div>
            </section>

            <div className="rc-board">
              {getRecoveryPlan(activity, now).map((group) => (
                <section className={`rc-column rc-${group.id}`} key={group.id} aria-labelledby={`rc-${group.id}-title`}>
                  <header className="rc-column-head">
                    <h2 className="rc-column-title" id={`rc-${group.id}-title`}>
                      {group.title} <span className="mono">({group.actions.length})</span>
                    </h2>
                    <p className="rc-column-copy">{group.description}</p>
                  </header>
                  {group.actions.length === 0 ? (
                    <p className="rc-empty">Nothing in this group right now.</p>
                  ) : (
                    <ul className="rc-cards">
                      {group.actions.map((action) => (
                        <li className="rc-card" key={action.id}>
                          <div className="rc-card-title">{action.title} <HoldBadge action={action} /></div>
                          <div className="rc-card-meta">{action.ownerRole} · {action.ownerName} · <span className="mono">approx. {action.estimatedMinutes} min</span></div>
                          <p className="rc-reason">{group.explanations[action.id]}</p>
                          {action.fallback && <p className="rc-fallback"><strong>Fallback:</strong> {action.fallback}</p>}
                          {holdTarget === action.id && (
                            <HoldForm
                              action={action}
                              onSave={(input) => { saveHold(activity, action, input); setHoldTarget(null); }}
                              onCancel={() => setHoldTarget(null)}
                            />
                          )}
                          <div className="rc-card-actions">
                            <button className="btn btn-rc btn-sm" type="button" onClick={() => completeAction(activity, action, "recovery")}>
                              Mark done
                            </button>
                            {action.fallback && (
                              <button className="btn btn-rc-hot btn-sm" type="button" onClick={() => applyFallback(activity, action)}>Use fallback</button>
                            )}
                            {isActionOnHold(action) ? (
                              <button className="btn btn-rc-ghost btn-sm" type="button" onClick={() => releaseHold(activity, action)}>
                                <Undo2 size={12} aria-hidden /> Release hold
                              </button>
                            ) : holdTarget !== action.id && (
                              <button className="btn btn-rc-ghost btn-sm" type="button" onClick={() => setHoldTarget(action.id)}>Waiting / blocked</button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <p className="rc-note">
              Recovery suggestions are deterministic and based on the playbook’s authored rules. The HR Generalist makes the decision and performs any communication or booking outside this prototype.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
