"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDuration } from "@/lib/engine";
import { PLAYBOOKS } from "@/lib/playbooks";
import { occurrenceHref } from "@/lib/shell";
import { useHubStore } from "../hub-store";
import { CriticalityTag, LoadingState, PageHeader } from "../ui";

function offsetLabel(minutes: number) {
  if (minutes === 0) return "At start";
  return minutes < 0 ? `${formatDuration(-minutes)} before` : `${formatDuration(minutes)} after`;
}

export function PlaybooksView() {
  const { hydrated, createFromPlaybook } = useHubStore();
  const router = useRouter();
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!hydrated) return <LoadingState />;

  function create(playbookId: string) {
    const created = createFromPlaybook(playbookId);
    if (created) router.push(occurrenceHref(created.id));
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Playbooks"
        description="Repeatable starting points for the operational work HR coordinates."
      />
      <p className="inline-info">
        The training playbook is implemented in this development slice. Other HR playbooks are documented product directions and are shown as “In design”.
      </p>
      <section className="panel" aria-label="Playbook library">
        <ul className="playbook-list">
          {PLAYBOOKS.map((playbook) => {
            const available = playbook.actions.length > 0;
            const open = expanded === playbook.id;
            return (
              <li className="playbook-row" key={playbook.id}>
                <div className="playbook-main">
                  <div className="label">{playbook.category}</div>
                  <h2 className="playbook-title">{playbook.title}</h2>
                  <p className="playbook-description">{playbook.description}</p>
                  <div className="playbook-meta mono">
                    <span>{playbook.durationLabel}</span>
                    <span aria-hidden>·</span>
                    <span>{playbook.actions.length} actions defined</span>
                  </div>
                </div>
                <div className="playbook-side">
                  <span className={`tag ${available ? "tag-available" : "tag-design"}`}>{available ? "Ready to use" : "In design"}</span>
                  <div className="playbook-buttons">
                    {available && (
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        aria-expanded={open}
                        aria-controls={`tasks-${playbook.id}`}
                        onClick={() => setExpanded(open ? null : playbook.id)}
                      >
                        <ChevronDown size={13} aria-hidden className={open ? "rotate" : ""} /> {open ? "Hide tasks" : "Show tasks"}
                      </button>
                    )}
                    <button
                      className={`btn ${available ? "btn-primary" : "btn-outline"} btn-sm`}
                      type="button"
                      disabled={!available}
                      onClick={() => create(playbook.id)}
                    >
                      Create activity <ArrowRight size={13} aria-hidden />
                    </button>
                  </div>
                </div>
                {available && open && (
                  <div className="playbook-tasks" id={`tasks-${playbook.id}`}>
                    <table className="table table-dense">
                      <thead>
                        <tr>
                          <th scope="col">Due</th>
                          <th scope="col">Task</th>
                          <th scope="col">Responsible</th>
                          <th scope="col">Criticality</th>
                          <th scope="col">Effort</th>
                          <th scope="col">Depends on</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...playbook.actions].sort((a, b) => a.dueOffsetMinutes - b.dueOffsetMinutes).map((action) => (
                          <tr key={action.id}>
                            <td className="mono nowrap">{offsetLabel(action.dueOffsetMinutes)}</td>
                            <td>{action.title}{action.fallback && <div className="cell-meta">Fallback: {action.fallback}</div>}</td>
                            <td>{action.ownerRole}</td>
                            <td><CriticalityTag value={action.criticality} /></td>
                            <td className="mono nowrap">{action.estimatedMinutes} min</td>
                            <td className="cell-meta">
                              {action.dependsOn.length === 0
                                ? "—"
                                : action.dependsOn.map((id) => playbook.actions.find((item) => item.id === id)?.title ?? id).join("; ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
