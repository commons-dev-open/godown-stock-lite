---
name: playwright-test-checklist
description: >-
  Checklist for authoring or editing Playwright tests in this repo. Use whenever
  adding, extending, or refactoring E2E specs, fixtures, or assertions so flows,
  selectors, and outcomes stay consistent and maintainable.
---

# Playwright test authoring checklist

Copy this list into your working notes and complete every relevant item before merging.

## Spec setup

- [ ] **Build**: Electron E2E targets the built app (`beforeAll` runs `npm run build` where the spec already does).
- [ ] **Isolation**: Flows that need a clean DB use an isolated `--user-data-dir` (see [`e2e/launch-electron.ts`](../../../e2e/launch-electron.ts)); do not rely on the developer’s default profile.
- [ ] **Environment**: Launch path clears `ELECTRON_RUN_AS_NODE` (handled by `electronTestEnv()` / smoke spec pattern).

## Selectors and copy

- [ ] **Stable ids**: Use `data-testid` values from [`src/shared/test-ids.ts`](../../../src/shared/test-ids.ts); import constants in specs instead of duplicating strings.
- [ ] **UI changes**: If you add or rename a `data-testid`, update `test-ids.ts`, renderer usage, and every spec in the same change set (see [`playwright-e2e`](../playwright-e2e/SKILL.md)).
- [ ] **i18n**: Prefer `getByTestId` and structural assertions. Asserting exact translated `getByText` requires a fixed locale (fresh isolated `userData` defaults to English unless the user changed global defaults—avoid brittle copy when a testid suffices).
- [ ] **Locale switching in flows**: When testing translated validation or headings, drive the compact language control (`COMPACT_SWITCHER.language` in [`src/shared/test-ids.ts`](../../../src/shared/test-ids.ts)), assert the short label cycles (`EN` → `हि` → `বা` → `EN`), and mirror expected strings from the matching `src/renderer/i18n/locales/<locale>/…` JSON. Cycle back to English before assertions that assume English unless the scenario is explicitly multilingual.
- [ ] **Theme switching on gates**: Onboarding, user select, and PIN entry (including PIN recovery overlay) expose compact `ThemeSwitcher` / `LanguageSwitcher` with stable ids (`COMPACT_SWITCHER.theme` / `.language`). Assert mode short labels cycle (`L` → `D` → `S` → `L`) and, for explicit light vs dark, `document.documentElement.classList.contains("dark")` as appropriate; treat `"system"` as OS-dependent for intermediate states.

## Routing (this app)

- [ ] **HashRouter**: In production the app uses `HashRouter` (`#/` routes). Prefer asserting a stable **page** `data-testid` (e.g. `PAGE.home`) after unlock; `page.url()` from Playwright’s Electron window may omit the hash fragment even when the in-window router is correct.

## Behavior assertions

- [ ] **After click**: Assert the next stable screen (gate testid, `LAYOUT.root`, etc.), URL fragment if relevant, or `page.once("dialog", …)` for `window.alert` / confirm.
- [ ] **Validation**: For client errors, assert the error region testid (`ONBOARDING.error`, `PIN_ENTRY.error`, etc.) and that the user remains on the same gate when navigation should not occur.
- [ ] **Native vs React validation**: Some inputs use HTML `pattern` / `required`; short PINs may fail browser constraint validation before React `setError`. Prefer asserting the outcome you care about (`validity`, visible error banner, or no gate change).

## Forms

- [ ] **Required labels**: Mandatory fields show `*` in the label (same convention across forms). Prefer resolving the label from the input’s `data-testid` (DOM structure / `xpath`) so the assertion is tied to the correct field; avoid matching a lone `*` elsewhere on the page.
- [ ] **Conditional required UI**: If a toggle enables a field (e.g. “same as company” off), re-check the asterisk on that field’s label and `required` / `disabled` behavior.
- [ ] **Coverage**: Exercise happy path and failure paths for each field or step (required, format, min/max length, mismatch, duplicates if applicable).
- [ ] **Whitespace**: Reject or normalize whitespace-only values; assert the field stays invalid or shows the same validation as empty, and that submit does not succeed with trimmed-to-empty input.
- [ ] **Errors on failure**: After an invalid submit or blur-triggered validation, assert a visible error (banner, inline message, or `aria-invalid` + associated description) and that the user does not advance when they should not.
- [ ] **Success feedback**: On valid submit, assert navigation to the expected screen or a visible success toast/snackbar (and that error UI is cleared if it was shown before).
- [ ] **Keyboard**: Tab through fields and controls, activate primary actions with Enter/Space where appropriate, and close dialogs with Escape when the app supports it; ensure focus order matches the flow under test.

## Quality

- [ ] **Timeouts**: Keep generous timeouts for first window / cold start (see existing `120_000` patterns).
- [ ] **Cleanup**: Always `close` the Electron app and remove temp `userData` in `finally`.
- [ ] **Verify**: Run `npm run test:e2e` after substantive spec or selector changes.

## Repo-specific deep dive

For Electron launch details, smoke expectations, and selector policy, read [`playwright-e2e`](../playwright-e2e/SKILL.md).
