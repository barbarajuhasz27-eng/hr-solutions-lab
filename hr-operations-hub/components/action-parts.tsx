"use client";

/** Task-level building blocks ported from the former single-page component. Behaviour is unchanged. */
import { ArrowRight, Ban, Check, Circle, CircleCheck, Clock3, Hourglass, Link2, ShieldAlert, Undo2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  getDependencyInfo,
  HOLD_NOTE_MAX_LENGTH,
  isActionOnHold,
  isActionResolved,
  validateHold,
  WAITING_ON_MAX_LENGTH,
  type HoldInput,
} from "@/lib/engine";
import type { Activity, ActionInstance, Readiness } from "@/lib/model";
import { CriticalityTag, dueLabel, HoldBadge } from "./ui";

export function HoldSummary({ action }: { action: ActionInstance }) {
  if (!isActionOnHold(action)) return null;
  return (
    <div className={`hold-note hold-note-${action.status}`}>
      {action.status === "waiting" ? (
        <><strong>Waiting on {action.waitingOn || "another person or team"}</strong>{action.statusNote ? ` — ${action.statusNote}` : ""}</>
      ) : (
        <><strong>Blocked</strong>{action.statusNote ? ` — ${action.statusNote}` : ""}</>
      )}
    </div>
  );
}

export function HoldForm({
  action,
  onSave,
  onCancel,
}: {
  action: ActionInstance;
  onSave: (input: HoldInput) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<HoldInput["kind"]>(action.status === "blocked" ? "blocked" : "waiting");
  const [waitingOn, setWaitingOn] = useState(action.waitingOn ?? (action.status === "not-started" ? action.ownerRole : ""));
  const [note, setNote] = useState(isActionOnHold(action) ? action.statusNote ?? "" : "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input: HoldInput = { kind, waitingOn, note };
    const message = validateHold(input);
    if (message) {
      setError(message);
      return;
    }
    onSave(input);
  }

  return (
    <form className="hold-form" onSubmit={submit} aria-label={`Set ${action.title} on hold`}>
      <div className="segmented" role="radiogroup" aria-label="Hold type">
        <label className={kind === "waiting" ? "active" : ""}>
          <input type="radio" name={`kind-${action.id}`} checked={kind === "waiting"} onChange={() => { setKind("waiting"); setError(null); }} />
          <Hourglass size={12} aria-hidden /> Waiting on someone
        </label>
        <label className={kind === "blocked" ? "active" : ""}>
          <input type="radio" name={`kind-${action.id}`} checked={kind === "blocked"} onChange={() => { setKind("blocked"); setError(null); }} />
          <Ban size={12} aria-hidden /> Blocked
        </label>
      </div>
      {kind === "waiting" && (
        <label className="field">
          <span>Waiting on (person or team)</span>
          <input value={waitingOn} maxLength={WAITING_ON_MAX_LENGTH} onChange={(event) => setWaitingOn(event.target.value)} placeholder="e.g. Facilities" />
        </label>
      )}
      <label className="field">
        <span>{kind === "blocked" ? "What is blocking this action?" : "Note (optional)"}</span>
        <input
          value={note}
          maxLength={HOLD_NOTE_MAX_LENGTH}
          onChange={(event) => setNote(event.target.value)}
          placeholder={kind === "blocked" ? "e.g. Room double-booked, no alternative confirmed" : "e.g. Asked for Room 2.14 at 09:10"}
        />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-actions">
        <button className="btn btn-primary btn-sm" type="submit">Save</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export function DependencyNotes({ action, activity }: { action: ActionInstance; activity: Activity }) {
  const info = getDependencyInfo(activity, action.id);
  const done = isActionResolved(action);
  if (info.prerequisites.length === 0 && (info.dependents.length === 0 || done)) return null;
  return (
    <div className="dependency-notes">
      {info.openPrerequisites.length > 0 && (
        <div className="dependency-note dependency-open">
          <Link2 size={12} aria-hidden />
          <span>
            <strong>Needs first:</strong>{" "}
            {info.openPrerequisites.map((item) => `${item.title} (${item.ownerRole} · ${item.ownerName})`).join("; ")}
          </span>
        </div>
      )}
      {info.prerequisites.length > 0 && info.openPrerequisites.length === 0 && (
        <div className="dependency-note">
          <Check size={12} aria-hidden />
          <span>Prerequisite done: {info.prerequisites.map((item) => item.action.title).join("; ")}</span>
        </div>
      )}
      {info.dependents.length > 0 && !done && (
        <div className="dependency-note">
          <ArrowRight size={12} aria-hidden />
          <span>Unlocks: {info.dependents.map((item) => item.title).join("; ")}</span>
        </div>
      )}
    </div>
  );
}

export function ActionRow({
  action,
  activity,
  now,
  holdOpen,
  onToggle,
  onFallback,
  onOpenHold,
  onSaveHold,
  onCancelHold,
  onRelease,
}: {
  action: ActionInstance;
  activity: Activity;
  now: Date;
  holdOpen: boolean;
  onToggle: () => void;
  onFallback?: () => void;
  onOpenHold: () => void;
  onSaveHold: (input: HoldInput) => void;
  onCancelHold: () => void;
  onRelease: () => void;
}) {
  const done = isActionResolved(action);
  const onHold = isActionOnHold(action);
  const due = dueLabel(action, activity, now);
  const overdue = due.startsWith("Overdue");
  return (
    <li className={`task-row ${done ? "is-done" : ""} ${overdue ? "is-overdue" : ""} ${onHold ? `is-${action.status}` : ""}`}>
      <button
        className={`task-toggle ${done ? "done" : ""}`}
        type="button"
        aria-label={done ? `Reopen ${action.title}` : `Mark ${action.title} done`}
        onClick={onToggle}
      >
        {done ? <Check size={13} strokeWidth={2.75} aria-hidden /> : <Circle size={16} aria-hidden />}
      </button>
      <div className="task-body">
        <div className="task-title">{action.title}</div>
        <p className="task-description">{action.description}</p>
        <div className="task-meta">
          <span>{action.ownerRole} · {action.ownerName}</span>
          <span className="mono">{action.estimatedMinutes} min</span>
          <CriticalityTag value={action.criticality} />
          <HoldBadge action={action} />
          {action.fallbackUsed && <span>Fallback recorded</span>}
        </div>
        <DependencyNotes action={action} activity={activity} />
        <HoldSummary action={action} />
        {!onHold && action.statusNote && <div className="fallback-note">{action.statusNote}</div>}
        {holdOpen && <HoldForm action={action} onSave={onSaveHold} onCancel={onCancelHold} />}
      </div>
      <div className="task-side">
        <span className={`due mono ${overdue ? "due-overdue" : ""}`}>{due}</span>
        {!done && !holdOpen && (
          onHold ? (
            <button className="btn btn-outline btn-sm" type="button" onClick={onRelease}><Undo2 size={12} aria-hidden /> Release hold</button>
          ) : (
            <button className="btn btn-outline btn-sm" type="button" onClick={onOpenHold}>Waiting / blocked</button>
          )
        )}
        {onFallback && action.fallback && !done && (
          <button className="btn btn-outline btn-sm" type="button" onClick={onFallback}>Use fallback</button>
        )}
      </div>
    </li>
  );
}

export function ReadinessExplanation({ readiness }: { readiness: Readiness }) {
  if (readiness.status === "completed") {
    return <div className="readiness-positive"><CircleCheck size={15} aria-hidden /> This activity has been completed.</div>;
  }
  if (readiness.unresolvedEssential.length === 0) {
    return <div className="readiness-positive"><CircleCheck size={15} aria-hidden /> All Essential pre-start actions are complete.</div>;
  }
  const risks = readiness.reasons.filter((reason) => reason.severity === "risk");
  const attention = readiness.reasons.filter((reason) => reason.severity === "attention");
  return (
    <>
      {risks.length > 0 && (
        <>
          <p className="reason-heading">Why this activity is at risk:</p>
          <ul className="reason-list">
            {risks.map((reason, index) => (
              <li key={`${reason.kind}-${reason.actionId ?? index}`} className="reason-risk"><ShieldAlert size={13} aria-hidden /> <span>{reason.message}</span></li>
            ))}
          </ul>
        </>
      )}
      {attention.length > 0 && (
        <>
          <p className="reason-heading">Needs follow-up:</p>
          <ul className="reason-list">
            {attention.map((reason, index) => (
              <li key={`${reason.kind}-${reason.actionId ?? index}`} className="reason-attention"><Clock3 size={13} aria-hidden /> <span>{reason.message}</span></li>
            ))}
          </ul>
        </>
      )}
      {readiness.reasons.length === 0 && (
        <p className="reason-copy">No risks right now — the open Essential actions are on schedule. Open steps that wait for a prerequisite are not counted as risks until that prerequisite falls behind.</p>
      )}
      <p className="reason-heading">Essential actions still open:</p>
      <ul className="open-list">
        {readiness.unresolvedEssential.map((action) => (
          <li key={action.id}><Circle size={8} aria-hidden /> <span>{action.title}</span><small>{action.ownerRole}</small></li>
        ))}
      </ul>
    </>
  );
}
