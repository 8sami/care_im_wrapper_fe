import { FullConfig } from "@playwright/test";
import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Token name constants
const ACCESS_TOKEN_KEY = "care_access_token";
const REFRESH_TOKEN_KEY = "care_refresh_token";

/**
 * Interface for localStorage items in Playwright storage state
 */
interface LocalStorageItem {
  name: string;
  value: string;
}

/**
 * Ported from care_fe's tests/globalSetup.ts, minus its restoreDatabase() step.
 *
 * care_fe restores a pg_dump snapshot to get a repeatable DB, and rebuilds that snapshot
 * with `playwright-db.sh reset`, which shells into a local care checkout at
 * `$CARE_BACKEND_DIR/.venv/bin/python`. This plugin is developed against a backend running
 * in Docker, where no such venv exists, so the reset path could not run. What this suite
 * actually needs from a snapshot -- a manual trigger and two templates -- comes from the
 * `seed_notification_test_data` management command instead, which is idempotent and works
 * the same locally and in CI. Add the snapshot back if accumulated state ever causes flakes.
 */

/**
 * Refresh authentication tokens using native fetch.
 */
async function refreshTokens() {
  const authFile = path.join(__dirname, ".auth/user.json");

  if (!fs.existsSync(authFile)) {
    console.log("⚠️ Auth file not found, skipping token refresh");
    return;
  }

  try {
    const storageState = JSON.parse(fs.readFileSync(authFile, "utf-8"));

    if (
      !Array.isArray(storageState.origins) ||
      storageState.origins.length === 0
    ) {
      console.log(
        "⚠️ No origins found in storage state, skipping token refresh",
      );
      return;
    }

    const firstOrigin = storageState.origins[0];
    const localStorage: LocalStorageItem[] = Array.isArray(
      firstOrigin.localStorage,
    )
      ? firstOrigin.localStorage
      : [];
    const accessTokenEntry = localStorage.find(
      (item: LocalStorageItem) => item.name === ACCESS_TOKEN_KEY,
    );
    const refreshTokenEntry = localStorage.find(
      (item: LocalStorageItem) => item.name === REFRESH_TOKEN_KEY,
    );

    if (!accessTokenEntry || !refreshTokenEntry) {
      console.log("⚠️ No tokens found in storage state");
      return;
    }

    const refreshToken = refreshTokenEntry.value;
    const apiUrl = process.env.REACT_CARE_API_URL || "http://localhost:9000";

    console.log("🔄 Refreshing authentication tokens...");

    const response = await fetch(`${apiUrl}/api/v1/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();

      const accessIndex = localStorage.findIndex(
        (item: LocalStorageItem) => item.name === ACCESS_TOKEN_KEY,
      );
      const refreshIndex = localStorage.findIndex(
        (item: LocalStorageItem) => item.name === REFRESH_TOKEN_KEY,
      );

      if (accessIndex !== -1) {
        localStorage[accessIndex].value = data.access;
      }
      if (refreshIndex !== -1 && data.refresh) {
        localStorage[refreshIndex].value = data.refresh;
      }

      fs.writeFileSync(authFile, JSON.stringify(storageState, null, 2));

      console.log("✅ Tokens refreshed successfully");
    } else {
      console.log(`⚠️ Token refresh failed with status: ${response.status}`);
    }
  } catch (error) {
    console.error("❌ Error refreshing tokens:", error);
  }
}

/**
 * Refuses to run the suite while a Celery worker is up.
 *
 * These tests must never cause a message to be sent through any provider. The Dispatch button
 * is not the only way that happens: care_im_wrapper registers
 * `dispatch_pending_notification_recipients` on Celery beat (every
 * NOTIFICATION_DISPATCH_INTERVAL_SECONDS, 120s by default), and it sweeps *every* recipient
 * with `latest_status IS NULL` regardless of facility. So any event this suite creates is a
 * pending send, and a running worker would deliver it to the real phone numbers in the
 * fixture data.
 *
 * A worker that cannot consume cannot send, which makes stopping it the only guarantee worth
 * relying on -- so this aborts rather than warns. Unlike the prerequisite checks below, a
 * mistake here reaches actual people.
 */
function assertNoCeleryWorker() {
  const container = process.env.CARE_CELERY_CONTAINER || "care-celery-1";

  let running = "";
  try {
    running = execFileSync(
      "docker",
      [
        "ps",
        "--filter",
        `name=${container}`,
        "--filter",
        "status=running",
        "--format",
        "{{.Names}}",
      ],
      { stdio: "pipe", timeout: 15000, encoding: "utf-8" },
    ).trim();
  } catch {
    // No docker here (CI runs the worker differently, if at all). Say so rather than
    // implying the check passed.
    console.log(
      `⚠️ Could not check whether a Celery worker is running (no docker). Ensure "${container}" is stopped.`,
    );
    return;
  }

  if (running) {
    throw new Error(
      [
        "",
        `Refusing to run: the Celery worker "${running}" is running.`,
        "",
        "This suite creates notification events. care_im_wrapper sweeps pending recipients",
        "every ~2 minutes and dispatches them for real, to the real phone numbers in the",
        "fixture data — no Dispatch click required.",
        "",
        `Stop it first:  docker stop ${container}`,
        "",
      ].join("\n"),
    );
  }
}

/**
 * Warn early when a prerequisite process is not answering. care_fe's own setup logs and
 * continues rather than throwing, so this does the same: a clear line here beats a wall of
 * navigation timeouts later.
 */
async function checkPrerequisites() {
  const targets = [
    {
      name: "care_fe",
      url: process.env.CARE_FE_URL || "http://localhost:4000",
    },
    {
      name: "care backend",
      url: process.env.REACT_CARE_API_URL || "http://localhost:9000",
    },
  ];

  for (const target of targets) {
    try {
      await fetch(target.url, { method: "HEAD" });
    } catch {
      console.log(
        `⚠️ ${target.name} is not answering at ${target.url} — see tests/README.md`,
      );
    }
  }
}

/**
 * Global setup that runs once before all tests.
 * 1. Warns about missing prerequisite processes
 * 2. Refreshes authentication tokens
 */
async function globalSetup(_config: FullConfig) {
  // First, before anything creates data: nothing this suite does may reach a real recipient.
  assertNoCeleryWorker();
  await checkPrerequisites();
  await refreshTokens();
}

export default globalSetup;
