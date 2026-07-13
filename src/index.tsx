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

interface PlugConfigMeta {
  url?: string;
  name?: string;
  [key: string]: unknown;
}

declare global {
  interface Window {
    CARE_API_URL: string;
    __CORE_ENV__: Record<string, unknown>;
    __CARE_PLUGIN_RUNTIME__: { meta: PlugConfigMeta };
    AuthUserContext: Context<AuthContextType | null>;
  }
}

export const CARE_API_URL = window.CARE_API_URL;
