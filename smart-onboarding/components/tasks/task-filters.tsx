"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchInput, SelectInput } from "@/components/ui/form-controls";
import type { OwnerFilter, RequirementFilter, StatusFilter } from "@/lib/metrics";
import { TASK_OWNERS, TASK_STATUSES } from "@/types/onboarding";

export type TaskFilterState = {
  status: StatusFilter;
  owner: OwnerFilter;
  requirement: RequirementFilter;
  query: string;
};

export const DEFAULT_TASK_FILTERS: TaskFilterState = {
  status: "All",
  owner: "All",
  requirement: "All",
  query: "",
};

const STATUS_OPTIONS: StatusFilter[] = ["All", ...TASK_STATUSES, "Overdue"];
const OWNER_OPTIONS: OwnerFilter[] = ["All", ...TASK_OWNERS];

export function TaskFilters({
  value,
  onChange,
  searchPlaceholder,
  idPrefix,
}: {
  value: TaskFilterState;
  onChange: (next: TaskFilterState) => void;
  /** When omitted, the search box is hidden. */
  searchPlaceholder?: string;
  idPrefix: string;
}) {
  const isFiltered =
    value.status !== "All" ||
    value.owner !== "All" ||
    value.requirement !== "All" ||
    value.query.trim() !== "";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {searchPlaceholder ? (
        <SearchInput
          aria-label="Search tasks"
          placeholder={searchPlaceholder}
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value })}
          className="sm:w-64"
        />
      ) : null}
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <label htmlFor={`${idPrefix}-status`} className="sr-only">
          Filter by status
        </label>
        <SelectInput
          id={`${idPrefix}-status`}
          size="sm"
          value={value.status}
          onChange={(event) => onChange({ ...value, status: event.target.value as StatusFilter })}
          className="sm:w-40"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "All" ? "All statuses" : option}
            </option>
          ))}
        </SelectInput>
        <label htmlFor={`${idPrefix}-owner`} className="sr-only">
          Filter by owner
        </label>
        <SelectInput
          id={`${idPrefix}-owner`}
          size="sm"
          value={value.owner}
          onChange={(event) => onChange({ ...value, owner: event.target.value as OwnerFilter })}
          className="sm:w-48"
        >
          {OWNER_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option === "All" ? "All owners" : option}
            </option>
          ))}
        </SelectInput>
        <label htmlFor={`${idPrefix}-requirement`} className="sr-only">
          Filter by requirement
        </label>
        <SelectInput
          id={`${idPrefix}-requirement`}
          size="sm"
          value={value.requirement}
          onChange={(event) =>
            onChange({ ...value, requirement: event.target.value as RequirementFilter })
          }
          className="col-span-2 sm:w-44"
        >
          <option value="All">Mandatory &amp; optional</option>
          <option value="Mandatory">Mandatory only</option>
          <option value="Optional">Optional only</option>
        </SelectInput>
      </div>
      {isFiltered ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(DEFAULT_TASK_FILTERS)}>
          <X aria-hidden />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
