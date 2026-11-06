"use client";

import { ArrowRight, CalendarDays, Hourglass, ShieldAlert, TriangleAlert, Users } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { formatDuration, getPriorityActivity, getReadiness } from "@/lib/engine";
import { PLAYBOOKS } from "@/lib/playbooks";
import {
  EXCEPTION_FILTERS,
  getAtRiskActivities,
  getOverdueTasks,
  getWaitingTasks,
  occurrenceHref,
  recoveryHref,
  type ExceptionFilter,
  type TaskRef,
} from "@/lib/shell";
import { useHubStore } from "../hub-store";
import { dueLabel, formatDate, formatFullDate, formatLongDate, formatTime, LoadingState, minutesToStart, PageHeader, ReadinessState } from "../ui";

function TaskList({ items, now, kind }: { items: TaskRef[]; now: Date; kind: "overdue" | "waiting" }) {
  return (
    <ul className="rows" aria-label={kind === "overdue" ? "Overdue tasks" : "Tasks waiting on others"}>
      {items.map(({ activity, action }) => (
        <li key={`${activity.id}-${action.id}`} className={`row row-${kind}`}>
          <span className="row-stripe" aria-hidden />
          <span className="row-time mono">
            {kind === "overdue" ? <TriangleAlert size={12} aria-hidden /> : <Hourglass size={12} aria-hidden />}
            {dueLabel(action, activity, now)}
          </span>
          <div className="row-main">
            <div className="row-title">{action.title}</div>
            <div className="row-meta">
              {kind === "waiting"
                ? <>Waiting on {action.waitingOn || "another person or team"}{action.statusNote ? ` — ${action.statusNote}` : ""}</>
                : <>{action.ownerRole} · {action.ownerName}</>}
            </div>
          </div>
          <Link className="row-link" href={occurrenceHref(activity.id)}>
            {activity.title} <ArrowRight size={12} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FilteredToday({ filter }: { filter: ExceptionFilter }) {
  const { activities, now } = useHubStore();
  const meta = EXCEPTION_FILTERS.find((item) => item.id === filter)!;
  const overdue = filter === "overdue" ? getOverdueTasks(activities, now) : [];
  const waiting = filter === "waiting" ? getWaitingTasks(activities) : [];
  const atRisk = filter === "at-risk" ? getAtRiskActivities(activities, now) : [];
  const count = overdue.length + waiting.length + atRisk.length;

  return (
    <section className="panel" aria-labelledby="filtered-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="filtered-title">{meta.label} <span className="count mono">{count}</span></h2>
          <p className="panel-sub">{meta.description}.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" href="/">Clear filter</Link>
      </div>
      {count === 0 ? (
        <p className="panel-empty">
          {filter === "overdue" ? "No unresolved task is past its due time." : filter === "waiting" ? "No task is on a Waiting hold." : "No occurrence is At risk or in Recovery."}
        </p>
      ) : filter === "at-risk" ? (
        <ul className="rows" aria-label="Occurrences at risk">
          {atRisk.map(({ activity, readiness }) => {
            const reason = readiness.reasons.find((item) => item.severity === "risk") ?? readiness.reasons[0];
            return (
              <li key={activity.id} className="row row-risk">
                <span className="row-stripe" aria-hidden />
                <ReadinessState status={readiness.status} />
                <div className="row-main">
                  <div className="row-title">{activity.title}</div>
                  {reason && <div className="row-meta">{reason.message}</div>}
                </div>
                <div className="row-actions">
                  <Link className="btn btn-primary btn-sm" href={recoveryHref(activity.id)}>Open recovery</Link>
                  <Link className="btn btn-outline btn-sm" href={occurrenceHref(activity.id)}>View occurrence</Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <TaskList items={filter === "overdue" ? overdue : waiting} now={now} kind={filter} />
      )}
    </section>
  );
}

function PriorityBand() {
  const { activities, now } = useHubStore();
  const priority = useMemo(() => getPriorityActivity(activities, now), [activities, now]);
  if (!priority) return null;

  const kicker = priority.readiness.status === "recovery" ? "Needs a decision now"
    : priority.readiness.status === "at-risk" ? "Needs a decision · At risk"
      : "Needs follow-up";
  const reason = priority.readiness.reasons.find((item) => item.severity === "risk") ?? priority.readiness.reasons[0];
  const open = priority.readiness.unresolvedEssential.length;
  const inRecovery = priority.readiness.status === "recovery";
  const start = new Date(priority.activity.startsAt);

  return (
    <section className={`decision-band decision-${priority.readiness.status}`} aria-labelledby="priority-title">
      <div className="decision-body">
        <div className="label">{kicker}</div>
        <h2 className="decision-title" id="priority-title">
          {priority.activity.title} starts in <span className="mono">{formatDuration(minutesToStart(priority.activity.startsAt, now))}</span>
        </h2>
        <p className="decision-copy">
          {open} essential action{open === 1 ? " is" : "s are"} still open.
          {inRecovery
            ? " See what must happen first, what can be simplified and what can follow later."
            : reason ? ` ${reason.message}` : ""}
        </p>
        <div className="decision-meta">
          <span><CalendarDays size={13} aria-hidden /> <span className="mono">{formatFullDate(start)} · {formatTime(start)}</span></span>
          <span><Users size={13} aria-hidden /> {priority.activity.coordinator}</span>
          <ReadinessState status={priority.readiness.status} />
        </div>
      </div>
      <div className="decision-actions">
        {inRecovery ? (
          <>
            <Link className="btn btn-hot" href={recoveryHref(priority.activity.id)}>Open recovery <ArrowRight size={14} aria-hidden /></Link>
            <Link className="btn btn-outline" href={occurrenceHref(priority.activity.id)}>View occurrence</Link>
          </>
        ) : (
          <>
            <Link className="btn btn-primary" href={occurrenceHref(priority.activity.id)}>View occurrence <ArrowRight size={14} aria-hidden /></Link>
            <Link className="btn btn-outline" href={recoveryHref(priority.activity.id)}>Open recovery</Link>
          </>
        )}
      </div>
    </section>
  );
}

function OccurrenceTable() {
  const { activities, now } = useHubStore();
  const ordered = useMemo(
    () => [...activities].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()),
    [activities],
  );
  return (
    <section className="panel" aria-labelledby="occurrences-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="occurrences-title">Occurrences</h2>
          <p className="panel-sub">Sorted by start time · select one to open its workspace</p>
        </div>
      </div>
      {ordered.length === 0 ? (
        <p className="panel-empty">No activities in this demo. Create one from a playbook.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Start</th>
              <th scope="col">Activity</th>
              <th scope="col">Readiness</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((activity) => {
              const readiness = getReadiness(activity, now);
              const start = new Date(activity.startsAt);
              return (
                <tr key={activity.id}>
                  <td className="mono nowrap">{formatDate(start)} {formatTime(start)}</td>
                  <td>
                    <Link className="table-link" href={occurrenceHref(activity.id)}>{activity.title}</Link>
                    <div className="cell-meta">{activity.location} · {activity.coordinator}</div>
                  </td>
                  <td><ReadinessState status={readiness.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PlaybookShortlist() {
  return (
    <section className="panel" aria-labelledby="playbooks-short-title">
      <div className="panel-head">
        <div>
          <h2 className="panel-title" id="playbooks-short-title">Playbooks</h2>
          <p className="panel-sub">HR-specific operational starting points</p>
        </div>
      </div>
      <ul className="rows">
        {PLAYBOOKS.slice(0, 3).map((playbook) => (
          <li className="row row-plain" key={playbook.id}>
            <div className="row-main">
              <div className="row-title">{playbook.title}</div>
              <div className="row-meta">{playbook.description}</div>
            </div>
            <span className={`tag ${playbook.actions.length > 0 ? "tag-available" : "tag-design"}`}>
              {playbook.actions.length > 0 ? "Available" : "In design"}
            </span>
          </li>
        ))}
      </ul>
      <div className="panel-foot">
        <Link className="text-link" href="/playbooks">View all playbooks <ArrowRight size={12} aria-hidden /></Link>
      </div>
    </section>
  );
}

export function TodayView({ filter }: { filter: ExceptionFilter | null }) {
  const { hydrated, now } = useHubStore();
  if (!hydrated) return <LoadingState />;

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(now)}
        title="Today"
        description="The HR activities that need your attention, most urgent first."
        actions={<Link className="btn btn-primary" href="/playbooks">New activity</Link>}
      />
      {filter ? (
        <FilteredToday filter={filter} />
      ) : (
        <>
          <PriorityBand />
          <div className="grid-12">
            <div className="span-7"><OccurrenceTable /></div>
            <div className="span-5"><PlaybookShortlist /></div>
          </div>
        </>
      )}
      <p className="demo-note">
        <ShieldAlert size={13} aria-hidden /> Demo note: activity dates, owners, action times and readiness states are synthetic. “Open recovery” does not send messages, book rooms or contact IT / Facilities.
      </p>
    </>
  );
}
