import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  canReopen,
  canRespondToFollowUp,
  createAction,
  EMPTY_FEEDBACK,
  getFeedbackSummary,
  isActionOverdue,
  recordFollowUp,
  reopenAction,
  reviewTopic,
  setActionStatus,
  submitSurvey,
} from "@/lib/feedback";
import type { ActionInput } from "@/lib/feedback";
import type { FeedbackState, Meeting } from "@/types/feedback";
import { makeCase, TODAY } from "./helpers";

const c = makeCase(-8, [{ key: "laptop" }, { key: "buddy" }], "c");
const other = makeCase(-8, [{ key: "laptop" }], "other");
const cases = [c, other];

const meeting = (status: Meeting["status"], id = "m1", caseId = "c"): Meeting => ({
  id,
  caseId,
  type: "hr",
  slotId: `${id}-slot`,
  hostName: "HR Partner",
  date: addDays(TODAY, -1),
  time: "11:00",
  durationMinutes: 30,
  status,
  bookedAt: addDays(TODAY, -5),
  agenda: [],
  ...(status === "completed" ? { outcome: "Agreed", completedAt: addDays(TODAY, -1) } : {}),
});

const base: FeedbackState = { ...EMPTY_FEEDBACK, meetings: [meeting("completed"), meeting("scheduled", "m2")] };
const input = (overrides: Partial<ActionInput> = {}): ActionInput => ({
  caseId: "c",
  description: "Pair with a senior colleague on the first report",
  owner: "Hiring manager",
  dueDate: addDays(TODAY, 10),
  source: { kind: "meeting", meetingId: "m1" },
  ...overrides,
});

describe("creating actions", () => {
  it("creates an open action from a completed check-in with every required field", () => {
    const { feedback, error, action } = createAction(base, cases, input(), TODAY, "a1", "HR");
    expect(error).toBeUndefined();
    expect(action).toMatchObject({
      id: "a1",
      caseId: "c",
      description: "Pair with a senior colleague on the first report",
      owner: "Hiring manager",
      dueDate: addDays(TODAY, 10),
      status: "Open",
      source: { kind: "meeting", meetingId: "m1" },
      reopenCount: 0,
      followUps: [],
    });
    expect(action!.history).toEqual([{ at: TODAY, type: "created", detail: "Action agreed", by: "HR" }]);
    expect(feedback.actions).toHaveLength(1);
  });

  it("refuses sources that are not agreed: a scheduled check-in, another case's check-in, or an unreviewed topic", () => {
    expect(createAction(base, cases, input({ source: { kind: "meeting", meetingId: "m2" } }), TODAY, "a", "HR").error).toBe("source-not-agreed");
    expect(createAction(base, cases, input({ caseId: "other" }), TODAY, "a", "HR").error).toBe("source-not-agreed");

    const low = submitSurvey(EMPTY_FEEDBACK, c, "day-7", { "role-clarity": 1, "learning-development": 4, "manager-support": 4, "team-integration": 4, "tools-resources": 4 }, "", TODAY).feedback;
    const topicId = low.topics[0].id;
    expect(createAction(low, cases, input({ source: { kind: "topic", topicId } }), TODAY, "a", "HR").error).toBe("source-not-agreed");
    const shared = reviewTopic(low, topicId, "share", "", TODAY);
    const created = createAction(shared, cases, input({ source: { kind: "topic", topicId } }), TODAY, "a", "HR");
    expect(created.error).toBeUndefined();
    expect(created.action!.source).toEqual({ kind: "topic", topicId });
  });

  it("links to an existing task of the same case without creating or changing tasks", () => {
    const before = JSON.stringify(cases);
    const linked = createAction(base, cases, input({ linkedTaskId: "c--laptop" }), TODAY, "a1", "HR");
    expect(linked.action!.linkedTaskId).toBe("c--laptop");
    expect(JSON.stringify(cases)).toBe(before);
    expect(createAction(base, cases, input({ linkedTaskId: "other--laptop" }), TODAY, "a2", "HR").error).toBe("task-not-in-case");
  });

  it("refuses an unlinked action that duplicates an existing task", () => {
    expect(createAction(base, cases, input({ description: "  task LAPTOP " }), TODAY, "a", "HR").error).toBe("duplicates-task");
    expect(createAction(base, cases, input({ description: "Task laptop", linkedTaskId: "c--laptop" }), TODAY, "a", "HR").error).toBeUndefined();
  });

  it("validates the description and due date", () => {
    expect(createAction(base, cases, input({ description: "  " }), TODAY, "a", "HR").error).toBe("description-required");
    expect(createAction(base, cases, input({ dueDate: "2026-13-01" }), TODAY, "a", "HR").error).toBe("invalid-due-date");
  });
});

describe("status, follow-up and reopening", () => {
  const created = () => createAction(base, cases, input(), addDays(TODAY, -10), "a1", "HR").feedback;

  it("records status changes in the history and marks completion", () => {
    let fb = setActionStatus(created(), "a1", "In progress", addDays(TODAY, -5), "HR");
    fb = setActionStatus(fb, "a1", "Completed", addDays(TODAY, -2), "HR");
    expect(fb.actions[0]).toMatchObject({ status: "Completed", completedAt: addDays(TODAY, -2) });
    expect(fb.actions[0].history.map((h) => h.detail)).toEqual(["Action agreed", "Open → In progress", "In progress → Completed"]);
  });

  it("asks for one follow-up per completion and only once the action is done", () => {
    let fb = created();
    expect(canRespondToFollowUp(fb.actions[0])).toBe(false);
    expect(recordFollowUp(fb, "a1", "helped", TODAY)).toBe(fb);
    fb = setActionStatus(fb, "a1", "Completed", TODAY, "HR");
    fb = recordFollowUp(fb, "a1", "partly", TODAY);
    expect(fb.actions[0].followUps).toEqual([{ at: TODAY, response: "partly" }]);
    expect(recordFollowUp(fb, "a1", "helped", TODAY)).toBe(fb);
    expect(canReopen(fb.actions[0])).toBe(false);
  });

  it("can be reopened after 'did not help', keeping the original history and answers", () => {
    let fb = setActionStatus(created(), "a1", "Completed", addDays(TODAY, -3), "HR");
    fb = recordFollowUp(fb, "a1", "not-helped", addDays(TODAY, -1));
    expect(canReopen(fb.actions[0])).toBe(true);
    const historyBefore = fb.actions[0].history;
    fb = reopenAction(fb, "a1", TODAY, "Employee", addDays(TODAY, 14));
    const a = fb.actions[0];
    expect(a).toMatchObject({ status: "Open", reopenCount: 1, dueDate: addDays(TODAY, 14) });
    expect(a.completedAt).toBeUndefined();
    expect(a.followUps).toEqual([{ at: addDays(TODAY, -1), response: "not-helped" }]);
    expect(a.history.slice(0, historyBefore.length)).toEqual(historyBefore);
    expect(a.history.at(-1)).toMatchObject({ type: "reopened", by: "Employee" });
    expect(reopenAction(fb, "a1", TODAY, "Employee")).toBe(fb);

    // Completed again: a new follow-up is asked for, and the earlier one is kept.
    fb = setActionStatus(fb, "a1", "Completed", TODAY, "HR");
    expect(canRespondToFollowUp(fb.actions[0])).toBe(true);
    fb = recordFollowUp(fb, "a1", "helped", TODAY);
    expect(fb.actions[0].followUps.map((f) => f.response)).toEqual(["not-helped", "helped"]);
  });

  it("is overdue when not completed and past the due date; reopened actions count as open", () => {
    const fb = createAction(base, cases, input({ dueDate: addDays(TODAY, -1) }), addDays(TODAY, -10), "a1", "HR").feedback;
    expect(isActionOverdue(fb.actions[0], TODAY)).toBe(true);
    expect(isActionOverdue({ ...fb.actions[0], dueDate: TODAY }, TODAY)).toBe(false);
    const done = setActionStatus(fb, "a1", "Completed", TODAY, "HR");
    expect(isActionOverdue(done.actions[0], TODAY)).toBe(false);
    const reopened = reopenAction(recordFollowUp(done, "a1", "not-helped", TODAY), "a1", TODAY, "HR");
    expect(getFeedbackSummary(cases, reopened, TODAY)).toMatchObject({ openActions: 1, overdueActions: 1 });
  });
});
