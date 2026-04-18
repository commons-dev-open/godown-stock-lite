import { useEffect, useState } from "react";

export type TableScrollHeightPreset = "default" | "compact";

/** [ narrow, sm, lg ] — matches former index.css `.table-scroll-wrap` heights */
const PRESET_HEIGHTS: Record<
  TableScrollHeightPreset,
  [string, string, string]
> = {
  default: ["min(50vh, 400px)", "calc(100vh - 260px)", "calc(100vh - 220px)"],
  compact: ["min(50vh, 346px)", "calc(100vh - 320px)", "calc(100vh - 280px)"],
};

function readBreakpointIndex(): 0 | 1 | 2 {
  if (typeof window === "undefined") {
    return 0;
  }
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return 2;
  }
  if (window.matchMedia("(min-width: 640px)").matches) {
    return 1;
  }
  return 0;
}

function heightForPreset(
  preset: TableScrollHeightPreset,
  index: 0 | 1 | 2
): string {
  return PRESET_HEIGHTS[preset][index];
}

/**
 * Responsive max-height for scrollable tables (replaces CSS media queries).
 * Pass `null` to skip subscriptions when height is fully controlled elsewhere.
 */
export function useTableScrollMaxHeight(
  preset: TableScrollHeightPreset | null
): string | undefined {
  const [value, setValue] = useState<string | undefined>(() => {
    if (preset == null) {
      return undefined;
    }
    return heightForPreset(preset, readBreakpointIndex());
  });

  useEffect(() => {
    if (preset == null) {
      setValue(undefined);
      return;
    }

    const fixedPreset = preset;

    function update() {
      setValue(heightForPreset(fixedPreset, readBreakpointIndex()));
    }

    update();
    const sm = window.matchMedia("(min-width: 640px)");
    const lg = window.matchMedia("(min-width: 1024px)");
    sm.addEventListener("change", update);
    lg.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      sm.removeEventListener("change", update);
      lg.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [preset]);

  return value;
}
