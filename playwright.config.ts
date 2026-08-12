import { defineConfig, devices } from "@playwright/test";
/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

/**
 * Ported from care_fe's playwright.config.ts. Two things differ, both forced by this
 * being a plugin rather than an app:
 *
 * - `baseURL` is care_fe, not us. The plugin has no UI of its own; its screens only exist
 *   once care_fe mounts the federated remote, so every page.goto() is against the host.
 * - `webServer` starts *our* preview (the remote), not the host. care_fe and the care
 *   backend are prerequisites the runner does not own -- see tests/README.md.
 *
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",

  timeout: 60000,

  /* Global expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Global setup - refreshes tokens before test run */
  globalSetup: "./tests/globalSetup",

  /* Deletes the events the suite created. Safety-critical — see tests/globalTeardown.ts. */
  globalTeardown: "./tests/globalTeardown",

  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  retries: process.env.CI ? 2 : 0,
  workers: undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [["html"], ["json", { outputFile: "test-results.json" }], ["list"]]
    : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* care_fe, the host that mounts this plugin. */
    baseURL: process.env.CARE_FE_URL || "http://localhost:4000",
    video: "on-first-retry",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Set navigation and action timeouts */
    navigationTimeout: 15000,
    actionTimeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    // Authentication is split into its own project so the rest of the setup can declare a
    // dependency on it. care_fe keeps all its setups in one project and relies on
    // `--workers=1` in CI to order them; locally that ordering is luck, and it breaks as
    // soon as a stored token goes stale — every other setup then runs with a dead session.
    // A dependency edge is the supported way to say "this must finish first".
    { name: "auth", testMatch: /auth\.setup\.ts/ },
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
      testIgnore: /auth\.setup\.ts/,
      fullyParallel: false,
      dependencies: ["auth"],
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: process.env.CI ? [] : ["setup"],
    },
    // firefox / webkit / mobile projects stay disabled, as in care_fe.
  ],

  /* Serve the federated remote before starting the tests. As in care_fe, the build is a
   * separate prerequisite step, not part of this command — see tests/README.md. */
  webServer: {
    command: "npm run preview",
    url: `${process.env.PLUGIN_URL || "http://localhost:10120"}/assets/remoteEntry.js`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
