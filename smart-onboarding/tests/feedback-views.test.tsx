import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { BookingView } from "@/components/feedback/booking-view";
import { HrCheckInsView } from "@/components/feedback/hr-check-ins-view";
import { HrMeetingView, PortalMeetingView } from "@/components/feedback/meeting-record";
import { PortalFeedbackView } from "@/components/feedback/portal-feedback-view";
import { SurveyView } from "@/components/feedback/survey-view";
import { HomeView } from "@/components/home-view";
import { CaseDetailView } from "@/components/onboarding/case-detail-view";
import { ToastProvider } from "@/components/ui/toast";
import { demoModeStore } from "@/lib/demo-mode";
import { onboardingStore } from "@/lib/onboarding-store";

const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

function renderAt(pathname: string, page: React.ReactNode) {
  nav.pathname = pathname;
  return render(
    <ToastProvider>
      <AppShell>{page}</AppShell>
    </ToastProvider>,
  );
}

const DANIEL = "demo-daniel-okafor";
const fb = () => onboardingStore.getFeedbackSnapshot();
/** The app shell also has a toast region with role="status"; pick the one with this text. */
const statusWith = (text: string) => screen.getAllByRole("status").find((el) => el.textContent?.includes(text))!;
const SOFIA_COMMENT = "Getting access to the reporting workspace took longer than I expected.";
const SOFIA_HR_NOTE = "Check whether other Finance starters had the same access delay.";

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
  demoModeStore._resetForTests();
  nav.push.mockReset();
});

describe("Employee: Feedback & check-ins", () => {
  it("lists surveys by state, explains privacy and is in the portal navigation", () => {
    renderAt("/me/feedback", <PortalFeedbackView />);
    expect(screen.getByRole("heading", { level: 1, name: "Feedback & check-ins" })).toBeInTheDocument();
    const legend = screen.getByRole("region", { name: "What is confidential and what is shared" });
    expect(legend).toHaveTextContent("Your survey ratings and comments");
    expect(legend).toHaveTextContent("never a performance warning or a risk rating");

    const surveys = screen.getByRole("region", { name: "Pulse surveys" });
    const rows = within(surveys).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("Day 7 survey");
    expect(rows[0]).toHaveTextContent("Open");
    expect(rows[1]).toHaveTextContent("Upcoming");
    expect(within(surveys).getByRole("link", { name: "Take the Day 7 survey" })).toHaveAttribute("href", "/me/feedback/survey/day-7");

    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "Feedback & check-ins" })).toHaveAttribute("href", "/me/feedback");
  });

  it("submits the survey once, confirms it and suggests a private topic without creating an action", async () => {
    const user = userEvent.setup();
    renderAt("/me/feedback/survey/day-7", <SurveyView checkpoint="day-7" />);
    await user.click(screen.getByRole("button", { name: "Submit survey" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please rate every statement (5 left).");

    await user.click(screen.getByRole("radio", { name: "Role clarity: 2, Disagree" }));
    for (const area of ["Learning and development", "Manager support", "Team integration", "Tools and resources"]) {
      await user.click(screen.getByRole("radio", { name: `${area}: 4, Agree` }));
    }
    await user.type(screen.getByLabelText(/Anything else you would like to tell us/), "Still learning the acronyms");
    await user.click(screen.getByRole("button", { name: "Submit survey" }));

    const status = statusWith("Thank you, your survey is submitted");
    expect(status).toBeDefined();
    expect(status).toHaveTextContent("One topic was suggested for you to review. Nothing is shared until you decide.");
    expect(screen.queryByRole("button", { name: "Submit survey" })).toBeNull();
    expect(screen.getByText("Still learning the acronyms")).toBeInTheDocument();

    const own = fb();
    expect(own.responses.filter((r) => r.caseId === DANIEL)).toHaveLength(1);
    expect(own.topics.filter((t) => t.caseId === DANIEL).map((t) => [t.area, t.status])).toEqual([["role-clarity", "suggested"]]);
    expect(own.actions.filter((a) => a.caseId === DANIEL)).toEqual([]);
  });

  it("shares a topic only after the employee agrees; HR then sees the title and note, not the rating or comment", async () => {
    const user = userEvent.setup();
    const ratings = { "role-clarity": 1, "learning-development": 4, "manager-support": 4, "team-integration": 4, "tools-resources": 4 };
    onboardingStore.submitSurvey({ role: "new-hire", caseId: DANIEL }, DANIEL, "day-7", ratings, "Daniel's private comment");

    const { unmount } = renderAt("/me/feedback", <PortalFeedbackView />);
    const suggestion = screen.getByRole("article", { name: "Suggested topic: Clarifying expectations for the role" });
    await user.type(within(suggestion).getByLabelText(/Add a few words/), "Which projects are mine");
    await user.click(within(suggestion).getByRole("button", { name: /Share for discussion/ }));
    expect(screen.queryByRole("article", { name: /Suggested topic/ })).toBeNull();
    expect(screen.getByRole("region", { name: "Discussion topics" })).toHaveTextContent("Shared");
    unmount();

    demoModeStore.setRole("hr");
    renderAt("/check-ins", <HrCheckInsView />);
    const topics = screen.getByRole("region", { name: "Approved discussion topics" });
    expect(topics).toHaveTextContent("Clarifying expectations for the role");
    expect(topics).toHaveTextContent("Which projects are mine");
    expect(document.body).not.toHaveTextContent("Daniel's private comment");
  });

  it("books a free slot with a draft agenda and shows it in the employee schedule", async () => {
    const user = userEvent.setup();
    const { unmount } = renderAt("/me/feedback/book", <BookingView />);
    await user.click(screen.getByRole("radio", { name: /Manager check-in/ }));
    const firstSlot = within(screen.getByRole("region", { name: "2. Choose a time" })).getAllByRole("button")[0];
    await user.click(firstSlot);
    expect(firstSlot).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByLabelText(/Anything you would like to discuss/), "My first project");

    const agenda = screen.getByRole("complementary", { name: "Draft agenda" });
    expect(agenda).toHaveTextContent("Support you need");
    expect(agenda).toHaveTextContent("Day 30 milestone");
    expect(agenda).toHaveTextContent("My first project");

    await user.click(screen.getByRole("button", { name: "Book this slot" }));
    expect(statusWith("Check-in booked")).toBeDefined();
    const meeting = fb().meetings.find((m) => m.caseId === DANIEL)!;
    expect(meeting).toMatchObject({ type: "manager", status: "scheduled", hostName: "Priya Raman" });
    unmount();

    renderAt("/", <HomeView />);
    const schedule = screen.getByRole("region", { name: "Your schedule" });
    expect(schedule).toHaveTextContent(`Manager check-in`);
    expect(schedule).toHaveTextContent(`at ${meeting.time} · with Priya Raman`);
    expect(screen.getByRole("region", { name: "Feedback & check-ins" })).toHaveTextContent("Manager check-in with Priya Raman");
  });

  it("asks for a follow-up after an action is completed and allows reopening when it did not help", async () => {
    const user = userEvent.setup();
    demoModeStore.previewCase("demo-ines-duarte");
    renderAt("/me/feedback", <PortalFeedbackView />);
    const card = screen.getByRole("article", { name: "Action: Join the weekly design critique" });
    expect(card).toHaveTextContent("Overdue");
    await user.selectOptions(within(card).getByRole("combobox", { name: /Status of/ }), "Completed");
    await user.click(within(card).getByRole("button", { name: "No, it did not help" }));
    expect(card).toHaveTextContent("Follow-up: No, it did not help");
    await user.click(within(card).getByRole("button", { name: "Reopen action" }));
    expect(card).toHaveTextContent("Reopened");
    const action = fb().actions.find((a) => a.caseId === "demo-ines-duarte")!;
    expect(action).toMatchObject({ status: "Open", reopenCount: 1 });
    expect(action.followUps.map((f) => f.response)).toEqual(["not-helped"]);
  });

  it("shows the agreed outcome but never the HR-only note in the portal", () => {
    demoModeStore.previewCase("demo-sofia-marin");
    const meeting = fb().meetings.find((m) => m.caseId === "demo-sofia-marin")!;
    renderAt(`/me/feedback/meetings/${meeting.id}`, <PortalMeetingView meetingId={meeting.id} />);
    expect(screen.getByRole("region", { name: "Agreed outcome" })).toHaveTextContent("walkthrough with the analytics team");
    expect(document.body).not.toHaveTextContent(SOFIA_HR_NOTE);
    expect(screen.queryByRole("region", { name: "HR-only note" })).toBeNull();
  });
});

describe("HR: Feedback & check-ins", () => {
  beforeEach(() => demoModeStore.setRole("hr"));

  it("shows participation, check-ins, approved topics and open actions without confidential content", () => {
    renderAt("/check-ins", <HrCheckInsView />);
    const participation = screen.getByRole("group", { name: "Feedback participation" });
    expect(participation).toHaveTextContent("86%");
    expect(participation).toHaveTextContent("12 of 14 opened surveys submitted");
    expect(screen.getByRole("group", { name: "Upcoming check-ins" })).toHaveTextContent("1");
    expect(screen.getByRole("group", { name: "Overdue actions" })).toHaveTextContent("1");

    const upcoming = screen.getByRole("region", { name: "Upcoming check-ins" });
    expect(upcoming).toHaveTextContent("Marcus Bell");
    expect(upcoming).toHaveTextContent("Marcus and Hannah Olsen");
    expect(screen.getByRole("region", { name: "Approved discussion topics" })).toHaveTextContent("A licence for the prototyping tool");
    expect(screen.getByRole("region", { name: "Open and overdue actions" })).toHaveTextContent("Join the weekly design critique");
    expect(screen.getByRole("region", { name: "Meeting records" })).toHaveTextContent("Sofia Marin");

    // Confidential content stays out of the overview.
    expect(document.body).not.toHaveTextContent(SOFIA_COMMENT);
    expect(document.body).not.toHaveTextContent(SOFIA_HR_NOTE);
    expect(document.body).not.toHaveTextContent("Settling into the team"); // Marcus has not shared it

    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "Check-ins" })).toHaveAttribute("href", "/check-ins");
  });

  it("hides raw survey answers on the case page until HR chooses to show them", async () => {
    const user = userEvent.setup();
    renderAt("/onboarding/demo-sofia-marin", <CaseDetailView id="demo-sofia-marin" />);
    const section = screen.getByRole("region", { name: "Feedback & check-ins" });
    expect(section).toHaveTextContent("Day 30: Submitted");
    expect(document.body).not.toHaveTextContent(SOFIA_COMMENT);
    await user.click(within(section).getByRole("button", { name: "Show confidential answers" }));
    expect(section).toHaveTextContent(SOFIA_COMMENT);
    expect(section).toHaveTextContent("A low rating is not a performance warning or a risk rating.");
  });

  it("shows the HR-only note in the meeting record and refuses an action that duplicates a task", async () => {
    const user = userEvent.setup();
    const meeting = fb().meetings.find((m) => m.caseId === "demo-sofia-marin")!;
    renderAt(`/check-ins/${meeting.id}`, <HrMeetingView meetingId={meeting.id} />);
    expect(screen.getByRole("region", { name: "HR-only note" })).toHaveTextContent(SOFIA_HR_NOTE);
    expect(screen.getByRole("region", { name: "Agreed actions" })).toHaveTextContent("Linked onboarding task: Set up system and application access");

    const form = screen.getByRole("form", { name: "Agree an action" });
    await user.type(within(form).getByLabelText(/Description/), "Set up system and application access");
    await user.click(within(form).getByRole("button", { name: "Add action" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("This is already an onboarding task.");

    await user.selectOptions(within(form).getByLabelText(/Link to an existing onboarding task/), "demo-sofia-marin--system-access");
    await user.click(within(form).getByRole("button", { name: "Add action" }));
    expect(within(form).getByRole("status")).toHaveTextContent("Action added");
    expect(fb().actions.filter((a) => a.caseId === "demo-sofia-marin")).toHaveLength(2);
  });

  it("waits for the meeting date before an outcome can be recorded", () => {
    const meeting = fb().meetings.find((m) => m.caseId === "demo-marcus-bell")!;
    renderAt(`/check-ins/${meeting.id}`, <HrMeetingView meetingId={meeting.id} />);
    expect(screen.getByText(/The outcome can be recorded on or after/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Record the outcome" })).toBeNull();
    expect(screen.getByRole("textbox", { name: "Add a shared agenda point" })).toBeInTheDocument();
  });
});
