import { lazy } from "react";

const Welcome = lazy(() => import("./pages/Welcome"));

const routes = {
  "/im/wrapper/welcome": () => <Welcome />,
};

export default routes;
