/**
 * Task due dates and lead-time starts (§6.3, §6.4) for every offset unit:
 *
 * - `workingDays`: from the anchor's local date by `amount` working days with the §6.2a convention (anchor
 *   date = position 0). The time is the template's `dueTime`, or the anchor's local time.
 * - `calendarDays`: by calendar dates; a result that is not a working day moves to the previous working day.
 *   Same time rule as working days.
 * - `hours` / `minutes`: the exact elapsed duration from the anchor instant (event playbooks).
 *
 * Working hours are never consulted, so changing them cannot move a due date (§6.1a, T21).
 */
import { addCalendarDays, localDateOf, localTimeOf, zonedToUtc } from "../calendar/dates";
import { addWorkingDays, isWorkingDay, NoWorkingDayError, previousWorkingDay, type WorkingDayCalendar } from "../calendar/working-days";
import { DomainError } from "../domain/errors";
import type { ISODateTime, Offset, TaskTemplate } from "../domain/types";

const MS_PER_MINUTE = 60_000;

/** True for units counted on calendar dates rather than as a duration. */
export function isDayUnit(offset: Offset): boolean {
  return offset.unit === "workingDays" || offset.unit === "calendarDays";
}

function withTime(date: string, time: string): ISODateTime {
  return zonedToUtc(date, time);
}

/** The local date an offset gives from an anchor date (day units only). */
function offsetDate(calendar: WorkingDayCalendar, anchorDate: string, offset: Offset): string {
  if (offset.unit === "workingDays") return addWorkingDays(calendar, anchorDate, offset.amount);
  const date = addCalendarDays(anchorDate, offset.amount);
  return isWorkingDay(calendar, date) ? date : previousWorkingDay(calendar, date);
}

function guard<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof NoWorkingDayError) throw new DomainError("no-working-day", error.message);
    if (error instanceof RangeError) throw new DomainError("invalid-schedule", error.message);
    throw error;
  }
}

/** Due instant of a task template for an anchor (§6.3). */
export function resolveDueAt(anchorAt: ISODateTime, template: Pick<TaskTemplate, "offset" | "dueTime">, calendar: WorkingDayCalendar): ISODateTime {
  const { offset } = template;
  if (offset.unit === "minutes" || offset.unit === "hours") {
    const minutes = offset.unit === "hours" ? offset.amount * 60 : offset.amount;
    return new Date(new Date(anchorAt).getTime() + minutes * MS_PER_MINUTE).toISOString();
  }
  if (!isDayUnit(offset)) throw new DomainError("offset-unit-unsupported", String(offset.unit));
  return guard(() => withTime(offsetDate(calendar, localDateOf(anchorAt), offset), template.dueTime ?? localTimeOf(anchorAt)));
}

/**
 * The instant a lead time before the anchor starts (`anchor − leadTime`, §6.4). Duration units are exact.
 * Day units count back from the anchor date with the same conventions and start at 00:00 local on that
 * date, so a 10-working-day lead time makes the occurrence active from the start of that working day.
 */
export function leadTimeStartAt(anchorAt: ISODateTime, leadTime: Offset, calendar: WorkingDayCalendar): ISODateTime {
  const back: Offset = { amount: -Math.abs(leadTime.amount), unit: leadTime.unit };
  if (!isDayUnit(leadTime)) return resolveDueAt(anchorAt, { offset: back }, calendar);
  return guard(() => withTime(offsetDate(calendar, localDateOf(anchorAt), back), "00:00"));
}
