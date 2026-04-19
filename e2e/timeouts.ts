/**
 * Central Playwright E2E timeouts. Import from here in specs and in playwright.config.ts.
 */
export const e2eTimeouts = {
  /** Per-test ceiling (see playwright.config `timeout`). */
  test: 30_000,
  /** Default `expect()` timeout (see playwright.config `expect.timeout`). */
  expect: 5_000,
  /** First window + onboarding gate (cold Electron + fresh profile). */
  gateAttach: 10_000,
  /** Heavy transitions (e.g. onboarding submit → user select). */
  flowStep: 10_000,
  /** Lighter UI transitions (nav → page, user select → PIN, lock → PIN). */
  uiStep: 5_000,
} as const;
