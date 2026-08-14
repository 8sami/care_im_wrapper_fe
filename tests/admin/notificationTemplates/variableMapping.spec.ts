import { expect, test } from "@playwright/test";
import { expectToast } from "tests/helper/ui";
import { getApiHeaders, getApiUrl } from "tests/helper/utils";

test.use({ storageState: "tests/.auth/user.json" });

const TEMPLATE_SLUG = "e2e_active_template";
// The variables in the seeded template's body: "Hello {{patient_name}} ... on {{date}}."
const VARIABLES = ["patient_name", "date"];

let templateId: string;

test.beforeAll(async ({ request }) => {
  const response = await request.get(
    `${getApiUrl()}/api/care_im_wrapper/notification-templates/?limit=100`,
    { headers: getApiHeaders() },
  );
  const template = (await response.json()).results.find(
    (t: { slug: string }) => t.slug === TEMPLATE_SLUG,
  );
  expect(template, `seeded template ${TEMPLATE_SLUG} is missing`).toBeTruthy();
  templateId = template.id;
});

test.describe("template variable mapping", () => {
  test("maps each variable in the template body and saves it", async ({
    page,
  }) => {
    // This mapping is what turns a provider template into a sendable message — an unmapped
    // or wrongly mapped variable is the difference between a correct message and a broken
    // one, so authoring and persisting it is the feature's core.
    // Every variable is required and each value must be a Jinja2 expression wrapped in
    // {{ ... }} — the backend rejects anything else.
    const value = `{{ "Mapped ${Date.now()}" }}`;

    await page.goto(`/admin/notification-templates/${templateId}/variables`);

    await test.step("the form offers one field per template variable", async () => {
      for (const variable of VARIABLES) {
        await expect(
          page.getByRole("textbox", { name: variable, exact: true }),
        ).toBeVisible();
      }
    });

    await test.step("fill every variable and save", async () => {
      for (const variable of VARIABLES) {
        await page
          .getByRole("textbox", { name: variable, exact: true })
          .fill(value);
      }
      await page.getByRole("button", { name: "Save" }).click();
      await expectToast(page, "Variable mapping updated");
    });

    await test.step("it returns to the template list", async () => {
      await expect(page).toHaveURL(/\/admin\/notification-templates$/);
    });

    await test.step("the mapping survives a reload", async () => {
      await page.goto(`/admin/notification-templates/${templateId}/variables`);
      await expect(
        page.getByRole("textbox", { name: VARIABLES[0], exact: true }),
      ).toHaveValue(value);
    });
  });
});
