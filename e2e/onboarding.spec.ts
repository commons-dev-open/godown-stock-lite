/**
 * Onboarding E2E: isolated `--user-data-dir` for a fresh DB each run.
 * Validation copy comes from each locale's `onboarding.json` under `src/renderer/i18n/locales` (default English for empty profile).
 */
import { execSync } from "node:child_process";
import { test, expect, type Page } from "@playwright/test";
import bnOnboardingLocale from "../src/renderer/i18n/locales/bn/onboarding.json";
import enOnboardingLocale from "../src/renderer/i18n/locales/en/onboarding.json";
import hiOnboardingLocale from "../src/renderer/i18n/locales/hi/onboarding.json";
import {
  COMPACT_SWITCHER,
  GATE,
  LAYOUT,
  ONBOARDING,
  PAGE,
  PIN_ENTRY,
  SETTINGS,
  USERS_ROSTER,
  dataTableRow,
  navLinkTestId,
  pinEntryPadPrefix,
  pinPadDigit,
  settingsTab,
  userSelectUserButton,
} from "../src/shared/test-ids";
import {
  closeAppAndRemoveUserData,
  launchElectronWithUserData,
  newIsolatedUserDataDir,
} from "./launch-electron";
import { e2eTimeouts } from "./timeouts";

const REPO_ROOT = process.cwd();

const EN_ONBOARDING_ERRORS = enOnboardingLocale.onboarding.errors;
const HI_ONBOARDING_ERRORS = hiOnboardingLocale.onboarding.errors;
const BN_ONBOARDING_ERRORS = bnOnboardingLocale.onboarding.errors;

const LANG_SHORT = { en: "EN", hi: "हि", bn: "বা" } as const;

async function expectRequiredAsteriskOnInputLabel(
  page: Page,
  fieldTestId: string
): Promise<void> {
  const field = page.getByTestId(fieldTestId);
  if (fieldTestId === ONBOARDING.displayName) {
    const label = field
      .locator(
        "xpath=ancestor::div[2]/div[contains(@class,'justify-between')]//label"
      )
      .first();
    await expect(label).toContainText("*");
    return;
  }
  if (
    fieldTestId === ONBOARDING.recoveryKey ||
    fieldTestId === ONBOARDING.confirmRecoveryKey
  ) {
    const label = field.locator("xpath=preceding-sibling::label[1]");
    await expect(label).toContainText("*");
    return;
  }
  const label = field.locator(
    "xpath=ancestor::div[1]/preceding-sibling::label[1]"
  );
  await expect(label).toContainText("*");
}

async function expectCompactLanguageCyclesThroughLocales(
  page: Page
): Promise<void> {
  const lang = page.getByTestId(COMPACT_SWITCHER.language);
  await expect(lang).toContainText(LANG_SHORT.en);
  await lang.click();
  await expect(lang).toContainText(LANG_SHORT.hi);
  await lang.click();
  await expect(lang).toContainText(LANG_SHORT.bn);
  await lang.click();
  await expect(lang).toContainText(LANG_SHORT.en);
}

async function expectHtmlDarkClass(page: Page, expected: boolean): Promise<void> {
  const hasDark = await page
    .locator("html")
    .evaluate((el: HTMLElement) => el.classList.contains("dark"));
  expect(hasDark).toBe(expected);
}

async function expectCompactThemeCyclesThroughModes(page: Page): Promise<void> {
  const themeBtn = page.getByTestId(COMPACT_SWITCHER.theme);
  await expect(themeBtn).toContainText("L");
  await expectHtmlDarkClass(page, false);
  await themeBtn.click();
  await expect(themeBtn).toContainText("D");
  await expectHtmlDarkClass(page, true);
  await themeBtn.click();
  await expect(themeBtn).toContainText("S");
  await themeBtn.click();
  await expect(themeBtn).toContainText("L");
  await expectHtmlDarkClass(page, false);
}

async function submitOnboardingAndAcceptRecoveryDialog(page: Page): Promise<void> {
  const dialogMessagePromise = new Promise<string>((resolve) => {
    page.once("dialog", (d) => {
      resolve(d.message());
      void d.accept();
    });
  });
  await page.getByTestId(ONBOARDING.submit).click();
  const message = await dialogMessagePromise;
  expect(message).toMatch(/recovery|রিকভারি|रिकवरी/i);
}

test.beforeAll(() => {
  execSync("npm run build", {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
});

async function expectOnboardingGate(
  page: Page,
  assertMessage?: string
): Promise<void> {
  const gate = page.getByTestId(GATE.onboarding);
  if (assertMessage) {
    await expect(gate, assertMessage).toBeAttached({
      timeout: e2eTimeouts.gateAttach,
    });
  } else {
    await expect(gate).toBeAttached({
      timeout: e2eTimeouts.gateAttach,
    });
  }
}

async function expectNoUserSelectGate(page: Page): Promise<void> {
  await expect(page.getByTestId(GATE.userSelect)).toHaveCount(0);
}

/** Validation failures must keep the onboarding gate up (HashRouter: prefer page testids over URL). */
async function expectStaysOnOnboardingGate(page: Page): Promise<void> {
  await expect(page.getByTestId(GATE.onboarding)).toBeAttached();
  await expectNoUserSelectGate(page);
}

async function fillPinsAndRecovery(
  page: Page,
  opts: { pin?: string; recoveryKey?: string; confirmRecovery?: string } = {}
): Promise<void> {
  const pin = opts.pin ?? "1234";
  await page.getByTestId(ONBOARDING.pin).fill(pin);
  await page.getByTestId(ONBOARDING.confirmPin).fill(pin);
  const rk = opts.recoveryKey ?? "e2e-recovery-key-stable";
  const confirm = opts.confirmRecovery ?? rk;
  await page.getByTestId(ONBOARDING.recoveryKey).fill(rk);
  await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill(confirm);
}

test("fresh profile shows onboarding gate", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding mandatory fields: labels include required asterisk", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    const requiredFieldTestIds = [
      ONBOARDING.companyName,
      ONBOARDING.ownerName,
      ONBOARDING.displayName,
      ONBOARDING.pin,
      ONBOARDING.confirmPin,
      ONBOARDING.recoveryKey,
      ONBOARDING.confirmRecoveryKey,
    ] as const;
    for (const testId of requiredFieldTestIds) {
      await expectRequiredAsteriskOnInputLabel(page, testId);
    }
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding mandatory fields: business display asterisk when not same-as-company", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.displaySameAsCompany).click();
    await expect(page.getByTestId(ONBOARDING.displayName)).toBeEnabled();
    await expectRequiredAsteriskOnInputLabel(page, ONBOARDING.displayName);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding gate: compact language and theme switchers update locale and color mode", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await expect(page.getByTestId(COMPACT_SWITCHER.theme)).toBeVisible();
    await expect(page.getByTestId(COMPACT_SWITCHER.language)).toBeVisible();
    await expectCompactLanguageCyclesThroughLocales(page);
    await expectCompactThemeCyclesThroughModes(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Welcome to Godown Stock"
    );
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding validation copies follow locale after switching to Hindi", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(COMPACT_SWITCHER.language).click();
    await expect(page.getByTestId(COMPACT_SWITCHER.language)).toContainText(
      LANG_SHORT.hi
    );
    await expectRequiredAsteriskOnInputLabel(page, ONBOARDING.companyName);
    await page.getByTestId(ONBOARDING.companyName).fill("   ");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await fillPinsAndRecovery(page);
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      HI_ONBOARDING_ERRORS.companyNameRequired
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding validation copies follow locale after switching to Bengali", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(COMPACT_SWITCHER.language).click();
    await page.getByTestId(COMPACT_SWITCHER.language).click();
    await expect(page.getByTestId(COMPACT_SWITCHER.language)).toContainText(
      LANG_SHORT.bn
    );
    await page.getByTestId(ONBOARDING.companyName).fill("   ");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await fillPinsAndRecovery(page);
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      BN_ONBOARDING_ERRORS.companyNameRequired
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding flow: compact language and theme on onboarding, user select, and PIN gates", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);

    await expectCompactLanguageCyclesThroughLocales(page);
    await expectCompactThemeCyclesThroughModes(page);

    await page.getByTestId(ONBOARDING.companyName).fill("Gate Flow Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Gate Owner");
    await page.getByTestId(ONBOARDING.pin).fill("1234");
    await page.getByTestId(ONBOARDING.confirmPin).fill("1234");
    const recovery = "test-recovery-key-gate-flow-1";
    await page.getByTestId(ONBOARDING.recoveryKey).fill(recovery);
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill(recovery);
    await submitOnboardingAndAcceptRecoveryDialog(page);

    await expect(page.getByTestId(GATE.userSelect)).toBeAttached({
      timeout: e2eTimeouts.flowStep,
    });
    await expectCompactLanguageCyclesThroughLocales(page);
    await expectCompactThemeCyclesThroughModes(page);

    await page.getByTestId(userSelectUserButton(1)).click();
    await expect(page.getByTestId(GATE.pinEntry)).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });
    await expectCompactLanguageCyclesThroughLocales(page);
    await expectCompactThemeCyclesThroughModes(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("pin entry gate: wrong PIN message follows locale after Hindi switch", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Pin Loc Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Pin Loc Owner");
    await page.getByTestId(ONBOARDING.pin).fill("1234");
    await page.getByTestId(ONBOARDING.confirmPin).fill("1234");
    const recovery = "test-recovery-key-pin-locale-1";
    await page.getByTestId(ONBOARDING.recoveryKey).fill(recovery);
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill(recovery);
    await submitOnboardingAndAcceptRecoveryDialog(page);

    await expect(page.getByTestId(GATE.userSelect)).toBeAttached({
      timeout: e2eTimeouts.flowStep,
    });
    await page.getByTestId(userSelectUserButton(1)).click();
    await expect(page.getByTestId(GATE.pinEntry)).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });

    await page.getByTestId(COMPACT_SWITCHER.language).click();
    await expect(page.getByTestId(COMPACT_SWITCHER.language)).toContainText(
      LANG_SHORT.hi
    );

    for (const digit of ["9", "9", "9", "9"]) {
      await page.getByTestId(pinPadDigit(pinEntryPadPrefix, digit)).click();
    }
    await expect(page.getByTestId(PIN_ENTRY.error)).toHaveText(
      hiOnboardingLocale.pinEntry.wrongPin
    );
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding client validation: whitespace-only company name", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("   ");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await fillPinsAndRecovery(page);
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      EN_ONBOARDING_ERRORS.companyNameRequired
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding client validation: whitespace-only owner name", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Val Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("\t  \n");
    await fillPinsAndRecovery(page);
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      EN_ONBOARDING_ERRORS.ownerNameRequired
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding client validation: business display blank after trim when not same as company", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Val Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await page.getByTestId(ONBOARDING.displaySameAsCompany).click();
    // HTML `required` blocks a truly empty value before React runs; whitespace passes the browser check.
    await page.getByTestId(ONBOARDING.displayName).fill("   ");
    await fillPinsAndRecovery(page);
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      EN_ONBOARDING_ERRORS.businessDisplayNameRequired
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding client validation: recovery key empty after trim", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Val Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await page.getByTestId(ONBOARDING.pin).fill("1234");
    await page.getByTestId(ONBOARDING.confirmPin).fill("1234");
    await page.getByTestId(ONBOARDING.recoveryKey).fill("   ");
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill("   ");
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      EN_ONBOARDING_ERRORS.recoveryKeyRequired
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding client validation: recovery keys do not match", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Val Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await fillPinsAndRecovery(page, {
      recoveryKey: "first-recovery-key",
      confirmRecovery: "second-recovery-key",
    });
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      EN_ONBOARDING_ERRORS.recoveryKeyMismatch
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding client validation shows error banner on PIN mismatch", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Val Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await page.getByTestId(ONBOARDING.pin).fill("1234");
    await page.getByTestId(ONBOARDING.confirmPin).fill("9999");
    await page.getByTestId(ONBOARDING.recoveryKey).fill("rk-val-1");
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill("rk-val-1");
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveText(
      EN_ONBOARDING_ERRORS.pinConfirmMismatch
    );
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding: PIN shorter than 4 digits blocked by native field validity (no React error banner)", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Val Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Val Owner");
    await page.getByTestId(ONBOARDING.pin).fill("12");
    await page.getByTestId(ONBOARDING.confirmPin).fill("12");
    await page.getByTestId(ONBOARDING.recoveryKey).fill("rk-native-1");
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill("rk-native-1");
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveCount(0);
    const pinValid = await page
      .getByTestId(ONBOARDING.pin)
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(pinValid).toBe(false);
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding: empty required fields use native validity (no React error banner, no advance)", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toHaveCount(0);
    const companyInvalid = await page
      .getByTestId(ONBOARDING.companyName)
      .evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(companyInvalid).toBe(true);
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding keyboard: Tab moves focus from company name to owner name", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByTestId(ONBOARDING.ownerName)).toBeFocused();
    await expectStaysOnOnboardingGate(page);
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("onboarding: after PIN mismatch, correcting PINs submits and shows recovery alert", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(page);
    await page.getByTestId(ONBOARDING.companyName).fill("Fix Co");
    await page.getByTestId(ONBOARDING.ownerName).fill("Fix Owner");
    await page.getByTestId(ONBOARDING.pin).fill("1234");
    await page.getByTestId(ONBOARDING.confirmPin).fill("9999");
    await page.getByTestId(ONBOARDING.recoveryKey).fill("rk-fix-1");
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill("rk-fix-1");
    await page.getByTestId(ONBOARDING.submit).click();
    await expect(page.getByTestId(ONBOARDING.error)).toBeVisible();

    await page.getByTestId(ONBOARDING.confirmPin).fill("1234");

    const dialogMessagePromise = new Promise<string>((resolve) => {
      page.once("dialog", (d) => {
        resolve(d.message());
        void d.accept();
      });
    });
    await page.getByTestId(ONBOARDING.submit).click();
    const message = await dialogMessagePromise;
    expect(message).toContain("Recovery key saved");

    await expect(page.getByTestId(GATE.userSelect)).toBeAttached({
      timeout: e2eTimeouts.flowStep,
    });
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});

test("happy path: onboard, alert text, user select, PIN, main layout and home route", async () => {
  const userDataDir = newIsolatedUserDataDir();
  const electronApp = await launchElectronWithUserData(REPO_ROOT, userDataDir);
  try {
    const page = await electronApp.firstWindow();
    await expectOnboardingGate(
      page,
      "Happy path: fresh profile should show the onboarding gate"
    );

    const companyName = "E2E Happy Co";
    const ownerName = "E2E Happy Owner";
    const businessDisplayName = "E2E Happy Shopfront";

    await page.getByTestId(ONBOARDING.companyName).fill(companyName);
    await page.getByTestId(ONBOARDING.ownerName).fill(ownerName);
    await page.getByTestId(ONBOARDING.displaySameAsCompany).click();
    await page.getByTestId(ONBOARDING.displayName).fill(businessDisplayName);
    await page.getByTestId(ONBOARDING.pin).fill("1234");
    await page.getByTestId(ONBOARDING.confirmPin).fill("1234");
    const recovery = "test-recovery-key-e2e-1";
    await page.getByTestId(ONBOARDING.recoveryKey).fill(recovery);
    await page.getByTestId(ONBOARDING.confirmRecoveryKey).fill(recovery);

    const dialogMessagePromise = new Promise<string>((resolve) => {
      page.once("dialog", (d) => {
        resolve(d.message());
        void d.accept();
      });
    });

    await page.getByTestId(ONBOARDING.submit).click();
    const alertText = await dialogMessagePromise;
    expect(
      alertText,
      `Happy path: recovery alert should mention saving the recovery key; got: ${JSON.stringify(alertText)}`
    ).toContain("Recovery key saved");

    await expect(
      page.getByTestId(GATE.userSelect),
      "Happy path: after onboarding submit, user selection gate should appear"
    ).toBeAttached({
      timeout: e2eTimeouts.flowStep,
    });
    await page.getByTestId(userSelectUserButton(1)).click();

    await expect(
      page.getByTestId(GATE.pinEntry),
      "Happy path: after picking a user, PIN entry gate should appear"
    ).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });
    for (const digit of ["1", "2", "3", "4"]) {
      await page.getByTestId(pinPadDigit(pinEntryPadPrefix, digit)).click();
    }

    await expect(
      page.getByTestId(GATE.appUnlocked),
      "Happy path: after correct PIN, app-unlocked marker should appear"
    ).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });
    await expect(
      page.getByTestId(LAYOUT.root),
      "Happy path: main layout root should render after unlock"
    ).toBeAttached();
    await expect(
      page.getByTestId(PAGE.home),
      "Happy path: home page content should be visible on default route after unlock"
    ).toBeAttached();

    await expect(
      page.getByTestId(LAYOUT.sidebarBusinessTitle),
      `Happy path: sidebar business title should match display name "${businessDisplayName}"`
    ).toHaveText(businessDisplayName);
    await expect(
      page.getByTestId(LAYOUT.sidebarUserName),
      `Happy path: sidebar user name should match owner "${ownerName}"`
    ).toHaveText(ownerName);
    await expect(
      page.getByTestId(LAYOUT.sidebarUserRole),
      'Happy path: sidebar role should read "Owner" for the owner user'
    ).toHaveText("Owner");

    await page.getByTestId(navLinkTestId("/settings")).click();
    await expect(
      page.getByTestId(PAGE.settings),
      "Happy path: Settings page should load after clicking the settings nav link"
    ).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });
    await expect(
      page.getByTestId(SETTINGS.businessCompanyName),
      `Happy path: Settings company name field should be "${companyName}"`
    ).toHaveValue(companyName);
    await expect(
      page.getByTestId(SETTINGS.businessOwnerName),
      `Happy path: Settings owner name field should be "${ownerName}"`
    ).toHaveValue(ownerName);

    await page.getByTestId(settingsTab("appearance")).click();
    await expect(
      page.getByTestId(SETTINGS.appearanceDisplayName),
      `Happy path: Appearance display name should be "${businessDisplayName}"`
    ).toHaveValue(businessDisplayName);

    await page.getByTestId(navLinkTestId("/users")).click();
    await expect(
      page.getByTestId(PAGE.users),
      "Happy path: Users page should load after clicking the users nav link"
    ).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });
    const ownerRow = page.getByTestId(dataTableRow(USERS_ROSTER, 1));
    await expect(
      ownerRow,
      `Happy path: first users table row should include owner name "${ownerName}"`
    ).toContainText(ownerName);
    await expect(
      ownerRow,
      'Happy path: first users table row should include role "Owner"'
    ).toContainText("Owner");

    await page.getByTestId(LAYOUT.lock).click();
    await expect(
      page.getByTestId(GATE.pinEntry),
      "Happy path: after lock, PIN entry gate should appear again"
    ).toBeAttached({
      timeout: e2eTimeouts.uiStep,
    });
  } finally {
    await closeAppAndRemoveUserData(electronApp, userDataDir);
  }
});
