import { CalendarDays, Eye, Lock, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { formatRelative, parseISODate } from "@/lib/dates";
import type { PortalContact, Schedule, ScheduleEvent } from "@/lib/portal";

export function ContactsCard({ contacts }: { contacts: PortalContact[] }) {
  return (
    <Card aria-labelledby="portal-people">
      <CardHeader id="portal-people" title="Your people" description="Who to ask, and what about" icon={<Users />} />
      <ul className="divide-y divide-line px-5">
        {contacts.map((contact) => (
          <li key={contact.kind} className="flex items-start gap-3 py-3.5">
            <Avatar name={contact.name} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{contact.name}</p>
              <p className="text-xs font-medium text-accent-strong">{contact.role}</p>
              <p className="mt-1 text-xs text-muted">{contact.helpsWith}</p>
              {!contact.introduced ? (
                <Badge tone="info" className="mt-1.5">
                  Introduction being arranged
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Fictional people. Contact details are not part of this demo.
      </p>
    </Card>
  );
}

const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "short" });

function DateBlock({ date }: { date: string }) {
  const parsed = parseISODate(date);
  return (
    <span
      aria-hidden
      className="flex size-11 shrink-0 flex-col items-center justify-center rounded-lg bg-subtle ring-1 ring-line"
    >
      <span className="text-[10px] font-semibold text-accent uppercase">{parsed ? monthFormatter.format(parsed) : ""}</span>
      <span className="text-base leading-none font-semibold text-ink tabular-nums">{parsed?.getDate()}</span>
    </span>
  );
}

function EventRow({ event, today }: { event: ScheduleEvent; today: string }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <DateBlock date={event.date} />
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{event.title}</p>
        <p className="text-xs text-muted">
          <time dateTime={event.date}>{formatRelative(event.date, today)}</time>
          {event.time ? <> at {event.time}</> : null} · with {event.with}
        </p>
      </div>
    </li>
  );
}

export function ScheduleCard({ schedule, today }: { schedule: Schedule; today: string }) {
  const upcoming = schedule.upcoming.slice(0, 5);
  return (
    <Card aria-labelledby="portal-schedule">
      <CardHeader id="portal-schedule" title="Your schedule" description="Meetings and sessions planned for you" icon={<CalendarDays />} />
      <div className="px-5 py-2">
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-line">
            {upcoming.map((event) => (
              <EventRow key={event.id} event={event} today={today} />
            ))}
          </ul>
        ) : (
          <p className="py-3 text-sm text-muted">Nothing else is planned yet.</p>
        )}
        {schedule.past.length > 0 ? (
          <details className="group border-t border-line py-2">
            <summary className="cursor-pointer rounded text-xs font-medium text-accent hover:text-accent-strong">
              Earlier ({schedule.past.length})
            </summary>
            <ul className="divide-y divide-line opacity-80">
              {schedule.past.slice(0, 6).map((event) => (
                <EventRow key={event.id} event={event} today={today} />
              ))}
            </ul>
          </details>
        ) : null}
      </div>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Check-ins you book show their time; other sessions are planned by date. No calendar invites are sent.
      </p>
    </Card>
  );
}

/** Explains, in plain words, what the employee's information is used for and who sees it. */
export function PrivacyCard() {
  return (
    <Card aria-labelledby="portal-privacy" className="bg-subtle">
      <CardHeader id="portal-privacy" title="About your information" icon={<Eye />} className="bg-transparent" />
      <ul className="space-y-3 px-5 py-4 text-sm text-ink-soft">
        <li className="flex gap-2.5">
          <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            <strong className="font-semibold text-ink">Shared with your onboarding team:</strong> the progress of your
            steps, so HR, your manager, IT and others can get you set up.
          </span>
        </li>
        <li className="flex gap-2.5">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            <strong className="font-semibold text-ink">Not shown here:</strong> HR&apos;s internal notes about delays.
            Your HR partner keeps you informed.
          </span>
        </li>
        <li className="flex gap-2.5">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            <strong className="font-semibold text-ink">Confidential:</strong> your survey answers and comments. Only topics
            you choose to share reach your check-ins.
          </span>
        </li>
      </ul>
      <p className="border-t border-line px-5 py-3 text-xs text-muted">
        Simulated preview: no sign-in, no real access control. Everything is stored in this browser.
      </p>
    </Card>
  );
}
