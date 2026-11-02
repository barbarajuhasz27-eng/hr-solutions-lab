"use client";

import {
  HeartPulse,
  BarChart3,
  GraduationCap,
  MessagesSquare,
  Home,
  LayoutDashboard,
  ListChecks,
  Menu,
  RotateCcw,
  Route,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserPlus,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DemoModeBar } from "@/components/demo-mode-switch";
import { PreviewGate } from "@/components/preview-gate";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ToastProvider, useToast } from "@/components/ui/toast";
import type { PreviewRole } from "@/lib/access";
import { cn } from "@/lib/cn";
import { useDemoPreview } from "@/lib/use-demo-preview";
import { onboardingActions } from "@/lib/use-onboarding";

type NavItem = { href: string; label: string; icon: typeof Home; isActive: (path: string) => boolean };

const PORTAL_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, isActive: (path: string) => path === "/" },
  {
    href: "/me/journey",
    label: "My journey",
    icon: Route,
    isActive: (path: string) => path.startsWith("/me/journey"),
  },
  {
    href: "/me/learning",
    label: "Learning",
    icon: GraduationCap,
    isActive: (path: string) => path.startsWith("/me/learning"),
  },
  {
    href: "/me/feedback",
    label: "Feedback & check-ins",
    icon: MessagesSquare,
    isActive: (path: string) => path.startsWith("/me/feedback"),
  },
];

const HR_NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    isActive: (path: string) => path === "/" || (path.startsWith("/onboarding/") && path !== "/onboarding/new"),
  },
  {
    href: "/readiness",
    label: "Readiness & risk",
    icon: ShieldCheck,
    isActive: (path: string) => path.startsWith("/readiness"),
  },
  {
    href: "/insights",
    label: "Process insights",
    icon: BarChart3,
    isActive: (path: string) => path.startsWith("/insights"),
  },
  {
    href: "/experience",
    label: "Experience",
    icon: HeartPulse,
    isActive: (path: string) => path.startsWith("/experience"),
  },
  {
    href: "/learning",
    label: "Learning",
    icon: GraduationCap,
    isActive: (path: string) => path.startsWith("/learning"),
  },
  {
    href: "/check-ins",
    label: "Check-ins",
    icon: MessagesSquare,
    isActive: (path: string) => path.startsWith("/check-ins"),
  },
  { href: "/tasks", label: "All tasks", icon: ListChecks, isActive: (path: string) => path.startsWith("/tasks") },
  {
    href: "/onboarding/new",
    label: "New onboarding",
    icon: UserPlus,
    isActive: (path: string) => path === "/onboarding/new",
  },
];

const WORKSPACE_LABEL: Record<PreviewRole, string> = {
  "new-hire": "Employee Portal",
  hr: "People Operations Workspace",
};

function Brand() {
  const preview = useDemoPreview();
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-white shadow-sm">
        <Sprout aria-hidden className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-ink">Smart Onboarding</span>
        <span className="block text-xs text-muted">{preview ? WORKSPACE_LABEL[preview.role] : " "}</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const preview = useDemoPreview();
  const items = preview === null ? [] : preview.role === "hr" ? HR_NAV_ITEMS : PORTAL_NAV_ITEMS;
  return (
    <nav aria-label="Main">
      {preview ? (
        <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-muted uppercase">
          {preview.role === "hr" ? "HR workspace" : "My onboarding"}
        </p>
      ) : null}
      <ul className="space-y-1">
        {items.map(({ href, label, icon: Icon, isActive }) => {
          const active = isActive(pathname);
          return (
            <li key={href}>
              <Link
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent-strong"
                    : "text-ink-soft hover:bg-ink/5 hover:text-ink",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DemoPanel({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-xl border border-line bg-subtle p-4">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-ink uppercase">
        <ShieldAlert aria-hidden className="size-4 text-amber-600" />
        Demo workspace
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        All employees and data are fictional and stored only in this browser. Do not enter real
        employee information. The New Hire and HR previews are simulated and are not access control.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-accent hover:text-accent-strong hover:underline"
      >
        <RotateCcw aria-hidden className="size-3.5" />
        Reset demo data
      </button>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const router = useRouter();
  const { notify } = useToast();

  const requestReset = () => {
    setMobileOpen(false);
    setConfirmReset(true);
  };

  const handleReset = () => {
    onboardingActions.resetDemo();
    setConfirmReset(false);
    notify("Demo data restored to the original sample cases.");
    router.push("/");
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:shadow-raised"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/80 px-4 py-5 backdrop-blur lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <div className="mt-8 flex-1">
          <NavLinks />
        </div>
        <DemoPanel onReset={requestReset} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          className="rounded-lg p-2 text-ink-soft hover:bg-ink/5"
        >
          <Menu aria-hidden className="size-5" />
        </button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" id="mobile-nav">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col bg-surface px-4 py-4 shadow-raised"
            onKeyDown={(event) => {
              if (event.key === "Escape") setMobileOpen(false);
            }}
          >
            <div className="mb-6 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded-lg p-2 text-ink-soft hover:bg-ink/5"
                autoFocus
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="flex-1">
              <NavLinks onNavigate={() => setMobileOpen(false)} />
            </div>
            <DemoPanel onReset={requestReset} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <DemoModeBar />
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <PreviewGate>{children}</PreviewGate>
        </main>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset demo data?"
        description={
          <>
            This replaces every onboarding case in this browser with the original ten sample
            cases. Cases you created and task updates you made will be lost. Your current preview
            (New Hire or HR) stays as it is.
          </>
        }
        confirmLabel="Reset demo data"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <Shell>{children}</Shell>
    </ToastProvider>
  );
}
