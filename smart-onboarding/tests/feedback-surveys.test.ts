import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  EMPTY_FEEDBACK,
  getFeedbackSummary,
  getSurveys,
  isTopicInUse,
  LOW_RATING_THRESHOLD,
  reviewTopic,
  sharedTopics,
  submitSurvey,
  suggestTopics,
  surveyClosesOn,
  surveyOpensOn,
  surveyState,
} from "@/lib/feedback";
import { createSeedFeedback } from "@/lib/feedback-seed";
import { createSeedCases } from "@/lib/seed-data";
import type { FeedbackArea, FeedbackState } from "@/types/feedback";
import { makeCase, TODAY } from "./helpers";

const ratings = (overrides: Partial<Record<FeedbackArea, number>> = {}) => ({
  "role-clarity": 4,
  "learning-development": 4,
  "manager-support": 4,
  "team-integration": 4,
  "tools-resources": 4,
  ...overrides,
});

/** A case whose Day 7 survey opened `daysAgo` days ago. */
const caseOpenedAgo = (daysAgo: number, id = "c") => makeCase(-(7 + daysAgo), [], id);

describe("survey availability", () => {
  const c = makeCase(-8, []);

  it("opens on the checkpoint date and stays open for 14 days", () => {
    expect(surveyOpensOn(c.startDate, "day-7")).toBe(addDays(c.startDate, 7));
    expect(surveyOpensOn(c.startDate, "day-90")).toBe(addDays(c.startDate, 90));
    expect(surveyClosesOn(c.startDate, "day-30")).toBe(addDays(c.startDate, 43));
  });

  it("is upcoming before the checkpoint, open from the checkpoint to the last day, then closed", () => {
    expect(surveyState(caseOpenedAgo(-1), "day-7", false, TODAY)).toBe("upcoming");
    expect(surveyState(caseOpenedAgo(0), "day-7", false, TODAY)).toBe("open");
    expect(surveyState(caseOpenedAgo(13), "day-7", false, TODAY)).toBe("open");
    expect(surveyState(caseOpenedAgo(14), "day-7", false, TODAY)).toBe("closed");
    expect(surveyState(caseOpenedAgo(14), "day-7", true, TODAY)).toBe("submitted");
  });

  it("lists every checkpoint with its state for the employee", () => {
    const surveys = getSurveys(c, [], TODAY);
    expect(surveys.map((s) => [s.label, s.state])).toEqual([
      ["Day 7", "open"],
      ["Day 30", "upcoming"],
      ["Day 60", "upcoming"],
      ["Day 90", "upcoming"],
    ]);
  });
});

describe("submitting a survey", () => {
  const c = caseOpenedAgo(1);

  it("saves the response once and refuses a second submission", () => {
    const first = submitSurvey(EMPTY_FEEDBACK, c, "day-7", ratings(), "  Thanks  ", TODAY);
    expect(first.result).toBe("submitted");
    expect(first.feedback.responses).toHaveLength(1);
    expect(first.feedback.responses[0]).toMatchObject({ checkpoint: "day-7", submittedAt: TODAY, comment: "Thanks" });

    const second = submitSurvey(first.feedback, c, "day-7", ratings({ "role-clarity": 1 }), "", TODAY);
    expect(second.result).toBe("already-submitted");
    expect(second.feedback).toBe(first.feedback);
    expect(getSurveys(c, second.feedback.responses, TODAY)[0].state).toBe("submitted");
  });

  it("refuses surveys that are not open and incomplete ratings", () => {
    expect(submitSurvey(EMPTY_FEEDBACK, c, "day-30", ratings(), "", TODAY).result).toBe("not-open");
    expect(submitSurvey(EMPTY_FEEDBACK, caseOpenedAgo(20), "day-7", ratings(), "", TODAY).result).toBe("not-open");
    expect(submitSurvey(EMPTY_FEEDBACK, c, "day-7", { "role-clarity": 3 }, "", TODAY).result).toBe("invalid");
    expect(submitSurvey(EMPTY_FEEDBACK, c, "day-7", ratings({ "role-clarity": 6 }), "", TODAY).result).toBe("invalid");
  });

  it("keeps earlier responses (feedback history)", () => {
    const d = makeCase(-31, []);
    let fb = submitSurvey(EMPTY_FEEDBACK, d, "day-30", ratings(), "", TODAY).feedback;
    fb = { ...fb, responses: [...fb.responses, { ...fb.responses[0], id: "older", checkpoint: "day-7", submittedAt: addDays(TODAY, -23) }] };
    expect(getSurveys(d, fb.responses, TODAY).filter((s) => s.state === "submitted")).toHaveLength(2);
  });
});

describe("insight rule: ratings of 2 or below", () => {
  const c = caseOpenedAgo(1);

  it("suggests one discussion topic per area rated 2 or below", () => {
    expect(LOW_RATING_THRESHOLD).toBe(2);
    const { feedback } = submitSurvey(
      EMPTY_FEEDBACK,
      c,
      "day-7",
      ratings({ "role-clarity": 1, "manager-support": 2, "tools-resources": 3 }),
      "",
      TODAY,
    );
    expect(feedback.topics.map((t) => [t.area, t.status])).toEqual([
      ["role-clarity", "suggested"],
      ["manager-support", "suggested"],
    ]);
  });

  it("suggests nothing when every rating is 3 or above", () => {
    expect(submitSurvey(EMPTY_FEEDBACK, c, "day-7", ratings({ "team-integration": 3 }), "", TODAY).feedback.topics).toEqual([]);
  });

  it("never creates an action, a warning or a risk classification", () => {
    const { feedback } = submitSurvey(
      EMPTY_FEEDBACK,
      c,
      "day-7",
      ratings({ "role-clarity": 1, "learning-development": 1, "manager-support": 1, "team-integration": 1, "tools-resources": 1 }),
      "Everything is hard",
      TODAY,
    );
    expect(feedback.topics).toHaveLength(5);
    expect(feedback.actions).toEqual([]);
    expect(feedback.meetings).toEqual([]);
    expect(JSON.stringify(feedback.topics)).not.toMatch(/warning|risk|performance/i);
  });

  it("stores no rating or comment on the topic", () => {
    const response = submitSurvey(EMPTY_FEEDBACK, c, "day-7", ratings({ "role-clarity": 2 }), "Private words", TODAY).feedback.responses[0];
    const [topic] = suggestTopics(response);
    expect(Object.keys(topic).sort()).toEqual(["area", "caseId", "checkpoint", "createdAt", "id", "responseId", "status"]);
    expect(JSON.stringify(topic)).not.toContain("Private words");
  });
});

describe("employee consent for topics", () => {
  const c = caseOpenedAgo(1);
  const withTopic = (): FeedbackState =>
    submitSurvey(EMPTY_FEEDBACK, c, "day-7", ratings({ "tools-resources": 2 }), "Confidential comment", TODAY).feedback;

  it("keeps suggested and private topics out of shared views", () => {
    const fb = withTopic();
    expect(sharedTopics(fb)).toEqual([]);
    const kept = reviewTopic(fb, fb.topics[0].id, "keep-private", "", TODAY);
    expect(kept.topics[0].status).toBe("private");
    expect(sharedTopics(kept)).toEqual([]);
  });

  it("shares the topic title and the employee's own note, never the rating or comment", () => {
    const fb = withTopic();
    const shared = reviewTopic(fb, fb.topics[0].id, "share", "  Laptop access  ", TODAY);
    expect(sharedTopics(shared)).toEqual([
      {
        id: fb.topics[0].id,
        caseId: "c",
        title: "Tools, access and resources",
        checkpoint: "day-7",
        status: "shared",
        note: "Laptop access",
        sharedOn: TODAY,
      },
    ]);
    expect(JSON.stringify(sharedTopics(shared))).not.toMatch(/Confidential comment|"rating|tools-resources":\s*2/);
  });

  it("lets the employee change their mind until the topic is in use", () => {
    const fb = withTopic();
    const shared = reviewTopic(fb, fb.topics[0].id, "share", "", TODAY);
    expect(isTopicInUse(shared, fb.topics[0].id)).toBe(false);
    const back = reviewTopic(shared, fb.topics[0].id, "keep-private", "", TODAY);
    expect(back.topics[0].status).toBe("private");
    expect(reviewTopic(back, fb.topics[0].id, "share", "", TODAY).topics[0].status).toBe("shared");
  });
});

describe("feedback participation", () => {
  it("is submitted surveys over surveys that have opened", () => {
    const opened = caseOpenedAgo(1, "a");
    const notYet = makeCase(5, [], "b");
    const fb = submitSurvey(EMPTY_FEEDBACK, opened, "day-7", ratings(), "", TODAY).feedback;
    expect(getFeedbackSummary([opened, notYet], fb, TODAY).participation).toEqual({ numerator: 1, denominator: 1, percent: 100 });
    expect(getFeedbackSummary([notYet], EMPTY_FEEDBACK, TODAY).participation.percent).toBeNull();
  });

  it("matches the seeded demo data", () => {
    const cases = createSeedCases(TODAY);
    expect(getFeedbackSummary(cases, createSeedFeedback(cases, TODAY), TODAY)).toEqual({
      participation: { numerator: 12, denominator: 14, percent: 86 },
      upcomingMeetings: 1,
      completedMeetings: 3,
      sharedTopics: 1,
      openActions: 2,
      overdueActions: 1,
    });
  });
});
