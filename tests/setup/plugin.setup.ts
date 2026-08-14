import { expect, test as setup } from "@playwright/test";
import { getApiHeaders, getApiUrl } from "tests/helper/utils";

// The plugin slug. It is also the i18next namespace care_fe derives from `meta.name`
// (see care_fe's src/i18n.ts) and the namespace src/hooks/useTranslation.ts reads, so the
// two must match exactly or every screen renders raw translation keys.
const SLUG = "care_im_wrapper";

// Module federation resolves this URL in the browser, so it must be reachable from there,
// not just from the test runner.
const REMOTE_URL = `${process.env.PLUGIN_URL || "http://localhost:10120"}/assets/remoteEntry.js`;

/**
 * Registers this plugin with care_fe. No care_fe analogue -- care_fe's own suite has
 * nothing to mount.
 *
 * care_fe merges plugin configs from build-time env and the backend API
 * (src/Utils/plugConfig.ts), so writing a PlugConfig row lets a stock, already-built
 * care_fe load the remote at runtime. The viewset allows unauthenticated GET and
 * IsAdminUser writes, and clears its own list cache on write.
 */
setup("register the plugin with care_fe", async ({ request, page }) => {
  const body = {
    slug: SLUG,
    meta: {
      name: SLUG,
      url: REMOTE_URL,
      package: "ohcnetwork/care_im_wrapper_fe",
    },
  };

  const existing = await request.get(
    `${getApiUrl()}/api/v1/plug_config/${SLUG}/`,
  );

  const response = existing.ok()
    ? await request.patch(`${getApiUrl()}/api/v1/plug_config/${SLUG}/`, {
        headers: getApiHeaders(),
        data: body,
      })
    : await request.post(`${getApiUrl()}/api/v1/plug_config/`, {
        headers: getApiHeaders(),
        data: body,
      });

  expect(
    response.ok(),
    `Failed to register plugin: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();

  // Prove the remote is actually reachable from a browser, not merely registered. A
  // registered-but-unreachable remote fails much later and far less legibly.
  const remote = await page.request.get(REMOTE_URL);
  expect(
    remote.ok(),
    `remoteEntry.js not served at ${REMOTE_URL} — is the plugin preview running?`,
  ).toBeTruthy();

  console.log(`✅ Plugin registered: ${SLUG} → ${REMOTE_URL}`);
});
