/** Rejected actions (§4.4). Every code maps to `error.<code>` in the message catalogue. */

export const DOMAIN_ERROR_CODES = [
  "occurrence-not-found",
  "operation-not-found",
  "task-not-found",
  "playbook-not-found",
  "playbook-not-available",
  "occurrence-closed",
  "task-resolved",
  "task-not-resolved",
  "task-not-on-hold",
  "invalid-hold",
  "no-fallback",
  "essential-unassigned",
  "unknown-assignee",
  "same-assignee",
  "owner-not-person",
  "backup-equals-owner",
  "backup-required",
  "duplicate-id",
  "outcome-not-allowed",
  "note-required",
  "note-too-long",
  "invalid-instant",
  "offset-unit-unsupported",
  "cancel-one-off-only",
  "invalid-status",
  // M2
  "invalid-schedule",
  "invalid-calendar",
  "invalid-date",
  "not-recurring",
  "non-working-day",
  "no-drift",
  "no-working-day",
] as const;

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number];

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DomainError";
  }
}
