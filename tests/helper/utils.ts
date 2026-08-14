import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Ported from care_fe's tests/helper/utils.ts (the API-header half; care_fe's expectedSlug
// has no counterpart here, since this plugin generates no slugs client-side).

const AUTH_PATH = path.resolve("tests/.auth/user.json");

/**
 * Playwright's setup project serialises tests within a file, not across files, so a setup
 * that needs a token can start before auth.setup.ts has written one. care_fe hits the same
 * problem and solves it by running the missing setup on demand — see its
 * tests/support/facilityId.ts. This does the same for the auth state.
 */
function ensureAuthState(): void {
  if (fs.existsSync(AUTH_PATH)) return;

  console.warn("⚠️ Auth state missing — running auth setup...");
  try {
    execSync("npx playwright test --project=setup tests/setup/auth.setup.ts", {
      stdio: "inherit",
      cwd: process.cwd(),
    });
  } catch (error) {
    throw new Error(
      `Failed to run auth setup: ${error instanceof Error ? error.message : error}`,
    );
  }
}

export function getApiHeaders(): {
  Authorization: string;
  "Content-Type": string;
} {
  ensureAuthState();
  const storageState = JSON.parse(fs.readFileSync(AUTH_PATH, "utf-8"));
  const localStorage = storageState.origins?.[0]?.localStorage ?? [];
  const tokenEntry = localStorage.find(
    (item: { name: string; value: string }) =>
      item.name === "care_access_token",
  );
  if (!tokenEntry) throw new Error("No access token in auth storage state");
  return {
    Authorization: `Bearer ${tokenEntry.value}`,
    "Content-Type": "application/json",
  };
}

export function getApiUrl(): string {
  return process.env.REACT_CARE_API_URL || "http://localhost:9000";
}
