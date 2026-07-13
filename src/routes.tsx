import Layout from "@/components/Common/Layout";

import NotificationEventsPage from "./pages/Notifications/NotificationEventsPage";
import NotificationTemplatesPage from "./pages/Notifications/NotificationTemplatesPage";
import Welcome from "./pages/Welcome";

// Static imports only: dynamic import()/React.lazy() inside a federation
// exposes module resolves its chunks against the host's origin instead of
// this plugin's own, breaking once mounted in care_fe.
const routes = {
  "/im/wrapper/welcome": () => (
    <Layout>
      <Welcome />
    </Layout>
  ),
  "/facility/:facilityId/settings/notifications": () => (
    <Layout>
      <NotificationEventsPage />
    </Layout>
  ),
  "/admin/notification-templates": () => (
    <Layout>
      <NotificationTemplatesPage />
    </Layout>
  ),
};

export default routes;
