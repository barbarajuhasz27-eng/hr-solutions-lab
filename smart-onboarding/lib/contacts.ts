import type { CaseContacts, SupportContact } from "@/types/onboarding";

/** Fictional People Partners. Names are synthetic. */
const HR_PARTNERS: readonly SupportContact[] = [
  { name: "Clara Mendes", role: "People Partner" },
  { name: "Jonah Whitaker", role: "People Partner" },
  { name: "Amara Osei", role: "People Partner" },
];

/** Fictional onboarding buddies. Names are synthetic. */
const BUDDIES: readonly SupportContact[] = [
  { name: "Felix Andersen", role: "Onboarding buddy" },
  { name: "Lucía Romero", role: "Onboarding buddy" },
  { name: "Kwame Asante", role: "Onboarding buddy" },
  { name: "Mei Lin", role: "Onboarding buddy" },
  { name: "Oskar Nilsson", role: "Onboarding buddy" },
];

function hash(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Deterministic default contacts for a case, used for new cases and when upgrading data
 * saved before contacts existed. The same case always gets the same people.
 */
export function defaultContacts(caseId: string, department: string): CaseContacts {
  return {
    hrPartner: { ...HR_PARTNERS[hash(caseId) % HR_PARTNERS.length] },
    buddy: { ...BUDDIES[hash(`${department}:${caseId}`) % BUDDIES.length] },
  };
}
