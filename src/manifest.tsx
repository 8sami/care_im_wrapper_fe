import { createElement } from "react";

import CareIcon from "@/CAREUI/icons/CareIcon";

import publicRoutes from "./publicRoutes";
import routes from "./routes";

const manifest = {
  plugin: "care_im_wrapper",
  routes,
  publicRoutes,
  extends: [],
  components: {},
  devices: [],
  // url is relative; the host prefixes it with /facility/{id}.
  navItems: [
    {
      name: "Notifications",
      url: "settings/notifications",
      icon: createElement(CareIcon, { icon: "l-bell" }),
    },
  ],
  // Unlike navItems, adminNavItems are NOT facility-prefixed.
  adminNavItems: [
    {
      name: "Notification templates",
      url: "/admin/notification-templates",
      icon: createElement(CareIcon, { icon: "l-comment-alt-lines" }),
    },
  ],
} as const;

export default manifest;
