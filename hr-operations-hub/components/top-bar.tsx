"use client";

import { Hourglass, Menu, RotateCcw, ShieldAlert, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { EXCEPTION_FILTERS, FILTER_PARAM, filterHref, getExceptionCounts, parseExceptionFilter, type ExceptionFilter } from "@/lib/shell";
import { useHubStore } from "./hub-store";
import { ThemeToggle } from "./theme";
import { formatDate, formatTime, formatWeekday } from "./ui";

/** The five sections, in the order fixed by D2 / section 3. */
export const NAV_SECTIONS = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Calendar" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/people", label: "People" },
  { href: "/playbooks", label: "Playbooks" },
] as const;

export const CURRENT_USER = { name: "Sophie Lang", role: "HR Generalist", initials: "SL" } as const;

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/" || pathname === "/today";
  return pathname === href || pathname.startsWith(`${href}/`);
}

const FILTER_ICON: Record<ExceptionFilter, typeof TriangleAlert> = {
  overdue: TriangleAlert,
  "at-risk": ShieldAlert,
  waiting: Hourglass,
};

export function ExceptionStrip({ active }: { active: ExceptionFilter | null }) {
  const { activities, now, hydrated } = useHubStore();
  const counts = useMemo(() => getExceptionCounts(activities, now), [activities, now]);
  return (
    <nav className="exception-strip" aria-label="Exceptions">
      {EXCEPTION_FILTERS.map((filter) => {
        const Icon = FILTER_ICON[filter.id];
        const count = hydrated ? counts[filter.id] : null;
        const zero = count === 0;
        return (
          <Link
            key={filter.id}
            href={filterHref(filter.id)}
            className={`exception exception-${filter.id} ${zero || count === null ? "is-zero" : ""} ${active === filter.id ? "is-active" : ""}`}
            aria-current={active === filter.id ? "page" : undefined}
            aria-label={`${filter.label}: ${count ?? "loading"}. ${filter.description}. Show in Today.`}
            title={`${filter.description} — show in Today`}
            data-testid={`exception-${filter.id}`}
          >
            <Icon size={13} aria-hidden />
            <span className="exception-label">{filter.short}<span className="label-extra">{filter.label.slice(filter.short.length)}</span></span>
            <span className="exception-count mono">{count ?? "–"}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function ExceptionStripFromUrl() {
  const pathname = usePathname();
  const params = useSearchParams();
  const active = pathname === "/" || pathname === "/today" ? parseExceptionFilter(params.get(FILTER_PARAM)) : null;
  return <ExceptionStrip active={active} />;
}

export function DemoClock() {
  const { now, hydrated } = useHubStore();
  return (
    <div className="demo-clock" aria-label={hydrated ? `Demo clock: ${formatWeekday(now)} ${formatDate(now)}, ${formatTime(now)}` : "Demo clock"}>
      <span className="label">Demo</span>
      <span className="mono">
        {hydrated ? <><span className="clock-day">{formatWeekday(now)} </span><span className="clock-date">{formatDate(now)} · </span>{formatTime(now)}</> : "–"}
      </span>
    </div>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { resetDemo } = useHubStore();
  const [menuOpen, setMenuOpen] = useState(false);

  function reset() {
    resetDemo();
    setMenuOpen(false);
    router.push("/");
  }

  const navLinks = (onNavigate?: () => void) =>
    NAV_SECTIONS.map((section) => {
      const active = isActive(section.href, pathname);
      return (
        <Link
          key={section.href}
          href={section.href}
          className={`nav-link ${active ? "is-active" : ""}`}
          aria-current={active ? "page" : undefined}
          onClick={onNavigate}
        >
          {section.label}
        </Link>
      );
    });

  return (
    <header className="top-bar">
      <Link href="/" className="product-mark" aria-label="HR Operations Hub — Today">
        <span className="product-glyph" aria-hidden>OH</span>
        <span className="product-name">Operations Hub</span>
      </Link>

      <nav className="primary-nav" aria-label="Main navigation">{navLinks()}</nav>

      <div className="strip-slot">
        <Suspense fallback={<ExceptionStrip active={null} />}>
          <ExceptionStripFromUrl />
        </Suspense>
      </div>

      <div className="top-bar-tools">
        <DemoClock />
        <button className="btn btn-ghost btn-sm reset-button" type="button" onClick={reset}>
          <RotateCcw size={13} aria-hidden /> <span className="reset-label">Reset demo</span>
        </button>
        <ThemeToggle />
        <button
          type="button"
          className="icon-button menu-button"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={16} aria-hidden /> : <Menu size={16} aria-hidden />}
        </button>
      </div>

      <div className="user-chip" title={`${CURRENT_USER.name} · ${CURRENT_USER.role} (simulated)`}>
        <span className="avatar" aria-hidden>{CURRENT_USER.initials}</span>
        <span className="user-name">{CURRENT_USER.name} · {CURRENT_USER.role}</span>
      </div>

      {menuOpen && (
        <div className="mobile-menu" id="mobile-menu">
          <nav aria-label="Main navigation (menu)">{navLinks(() => setMenuOpen(false))}</nav>
          <div className="mobile-menu-foot">
            <span>{CURRENT_USER.name} · {CURRENT_USER.role}</span>
            <button className="btn btn-outline btn-sm" type="button" onClick={reset}>
              <RotateCcw size={13} aria-hidden /> Reset demo
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
