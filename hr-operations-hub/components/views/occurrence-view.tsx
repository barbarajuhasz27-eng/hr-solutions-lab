"use client";

import { ArrowLeft, CalendarDays, Flag, SearchX, Users, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getReadiness } from "@/lib/engine";
import { getPlaybook } from "@/lib/playbooks";
import { recoveryHref } from "@/lib/shell";
import { ActionRow, ReadinessExplanation } from "../action-parts";
import { useHubStore } from "../hub-store";
import { EmptyState, formatLongDate, formatTime, LoadingState, ReadinessState } from "../ui";

export function OccurrenceNotFound({ id, tone = "workspace" }: { id: string; tone?: "workspace" | "recovery" }) {
  return (
    <EmptyState
      icon={<SearchX size={22} aria-hidden />}
      kicker={tone === "recovery" ? "Recovery mode" : "Occurrence"}
      title="Not found in this demo"
      links={[
        { href: "/", label: "Back to Today", primary: true },
        { href: "/playbooks", label: "Create from a playbook" },
      ]}
    >
      <p>
        There is no occurrence with the ID <code className="mono">{id}</code> in this browser’s demo data. Demo data lives only in this
        browser, so an occurrence created elsewhere, or removed by “Reset demo”, cannot be opened here.
      </p>
    </EmptyState>
  );
}

export function OccurrenceView({ id }: { id: string }) {
  const { hydrated, getActivity, now, toggleAction, applyFallback, saveHold, releaseHold } = useHubStore();
  const [holdTarget, setHoldTarget] = useState<string | null>(null);
  if (!hydrated) return <LoadingState />;

  const activity = getActivity(id);
  if (!activity) return <OccurrenceNotFound id={id} />;

  const readiness = getReadiness(activity, now);
  const start = new Date(activity.startsAt);
  const urgent = readiness.status === "recovery" || readiness.status === "at-risk";
  const done = activity.actions.filter((action) => action.status === "done").length;

  return (
    <>
      <div className="back-row">
        <Link className="text-link" href="/"><ArrowLeft size={13} aria-hidden /> Today</Link>
      </div>
      <header className="occurrence-header">
        <div>
          <div className="label">{getPlaybook(activity.playbookId)?.category ?? "HR Operations"}</div>
          <h1 className="page-title">{activity.title}</h1>
          <div className="occurrence-meta">
            <span><CalendarDays size={13} aria-hidden /> <span className="mono">{formatLongDate(start)} · {formatTime(start)}</span></span>
            <span><Users size={13} aria-hidden /> {activity.coordinator}</span>
            <span><Flag size={13} aria-hidden /> {activity.location}</span>
          </div>
        </div>
        <div className="occurrence-status">
          <ReadinessState status={readiness.status} />
          <Link className={`btn ${urgent ? "btn-hot" : "btn-outline"} btn-sm`} href={recoveryHref(activity.id)}>
            Open recovery <Zap size={13} aria-hidden />
          </Link>
        </div>
      </header>

      <div className="grid-12">
        <section className="panel span-8" aria-labelledby="timeline-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="timeline-title">Preparation timeline</h2>
              <p className="panel-sub">Complete an action, or mark it as waiting on someone or blocked. Dependencies show what has to happen first.</p>
            </div>
            <span className="count mono" aria-label={`${done} of ${activity.actions.length} actions done`}>{done} / {activity.actions.length} done</span>
          </div>
          <ol className="task-list">
            {[...activity.actions].sort((a, b) => a.dueOffsetMinutes - b.dueOffsetMinutes).map((action) => (
              <ActionRow
                key={action.id}
                action={action}
                activity={activity}
                now={now}
                holdOpen={holdTarget === action.id}
                onToggle={() => toggleAction(activity, action)}
                onFallback={action.fallback ? () => applyFallback(activity, action) : undefined}
                onOpenHold={() => setHoldTarget(action.id)}
                onSaveHold={(input) => { saveHold(activity, action, input); setHoldTarget(null); }}
                onCancelHold={() => setHoldTarget(null)}
                onRelease={() => releaseHold(activity, action)}
              />
            ))}
          </ol>
        </section>

        <aside className="panel span-4 side-panel" aria-labelledby="readiness-title">
          <div className="panel-head">
            <div>
              <h2 className="panel-title" id="readiness-title">Readiness</h2>
              <p className="panel-sub">Derived from Essential actions, deadlines, remaining work, holds and dependencies — not a weighted score.</p>
            </div>
          </div>
          <div className="panel-body">
            <ReadinessExplanation readiness={readiness} />
          </div>
        </aside>
      </div>
    </>
  );
}
