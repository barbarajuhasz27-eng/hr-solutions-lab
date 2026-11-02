import { CalendarDays, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { formatRelative, formatShortDate } from "@/lib/dates";
import { completionPercent, UPCOMING_START_WINDOW_DAYS } from "@/lib/metrics";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function UpcomingStarts({ cases, today }: { cases: OnboardingCase[]; today: ISODate }) {
  return (
    <Card aria-labelledby="upcoming-heading" className="flex flex-col">
      <CardHeader
        id="upcoming-heading"
        icon={<CalendarDays />}
        title="Upcoming starts"
        description={`Starting in the next ${UPCOMING_START_WINDOW_DAYS} days.`}
      />
      {cases.length === 0 ? (
        <EmptyState
          icon={<CalendarPlus />}
          title="No upcoming starts"
          description="Nobody is scheduled to start in the next 30 days."
          action={
            <ButtonLink href="/onboarding/new" variant="secondary" size="sm">
              New onboarding
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/onboarding/${c.id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-subtle"
              >
                <Avatar name={c.employeeName} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{c.employeeName}</p>
                  <p className="truncate text-xs text-muted">
                    {c.jobTitle} · {c.department}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-ink tabular-nums">
                    <time dateTime={c.startDate}>{formatShortDate(c.startDate)}</time>
                  </p>
                  <p className="text-xs text-muted">
                    {formatRelative(c.startDate, today)} · {completionPercent(c.tasks)}% ready
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
