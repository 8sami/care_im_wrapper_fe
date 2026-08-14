# Week 11 — Frontend tests & documentation (implementation plan)

Timeline deliverables (Aug 3–9):

1. Playwright tests covering all functionality of the frontend plugin.
2. Documentation in MDX, in `/docs` at the repo root.
3. Every test passes.

Written against `care_im_wrapper_fe` at `8d47f63`, `care` at its current checkout, and
`care_fe`'s test suite.

**Governing rule for the test half: do what `care_fe` does, and only what `care_fe` does.**
Every structural choice traces to `care_fe`'s `playwright.config.ts`,
`tests/PLAYWRIGHT_GUIDE.md`, `tests/README.md`, or an existing spec. Where `care_fe` has no
precedent for a kind of test, this plan does not invent one — §4.3 lists what is
deliberately left untested, with the reason for each.

---

## 1. Host strategy

This plugin is not an app. It is a module-federation remote (`vite.config.mts` exposes
`./manifest`); its screens exist only once `care_fe` mounts them at
`/facility/:facilityId/settings/notifications` and `/admin/notification-templates`.
`npm run preview` on :10120 serves `remoteEntry.js`, not a UI. So the suite needs a host.

**Decision: run against a real `care_fe` + real backend, registering the plugin at
runtime.** Three processes:

| Process | Port | Provided by |
| --- | --- | --- |
| care backend (with `care_im_wrapper` installed) | 9000 | existing local Docker sandbox (`care-backend-1`) |
| `care_fe`, built, `npm run preview` | 4000 | local checkout |
| this plugin, built, `npm run preview` | 10120 | Playwright `webServer` |

Rejected: putting the specs in `care_fe` (violates the no-core-modification constraint,
and the tests wouldn't ship with the plugin); a standalone harness with `page.route()`
mocks (`care_fe` never mocks the network — its suite runs against a live backend — and a
mocked suite would be blind to federation loading, the i18n namespace, and facility
permissions, which is where this plugin's real failures live).

### Runtime registration — no `care_fe` fork, no rebuild

`care_fe` merges plugin configs from build-time (`REACT_ENABLED_APPS`) and the backend API
(`src/Utils/plugConfig.ts`). The backend viewset (`care/users/api/viewsets/plug_config.py`)
allows unauthenticated `GET`, `IsAdminUser` writes, and busts its own list cache on create.
So a superuser token registers the remote against a stock, prebuilt `care_fe`:

```http
POST /api/v1/plug_config/
{
  "slug": "care_im_wrapper",
  "meta": {
    "name": "care_im_wrapper",
    "url": "http://localhost:10120/assets/remoteEntry.js",
    "package": "ohcnetwork/care_im_wrapper_fe"
  }
}
```

Verified details:

- `vite.config.mts` sets `filename: "remoteEntry.js"`, and the build puts it at
  **`dist/assets/remoteEntry.js`**. Verified by probing the preview server: `/remoteEntry.js`
  is a 404, `/assets/remoteEntry.js` is a 200. The URL above and the `webServer.url` health
  check must both use that path.
- `meta.name` must be exactly `care_im_wrapper`: `care_fe/src/i18n.ts` derives the i18next
  namespace from `meta.name || slug`, and `src/hooks/useTranslation.ts` reads that
  namespace. This is a setup precondition, not a spec assertion — if it is wrong, every
  spec fails at once.
- Locale JSON is fetched from the remote's own origin. `dist/locale/en.json` exists after
  build, and the preview server sets `cors: { origin: "*" }`, so `:10120/locale/en.json`
  resolves.
- Plugin `navItems` render through `care_fe`'s `FacilityNav` as links prefixed with
  `/facility/{id}/`, giving `/facility/{id}/settings/notifications`.

**Celery must be stopped for the run — this is a safety requirement, not a convenience.**
`sync` and `dispatch` are both `.delay()` calls returning `202 {"detail": …}` immediately
(`api/viewsets.py:158`, `:426`), so with no worker recipients stay `latest_status = null`
("pending") and assertions are deterministic.

The stronger reason: celery beat runs `dispatch_pending_notification_recipients` **every 120
seconds** (`NOTIFICATION_DISPATCH_INTERVAL_SECONDS`, registered in `apps.py:ready()`). It
sweeps every recipient with `latest_status IS NULL`, ignores `facility_id` entirely, and has
no dry-run gate. So **merely creating an event sends a real WhatsApp message within two
minutes**, without any test calling dispatch — and the fixture patients carry real phone
numbers. Any suite that exercises the create flow against a running worker will send real
messages to real people. Stop the worker before running, and verify it is stopped.

---

## 2. Seed fixture (do this first — three flows are untestable without it)

Two facts from the backend make seeding mandatory rather than optional:

1. **No manual trigger exists out of the box.** Every trigger seeded by migration
   (`0007`, `0013`, `0018`) is `trigger_type="signal"`, and `perform_create`
   (`api/viewsets.py`) rejects anything else: *"Only manual-type triggers can be used to
   create events via this endpoint."* `NotificationCreateEventPage` filters the dropdown to
   manual triggers and disables submit when there are none — so with a stock DB the create
   spec can only ever assert the empty state.
2. **Templates only arrive via provider `sync`**, which needs real Meta credentials. They
   cannot be created through the UI or the API.

**Decision: add a `seed_notification_test_data` management command to `care_im_wrapper`**
(the backend repo already has the precedent — `seed_notification_variable_mappings.py`).
It creates, idempotently:

| Object | Fields that matter |
| --- | --- |
| `NotificationTrigger` | `slug="e2e_manual"`, `trigger_type="manual"`, `is_active=True`, a `context_slug` that yields schema fields |
| `NotificationTemplate` ×1 | approved + `is_active=True`, with a `payload` body containing at least one variable, and a valid `variable_mapping` |
| `NotificationTemplate` ×1 | `is_active=False` — proves the create form lists active templates only, and gives the activate/deactivate toggle something to flip |

Run it once, then `npm run playwright:db-snapshot`; `globalSetup` restores that snapshot
before every run. This is exactly `care_fe`'s fixtures model, and it makes the suite
repeatable rather than order-dependent.

Events, which *are* creatable via `POST /notification-events/`, are seeded per-run in a
setup project with `request.post` + `getApiHeaders()` — the same approach as `care_fe`'s
`questionnaire.setup.ts`.

---

## 3. Test infrastructure — a port of `care_fe`'s, not a redesign

```
care_im_wrapper_fe/
  playwright.config.ts
  scripts/playwright-db.sh          # ported from care_fe (snapshot/restore/reset)
  .gitignore                        # + tests/.auth
  tests/
    tsconfig.json
    README.md                       # ported, with this repo's three prerequisites
    globalSetup.ts                  # ported: DB restore, then token refresh
    .auth/                          # gitignored
    setup/
      auth.setup.ts                 # admin          -> tests/.auth/user.json          (verbatim)
      facilityAdmin.setup.ts        # facility admin -> tests/.auth/facilityAdmin.json (verbatim)
      nurse.setup.ts                # nurse          -> tests/.auth/nurse.json         (verbatim)
      facility.setup.ts             # enter facility via UI, save id                   (verbatim)
      plugin.setup.ts               # NEW — POST the PlugConfig row (no care_fe analogue)
      notification.setup.ts         # seed events via API (models questionnaire.setup.ts)
    support/
      facilityId.ts                 # ported verbatim
      templateSlug.ts               # same shape as facilityId.ts
    helper/
      utils.ts                      # getApiHeaders / getApiUrl (ported verbatim)
      error.ts                      # getFieldErrorMessage (ported verbatim — see below)
      ui.ts                         # only helpers care_fe already names: expectToast,
                                    #   getCardByTitle, verifyTableBadges,
                                    #   selectFromCommand, selectFromFilterSelect
    facility/settings/notifications/    # mirrors the plugin's facility routes
    admin/notificationTemplates/        # mirrors the plugin's admin routes
```

The tree mirrors the **route** structure, as `care_fe` does
(`tests/facility/settings/locations/`, `tests/admin/valueset/`), camelCase dirs
(pitfall #8), files named `featureAction.spec.ts`.

Three ported helpers are confirmed compatible with this repo's components:

- `getFieldErrorMessage` looks for `[data-slot="form-message"]`; the plugin's
  `src/components/ui/form.tsx:151` emits exactly that.
- Table assertions use `[data-slot="table-body"]`; the plugin's `ui/table.tsx` emits
  `data-slot` throughout, as do `card.tsx` and `badge.tsx`.
- `getByRole("heading", …)` works: `Common/PageTitle.tsx` renders the page title as `<h2>`.

`package.json` — `care_fe`'s script names verbatim, so muscle memory transfers:

```jsonc
"devDependencies": { "@playwright/test": "^1.x", "@faker-js/faker": "^9.x", "dotenv": "^17.x" },
"scripts": {
  "playwright:test": "playwright test",
  "playwright:test:ui": "playwright test --ui",
  "playwright:test:headed": "playwright test --headed",
  "playwright:install": "playwright install --with-deps",
  "playwright:show-report": "playwright show-report",
  "playwright:db-snapshot": "bash scripts/playwright-db.sh snapshot",
  "playwright:db-restore": "bash scripts/playwright-db.sh restore",
  "playwright:db-reset": "bash scripts/playwright-db.sh reset"
}
```

`playwright.config.ts` — `care_fe`'s config with two edits and nothing else:

```ts
export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  globalSetup: "./tests/globalSetup",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: undefined,
  reporter: process.env.CI
    ? [["html"], ["json", { outputFile: "test-results.json" }], ["list"]]
    : "html",
  use: {
    baseURL: process.env.CARE_FE_URL || "http://localhost:4000",  // edit 1: the host, configurable
    video: "on-first-retry",
    trace: "on-first-retry",
    navigationTimeout: 15000,
    actionTimeout: 10000,
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/, fullyParallel: false },
    { name: "chromium", use: { ...devices["Desktop Chrome"] },
      dependencies: process.env.CI ? [] : ["setup"] },
    // firefox / webkit / mobile stay commented out, as in care_fe.
  ],
  webServer: {                                    // edit 2: our server is the remote, not the host
    command: "npm run build && npm run preview",
    url: "http://localhost:10120/remoteEntry.js",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

`globalSetup.ts` is ported as-is: DB restore, then token refresh, with `console.log`
warnings that continue rather than throw — matching `care_fe`'s behaviour when a snapshot
or auth file is missing.

`plugin.setup.ts` (the one genuinely new file) runs first in the serial setup project:
POST the `PlugConfig` row with `getApiHeaders()`, then load `/` and wait for the
Notifications nav link, which proves the remote fetched, the manifest parsed, and the
namespace resolved.

---

## 4. Test suites

### 4.1 Coverage map

| Spec | Covers |
| --- | --- |
| `facility/settings/notifications/notificationList.spec.ts` | Sidebar link reaches the page; seeded events render in `[data-slot="table-body"]`; All/Urgent tabs change the rows; the trigger `Select` changes the rows; a filter matching nothing shows the empty state (faker-uuid pattern from `departmentCreate.spec.ts`); a row click lands on the detail URL |
| `.../notificationCreate.spec.ts` | Empty submit raises field errors on title / trigger / template via `getFieldErrorMessage`; submitting with no recipient shows the recipients error; the trigger dropdown offers the seeded manual trigger and no signal triggers; the template dropdown offers the active template and not the inactive one; the urgent switch toggles; Cancel returns to the list; a valid submit toasts and lands on `…/notifications/{id}` with the faker title visible |
| `.../notificationRecipients.spec.ts` | The recipient picker as a `selectFromCommand` case: search the seeded patient, select, badge appears; remove via the badge button; the same for staff |
| `.../notificationDetail.spec.ts` | Title, urgent badge, created-by line, message-details card; the recipients table lists recipients with their status text (`verifyTableBadges`); the back link returns to the list |
| `.../notificationDispatch.spec.ts` | Dispatch from the row dropdown and from the detail page: confirm dialog, `expectToast` on the 202 detail; the action is disabled when nothing is pending |
| `.../notificationPermissions.spec.ts` | Nested `describe` per role with `test.use({ storageState })`, modelled on `billing/updateAccountPermission.spec.ts` — see the matrix in §4.2 |
| `admin/notificationTemplates/templateList.spec.ts` | Templates table with name / channel / category / approval columns; "Sync templates" toasts; activate ⇄ deactivate flips the badge and toasts; a row click opens the variables page |
| `admin/notificationTemplates/variableMapping.spec.ts` | The message body renders from the seeded payload; the available-fields picker inserts a token into an input; "Preview" renders values; Save toasts and returns to the list; Cancel returns without saving |

Eight spec files, ~35 tests. Every route in `routes.tsx` and every mutation in
`lib/api/notifications.ts` is exercised at least once.

### 4.2 Permission matrix (from `care_im_wrapper/security/permissions.py`)

| Permission | admin | facility admin | nurse |
| --- | :-: | :-: | :-: |
| `can_read_notification_event` | ✓ | ✓ | ✓ |
| `can_create_notification_event` | ✓ | ✓ | ✗ |
| `can_dispatch_notification_event` | ✓ | ✓ | ✗ |
| `can_read_notification_template` | ✓ | ✓ | ✓ |
| `can_manage_notification_template` | ✓ | ✓ | ✗ |

So the spec is a clean two-role contrast, and every storage state it needs already exists
in `care_fe` and is ported:

- **facility admin** (`tests/.auth/facilityAdmin.json`) — sees the list, the "New
  notification" button, and the Dispatch action.
- **nurse** (`tests/.auth/nurse.json`) — sees the list, but no "New notification" button
  and no Dispatch action; navigating to `…/notifications/new` directly shows the
  no-permission text instead of the form (`NotificationCreateEventPage.tsx:146`).

### 4.3 Conventions every spec follows

From `PLAYWRIGHT_GUIDE.md`:

- `test.use({ storageState: "tests/.auth/user.json" })` at the top of every file.
- `beforeAll`/`beforeEach` pulls `getFacilityId()`; URLs are inline template literals (the
  guide's "Common URLs" section) — no bespoke nav helper module.
- Role-based locators; `exact: true` on ambiguous labels; `.first()` where several nodes
  can match; CSS only for `[data-slot="table-body"]` / `[data-slot="card"]`, which the
  guide sanctions.
- `test.step()` around each phase.
- `faker` or `Date.now()` for every created entity name — never a hardcoded title.
- No hardcoded `{ timeout: … }`; wait on visibility, or `waitForLoadState("networkidle")`.
- `expectToast()` for toasts, `getFieldErrorMessage()` for field errors,
  `verifyTableBadges()` for status badges.

### 4.4 Deliberately not tested (no `care_fe` precedent)

| Not tested | Why |
| --- | --- |
| Mobile card layouts (`md:hidden` branches) | `care_fe` has every mobile/tablet project commented out in `playwright.config.ts`. Adding one would mean this repo inventing a viewport policy the core repo declined. |
| i18n / raw-key sweeps | `care_fe` has zero translation assertions. A missing namespace fails every spec anyway. |
| Auto-refresh polling on the detail page | Would need wall-clock waits — pitfall #7. `care_fe` never asserts a poll. |
| Copy-to-clipboard in the delivery-error dialog | No clipboard assertion exists anywhere in `care_fe`'s suite. |
| Skeleton / loading states | Never asserted in `care_fe`; racy by construction. |
| Badge *colours* / variant mapping | `verifyTableBadges` checks badge **text**; `care_fe` never asserts styling. |
| Unknown-id / not-found routes | No 404-route spec in `care_fe`. |
| Query-string internals (`?trigger=`, `?page=`) | `care_fe` asserts `toHaveURL` for **navigation** only; filter behaviour is asserted through table contents. |
| `lib/config.ts`, `lib/format.ts`, `lib/permissions.ts` as units | `care_fe` runs no unit tests over `src/` — only `plugins/**/*.test.ts` for its Vite plugins. Behaviour is covered end-to-end instead. |

### 4.5 Source changes needed first

Small, in this repo, and required for role-based selectors to work at all — the guide's
"⚠️ Avoid CSS selectors" rule cannot be honoured against a button with no accessible name:

1. Row action triggers `<Button variant="ghost" size="icon"><CareIcon icon="l-ellipsis-v" /></Button>`
   at `NotificationEventsPage.tsx:350` and `NotificationTemplatesPage.tsx:255,321` need
   `aria-label={t("actions")}`.
2. The "see error" and "copy" icon buttons in `NotificationEventDetailPage.tsx` need the
   same treatment.

Nothing else: forms already use `FormLabel`, the picker's remove button already has
`aria-label={t("remove")}`, and the table/card primitives already emit `data-slot`.

---

## 5. Documentation (`/docs`, MDX)

`docs/` is now empty: the week 7–8 planning notes have been deleted, and the two working
documents still in use — the demo VPS runbook and this plan — moved to `notes/` at the repo
root. So `docs/` is built fresh as published documentation, with no working notes mixed in.

**Organised per [Diátaxis](https://diataxis.fr/): four modes, one mode per page, directories
named for the user's need rather than for the plugin's features.**

```
docs/
  index.mdx                             # the map: what the plugin is, and which of the four
                                        # sections answers which kind of question

  tutorial/
    first-notification.mdx              # learning-oriented, end to end: register the plugin in a
                                        # dev care_fe, seed, send a manual notification, watch it settle

  how-to/
    register-the-plugin.mdx             # REACT_ENABLED_APPS vs the PlugConfig API
    send-a-manual-notification.mdx
    dispatch-pending-recipients.mdx
    activate-or-deactivate-a-template.mdx
    map-template-variables.mdx
    diagnose-a-failed-delivery.mdx      # the status history and the raw provider payload
    add-a-translated-string.mdx
    run-the-test-suite.mdx              # the three processes, seed + snapshot, Celery off
    fix-plugin-loading.mdx              # the ngrok interstitial that looks like CORS; the
                                        # federation dynamic-import origin trap; stale remoteEntry

  reference/
    routes.mdx                          # every route in routes.tsx and the permission gating it
    api.mdx                             # lib/request.ts contract + the endpoint table
    configuration.mdx                   # every lib/config.ts key, its default and effect;
                                        # window.__CARE_PLUGIN_RUNTIME__ injection
    permissions.mdx                     # the five slugs + the role matrix from §4.2
    i18n.mdx                            # namespace, en.json location, key conventions

  explanation/
    architecture.mdx                    # module federation, the manifest, why static imports only
    mirrored-types.mdx                  # why care_fe and backend types are copied, not imported
    notification-model.mdx              # trigger → template → event → recipient; manual vs signal;
                                        # why dispatch is asynchronous
```

Everything under `docs/` is published documentation in one of the four modes. Working
documents (this plan, the demo VPS runbook) live in `notes/` at the repo root and are not
part of the doc set.

What this changes from a feature-shaped layout: **the per-screen `pages/*` set is dissolved.**
A page like "notification-events.mdx" inevitably mixes modes — half "what this control does"
(reference), half "how to filter and dispatch" (how-to) — which is the one thing Diátaxis
tells you not to do. Its content is split into `how-to/` for the goals and `reference/` for
the facts. Likewise `troubleshooting.mdx` becomes how-to guides (troubleshooting is
goal-oriented), and `installation.mdx` splits: the procedure into `how-to/register-the-plugin`,
the slug / `meta.name` / `dist/remoteEntry.js` contract into `reference/`.

Where the framework fits loosely, say so rather than forcing it: the audience is CARE
developers and operators who already run `care_fe`, so **one** tutorial is enough — a second
would just restate the how-to guides. Reference carries the most weight here.

Two further decisions:

- **MDX files, no site framework.** The timeline asks for MDX in `/docs`; plain `.mdx`
  renders on GitHub and reviews cleanly in PRs. Add `@mdx-js/rollup` and a `docs:dev` entry
  only if a browsable site is actually wanted later.
- **A docs site must not take the Pages root.** GitHub Pages for this repo serves the built
  plugin, which is what `care_fe`'s `care.config.ts` resolves plugin URLs to. Any site goes
  under a subpath or a separate branch, or plugin loading breaks in every Pages-based
  deployment.

Screenshots are captured manually into `docs/images/`. (An earlier draft proposed
generating them from a Playwright spec; `care_fe` has no such spec, so it is dropped along
with everything else in §4.4.)

---

## 6. CI

`.github/workflows/playwright.yaml`, modelled on `care_fe`'s — which already solves the
hard part (checkout `ohcnetwork/care`, docker compose, cached images, wait for :9000,
`dorny/paths-filter` so unrelated PRs skip). Deltas:

1. Install `care_im_wrapper` into the backend image so `/api/care_im_wrapper/` exists.
2. Run `seed_notification_test_data`; do **not** start the Celery worker.
3. Checkout + build `care_fe`, serve on :4000.
4. Build this plugin, serve on :10120 (Playwright's `webServer` handles this).
5. `npx playwright test`; upload the HTML report artifact.
6. One shard — `care_fe` shards 3 ways for ~500 tests; ~35 doesn't warrant it.

---

## 7. Sequencing

| Step | Work | Done when |
| --- | --- | --- |
| 1 | `seed_notification_test_data` in the backend plugin (§2) | Command creates the manual trigger + two templates idempotently |
| 2 | Deps, `playwright.config.ts`, `tests/` skeleton, ported `globalSetup` + `playwright-db.sh`, `.gitignore` entry | `npx playwright test --list` runs |
| 3 | Setup projects: `plugin` → `auth` / `facilityAdmin` / `nurse` → `facility` → `notification` | A one-line spec reaches the notifications page and sees translated copy |
| 4 | Seed + `npm run playwright:db-snapshot`; `support/*` accessors | A restore reproduces facility + manual trigger + both templates + events |
| 5 | `aria-label` fixes (§4.5) | `getByRole("button", { name: "Actions" })` resolves |
| 6 | Specs in order: list → create → recipients → detail → dispatch → permissions → templateList → variableMapping | Each green before the next starts |
| 7 | `tests/README.md` | A newcomer runs the suite from the README alone |
| 8 | MDX docs (§5) | Every route and config key documented |
| 9 | CI workflow (§6) | Green on a PR |

**Acceptance:** `npm run playwright:test` green from a clean checkout given the three
processes of §1; every route in `routes.tsx` and every entry in `lib/api/notifications.ts`
touched by at least one test; `/docs` carries the four Diátaxis sections of §5, with every
route, config key, permission slug and API endpoint appearing in `reference/`, and each page
staying in a single mode.

---

## 8. Residual risks

- **The suite needs a `care_fe` checkout.** No checkout, no run. This matches `care_fe`'s
  own posture toward the backend (`tests/README.md` prerequisite #1); document it and let
  `globalSetup` log a clear warning when :4000 doesn't answer.
- **Celery must be stopped**, or dispatched recipients transition to `failed` against a
  real provider. Documented in `tests/README.md`; the dispatch spec asserts the pending
  state explicitly so a running worker fails loudly rather than flaking.
- **Template sync is provider-backed**, so the sync test asserts the queued toast, not that
  new templates appear. Anything stronger would need a stub provider in the backend — out
  of scope for week 11.
- **The seed command lands in the backend repo**, so week 11 touches two repos. It is a
  small, additive, test-only command alongside an existing one; if it must be avoided, the
  fallback is `docker exec … manage.py shell` from `plugin.setup.ts`, which works but is
  more fragile across schema changes.
