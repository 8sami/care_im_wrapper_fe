import { faker } from "@faker-js/faker";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { getFieldErrorMessage } from "tests/helper/error";
import { expectToast } from "tests/helper/ui";
import { getFacilityId } from "tests/support/facilityId";

test.use({ storageState: "tests/.auth/user.json" });

let facilityId: string;

test.beforeAll(() => {
  facilityId = getFacilityId();
});

// Seeded by the backend's seed_notification_test_data command. "Appointment" matches the
// migration-seeded signal triggers, which must never be offered here.
const MANUAL_TRIGGER = "E2E Manual Notification";
const ACTIVE_TEMPLATE = "E2E Active Template";
const INACTIVE_TEMPLATE = "E2E Inactive Template";
const SIGNAL_TRIGGER = /appointment/i;
const PATIENT = "sami";

/**
 * The form's Select fields are Radix triggers — buttons, not labelable elements — so their
 * `<label for>` gives them no accessible name and their name is whatever they currently
 * display. Scoping by the FormItem that holds the label is stable whether the field still
 * shows its placeholder or an already-chosen value.
 */
function field(page: Page, label: string) {
  return page
    .locator('[data-slot="form-item"]')
    .filter({ has: page.getByText(label, { exact: true }) });
}

async function selectOption(page: Page, label: string, option: string) {
  await field(page, label).getByRole("combobox").click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/** The patient and staff pickers are identical widgets, so anything asserted inside one
 * must be scoped to it — their empty and "keep typing" states are the same text. */
function picker(page: Page, placeholder: string) {
  return page
    .locator('[data-slot="command"]')
    .filter({ has: page.getByPlaceholder(placeholder) });
}

async function pickRecipient(page: Page, placeholder: string, search: string) {
  await page.getByPlaceholder(placeholder).fill(search);
  await picker(page, placeholder)
    .getByRole("option", { name: new RegExp(search, "i") })
    .first()
    .click();
}

function badge(page: Page, text: string) {
  return page.locator('[data-slot="badge"]').filter({ hasText: text });
}

test.describe("create notification event", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/facility/${facilityId}/settings/notifications/new`);
    await expect(
      page.getByRole("heading", { name: "New notification" }),
    ).toBeVisible();
  });

  test("shows validation errors when required fields are empty", async ({
    page,
  }) => {
    await test.step("submit an empty form", async () => {
      await page.getByRole("button", { name: "Create" }).click();
    });

    await test.step("every required field is flagged", async () => {
      await expect(
        getFieldErrorMessage(page.getByRole("textbox", { name: "Title" })),
      ).toContainText("This field is required");
      await expect(
        field(page, "Trigger").locator('[data-slot="form-message"]'),
      ).toContainText("This field is required");
      await expect(
        field(page, "Template").locator('[data-slot="form-message"]'),
      ).toContainText("This field is required");
    });
  });

  test("refuses to submit without a recipient", async ({ page }) => {
    await test.step("fill everything except the recipients", async () => {
      await page
        .getByRole("textbox", { name: "Title" })
        .fill(`No recipients ${Date.now()}`);
      await selectOption(page, "Trigger", MANUAL_TRIGGER);
      await selectOption(page, "Template", `${ACTIVE_TEMPLATE} (whatsapp)`);
      await page.getByRole("button", { name: "Create" }).click();
    });

    await test.step("the recipients error appears", async () => {
      await expect(
        page.getByText("Add at least one patient or staff recipient."),
      ).toBeVisible();
    });
  });

  test("offers only manual triggers and only active templates", async ({
    page,
  }) => {
    await test.step("the trigger list excludes signal triggers", async () => {
      await field(page, "Trigger").getByRole("combobox").click();
      await expect(
        page.getByRole("option", { name: MANUAL_TRIGGER, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: SIGNAL_TRIGGER }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    await test.step("the template list excludes inactive templates", async () => {
      await field(page, "Template").getByRole("combobox").click();
      await expect(
        page.getByRole("option", { name: `${ACTIVE_TEMPLATE} (whatsapp)` }),
      ).toBeVisible();
      await expect(
        page.getByRole("option", { name: new RegExp(INACTIVE_TEMPLATE, "i") }),
      ).toHaveCount(0);
    });
  });

  test("creates a notification and it is visible afterwards", async ({
    page,
  }) => {
    const title = `${faker.word.words(3)} ${Date.now()}`;
    const description = faker.lorem.sentence();

    await test.step("fill in the form", async () => {
      await page.getByRole("textbox", { name: "Title" }).fill(title);
      await page
        .getByRole("textbox", { name: "Description" })
        .fill(description);
      await selectOption(page, "Trigger", MANUAL_TRIGGER);
      await selectOption(page, "Template", `${ACTIVE_TEMPLATE} (whatsapp)`);
      // The switch is a Radix button too, so it has no accessible name either; there is
      // exactly one on this form.
      await page.getByRole("switch").click();
      await pickRecipient(page, "Search patients…", PATIENT);
    });

    await test.step("submit", async () => {
      await page.getByRole("button", { name: "Create" }).click();
      await expectToast(page, "Notification created");
    });

    await test.step("it lands on the detail page for the new event", async () => {
      await page.waitForURL(/\/settings\/notifications\/[0-9a-f-]{36}$/);
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await expect(page.getByText(description)).toBeVisible();
      await expect(badge(page, "Urgent")).toBeVisible();
    });

    // Only listed here if the backend scoped the event to this facility. It used to be
    // created with no facility at all, which left it out of this list entirely.
    await test.step("it appears in the facility's list", async () => {
      await page.goto(`/facility/${facilityId}/settings/notifications`);
      await expect(
        page.locator('[data-slot="table-body"]').getByText(title),
      ).toBeVisible();
    });
  });
});
