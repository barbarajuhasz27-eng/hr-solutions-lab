"use client";

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  ClipboardCheck,
  Flag,
  Layers3,
  ListChecks,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { applyActionUpdate, getReadiness, getRecoveryPlan } from "@/lib/engine";
import type { Activity, ActionInstance, ActivityStatus, View } from "@/lib/model";
import { PLAYBOOKS, getPlaybook } from "@/lib/playbooks";
import { createActivity, createSeedActivities, resetActivities } from "@/lib/seed";
import { clearActivities, loadActivities, saveActivities } from "@/lib/storage";

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

function remainingLabel(startsAt: string, now: Date) {
  const minutes = Math.max(0, Math.floor((new Date(startsAt).getTime() - now.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min remaining`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m remaining` : `${hours}h remaining`;
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

function statusLabel(status: ActivityStatus) {
  const labels: Record<ActivityStatus, string> = {
    planned: "Planned",
    preparing: "Preparing",
    "needs-attention": "Needs attention",
    "at-risk": "At risk",
    recovery: "Recovery",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[status];
}

function StatusBadge({ status }: { status: ActivityStatus }) {
  return <span className={`badge badge-${status}`}>{statusLabel(status)}</span>;
}

function CriticalityBadge({ value }: { value: ActionInstance["criticality"] }) {
  return <span className={`badge badge-${value}`}>{value}</span>;
}

function ActionRow({
  action,
  activity,
  now,
  onToggle,
  onFallback,
}: {
  action: ActionInstance;
  activity: Activity;
  now: Date;
  onToggle: () => void;
  onFallback?: () => void;
}) {
  const done = action.status === "done" || action.status === "skipped";
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
          {action.fallbackUsed && <span>Fallback recorded</span>}
        </div>
        {action.statusNote && <div className="fallback-note">{action.statusNote}</div>}
      </div>
      <div className="action-side">
        <span className="time-label">{dueLabel(action, activity, now)}</span>
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

export function OperationsHub() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeId, setActiveId] = useState("activity-training-rescue");
  const [view, setView] = useState<View>("radar");
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const loaded = loadActivities(new Date());
    setActivities(loaded);
    if (loaded.length > 0 && !loaded.some((activity) => activity.id === activeId)) {
      setActiveId(loaded[0].id);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hydrated) saveActivities(activities);
  }, [activities, hydrated]);

  const activeActivity = activities.find((activity) => activity.id === activeId) ?? activities[0];
  const readinessItems = useMemo(
    () => activities.map((activity) => ({ activity, readiness: getReadiness(activity, now) })),
    [activities, now],
  );
  const orderedActivities = useMemo(
    () => [...activities].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [activities],
  );
  const recoveryPlan = activeActivity ? getRecoveryPlan(activeActivity, now) : [];
  const remaining = activeActivity ? remainingLabel(activeActivity.startsAt, now) : "";
  const rescueActivity = activities.find((activity) => activity.id === "activity-training-rescue") ?? orderedActivities[0];
  const rescueReadiness = rescueActivity ? getReadiness(rescueActivity, now) : null;
  const openCount = readinessItems.filter((item) => !["completed", "cancelled"].includes(item.readiness.status)).length;
  const atRiskCount = readinessItems.filter((item) => ["at-risk", "recovery"].includes(item.readiness.status)).length;
  const overdueActions = activities.reduce((count, activity) => count + activity.actions.filter((action) => {
    if (action.status === "done" || action.status === "skipped") return false;
    const dueAt = new Date(new Date(activity.startsAt).getTime() + action.dueOffsetMinutes * 60_000);
    return dueAt < now;
  }).length, 0);

  function openActivity(activity: Activity, nextView: View = "activity") {
    setActiveId(activity.id);
    setView(nextView);
    setNotice("");
  }

  function updateAction(activityId: string, actionId: string, update: Partial<Pick<ActionInstance, "status" | "statusNote" | "fallbackUsed">>) {
    setActivities((current) => applyActionUpdate(current, activityId, actionId, update));
  }

  function toggleAction(activity: Activity, action: ActionInstance) {
    const nextStatus = action.status === "done" || action.status === "skipped" ? "not-started" : "done";
    updateAction(activity.id, action.id, {
      status: nextStatus,
      statusNote: nextStatus === "not-started" ? undefined : "Completed in the demo workspace.",
      fallbackUsed: false,
    });
  }

  function useFallback(activity: Activity, action: ActionInstance) {
    if (!action.fallback) return;
    updateAction(activity.id, action.id, {
      status: "done",
      statusNote: `Fallback used: ${action.fallback}`,
      fallbackUsed: true,
    });
  }

  function resetDemo() {
    clearActivities();
    const fresh = resetActivities(new Date());
    setActivities(fresh);
    setActiveId("activity-training-rescue");
    setView("radar");
    setNotice("Demo data restored. The training scenario starts in 45 minutes.");
  }

  function createFromPlaybook(playbookId: string) {
    const playbook = getPlaybook(playbookId);
    if (!playbook || playbook.actions.length === 0) return;
    const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    const created = createActivity(
      playbookId,
      playbook.title,
      startsAt,
      `activity-${Date.now()}`,
      { location: "To be confirmed" },
    );
    setActivities((current) => [created, ...current]);
    setActiveId(created.id);
    setView("activity");
    setNotice("New activity created from the playbook, scheduled seven days from now.");
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
                onClick={() => { setView(item.id); setNotice(""); }}
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
                onClick={() => setView("activity")}
              >
                <ListChecks size={16} strokeWidth={1.8} />
                Activity Workspace
              </button>
              <button
                type="button"
                className={`nav-button ${view === "recovery" ? "active" : ""}`}
                onClick={() => setView("recovery")}
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
            <button className="btn btn-dark" type="button" onClick={() => setView("playbooks")}>
              <Sparkles size={15} /> New activity
            </button>
          )}
          {(view === "activity" || view === "recovery") && (
            <button className="btn btn-outline" type="button" onClick={() => setView("radar")}>
              <ArrowLeft size={14} /> Back to radar
            </button>
          )}
        </div>

        {notice && <div className="inline-notice" role="status">{notice}</div>}

        {view === "radar" && (
          <>
            {rescueActivity && rescueReadiness && rescueReadiness.status !== "completed" && (
              <section className="hero-panel">
                <div>
                  <div className="hero-kicker">Priority activity · Needs attention now</div>
                  <h2 className="hero-title">{rescueActivity.title} starts in {remaining}</h2>
                  <p className="hero-copy">
                    {rescueReadiness.unresolvedEssential.length} essential actions are still open.
                    See what must happen first, what can be simplified and what can follow later.
                  </p>
                  <div className="hero-meta">
                    <span><CalendarDays size={13} /> {formatDate(new Date(rescueActivity.startsAt), { year: "numeric" })} · {formatTime(new Date(rescueActivity.startsAt))}</span>
                    <span><Users size={13} /> {rescueActivity.coordinator}</span>
                    <span><ShieldAlert size={13} /> {rescueReadiness.label}</span>
                  </div>
                </div>
                <div className="hero-actions">
                  <button className="btn btn-primary" type="button" onClick={() => openActivity(rescueActivity, "recovery")}>
                    Open Rapid Recovery <ArrowRight size={15} />
                  </button>
                  <button className="btn btn-white" type="button" onClick={() => openActivity(rescueActivity)}>
                    View activity
                  </button>
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
                  <button className="link-button" type="button" onClick={() => setView("playbooks")}>Create <ArrowRight size={13} /></button>
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
                  <button className="link-button" type="button" onClick={() => setView("playbooks")}>View all playbooks <ArrowRight size={13} /></button>
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

        {view === "activity" && activeActivity && (
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
                <StatusBadge status={getReadiness(activeActivity, now).status} />
                {getReadiness(activeActivity, now).status === "recovery" && (
                  <button className="btn btn-dark btn-sm" type="button" onClick={() => setView("recovery")}>Open Rapid Recovery <Zap size={13} /></button>
                )}
              </div>
            </div>

            <section className="panel" style={{ marginTop: 18 }}>
              <div className="panel-head">
                <div>
                  <div className="panel-title">Preparation timeline</div>
                  <div className="panel-sub">Complete an action to update the readiness explanation. Dependencies remain visible.</div>
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
                    onToggle={() => toggleAction(activeActivity, action)}
                    onFallback={action.fallback ? () => useFallback(activeActivity, action) : undefined}
                  />
                ))}
              </div>
            </section>

            <section className="panel" style={{ marginTop: 16 }}>
              <div className="panel-head">
                <div>
                  <div className="panel-title">Readiness explanation</div>
                  <div className="panel-sub">The status is derived from Essential actions, due times and blockers — not a weighted score.</div>
                </div>
                <StatusBadge status={getReadiness(activeActivity, now).status} />
              </div>
              <div className="readiness-body">
                {getReadiness(activeActivity, now).unresolvedEssential.length === 0 ? (
                  <div className="readiness-positive"><CheckCircle2 size={17} /> All Essential pre-start actions are complete.</div>
                ) : (
                  <>
                    <p className="readiness-copy">The activity is not ready because these Essential actions remain unresolved:</p>
                    <ul className="readiness-list">
                      {getReadiness(activeActivity, now).unresolvedEssential.map((action) => (
                        <li key={action.id}><Circle size={8} /> <span>{action.title}</span><small>{action.ownerRole}</small></li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </>
        )}

        {view === "recovery" && activeActivity && (
          <>
            <div className="recovery-intro">
              <div>
                <div className="hero-kicker">Rapid Recovery · {activeActivity.title}</div>
                <div className="recovery-clock">{remaining}</div>
                <p className="hero-copy" style={{ marginTop: 9 }}>A time-aware action order based on criticality, available time, dependencies and playbook fallbacks.</p>
              </div>
              <button className="btn btn-white" type="button" onClick={() => setView("activity")}>View full activity <ArrowRight size={14} /></button>
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
                      <div className="recovery-action-title">{action.title}</div>
                      <div className="recovery-action-meta">{action.ownerRole} · {action.ownerName} · approx. {action.estimatedMinutes} min</div>
                      {action.fallback && (
                        <div className="fallback-note"><strong>Fallback:</strong> {action.fallback}</div>
                      )}
                      {action.dependsOn.length > 0 && (
                        <div className="recovery-action-meta">Depends on: {action.dependsOn.map((id) => activeActivity.actions.find((item) => item.id === id)?.title ?? id).join(", ")}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => updateAction(activeActivity.id, action.id, { status: "done", statusNote: "Completed in Rapid Recovery." })}>Mark done</button>
                      {action.fallback && (
                        <button className="btn btn-dark btn-sm" type="button" onClick={() => useFallback(activeActivity, action)}>Use fallback</button>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            ))}
            <div className="notice">
              Recovery suggestions are deterministic and based on the playbook's authored rules. The HR Generalist makes the decision and performs any communication or booking outside this prototype.
            </div>
          </>
        )}
      </main>
    </div>
  );
}
