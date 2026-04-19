import { defineConfig } from "@playwright/test";
import { e2eTimeouts } from "./e2e/timeouts";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: e2eTimeouts.test,
  expect: { timeout: e2eTimeouts.expect },
  reporter: [["list"]],
});
