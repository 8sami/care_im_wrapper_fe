// Local mirror types for care_im_wrapper's notification API; this plugin
// can't import backend or care_fe types, only shape-match them.

// Mirrors care_fe's badge.tsx variant union; the plugin can't import its VariantProps type.
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

// Object fields (object.<path>) may nest via fields; extra-context fields (a bare key) are always flat.
export interface NotificationSchemaField {
  key: string;
  display: string;
  description?: string;
  type: string;
  preview_value?: unknown;
  is_nested_context?: boolean;
  fields?: NotificationSchemaField[];
}

export interface NotificationTemplateSchema {
  contexts: { slug: string; display_name: string; description: string }[];
  object_fields: NotificationSchemaField[];
  extra_context_fields: NotificationSchemaField[];
}

export interface VariableMappingPreviewResponse {
  rendered: Record<string, string>;
  errors?: Record<string, string>;
  detail?: string;
}

// null means pending / not yet dispatched.
export type NotificationDeliveryStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed";

export type NotificationRecipientType = "patient" | "user";

export interface NotificationStatusEvent {
  state: NotificationDeliveryStatus;
  created_date: string;
  // Raw provider error body or dispatch exception on "failed"; null on normal transitions.
  payload: Record<string, unknown> | null;
}

export interface NotificationRecipient {
  id: string;
  event_id: string;
  recipient_phone: string;
  recipient_name: string | null;
  recipient_type: NotificationRecipientType | null;
  provider: string;
  tracking_id: string | null;
  latest_status: NotificationDeliveryStatus | null;
  status_history: NotificationStatusEvent[];
  created_date: string;
  // Resolved values actually sent to this recipient, captured server-side at send time.
  sent_parameters: Record<string, string>;
}

export interface NotificationEventCreatedBy {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
}

export interface NotificationEvent {
  id: string;
  trigger_id: string;
  template_id: string;
  title: string;
  description: string | null;
  is_urgent: boolean;
  variable_values: Record<string, unknown> | null;
  // Staff member who created a manual event; null for automatic signal-triggered events.
  created_by: NotificationEventCreatedBy | null;
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
  // External id of the facility the event belongs to. A signal-created event derives this
  // from its related object; a manual one has none, so the creating screen names it.
  // Required by the backend, which also checks create permission in this facility.
  facility: string;
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
