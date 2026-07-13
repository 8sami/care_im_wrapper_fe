// Local mirror types for care_im_wrapper's notification API. This plugin
// can't import backend or care_fe types, only shape-match them.

// Mirrors care_fe's badge.tsx variant union by hand, since the plugin can't
// import the component's VariantProps type.
export type BadgeVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "danger"
  | "destructive"
  | "indigo"
  | "purple"
  | "blue"
  | "sky"
  | "cyan"
  | "teal"
  | "green"
  | "yellow"
  | "orange"
  | "pink";

export type TriggerType = "signal" | "manual";

export interface NotificationTrigger {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  trigger_type: TriggerType;
  is_active: boolean;
}

export type NotificationCategory = "marketing" | "utility" | "authentication";

export type TemplateApprovalStatus =
  | "pending"
  | "active"
  | "rejected"
  | "disabled";

export type TemplateParameterFormat = "positional" | "named";

export interface NotificationTemplate {
  id: string;
  name: string;
  slug: string;
  provider: string;
  category: NotificationCategory;
  approval_status: TemplateApprovalStatus;
  is_active: boolean;
  language_code: string | null;
  payload: Record<string, unknown> | null;
  variable_mapping: Record<string, unknown> | null;
  parameter_format: TemplateParameterFormat;
  created_date: string;
  modified_date: string;
}

export interface NotificationTemplateWrite {
  is_active: boolean;
  variable_mapping?: Record<string, unknown> | null;
}

// null means pending / not yet dispatched.
export type NotificationDeliveryStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export interface NotificationRecipient {
  id: string;
  event_id: string;
  recipient_phone: string;
  provider: string;
  tracking_id: string | null;
  latest_status: NotificationDeliveryStatus | null;
  created_date: string;
}

export interface NotificationEvent {
  id: string;
  trigger_id: string;
  template_id: string;
  title: string;
  description: string | null;
  is_urgent: boolean;
  variable_values: Record<string, unknown> | null;
  created_date: string;
  recipients: NotificationRecipient[];
}

export interface NotificationEventWrite {
  title: string;
  description?: string;
  is_urgent?: boolean;
  variable_values?: Record<string, unknown>;
  trigger_slug: string;
  template_slug: string;
  recipient_patient_ids?: string[];
  recipient_user_ids?: string[];
}

export interface NotificationEventDispatchResponse {
  detail: string;
}

// "pending" stands in for a null latest_status here.
export const NOTIFICATION_STATUS_BADGE: Record<
  "pending" | NotificationDeliveryStatus,
  BadgeVariant
> = {
  pending: "secondary",
  sent: "blue",
  delivered: "green",
  read: "primary",
  failed: "destructive",
};

export const TEMPLATE_APPROVAL_BADGE: Record<
  TemplateApprovalStatus,
  BadgeVariant
> = {
  active: "green",
  pending: "yellow",
  rejected: "destructive",
  disabled: "secondary",
};

export const NOTIFICATION_CATEGORY_BADGE: Record<
  NotificationCategory,
  BadgeVariant
> = {
  utility: "blue",
  marketing: "purple",
  authentication: "teal",
};

export const TRIGGER_TYPE_BADGE: Record<TriggerType, BadgeVariant> = {
  manual: "outline",
  signal: "secondary",
};
