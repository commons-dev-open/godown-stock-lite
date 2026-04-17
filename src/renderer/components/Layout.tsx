import { ReactNode, useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  Sun,
  Moon,
  Monitor,
  Lock,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { getElectron } from "../api/client";
import { getAppDisplayName } from "../lib/displayName";
import { TRIAL_MODE } from "shared/buildConfig";
import type { ThemeMode } from "../context/ThemeContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import TrialTimer from "./TrialTimer";
import Tooltip from "./Tooltip";
import LanguageSwitcher from "../i18n/LanguageSwitcher";

type NavItem = {
  to: string;
  /** Translation key within the "navigation" namespace. */
  labelKey: string;
  icon: LucideIcon;
};

const mainNavItems: NavItem[] = [
  { to: "/", labelKey: "home", icon: Home },
  { to: "/units", labelKey: "units", icon: Scale },
  { to: "/stock", labelKey: "stock", icon: Package },
  { to: "/mahajans", labelKey: "mahajans", icon: Users },
  { to: "/transactions", labelKey: "transactions", icon: ArrowLeftRight },
  { to: "/sales", labelKey: "sales", icon: CalendarDays },
  { to: "/invoices", labelKey: "invoices", icon: FileText },
];

const systemNavItems: NavItem[] = [
  { to: "/users", labelKey: "team", icon: UserCog },
  { to: "/settings", labelKey: "settings", icon: SettingsIcon },
  { to: "/help", labelKey: "help", icon: HelpCircle },
];

const SIDEBAR_KEY = "sidebar-collapsed";

const sidebarThemeModes: {
  value: ThemeMode;
  /** Translation key within theme labels. */
  labelKey: "light" | "dark" | "system";
  icon: typeof Sun;
}[] = [
  { value: "light", labelKey: "light", icon: Sun },
  { value: "dark", labelKey: "dark", icon: Moon },
  { value: "system", labelKey: "system", icon: Monitor },
];

function SidebarNavLink({
  to,
  labelKey,
  icon: Icon,
  collapsed,
  end,
}: NavItem & { collapsed: boolean; end?: boolean }) {
  const { t } = useTranslation("navigation");
  const label = t(labelKey as never) as string;
  const navClass = ({ isActive }: Readonly<{ isActive: boolean }>) =>
    `flex items-center ${collapsed ? "justify-center" : ""} gap-3 px-3 py-2 text-sm rounded-none transition-all ${
      isActive
        ? "border-l-[3px] border-l-[var(--color-accent)] bg-gradient-to-r from-[var(--color-accent-muted)] to-transparent text-[var(--color-accent)] font-medium"
        : "border-l-[3px] border-l-transparent text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-sidebar-hover)] hover:text-[var(--color-text-sidebar-active)]"
    }`;

  const link = (
    <NavLink to={to} className={navClass} end={end}>
      <Icon
        size={20}
        strokeWidth={1.5}
        className="shrink-0"
        aria-hidden="true"
      />
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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Layout({ children }: { children: ReactNode }) {
  const { mode, setMode } = useTheme();
  const { authState, lock } = useAuth();
  const { t } = useTranslation("navigation");
  const currentUser = authState.status === "unlocked" ? authState.user : null;

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
          (e.target as HTMLElement).tagName
        )
      )
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "k") {
          e.preventDefault();
          const search = document.querySelector(
            'input[type="search"], input[placeholder*="Search"]'
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
                    {t("sidebar.trial")}
                  </span>
                )}
              </div>
              {TRIAL_MODE && <TrialTimer />}
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="shrink-0 p-1 rounded text-[var(--color-text-sidebar)] hover:text-[var(--color-text-sidebar-active)] hover:bg-[var(--color-bg-sidebar-hover)] transition-colors"
            title={
              collapsed
                ? `${t("sidebar.expand")} (⌘B)`
                : `${t("sidebar.collapse")} (⌘B)`
            }
          >
            <ToggleIcon size={18} strokeWidth={1.5} />
          </button>
        </div>
        <nav
          className={`flex-1 overflow-y-auto ${collapsed ? "p-1.5" : "p-3"}`}
        >
          <ul className="space-y-0.5">
            {mainNavItems.map((item) => (
              <li key={item.to}>
                <SidebarNavLink
                  {...item}
                  collapsed={collapsed}
                  end={item.to === "/"}
                />
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
        <fieldset
          className={`m-0 min-w-0 shrink-0 border-0 border-t border-solid border-[var(--color-bg-sidebar-hover)] ${
            collapsed ? "p-1.5" : "p-3"
          }`}
        >
          <legend
            className={
              collapsed
                ? "sr-only"
                : "float-none w-full px-0 pb-2 text-xs font-medium text-[var(--color-text-sidebar)]"
            }
          >
            {t("sidebar.theme")}
          </legend>
          <div
            className={`flex ${collapsed ? "flex-col items-center gap-1" : "gap-1"}`}
          >
            {sidebarThemeModes.map(({ value, labelKey, icon: Icon }) => {
              const active = mode === value;
              const label = t(`themes.${labelKey}`);
              const withModeLabel = t("themes.themeWithMode", { mode: label });
              const btn = (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={active}
                  title={collapsed ? withModeLabel : undefined}
                  className={`rounded-md transition-colors ${
                    collapsed
                      ? "flex size-9 items-center justify-center"
                      : "flex flex-1 flex-col items-center gap-0.5 py-2"
                  } ${
                    active
                      ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                      : "text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-sidebar-hover)] hover:text-[var(--color-text-sidebar-active)]"
                  }`}
                >
                  <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                  {!collapsed && (
                    <span className="text-[10px] font-medium leading-none">
                      {label}
                    </span>
                  )}
                </button>
              );
              if (collapsed) {
                return (
                  <Tooltip
                    key={value}
                    content={withModeLabel}
                    placement="right"
                    delay={100}
                  >
                    {btn}
                  </Tooltip>
                );
              }
              return btn;
            })}
          </div>
        </fieldset>

        {/* Language switcher */}
        <div
          className={`border-t border-[var(--color-bg-sidebar-hover)] ${
            collapsed ? "p-1.5 flex justify-center" : "p-3"
          }`}
        >
          <LanguageSwitcher variant={collapsed ? "compact" : "full"} />
        </div>

        {/* Current user + lock */}
        {currentUser && (
          <div
            className={`border-t border-[var(--color-bg-sidebar-hover)] flex ${collapsed ? "flex-col items-center gap-1 p-2" : "items-center gap-2 p-3"}`}
          >
            {(() => {
              const roleLabel =
                currentUser.role === "superadmin"
                  ? t("sidebar.owner")
                  : currentUser.role;
              return collapsed ? (
                <Tooltip
                  content={`${currentUser.name} · ${roleLabel}`}
                  placement="right"
                  delay={100}
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(currentUser.name)}
                  </div>
                </Tooltip>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-subtle)] text-[var(--color-accent)] flex items-center justify-center text-xs font-bold shrink-0">
                    {getInitials(currentUser.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                      {currentUser.name}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] capitalize">
                      {roleLabel}
                    </p>
                  </div>
                </>
              );
            })()}
            <Tooltip
              content={t("sidebar.lockApp")}
              placement="right"
              delay={100}
            >
              <button
                type="button"
                onClick={lock}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--color-text-sidebar)] hover:bg-[var(--color-bg-sidebar-hover)] hover:text-[var(--color-danger)] transition-colors shrink-0"
                aria-label={t("sidebar.lockApp")}
              >
                <Lock size={16} strokeWidth={1.75} />
              </button>
            </Tooltip>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto px-8 pb-2 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
