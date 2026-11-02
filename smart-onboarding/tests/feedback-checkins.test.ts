import { describe, expect, it } from "vitest";
import { addDays, parseISODate } from "@/lib/dates";
import {
  addAgendaPoint,
  availableSlots,
  bookMeeting,
  buildDraftAgenda,
  cancelMeeting,
  completeMeeting,
  EMPTY_FEEDBACK,
  generateSlots,
  isSlotTaken,
  isTopicInUse,
  reviewTopic,
  submitSurvey,
  toSharedMeeting,
} from "@/lib/feedback";
import { createSeedCases } from "@/lib/seed-data";
import type { FeedbackState } from "@/types/feedback";
import { makeCase, TODAY } from "./helpers";

const cases = createSeedCases(TODAY);
const daniel = cases.find((c) => c.id === "demo-daniel-okafor")!;
const marcus = cases.find((c) => c.id === "demo-marcus-bell")!;

describe("fictional slots", () => {
  it("are on weekdays within the next 14 days, at fixed times, and stable", () => {
    const slots = generateSlots("Amara Osei", TODAY);
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const day = parseISODate(s.date)!.getDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
      expect(s.date > TODAY && s.date <= addDays(TODAY, 14)).toBe(true);
      expect(["09:30", "11:00", "14:00", "15:30"]).toContain(s.time);
    }
    expect(generateSlots("Amara Osei", TODAY)).toEqual(slots);
  });
});

describe("booking", () => {
  it("reserves the slot and prevents double booking, also across employees with the same host", () => {
    expect(daniel.contacts.hrPartner.name).toBe(marcus.contacts.hrPartner.name);
    const slot = availableSlots(daniel, "hr", [], TODAY)[0];
    const first = bookMeeting(EMPTY_FEEDBACK, daniel, { type: "hr", slotId: slot.id, employeePoints: [] }, TODAY, "m1");
    expect(first.result).toBe("booked");
    expect(isSlotTaken(first.feedback.meetings, slot.id)).toBe(true);
    expect(availableSlots(marcus, "hr", first.feedback.meetings, TODAY).map((s) => s.id)).not.toContain(slot.id);

    const second = bookMeeting(first.feedback, marcus, { type: "hr", slotId: slot.id, employeePoints: [] }, TODAY, "m2");
    expect(second.result).toBe("slot-taken");
    expect(second.feedback).toBe(first.feedback);
  });

  it("refuses slots the host does not offer and a second upcoming check-in of the same type", () => {
    expect(bookMeeting(EMPTY_FEEDBACK, daniel, { type: "hr", slotId: "nobody--2026-11-03--09:30", employeePoints: [] }, TODAY, "x").result).toBe(
      "invalid-slot",
    );
    const [a, b] = availableSlots(daniel, "buddy", [], TODAY);
    const booked = bookMeeting(EMPTY_FEEDBACK, daniel, { type: "buddy", slotId: a.id, employeePoints: [] }, TODAY, "m1").feedback;
    expect(bookMeeting(booked, daniel, { type: "buddy", slotId: b.id, employeePoints: [] }, TODAY, "m2").result).toBe("already-booked");
  });

  it("frees the slot when a check-in is cancelled and keeps the record", () => {
    const slot = availableSlots(daniel, "manager", [], TODAY)[0];
    const booked = bookMeeting(EMPTY_FEEDBACK, daniel, { type: "manager", slotId: slot.id, employeePoints: [] }, TODAY, "m1").feedback;
    const cancelled = cancelMeeting(booked, "m1", TODAY);
    expect(cancelled.meetings[0]).toMatchObject({ status: "cancelled", cancelledAt: TODAY });
    expect(isSlotTaken(cancelled.meetings, slot.id)).toBe(false);
    expect(bookMeeting(cancelled, marcus, { type: "hr", slotId: slot.id, employeePoints: [] }, TODAY, "m2").result).not.toBe("slot-taken");
  });
});

describe("agenda preparation", () => {
  function danielWithTopics(): FeedbackState {
    let fb = submitSurvey(
      EMPTY_FEEDBACK,
      daniel,
      "day-7",
      {
        "role-clarity": 1,
        "learning-development": 4,
        "manager-support": 2,
        "team-integration": 4,
        "tools-resources": 5,
      },
      "My secret comment",
      TODAY,
    ).feedback;
    const roleTopic = fb.topics.find((t) => t.area === "role-clarity")!;
    fb = reviewTopic(fb, roleTopic.id, "share", "", TODAY); // manager-support stays suggested (not shared)
    return fb;
  }

  it("uses the meeting type, the next milestone, shared topics and the employee's points", () => {
    const fb = danielWithTopics();
    const date = addDays(TODAY, 3);
    const agenda = buildDraftAgenda({
      onboarding: daniel,
      type: "manager",
      date,
      topics: fb.topics,
      employeePoints: ["  My first project  ", "", "Team rituals"],
      idPrefix: "m",
    });
    expect(agenda.map((i) => [i.source, i.text])).toEqual([
      ["meeting-type", "Your priorities until the next checkpoint"],
      ["meeting-type", "What good looks like in your role"],
      ["meeting-type", "Support you need"],
      ["milestone", expect.stringMatching(/^Day 30 milestone \(24 Nov\)/)],
      ["topic", "Clarifying expectations for the role"],
      ["employee", "My first project"],
      ["employee", "Team rituals"],
    ]);
  });

  it("never includes ratings, comments or topics the employee has not shared", () => {
    const fb = danielWithTopics();
    const agenda = buildDraftAgenda({ onboarding: daniel, type: "hr", date: addDays(TODAY, 3), topics: fb.topics, employeePoints: [], idPrefix: "m" });
    const text = JSON.stringify(agenda);
    expect(text).not.toContain("My secret comment");
    expect(text).not.toContain("Support from the manager"); // suggested, not shared
    expect(text).not.toMatch(/rating|\b[12] ?\/ ?5\b/i);
  });

  it("is created on booking and accepts shared points from participants", () => {
    const fb = danielWithTopics();
    const slot = availableSlots(daniel, "hr", [], TODAY)[0];
    let booked = bookMeeting(fb, daniel, { type: "hr", slotId: slot.id, employeePoints: ["Benefits question"] }, TODAY, "m1").feedback;
    const roleTopic = booked.topics.find((t) => t.area === "role-clarity")!;
    expect(booked.meetings[0].agenda.some((i) => i.topicId === roleTopic.id)).toBe(true);
    expect(isTopicInUse(booked, roleTopic.id)).toBe(true);
    // Once on an agenda, the employee cannot silently withdraw the topic.
    expect(reviewTopic(booked, roleTopic.id, "keep-private", "", TODAY)).toBe(booked);

    booked = addAgendaPoint(booked, "m1", "Review the 30-day goals", "HR");
    booked = addAgendaPoint(booked, "m1", "   ", "Employee");
    expect(booked.meetings[0].agenda.at(-1)).toMatchObject({ source: "participant", text: "Review the 30-day goals", addedBy: "HR" });
  });
});

describe("completing a check-in", () => {
  const c = makeCase(-20, [], "c");
  const meetingOn = (date: string): FeedbackState => ({
    ...EMPTY_FEEDBACK,
    meetings: [
      {
        id: "m1",
        caseId: "c",
        type: "hr",
        slotId: `hr-partner--${date}--11:00`,
        hostName: "HR Partner",
        date,
        time: "11:00",
        durationMinutes: 30,
        status: "scheduled",
        bookedAt: addDays(date, -3),
        agenda: buildDraftAgenda({ onboarding: c, type: "hr", date, topics: [], employeePoints: [], idPrefix: "m1" }),
      },
    ],
  });

  it("records a shared outcome and a separate HR-only note, on or after the meeting date", () => {
    expect(completeMeeting(meetingOn(addDays(TODAY, 1)), "m1", "Agreed", "", TODAY).meetings[0].status).toBe("scheduled");
    expect(completeMeeting(meetingOn(TODAY), "m1", "   ", "", TODAY).meetings[0].status).toBe("scheduled");
    const done = completeMeeting(meetingOn(TODAY), "m1", "Agreed next steps", "Private HR context", TODAY).meetings[0];
    expect(done).toMatchObject({ status: "completed", outcome: "Agreed next steps", hrNote: "Private HR context", completedAt: TODAY });
    expect(toSharedMeeting(done)).not.toHaveProperty("hrNote");
    expect(JSON.stringify(toSharedMeeting(done))).not.toContain("Private HR context");
  });
});
