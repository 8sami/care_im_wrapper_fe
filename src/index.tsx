import type { Context } from "react";

import "./index.css";

export { default as manifest } from "./manifest";
export { default as routes } from "./routes";

// Stubs for care_fe's real types; the plugin can't import them directly.
interface CurrentUserRead {
  id: string;
  username: string;
  permissions: string[];
  [key: string]: unknown;
}

interface AuthContextType {
  user: CurrentUserRead | undefined;
  [key: string]: unknown;
}

// Mirrors care_fe's PlugConfigMeta (src/types/plugConfig.ts). `config` is the operator-
// supplied dict passed when the plugin is registered in care_fe's plug config -- the FE
// analog of the backend's PLUGIN_CONFIGS. Read it via lib/config.ts.
interface PlugConfigMeta {
  url?: string;
  name?: string;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

declare global {
  interface Window {
    CARE_API_URL: string;
    __CORE_ENV__: Record<string, unknown>;
    // care_fe (PluginEngine.tsx) sets meta keyed by plugin slug, and only after plugins
    // load -- so both the global and the per-slug entry can be absent early.
    __CARE_PLUGIN_RUNTIME__?: { meta: Record<string, PlugConfigMeta> };
    AuthUserContext: Context<AuthContextType | null>;
  }
}
