// Frontend config, mirroring the backend's settings.py DEFAULTS pattern: hardcoded defaults
// overridable per deployment. care_fe injects the operator-supplied dict onto
// window.__CARE_PLUGIN_RUNTIME__.meta[<slug>].config (see index.tsx / care_fe PluginEngine);
// values there win over the defaults below.

const SLUG = "care_im_wrapper";

interface WrapperConfig {
  // Event-detail poll cadence while any recipient is still unsettled.
  pollIntervalMs: number;
  // Grace period before refetching templates after a sync is queued (a background task).
  syncRefreshDelayMs: number;
  // Debounce before a search query fires (recipient/patient pickers).
  searchDebounceMs: number;
  // Minimum characters before a picker search runs.
  searchMinLength: number;
  // Page size for the paginated admin lists (templates, events).
  listPageSize: number;
  // Page size for the recipients table on the event-detail page.
  recipientsPageSize: number;
  // Cap on patient/user picker search results.
  searchResultsLimit: number;
  // One-shot fetch size for a static catalog (all templates / all triggers).
  catalogFetchLimit: number;
  // How long a fetched catalog stays fresh before React Query refetches it.
  catalogStaleMs: number;
}

const DEFAULTS: WrapperConfig = {
  pollIntervalMs: 5000,
  syncRefreshDelayMs: 3000,
  searchDebounceMs: 500,
  searchMinLength: 2,
  listPageSize: 15,
  recipientsPageSize: 10,
  searchResultsLimit: 10,
  catalogFetchLimit: 100,
  catalogStaleMs: 5 * 60 * 1000,
};

// Overrides arrive as unknown, so coerce each key rather than trusting the shape.
function positiveNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

let resolved: WrapperConfig | null = null;

// Resolved lazily on first access, not at import: care_fe populates
// window.__CARE_PLUGIN_RUNTIME__ in an effect, which can run after this module loads.
// Only cache once the runtime is actually present, so an early read can't freeze the
// defaults in before the operator overrides arrive.
function resolve(): WrapperConfig {
  if (resolved) return resolved;
  const runtime = window.__CARE_PLUGIN_RUNTIME__;
  const overrides = runtime?.meta?.[SLUG]?.config ?? {};
  const computed = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof WrapperConfig)[]) {
    computed[key] = positiveNumberOr(overrides[key], DEFAULTS[key]);
  }
  if (runtime) resolved = computed;
  return computed;
}

export const config = {} as WrapperConfig;
for (const key of Object.keys(DEFAULTS) as (keyof WrapperConfig)[]) {
  Object.defineProperty(config, key, {
    get: () => resolve()[key],
    enumerable: true,
  });
}
