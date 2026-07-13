import { ReactNode } from "react";

// index.css scopes all Tailwind utilities under .care-im-wrapper-container,
// so every route must render inside this wrapper or utilities won't apply.
export default function Layout({ children }: { children: ReactNode }) {
  return <div className="care-im-wrapper-container">{children}</div>;
}
