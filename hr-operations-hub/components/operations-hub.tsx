"use client";

import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ClipboardCheck,
  Flag,
  Hourglass,
  Layers3,
  Link2,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Undo2,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  applyActionUpdate,
  completeUpdate,
  fallbackUpdate,
  formatDuration,
  getDependencyInfo,
  getPriorityActivity,
  getReadiness,
  getRecoveryPlan,
  getStatusLabel,
  HOLD_NOTE_MAX_LENGTH,
  holdUpdate,
  isActionOnHold,
  isActionResolved,
  reopenUpdate,
  validateHold,
  WAITING_ON_MAX_LENGTH,
  type HoldInput,
} from "@/lib/engine";
import type { Activity, ActionInstance, ActionUpdate, ActivityStatus, Readiness, View } from "@/lib/model";
import { PLAYBOOKS, getPlaybook } from "@/lib/playbooks";
import { createActivity, resetActivities, RESCUE_ACTIVITY_ID, RESCUE_LEAD_MINUTES } from "@/lib/seed";
import { clearDemo, loadDemo, saveDemo } from "@/lib/storage";

function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...options,
  }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function minutesToStart(startsAt: string, now: Date) {
  return (new Date(startsAt).getTime() - now.getTime()) / 60_000;
}

function remainingLabel(startsAt: string, now: Date) {
  const minutes = minutesToStart(startsAt, now);
  return minutes > 0 ? `${formatDuration(minutes)} remaining` : `Started ${formatDuration(-minutes)} ago`;
}

function dueLabel(action: ActionInstance, activity: Activity, now: Date) {
  const dueAt = new Date(new Date(activity.startsAt).getTime() + action.dueOffsetMinutes * 60_000);
  const delta = dueAt.getTime() - now.getTime();
  if (action.status === "done") return "Completed";
  if (delta < 0) {
    const minutes = Math.ceil(Math.abs(delta) / 60_000);
    if (minutes < 60) return `Overdue ${minutes}m`;
    const days = Math.floor(minutes / 1_440);
    if (days > 0) return `Overdue ${days}d`;
    return `Overdue ${Math.floor(minutes / 60)}h`;
  }
  if (delta < 60 * 60_000) return `Due in ${Math.ceil(delta / 60_000)}m`;
  if (delta < 24 * 60 * 60_000) return `Due in ${Math.floor(delta / 3_600_000)}h`;
  return `Due ${formatDate(dueAt)}`;
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  return <span className={`badge badge-${status}`}>{getStatusLabel(status)}</span>;
}

function CriticalityBadge({ value }: { value: ActionInstance["criticality"] }) {
  return <span className={`badge badge-${value}`}>{value}</span>;
}

function HoldBadge({ action }: { action: ActionInstance }) {
  if (action.status === "waiting") return <span className="badge badge-waiting"><Hourglass size={10} /> Waiting</span>;
  if (action.status === "blocked") return <span className="badge badge-blocked"><Ban size={10} /> Blocked</span>;
  return null;
}

function HoldSummary({ action }: { action: ActionInstance }) {
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

function HoldForm({
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
      <div className="hold-kind" role="radiogroup" aria-label="Hold type">
        <label className={kind === "waiting" ? "active" : ""}>
          <input type="radio" name={`kind-${action.id}`} checked={kind === "waiting"} onChange={() => { setKind("waiting"); setError(null); }} />
          <Hourglass size={12} /> Waiting on someone
        </label>
        <label className={kind === "blocked" ? "active" : ""}>
          <input type="radio" name={`kind-${action.id}`} checked={kind === "blocked"} onChange={() => { setKind("blocked"); setError(null); }} />
          <Ban size={12} /> Blocked
        </label>
      </div>
      {kind === "waiting" && (
        <label className="hold-field">
          <span>Waiting on (person or team)</span>
          <input value={waitingOn} maxLength={WAITING_ON_MAX_LENGTH} onChange={(event) => setWaitingOn(event.target.value)} placeholder="e.g. Facilities" />
        </label>
      )}
      <label className="hold-field">
        <span>{kind === "blocked" ? "What is blocking this action?" : "Note (optional)"}</span>
        <input
          value={note}
          maxLength={HOLD_NOTE_MAX_LENGTH}
          onChange={(event) => setNote(event.target.value)}
          placeholder={kind === "blocked" ? "e.g. Room double-booked, no alternative confirmed" : "e.g. Asked for Room 2.14 at 09:10"}
        />
      </label>
      {error && <div className="hold-error" role="alert">{error}</div>}
      <div className="hold-actions">
        <button className="btn btn-dark btn-sm" type="submit">Save</button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function DependencyNotes({ action, activity }: { action: ActionInstance; activity: Activity }) {
  const info = getDependencyInfo(activity, action.id);
  const done = isActionResolved(action);
  if (info.prerequisites.length === 0 && (info.dependents.length === 0 || done)) return null;
  return (
    <div className="dependency-notes">
      {info.openPrerequisites.length > 0 && (
        <div className="dependency-note dependency-open">
          <Link2 size={12} />
          <span>
            <strong>Needs first:</strong>{" "}
            {info.openPrerequisites.map((item) => `${item.title} (${item.ownerRole} · ${item.ownerName})`).join("; ")}
          </span>
        </div>
      )}
      {info.prerequisites.length > 0 && info.openPrerequisites.length === 0 && (
        <div className="dependency-note">
          <Check size={12} />
          <span>Prerequisite done: {info.prerequisites.map((item) => item.action.title).join("; ")}</span>
        </div>
      )}
      {info.dependents.length > 0 && !done && (
        <div className="dependency-note">
          <ArrowRight size={12} />
          <span>Unlocks: {info.dependents.map((item) => item.title).join("; ")}</span>
        </div>
      )}
    </div>
  );
}

function ActionRow({
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
  return (
    <div className="action-row">
      <button
        className={`action-toggle ${done ? "done" : ""}`}
        type="button"
        aria-label={done ? `Reopen ${action.title}` : `Mark ${action.title} done`}
        onClick={onToggle}
      >
        {done ? <Check size={14} strokeWidth={2.5} /> : <Circle size={17} />}
      </button>
      <div>
        <div className="action-title" style={{ textDecoration: done ? "line-through" : "none", color: done ? "#8c949e" : undefined }}>
          {action.title}
        </div>
        <p className="action-description">{action.description}</p>
        <div className="action-meta">
          <span>{action.ownerRole} · {action.ownerName}</span>
          <span>{action.estimatedMinutes} min</span>
          <CriticalityBadge value={action.criticality} />
          <HoldBadge action={action} />
          {action.fallbackUsed && <span>Fallback recorded</span>}
        </div>
        <DependencyNotes action={action} activity={activity} />
        <HoldSummary action={action} />
        {!onHold && action.statusNote && <div className="fallback-note">{action.statusNote}</div>}
        {holdOpen && <HoldForm action={action} onSave={onSaveHold} onCancel={onCancelHold} />}
      </div>
      <div className="action-side">
        <span className="time-label">{dueLabel(action, activity, now)}</span>
        {!done && !holdOpen && (
          onHold ? (
            <button className="btn btn-outline btn-sm" type="button" onClick={onRelease}><Undo2 size={12} /> Release hold</button>
          ) : (
            <button className="btn btn-outline btn-sm" type="button" onClick={onOpenHold}>Waiting / blocked</button>
          )
        )}
        {onFallback && action.fallback && !done && (
          <button className="btn btn-outline btn-sm" type="button" onClick={onFallback}>Use fallback</button>
        )}
      </div>
    </div>
  );
}

function ActivityRow({
  activity,
  now,
  onClick,
}: {
  activity: Activity;
  now: Date;
  onClick: () => void;
}) {
  const readiness = getReadiness(activity, now);
  const date = new Date(activity.startsAt);
  return (
    <button type="button" className="activity-row" onClick={onClick}>
      <div className="date-tile">
        <div className="date-day">{date.getDate()}</div>
        <div className="date-month">{new Intl.DateTimeFormat("en-GB", { month: "short" }).format(date)}</div>
      </div>
      <div>
        <div className="activity-name">{activity.title}</div>
        <div className="activity-meta">
          <span>{formatTime(date)}</span>
          <span>·</span>
          <span>{activity.location}</span>
          <span>·</span>
          <span>{activity.coordinator}</span>
        </div>
      </div>
      <StatusBadge status={readiness.status} />
    </button>
  );
}

function ReadinessExplanation({ readiness }: { readiness: Readiness }) {
  if (readiness.status === "completed") {
    return <div className="readiness-positive"><CheckCircle2 size={17} /> This activity has been completed.</div>;
  }
  if (readiness.unresolvedEssential.length === 0) {
    return <div className="readiness-positive"><CheckCircle2 size={17} /> All Essential pre-start actions are complete.</div>;
  }
  const risks = readiness.reasons.filter((reason) => reason.severity === "risk");
  const attention = readiness.reasons.filter((reason) => reason.severity === "attention");
  return (
    <>
      {risks.length > 0 && (
        <>
          <p className="readiness-copy">Why this activity is at risk:</p>
          <ul className="reason-list">
            {risks.map((reason, index) => (
              <li key={`${reason.kind}-${reason.actionId ?? index}`} className="reason-risk"><ShieldAlert size={13} /> <span>{reason.message}</span></li>
            ))}
          </ul>
        </>
      )}
      {attention.length > 0 && (
        <>
          <p className="readiness-copy">Needs follow-up:</p>
          <ul className="reason-list">
            {attention.map((reason, index) => (
              <li key={`${reason.kind}-${reason.actionId ?? index}`} className="reason-attention"><Clock3 size={13} /> <span>{reason.message}</span></li>
            ))}
          </ul>
        </>
      )}
      {readiness.reasons.length === 0 && (
        <p className="readiness-copy">No risks right now — the open Essential actions are on schedule. Open steps that wait for a prerequisite are not counted as risks until that prerequisite falls behind.</p>
      )}
      <p className="readiness-copy" style={{ marginTop: 16 }}>Essential actions still open:</p>
      <ul className="readiness-list">
        {readiness.unresolvedEssential.map((action) => (
          <li key={action.id}><Circle size={8} /> <span>{action.title}</span><small>{action.ownerRole}</small></li>
        ))}
      </ul>
    </>
  );
}

export function OperationsHub() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeId, setActiveId] = useState(RESCUE_ACTIVITY_ID);
  const [view, setView] = useState<View>("radar");
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [modified, setModified] = useState(false);
  const [notice, setNotice] = useState("");
  const [holdTarget, setHoldTarget] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const loadedAt = new Date();
    const loaded = loadDemo(loadedAt);
    setActivities(loaded.activities);
    setModified(loaded.modified);
    if (loaded.notice) setNotice(loaded.notice);
    if (loaded.activities.length > 0) setActiveId(loaded.activities[0].id);
    setNow(loadedAt);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Saving on every clock tick keeps `savedAt` close to the moment the visitor leaves,
  // so a returning visitor's timeline is only shifted by the time they were actually away.
  useEffect(() => {
    if (hydrated) saveDemo(activities, modified, now);
  }, [activities, modified, now, hydrated]);

  const activeActivity = activities.find((activity) => activity.id === activeId) ?? activities[0];
  const readinessItems = useMemo(
    () => activities.map((activity) => ({ activity, readiness: getReadiness(activity, now) })),
    [activities, now],
  );
  const orderedActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [activities],
  );
  const priority = useMemo(() => getPriorityActivity(activities, now), [activities, now]);
  const activeReadiness = activeActivity ? getReadiness(activeActivity, now) : null;
  const recoveryPlan = activeActivity ? getRecoveryPlan(activeActivity, now) : [];
  const openCount = readinessItems.filter((item) => !["completed", "cancelled"].includes(item.readiness.status)).length;
  const atRiskCount = readinessItems.filter((item) => ["at-risk", "recovery"].includes(item.readiness.status)).length;
  const overdueActions = activities.reduce((count, activity) => count + activity.actions.filter((action) => {
    if (isActionResolved(action)) return false;
    const dueAt = new Date(new Date(activity.startsAt).getTime() + action.dueOffsetMinutes * 60_000);
    return dueAt < now;
  }).length, 0);

  function changeView(nextView: View) {
    setView(nextView);
    setHoldTarget(null);
  }

  function openActivity(activity: Activity, nextView: View = "activity") {
    setActiveId(activity.id);
    changeView(nextView);
    setNotice("");
  }

  function updateAction(activityId: string, actionId: string, update: ActionUpdate) {
    setActivities((current) => applyActionUpdate(current, activityId, actionId, update));
    setModified(true);
  }

  function toggleAction(activity: Activity, action: ActionInstance) {
    updateAction(
      activity.id,
      action.id,
      isActionResolved(action) ? reopenUpdate() : completeUpdate("Completed in the demo workspace."),
    );
  }

  function applyFallback(activity: Activity, action: ActionInstance) {
    if (!action.fallback) return;
    updateAction(activity.id, action.id, fallbackUpdate(action));
  }

  function saveHold(activity: Activity, action: ActionInstance, input: HoldInput) {
    updateAction(activity.id, action.id, holdUpdate(input));
    setHoldTarget(null);
  }

  function releaseHold(activity: Activity, action: ActionInstance) {
    updateAction(activity.id, action.id, reopenUpdate());
  }

  function resetDemo() {
    clearDemo();
    const resetAt = new Date();
    setActivities(resetActivities(resetAt));
    setModified(false);
    setNow(resetAt);
    setActiveId(RESCUE_ACTIVITY_ID);
    changeView("radar");
    setNotice(`Demo data restored. The training scenario starts in ${RESCUE_LEAD_MINUTES} minutes.`);
  }

  function createFromPlaybook(playbookId: string) {
    const playbook = getPlaybook(playbookId);
    if (!playbook || playbook.actions.length === 0) return;
    const startsAt = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
    const created = createActivity(
      playbookId,
      playbook.title,
      startsAt,
      `activity-${activities.length + 1}-${now.getTime()}`,
      { location: "To be confirmed" },
    );
    setActivities((current) => [created, ...current]);
    setModified(true);
    setActiveId(created.id);
    changeView("activity");
    setNotice("New activity created from the playbook, scheduled two weeks from now.");
  }

  if (!hydrated) {
    return <div className="loading-state"><div className="loading-mark">HR</div><p>Preparing your operations workspace…</p></div>;
  }

  const navItems: { id: View; label: string; icon: typeof CalendarDays }[] = [
    { id: "radar", label: "Operations Radar", icon: CalendarDays },
    { id: "playbooks", label: "Playbook Library", icon: Layers3 },
  ];

  const title =
    view === "radar" ? "Operations Radar"
      : view === "playbooks" ? "Playbook Library"
        : view === "activity" ? "Activity Workspace"
          : "Rapid Recovery";
  const subtitle =
    view === "radar" ? "A clear view of the HR activities that need your attention."
      : view === "playbooks" ? "Repeatable starting points for the operational work HR coordinates."
        : view === "activity" ? "One activity, its preparation steps and what still needs to happen."
          : "A practical plan for the time and options still available.";

  const priorityKicker = priority
    ? priority.readiness.status === "recovery" ? "Priority activity · Needs attention now"
      : priority.readiness.status === "at-risk" ? "Priority activity · At risk"
        : "Priority activity · Needs follow-up"
    : "";
  const priorityReason = priority?.readiness.reasons.find((reason) => reason.severity === "risk") ?? priority?.readiness.reasons[0];

  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">HR</div>
          <div>
            <div className="brand-name">Operations Hub</div>
            <div className="brand-sub">People · Process · Readiness</div>
          </div>
        </div>

        <div className="side-kicker">Workspace</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-button ${view === item.id ? "active" : ""}`}
                onClick={() => { changeView(item.id); setNotice(""); }}
              >
                <Icon size={16} strokeWidth={1.8} />
                {item.label}
              </button>
            );
          })}
          {activeActivity && (
            <>
              <button
                type="button"
                className={`nav-button ${view === "activity" ? "active" : ""}`}
                onClick={() => changeView("activity")}
              >
                <ListChecks size={16} strokeWidth={1.8} />
                Activity Workspace
              </button>
              <button
                type="button"
                className={`nav-button ${view === "recovery" ? "active" : ""}`}
                onClick={() => changeView("recovery")}
              >
                <Zap size={16} strokeWidth={1.8} />
                Rapid Recovery
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-spacer" />
        <div className="demo-card">
          <span className="demo-dot" />
          <strong>Demo environment</strong>
          <br />
          Fictional activities and synthetic data. No real reminders, bookings or messages are sent.
        </div>
        <div className="side-foot">HR Solutions Lab<br />Independent portfolio prototype</div>
      </aside>

      <main className="main-area">
        <div className="topbar">
          <div className="eyebrow">HR Operations / Workspace</div>
          <div className="topbar-right">
            <button className="reset-button" type="button" onClick={resetDemo}>
              <RotateCcw size={13} /> Reset demo
            </button>
            <div className="profile-chip">
              <span className="avatar">SL</span>
              <span>Sophie Lang · HR Generalist</span>
            </div>
          </div>
        </div>

        <div className="page-heading">
          <div>
            <div className="eyebrow">{formatLongDate(now)}</div>
            <h1 className="page-title">{title}</h1>
            <p className="page-description">{subtitle}</p>
          </div>
          {view === "radar" && (
            <button className="btn btn-dark" type="button" onClick={() => changeView("playbooks")}>
              <Sparkles size={15} /> New activity
            </button>
          )}
          {(view === "activity" || view === "recovery") && (
            <button className="btn btn-outline" type="button" onClick={() => changeView("radar")}>
              <ArrowLeft size={14} /> Back to radar
            </button>
          )}
        </div>

        {notice && <div className="inline-notice" role="status">{notice}</div>}

        {view === "radar" && (
          <>
            {priority && (
              <section className="hero-panel">
                <div>
                  <div className="hero-kicker">{priorityKicker}</div>
                  <h2 className="hero-title">
                    {priority.activity.title} starts in {formatDuration(minutesToStart(priority.activity.startsAt, now))}
                  </h2>
                  <p className="hero-copy">
                    {priority.readiness.unresolvedEssential.length} essential action{priority.readiness.unresolvedEssential.length === 1 ? " is" : "s are"} still open.
                    {priority.readiness.status === "recovery"
                      ? " See what must happen first, what can be simplified and what can follow later."
                      : priorityReason ? ` ${priorityReason.message}` : ""}
                  </p>
                  <div className="hero-meta">
                    <span><CalendarDays size={13} /> {formatDate(new Date(priority.activity.startsAt), { year: "numeric" })} · {formatTime(new Date(priority.activity.startsAt))}</span>
                    <span><Users size={13} /> {priority.activity.coordinator}</span>
                    <span><ShieldAlert size={13} /> {priority.readiness.label}</span>
                  </div>
                </div>
                <div className="hero-actions">
                  {priority.readiness.status === "recovery" ? (
                    <>
                      <button className="btn btn-primary" type="button" onClick={() => openActivity(priority.activity, "recovery")}>
                        Open Rapid Recovery <ArrowRight size={15} />
                      </button>
                      <button className="btn btn-white" type="button" onClick={() => openActivity(priority.activity)}>
                        View activity
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-primary" type="button" onClick={() => openActivity(priority.activity)}>
                        View activity <ArrowRight size={15} />
                      </button>
                      <button className="btn btn-white" type="button" onClick={() => openActivity(priority.activity, "recovery")}>
                        Open Rapid Recovery
                      </button>
                    </>
                  )}
                </div>
              </section>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Open activities</div>
                <div className="stat-value">{openCount}</div>
                <div className="stat-note">Across your workspace</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">At risk / recovery</div>
                <div className="stat-value">{atRiskCount}</div>
                <div className="stat-note">Activities needing intervention</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Open overdue actions</div>
                <div className="stat-value">{overdueActions}</div>
                <div className="stat-note">Based on illustrative lead times</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Completed activities</div>
                <div className="stat-value">{readinessItems.filter((item) => item.readiness.status === "completed").length}</div>
                <div className="stat-note">Recorded in this demo</div>
              </div>
            </div>

            <div className="content-grid">
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Upcoming activities</div>
                    <div className="panel-sub">Sorted by start time · select an activity to open its workspace</div>
                  </div>
                  <button className="link-button" type="button" onClick={() => changeView("playbooks")}>Create <ArrowRight size={13} /></button>
                </div>
                {orderedActivities.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} now={now} onClick={() => openActivity(activity)} />
                ))}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">Playbook Library</div>
                    <div className="panel-sub">HR-specific operational starting points</div>
                  </div>
                </div>
                {PLAYBOOKS.slice(0, 3).map((playbook) => (
                  <div className="playbook-mini" key={playbook.id}>
                    <div className="playbook-mini-title">
                      <span>{playbook.title}</span>
                      {playbook.actions.length > 0 ? <span className="badge badge-ready">Available</span> : <span className="badge badge-planned">In design</span>}
                    </div>
                    <p className="playbook-mini-desc">{playbook.description}</p>
                  </div>
                ))}
                <div style={{ padding: "12px 18px" }}>
                  <button className="link-button" type="button" onClick={() => changeView("playbooks")}>View all playbooks <ArrowRight size={13} /></button>
                </div>
              </section>
            </div>

            <div className="notice">
              Demo note: activity dates, owners, action times and readiness states are synthetic. “Open Rapid Recovery” does not send messages, book rooms or contact IT / Facilities.
            </div>
          </>
        )}

        {view === "playbooks" && (
          <>
            <div className="notice" style={{ marginTop: 0, marginBottom: 18 }}>
              The training playbook is implemented in this first development slice. Other HR playbooks are documented product directions and are shown as “In design”.
            </div>
            <div className="playbook-grid">
              {PLAYBOOKS.map((playbook, index) => {
                const available = playbook.actions.length > 0;
                return (
                  <article className="playbook-card" key={playbook.id}>
                    <div className="playbook-icon">
                      {index === 0 ? <Layers3 size={18} /> : index === 1 ? <Users size={18} /> : index === 2 ? <CalendarDays size={18} /> : index === 3 ? <Clock3 size={18} /> : <ClipboardCheck size={18} />}
                    </div>
                    <h2 className="playbook-title">{playbook.title}</h2>
                    <p className="playbook-description">{playbook.description}</p>
                    <div className="playbook-meta">
                      <span>{playbook.durationLabel}</span>
                      <span>·</span>
                      <span>{playbook.actions.length} actions defined</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 17, gap: 8 }}>
                      {available ? <span className="badge badge-ready">Ready to use</span> : <span className="badge badge-planned">In design</span>}
                      <button
                        className={`btn ${available ? "btn-dark" : "btn-outline"} btn-sm`}
                        type="button"
                        disabled={!available}
                        onClick={() => createFromPlaybook(playbook.id)}
                      >
                        Create activity <ArrowRight size={13} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        {view === "activity" && activeActivity && activeReadiness && (
          <>
            <div className="activity-summary">
              <div>
                <div className="eyebrow">{getPlaybook(activeActivity.playbookId)?.category ?? "HR Operations"}</div>
                <h2 className="activity-summary-title">{activeActivity.title}</h2>
                <div className="activity-summary-meta">
                  <span><CalendarDays size={13} /> {formatLongDate(new Date(activeActivity.startsAt))} · {formatTime(new Date(activeActivity.startsAt))}</span>
                  <span><Users size={13} /> {activeActivity.coordinator}</span>
                  <span><Flag size={13} /> {activeActivity.location}</span>
                </div>
              </div>
              <div style={{ display: "grid", justifyItems: "end", gap: 10 }}>
                <StatusBadge status={activeReadiness.status} />
                {activeReadiness.status === "recovery" && (
                  <button className="btn btn-dark btn-sm" type="button" onClick={() => changeView("recovery")}>Open Rapid Recovery <Zap size={13} /></button>
                )}
              </div>
            </div>

            <section className="panel" style={{ marginTop: 18 }}>
              <div className="panel-head">
                <div>
                  <div className="panel-title">Preparation timeline</div>
                  <div className="panel-sub">Complete an action, or mark it as waiting on someone or blocked. Dependencies show what has to happen first.</div>
                </div>
                <span className="badge badge-planned">{activeActivity.actions.filter((action) => action.status === "done").length} / {activeActivity.actions.length} done</span>
              </div>
              <div className="action-list">
                {[...activeActivity.actions].sort((a, b) => a.dueOffsetMinutes - b.dueOffsetMinutes).map((action) => (
                  <ActionRow
                    key={action.id}
                    action={action}
                    activity={activeActivity}
                    now={now}
                    holdOpen={holdTarget === action.id}
                    onToggle={() => toggleAction(activeActivity, action)}
                    onFallback={action.fallback ? () => applyFallback(activeActivity, action) : undefined}
                    onOpenHold={() => setHoldTarget(action.id)}
                    onSaveHold={(input) => saveHold(activeActivity, action, input)}
                    onCancelHold={() => setHoldTarget(null)}
                    onRelease={() => releaseHold(activeActivity, action)}
                  />
                ))}
              </div>
            </section>

            <section className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head">
                <div>
                  <div className="panel-title">Readiness explanation</div>
                  <div className="panel-sub">Derived from Essential actions, deadlines, remaining work, holds and dependencies — not a weighted score.</div>
                </div>
                <StatusBadge status={activeReadiness.status} />
              </div>
              <div className="readiness-body">
                <ReadinessExplanation readiness={activeReadiness} />
              </div>
            </section>
          </>
        )}

        {view === "recovery" && activeActivity && (
          <>
            <div className="recovery-intro">
              <div>
                <div className="hero-kicker">Rapid Recovery · {activeActivity.title}</div>
                <div className="recovery-clock">{remainingLabel(activeActivity.startsAt, now)}</div>
                <p className="hero-copy" style={{ marginTop: 9 }}>A time-aware action order based on criticality, available time, dependencies, holds and playbook fallbacks.</p>
              </div>
              <button className="btn btn-white" type="button" onClick={() => changeView("activity")}>View full activity <ArrowRight size={14} /></button>
            </div>
            {recoveryPlan.map((group) => (
              <section className="recovery-group" key={group.id}>
                <div className="recovery-group-head">
                  <div className="recovery-group-title">{group.title} <span style={{ color: "#929aa4", fontWeight: 500 }}>({group.actions.length})</span></div>
                  <div className="recovery-group-copy">{group.description}</div>
                </div>
                {group.actions.length === 0 ? (
                  <div className="empty-state">Nothing in this group right now.</div>
                ) : group.actions.map((action) => (
                  <div className="recovery-action" key={action.id}>
                    <div>
                      <div className="recovery-action-title">{action.title} <HoldBadge action={action} /></div>
                      <div className="recovery-action-meta">{action.ownerRole} · {action.ownerName} · approx. {action.estimatedMinutes} min</div>
                      <div className="recovery-reason">{group.explanations[action.id]}</div>
                      {action.fallback && (
                        <div className="fallback-note"><strong>Fallback:</strong> {action.fallback}</div>
                      )}
                      {holdTarget === action.id && (
                        <HoldForm
                          action={action}
                          onSave={(input) => saveHold(activeActivity, action, input)}
                          onCancel={() => setHoldTarget(null)}
                        />
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => updateAction(activeActivity.id, action.id, completeUpdate("Completed in Rapid Recovery."))}>Mark done</button>
                      {action.fallback && (
                        <button className="btn btn-dark btn-sm" type="button" onClick={() => applyFallback(activeActivity, action)}>Use fallback</button>
                      )}
                      {isActionOnHold(action) ? (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => releaseHold(activeActivity, action)}><Undo2 size={12} /> Release hold</button>
                      ) : holdTarget !== action.id && (
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => setHoldTarget(action.id)}>Waiting / blocked</button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            ))}
            <div className="notice">
              Recovery suggestions are deterministic and based on the playbook’s authored rules. The HR Generalist makes the decision and performs any communication or booking outside this prototype.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
