/**
 * Playbooks shipped with the app (read-only in the MVP, §9.4).
 *
 * M1 ships only Training Session v2 (Appendix A.1): the seven existing tasks unchanged, offsets converted
 * to minutes and responsibilities mapped as in §11.3. Payroll and HR Reporting (A.2, A.3) are authored in M5.
 */
import type { Playbook, RoleRef } from "./types";

export const TRAINING_PLAYBOOK_ID = "training-session";
export const TRAINING_PLAYBOOK_VERSION = 2;

/** Counterparty IDs of the synthetic seed (Appendix B). */
export const COUNTERPARTY_IDS = {
  finance: "cp-finance",
  salesOps: "cp-sales-ops",
  lineManagers: "cp-line-managers",
  it: "cp-it",
  facilities: "cp-facilities",
  payrollProvider: "cp-payroll-provider",
  hrisVendor: "cp-hris-vendor",
  worksCouncil: "cp-works-council",
  trainer: "cp-trainer",
} as const;

/**
 * The v2 `ownerRole` → v3 responsible mapping (§11.3). HR roles resolve to the occurrence owner,
 * Facilities, IT and Trainer to their counterparties.
 */
export function responsibleForLegacyRole(ownerRole: string): RoleRef {
  switch (ownerRole.trim()) {
    case "Facilities":
      return { kind: "counterparty", counterpartyId: COUNTERPARTY_IDS.facilities };
    case "IT":
      return { kind: "counterparty", counterpartyId: COUNTERPARTY_IDS.it };
    case "Trainer":
      return { kind: "counterparty", counterpartyId: COUNTERPARTY_IDS.trainer };
    default:
      // "HR", "HR / Trainer" and any other HR label.
      return { kind: "owner" };
  }
}

const DAY = 24 * 60;

export const TRAINING_SESSION_V2: Playbook = {
  id: TRAINING_PLAYBOOK_ID,
  version: TRAINING_PLAYBOOK_VERSION,
  title: "Training session",
  area: "LD",
  status: "available",
  purpose: "Coordinate trainer, participants, room, IT setup and session materials.",
  trigger: "A training session is scheduled.",
  anchorKind: "event-start",
  anchorLabel: "Training starts",
  leadTime: { amount: 7 * 24, unit: "hours" },
  attentionWindow: { amount: 24, unit: "hours" },
  recoveryWindow: { amount: 60, unit: "minutes" },
  completionCriteria: [
    "Trainer and session content confirmed.",
    "Participant list confirmed.",
    "Room or virtual meeting confirmed.",
    "IT and presentation setup checked.",
  ],
  tasks: [
    {
      id: "trainer-confirmed",
      title: "Confirm trainer and session content",
      description: "Confirm the trainer, agenda and expected session format.",
      offset: { amount: -7 * DAY, unit: "minutes" },
      ownerRole: "HR / Trainer",
      responsible: { kind: "owner" },
      criticality: "essential",
      estimatedMinutes: 3,
      dependsOn: [],
      fallback: "Use an internal facilitator or agree a new session time.",
    },
    {
      id: "participants-confirmed",
      title: "Confirm participant list",
      description: "Check the audience and make sure the right people are invited.",
      offset: { amount: -5 * DAY, unit: "minutes" },
      ownerRole: "HR",
      responsible: { kind: "owner" },
      criticality: "essential",
      estimatedMinutes: 5,
      dependsOn: [],
      fallback: "Use the existing registration list and brief the trainer on any gaps.",
    },
    {
      id: "room-confirmed",
      title: "Confirm room or virtual meeting",
      description: "Make sure a suitable room or meeting link is available.",
      offset: { amount: -3 * DAY, unit: "minutes" },
      ownerRole: "Facilities",
      responsible: { kind: "counterparty", counterpartyId: COUNTERPARTY_IDS.facilities },
      criticality: "essential",
      estimatedMinutes: 8,
      dependsOn: [],
      fallback: "Switch to an available alternative room or a virtual format.",
    },
    {
      id: "it-setup",
      title: "Check IT and presentation setup",
      description: "Confirm screen, audio, connection and access to the presentation.",
      offset: { amount: -DAY, unit: "minutes" },
      ownerRole: "IT",
      responsible: { kind: "counterparty", counterpartyId: COUNTERPARTY_IDS.it },
      criticality: "essential",
      estimatedMinutes: 12,
      dependsOn: ["room-confirmed"],
      fallback: "Use a laptop with a local copy of the materials and a simple screen-share fallback.",
    },
    {
      id: "participant-reminder",
      title: "Send a concise participant reminder",
      description: "Share the time, location or link and any short joining instructions.",
      offset: { amount: -DAY, unit: "minutes" },
      ownerRole: "HR",
      responsible: { kind: "owner" },
      criticality: "important",
      estimatedMinutes: 5,
      dependsOn: ["participants-confirmed"],
      fallback: "Send a short plain-text reminder with the essential joining details.",
    },
    {
      id: "materials-ready",
      title: "Prepare session materials",
      description: "Make the presentation and handouts available to the trainer.",
      offset: { amount: -DAY, unit: "minutes" },
      ownerRole: "HR / Trainer",
      responsible: { kind: "owner" },
      criticality: "important",
      estimatedMinutes: 15,
      dependsOn: ["trainer-confirmed"],
      fallback: "Use the trainer's existing standard deck and skip new handouts.",
    },
    {
      id: "attendance-followup",
      title: "Prepare attendance and feedback follow-up",
      description: "Have a simple way to record attendance and collect feedback after the session.",
      offset: { amount: 45, unit: "minutes" },
      ownerRole: "HR",
      responsible: { kind: "owner" },
      criticality: "optional",
      estimatedMinutes: 10,
      dependsOn: [],
      fallback: "Record attendance after the session and send feedback later.",
    },
  ],
};

/** The playbook collection stored in every v3 store. */
export function shippedPlaybooks(): Playbook[] {
  return [structuredClone(TRAINING_SESSION_V2)];
}
