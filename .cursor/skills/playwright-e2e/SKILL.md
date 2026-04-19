---
name: playwright-e2e
description: >-
  Mandatory when editing e2e/, playwright.config.ts, src/shared/test-ids.ts,
  or renderer UI that adds/changes/removes data-testid, testId, auth gates,
  routes, or user flows covered by Playwright. Keeps Electron E2E and stable
  selectors in sync.
---

# Playwright and stable selectors (this repo)

## Checklist for new or changed tests

When **writing or editing** Playwright specs, also follow the step-by-step checklist in [`playwright-test-checklist`](../playwright-test-checklist/SKILL.md) (selectors, HashRouter, isolation, assertions after clicks/dialogs).

## When this skill applies

Read and follow this skill whenever you touch:

- [`e2e/`](../../../e2e/) or [`playwright.config.ts`](../../../playwright.config.ts)
- [`src/shared/test-ids.ts`](../../../src/shared/test-ids.ts)
- Renderer code that changes **navigation**, **auth gates**, **`data-testid` / `testId`**, or flows exercised by E2E

## Rules

1. **Single source of truth**  
   Add or rename stable ids in [`src/shared/test-ids.ts`](../../../src/shared/test-ids.ts). Do not scatter magic strings across specs and components for the same concept.

2. **Specs import shared ids**  
   In Playwright tests, import from `../src/shared/test-ids` (or the correct relative path) instead of duplicating `data-testid` strings.

3. **Renames**  
   If you rename or remove a `data-testid`, update **every** `e2e/` reference and every renderer usage in the same change set.

4. **HashRouter**  
   This app uses `HashRouter` (`#/…` in the real browser). Prefer route outcomes via stable **page** testids; Playwright’s `page.url()` on the Electron window may not include the hash even when routing is correct.

5. **Assertions**  
   Prefer `page.getByTestId(...)` with shared constants. Do **not** assert on `document.title`, dynamic app display name from settings, or translated `getByText` unless there is no stable alternative.

6. **Journeys**  
   When you add or materially change a flow that should be covered by automation, extend [`e2e/`](../../../e2e/) (or add a new spec). Do not rely only on manual checks.

7. **Verify**  
   After substantive selector or spec changes, run `npm run test:e2e` locally (or ensure CI runs it) and fix failures before finishing.

## Smoke test expectations

[`e2e/smoke.spec.ts`](../../../e2e/smoke.spec.ts) launches the **built** Electron app (`npm run build` in `beforeAll`). It waits for any known auth gate or main layout id—behavior depends on local DB state; do not make the smoke test depend on a single screen unless you also control DB fixtures.

The smoke spec clears **`ELECTRON_RUN_AS_NODE`** on launch: if that variable is set (some dev shells), `require("electron")` in main resolves to the binary path string and the app crashes. It asserts **`toBeAttached`** rather than strict visibility so full-screen gates still count when Playwright’s visibility heuristics disagree with layout.

## Links (repo root)

- [`playwright.config.ts`](../../../playwright.config.ts)
- [`src/shared/test-ids.ts`](../../../src/shared/test-ids.ts)
