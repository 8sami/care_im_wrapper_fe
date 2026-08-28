// The permission slugs the backend registers in
// care_im_wrapper/security/permissions.py. Named here so a call site cannot invent one:
// a mistyped string is not an error at runtime, it just returns false forever and hides
// the control with nothing logged anywhere.
export const PERMISSION_READ_NOTIFICATION_TEMPLATE =
  "can_read_notification_template";
export const PERMISSION_MANAGE_NOTIFICATION_TEMPLATE =
  "can_manage_notification_template";
export const PERMISSION_READ_NOTIFICATION_EVENT = "can_read_notification_event";
export const PERMISSION_DISPATCH_NOTIFICATION_EVENT =
  "can_dispatch_notification_event";

export type NotificationPermission =
  | typeof PERMISSION_READ_NOTIFICATION_TEMPLATE
  | typeof PERMISSION_MANAGE_NOTIFICATION_TEMPLATE
  | typeof PERMISSION_READ_NOTIFICATION_EVENT
  | typeof PERMISSION_DISPATCH_NOTIFICATION_EVENT;

export function hasPermission(
  permission: NotificationPermission,
  permissions: string[],
) {
  return permissions.includes(permission);
}
