import { expect, test as setup } from "@playwright/test";

// Ported from care_fe's tests/setup/auth.setup.ts. The login screen belongs to care_fe,
// so the flow is identical.

const authFile = "tests/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Navigate to login page
  await page.goto("/login");

  // Fill in credentials
  // These should match the credentials from your local backend setup
  await page.getByRole("textbox", { name: /username/i }).fill("admin");
  await page.getByLabel(/password/i).fill("admin");

  // Click login button
  await page.getByRole("button", { name: /login/i }).click();

  // Wait for successful login
  await page.waitForURL(/(?!.*login)/, { timeout: 15000 });

  // Verify we're logged in by checking for user-specific elements
  await expect(page.getByRole("heading", { name: /^Hey .+/ })).toBeVisible();

  // Save signed-in state to 'authFile'
  await page.context().storageState({ path: authFile });
});
