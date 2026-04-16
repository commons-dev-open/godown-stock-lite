import { ReactNode, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Home,
  Scale,
  Package,
  Users,
  ArrowLeftRight,
  CalendarDays,
  FileText,
  Settings as SettingsIcon,
  HelpCircle,
  PanelLeftClose,
  PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { getElectron } from "../api/client";
import { getAppDisplayName } from "../lib/displayName";
import { TRIAL_MODE } from "shared/buildConfig";
import TrialTimer from "./TrialTimer";
import Tooltip from "./Tooltip";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const mainNavItems: NavItem[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/units", label: "Units", icon: Scale },
  { to: "/stock", label: "Products & Stock", icon: Package },
  { to: "/mahajans", label: "Lenders", icon: Users },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/sales", label: "Daily Sales", icon: CalendarDays },
  { to: "/invoices", label: "Invoices", icon: FileText },
];

const systemNavItems: NavItem[] = [
  { to: "/settings", label: "Settings", icon: SettingsIcon },
  { to: "/help", label: "Help", icon: HelpCircle },
];

const SIDEBAR_KEY = "sidebar-collapsed";

function SidebarNavLink({
  to,
  label,
  icon: Icon,
  collapsed,
  end,
}: NavItem & { collapsed: boolean; end?: boolean }) {
  const navClass = ({ isActive }: Readonly<{ isActive: boolean }>) =>
    `flex items-center ${collapsed ? "justify-center" : ""} gap-3 px-3 py-2 text-sm rounded-none transition-all ${
      isActive
        ? "border-l-[3px] border-l-[var(--color-accent)] bg-gradient-to-r from-[var(--color-accent-muted)] to-transparent text-[var(--color-accent)] font-medium"
        : "border-l-[3px] border-l-transparent text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-sidebar-hover)] hover:text-[var(--color-text-sidebar-active)]"
    }`;

  const link = (
    <NavLink to={to} className={navClass} end={end}>
      <Icon size={20} strokeWidth={1.5} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} placement="right" delay={100}>
        {link}
      </Tooltip>
    );
  }

  return link;
}

export default function Layout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      return false;
    }
  });

  const { data: settings = {} } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getElectron().getSettings(),
  });
  const appName = getAppDisplayName(settings);

  useEffect(() => {
    document.title = TRIAL_MODE ? `${appName} (Trial)` : appName;
  }, [appName]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(collapsed));
    } catch {
      // ignore
    }
  }, [collapsed]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT"].includes(
          (e.target as HTMLElement).tagName,
        )
      )
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k") {
          e.preventDefault();
          const search = document.querySelector(
            'input[type="search"], input[placeholder*="Search"]',
          ) as HTMLElement;
          search?.focus();
        }
        if (e.key === "b") {
          e.preventDefault();
          setCollapsed((c) => !c);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const ToggleIcon = collapsed ? PanelLeft : PanelLeftClose;

  return (
    <div className="flex h-screen bg-bg-app">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? "w-14" : "w-52"} shrink-0 flex flex-col bg-[var(--color-bg-sidebar)] transition-[width] duration-200`}
      >
        <div className="p-4 border-b border-[var(--color-bg-sidebar-hover)] flex items-center justify-between gap-2">
          {!collapsed && (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-semibold text-[var(--color-text-sidebar-active)] truncate">
                  {appName}
                </h1>
                {TRIAL_MODE && (
                  <span
                    className="inline-flex items-center rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-300"
                    title="This is a trial version. Full version will be provided after payment."
                  >
                    Trial
                  </span>
                )}
              </div>
              {TRIAL_MODE && <TrialTimer />}
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="shrink-0 p-1 rounded text-[var(--color-text-sidebar)] hover:text-[var(--color-text-sidebar-active)] hover:bg-[var(--color-bg-sidebar-hover)] transition-colors"
            title={collapsed ? "Expand sidebar (⌘B)" : "Collapse sidebar (⌘B)"}
          >
            <ToggleIcon size={18} strokeWidth={1.5} />
          </button>
        </div>
        <nav className={`flex-1 overflow-y-auto ${collapsed ? "p-1.5" : "p-3"}`}>
          <ul className="space-y-0.5">
            {mainNavItems.map((item) => (
              <li key={item.to}>
                <SidebarNavLink {...item} collapsed={collapsed} end={item.to === "/"} />
              </li>
            ))}
          </ul>
          <div className="border-t border-[var(--color-bg-sidebar-hover)] my-2" />
          <ul className="space-y-0.5">
            {systemNavItems.map((item) => (
              <li key={item.to}>
                <SidebarNavLink {...item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto px-8 pb-6 animate-fade-in">{children}</main>
    </div>
  );
}
