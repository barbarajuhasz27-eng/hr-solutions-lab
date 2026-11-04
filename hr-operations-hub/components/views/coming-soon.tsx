import { CalendarRange, LayoutList, UsersRound } from "lucide-react";
import { EmptyState, PageHeader } from "../ui";

/**
 * Honest placeholders for sections whose content depends on later milestones (section 12).
 * They show no sample or illustrative data.
 */
const SECTIONS = {
  calendar: {
    title: "Calendar",
    milestone: "M7",
    icon: CalendarRange,
    summary: "All occurrences over time, with working-day-aware schedules.",
    planned: [
      "A 13-week cut-off timeline and a month view of every occurrence.",
      "Generated, projected, moved, skipped and carried-over occurrences shown distinctly.",
      "Working-time settings: working week, working hours, public holidays and company closures.",
    ],
    dependsOn: "It needs the occurrence model (M1) and the working-time and schedule engine (M2).",
  },
  portfolio: {
    title: "Portfolio",
    milestone: "M6",
    icon: LayoutList,
    summary: "Every recurring and one-off operation the team is responsible for.",
    planned: [
      "Operations grouped by area, with cadence, owner and backup, and the next anchor.",
      "The current occurrence state and a short history of past outcomes.",
      "Operation detail with the schedule rule, a preview of the next anchors and ownership.",
    ],
    dependsOn: "It needs operations and schedules (M1, M2) and responsibility rules (M4).",
  },
  people: {
    title: "People",
    milestone: "M9",
    icon: UsersRound,
    summary: "Responsibilities per person and counterparty, unavailability and cover.",
    planned: [
      "What each person owns and backs up, and their task load for the next four weeks.",
      "Marking someone unavailable (dates only) and handing work over to the backup.",
      "A queue of unassigned non-essential tasks.",
    ],
    dependsOn: "It needs people, counterparties, backup and cover logic (M4).",
  },
} as const;

export function ComingSoonView({ section }: { section: keyof typeof SECTIONS }) {
  const content = SECTIONS[section];
  const Icon = content.icon;
  return (
    <>
      <PageHeader eyebrow={`Coming in ${content.milestone}`} title={content.title} description={content.summary} />
      <EmptyState
        icon={<Icon size={22} aria-hidden />}
        kicker={`Coming in ${content.milestone}`}
        title={`${content.title} is not built yet`}
        links={[{ href: "/", label: "Go to Today", primary: true }, { href: "/playbooks", label: "Open Playbooks" }]}
      >
        <p>This section arrives in milestone {content.milestone}. {content.dependsOn} It intentionally shows no sample data until then.</p>
        <ul className="planned-list">
          {content.planned.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </EmptyState>
    </>
  );
}
