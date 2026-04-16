import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getElectron } from "../api/client";

/* ── Brand color presets ──────────────────────────────────── */
export type BrandColor =
  | "blue"
  | "indigo"
  | "violet"
  | "emerald"
  | "rose"
  | "amber";

export type ThemeMode = "light" | "dark" | "system";

type BrandTokens = {
  accent: string;
  accentHover: string;
  accentSubtle: string;
  accentMuted: string;
  /** dark-mode overrides for subtle/muted */
  accentSubtleDark: string;
  accentMutedDark: string;
};

const BRAND_COLORS: Record<BrandColor, BrandTokens> = {
  blue: {
    accent: "#2563EB",
    accentHover: "#1D4ED8",
    accentSubtle: "#EFF6FF",
    accentMuted: "#DBEAFE",
    accentSubtleDark: "rgba(37, 99, 235, 0.15)",
    accentMutedDark: "rgba(37, 99, 235, 0.25)",
  },
  indigo: {
    accent: "#4F46E5",
    accentHover: "#4338CA",
    accentSubtle: "#EEF2FF",
    accentMuted: "#E0E7FF",
    accentSubtleDark: "rgba(79, 70, 229, 0.15)",
    accentMutedDark: "rgba(79, 70, 229, 0.25)",
  },
  violet: {
    accent: "#7C3AED",
    accentHover: "#6D28D9",
    accentSubtle: "#F5F3FF",
    accentMuted: "#EDE9FE",
    accentSubtleDark: "rgba(124, 58, 237, 0.15)",
    accentMutedDark: "rgba(124, 58, 237, 0.25)",
  },
  emerald: {
    accent: "#059669",
    accentHover: "#047857",
    accentSubtle: "#ECFDF5",
    accentMuted: "#D1FAE5",
    accentSubtleDark: "rgba(5, 150, 105, 0.15)",
    accentMutedDark: "rgba(5, 150, 105, 0.25)",
  },
  rose: {
    accent: "#E11D48",
    accentHover: "#BE123C",
    accentSubtle: "#FFF1F2",
    accentMuted: "#FFE4E6",
    accentSubtleDark: "rgba(225, 29, 72, 0.15)",
    accentMutedDark: "rgba(225, 29, 72, 0.25)",
  },
  amber: {
    accent: "#D97706",
    accentHover: "#B45309",
    accentSubtle: "#FFFBEB",
    accentMuted: "#FEF3C7",
    accentSubtleDark: "rgba(217, 119, 6, 0.15)",
    accentMutedDark: "rgba(217, 119, 6, 0.25)",
  },
};

export const BRAND_COLOR_OPTIONS: { value: BrandColor; label: string; hex: string }[] = [
  { value: "blue", label: "Blue", hex: "#2563EB" },
  { value: "indigo", label: "Indigo", hex: "#4F46E5" },
  { value: "violet", label: "Violet", hex: "#7C3AED" },
  { value: "emerald", label: "Emerald", hex: "#059669" },
  { value: "rose", label: "Rose", hex: "#E11D48" },
  { value: "amber", label: "Amber", hex: "#D97706" },
];

/* ── Context ──────────────────────────────────────────────── */
type ThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  brandColor: BrandColor;
  setMode: (m: ThemeMode) => void;
  setBrandColor: (c: BrandColor) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  resolvedMode: "light",
  brandColor: "blue",
  setMode: () => {},
  setBrandColor: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/* ── Helpers ──────────────────────────────────────────────── */
function getSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemDark() ? "dark" : "light";
  return mode;
}

function applyDarkClass(resolved: "light" | "dark") {
  const html = document.documentElement;
  if (resolved === "dark") {
    html.classList.add("dark");
  } else {
    html.classList.remove("dark");
  }
}

function applyBrandTokens(brand: BrandColor, resolved: "light" | "dark") {
  const tokens = BRAND_COLORS[brand];
  const style = document.documentElement.style;
  style.setProperty("--color-accent", tokens.accent);
  style.setProperty("--color-accent-hover", tokens.accentHover);
  style.setProperty("--color-accent-text", "#FFFFFF");

  if (resolved === "dark") {
    style.setProperty("--color-accent-subtle", tokens.accentSubtleDark);
    style.setProperty("--color-accent-muted", tokens.accentMutedDark);
  } else {
    style.setProperty("--color-accent-subtle", tokens.accentSubtle);
    style.setProperty("--color-accent-muted", tokens.accentMuted);
  }
}

/* ── Provider ─────────────────────────────────────────────── */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [brandColor, setBrandColorState] = useState<BrandColor>("blue");
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">("light");
  const [ready, setReady] = useState(false);

  // Load saved theme from settings on mount
  useEffect(() => {
    const api = getElectron();
    api.getSettings().then((settings: Record<string, string>) => {
      const savedMode = (settings.theme_mode as ThemeMode) || "light";
      const savedBrand = (settings.brand_color as BrandColor) || "blue";
      const resolved = resolveMode(savedMode);

      setModeState(savedMode);
      setBrandColorState(savedBrand);
      setResolvedMode(resolved);
      applyDarkClass(resolved);
      applyBrandTokens(savedBrand, resolved);
      setReady(true);
    });
  }, []);

  // Listen for system color scheme changes
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = resolveMode("system");
      setResolvedMode(resolved);
      applyDarkClass(resolved);
      applyBrandTokens(brandColor, resolved);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, brandColor]);

  const setMode = useCallback(
    (m: ThemeMode) => {
      setModeState(m);
      const resolved = resolveMode(m);
      setResolvedMode(resolved);
      applyDarkClass(resolved);
      applyBrandTokens(brandColor, resolved);
      getElectron().setSettings({ theme_mode: m });
    },
    [brandColor],
  );

  const setBrandColor = useCallback(
    (c: BrandColor) => {
      setBrandColorState(c);
      applyBrandTokens(c, resolvedMode);
      getElectron().setSettings({ brand_color: c });
    },
    [resolvedMode],
  );

  // Don't render children until initial theme is loaded to avoid flash
  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, brandColor, setMode, setBrandColor }}>
      {children}
    </ThemeContext.Provider>
  );
}
