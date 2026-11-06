/**
 * Close-out outcome semantics (§6.5, D19, D29, D31).
 *
 * The outcome is decided by each essential task's own status, `dueAt` and `resolvedAt`, never by the
 * anchor alone or by the moment Close is clicked:
 * - `completed`: every essential task is `done` with `resolvedAt` at or before its own `dueAt`.
 * - `completed-late`: every essential task is `done` with a `resolvedAt`, at least one after its `dueAt`.
 * - `missed`: anything else, including a **skipped** essential task. Requires a note.
 * Skipped important or optional tasks never change the outcome.
 *
 * The full readiness and recovery engine is M3; this module only holds the outcome rules.
 */
import { isClosed } from "./occurrence";
import type { Occurrence, Operation, Task } from "./types";

export type ComputedOutcome = "completed" | "completed-late" | "missed";
export type CloseOutcome = ComputedOutcome | "cancelled";

export interface OutcomeAssessment {
  outcome: ComputedOutcome;
  /** Essential tasks that are skipped (D31): the occurrence can only close as `missed`. */
  skippedEssential: string[];
  /** Essential tasks not done and not skipped: open or on hold, including open post-anchor essentials. */
  openEssential: string[];
  /** Essential tasks done after their own due time. */
  lateEssential: string[];
  /**
   * D29 qualifier: `completed-late` while every pre-anchor essential task (`dueAt ≤ anchorAt`) was done on
   * time, so only post-anchor follow-ups were late. The anchor deliverable is shown as on time.
   */
  lateFollowUpOnly: boolean;
}

const time = (iso: string) => new Date(iso).getTime();

export function isDoneOnTime(task: Pick<Task, "status" | "resolvedAt" | "dueAt">): boolean {
  return task.status === "done" && task.resolvedAt !== undefined && time(task.resolvedAt) <= time(task.dueAt);
}

export function isPreAnchor(task: Pick<Task, "dueAt">, occurrence: Pick<Occurrence, "anchorAt">): boolean {
  return time(task.dueAt) <= time(occurrence.anchorAt);
}

export function assessOutcome(occurrence: Pick<Occurrence, "anchorAt" | "tasks">): OutcomeAssessment {
  const essential = occurrence.tasks.filter((task) => task.criticality === "essential");
  const skippedEssential = essential.filter((task) => task.status === "skipped").map((task) => task.id);
  // A done task without a resolution time cannot prove when it was done, so it does not count as done.
  const openEssential = essential
    .filter((task) => task.status !== "skipped" && !(task.status === "done" && task.resolvedAt))
    .map((task) => task.id);
  const lateEssential = essential
    .filter((task) => task.status === "done" && task.resolvedAt && !isDoneOnTime(task))
    .map((task) => task.id);

  let outcome: ComputedOutcome;
  if (skippedEssential.length > 0 || openEssential.length > 0) outcome = "missed";
  else if (lateEssential.length > 0) outcome = "completed-late";
  else outcome = "completed";

  const lateFollowUpOnly =
    outcome === "completed-late" &&
    essential.filter((task) => isPreAnchor(task, occurrence)).every((task) => isDoneOnTime(task));

  return { outcome, skippedEssential, openEssential, lateEssential, lateFollowUpOnly };
}

/**
 * Outcomes the close dialog may offer. `completed` / `completed-late` only when every essential task is
 * done (and then only the computed one); otherwise only `missed`. `cancelled` is for one-off operations.
 */
export function closeOptions(occurrence: Occurrence, operation: Pick<Operation, "schedule">): CloseOutcome[] {
  if (isClosed(occurrence)) return [];
  const options: CloseOutcome[] = [assessOutcome(occurrence).outcome];
  if (operation.schedule === null) options.push("cancelled");
  return options;
}

/** Outcomes that need a close note (§6.5). */
export function outcomeRequiresNote(outcome: CloseOutcome): boolean {
  return outcome === "missed" || outcome === "cancelled";
}
