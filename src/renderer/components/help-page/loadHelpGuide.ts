import type { ReactNode } from "react";
import type { HelpTabId } from "./types";
import { HELP_TAB_ORDER } from "./types";

export async function loadHelpGuide(): Promise<Record<HelpTabId, ReactNode>> {
  const { HELP_TAB_BODIES } = await import("./HelpTabBodies");
  const bodies = HELP_TAB_BODIES;
  for (const id of HELP_TAB_ORDER) {
    if (bodies[id] == null) {
      throw new Error(`Missing help body for tab: ${id}`);
    }
  }
  return bodies;
}
