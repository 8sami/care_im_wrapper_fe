import { HttpMethod, PaginatedResponse, apiRoutes } from "@/lib/request";
import { FacilityRead } from "@/lib/types/facility";
import {
  NotificationEvent,
  NotificationEventDispatchResponse,
  NotificationEventWrite,
  NotificationRecipient,
  NotificationTemplate,
  NotificationTrigger,
} from "@/lib/types/notifications";

const BASE = "/api/care_im_wrapper";

export const notificationApi = apiRoutes({
  triggers_list: {
    path: `${BASE}/notification-triggers/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<NotificationTrigger>,
  },
  templates_list: {
    path: `${BASE}/notification-templates/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<NotificationTemplate>,
  },
  template_toggle_active: {
    path: `${BASE}/notification-templates/{id}/toggle_active/`,
    method: HttpMethod.POST,
    TResponse: {} as NotificationTemplate,
  },
  templates_sync: {
    path: `${BASE}/notification-templates/sync/`,
    method: HttpMethod.POST,
    TResponse: {} as { detail: string },
  },
  template_set_variable_mapping: {
    path: `${BASE}/notification-templates/{id}/set_variable_mapping/`,
    method: HttpMethod.POST,
    TRequest: {} as { variable_mapping: Record<string, unknown> },
    TResponse: {} as NotificationTemplate,
  },
  events_list: {
    path: `${BASE}/notification-events/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<NotificationEvent>,
  },
  events_retrieve: {
    path: `${BASE}/notification-events/{id}/`,
    method: HttpMethod.GET,
    TResponse: {} as NotificationEvent,
  },
  events_create: {
    path: `${BASE}/notification-events/`,
    method: HttpMethod.POST,
    TRequest: {} as NotificationEventWrite,
    TResponse: {} as NotificationEvent,
  },
  events_dispatch: {
    path: `${BASE}/notification-events/{id}/dispatch/`,
    method: HttpMethod.POST,
    TResponse: {} as NotificationEventDispatchResponse,
  },
  recipients_list: {
    path: `${BASE}/notification-recipients/`,
    method: HttpMethod.GET,
    TResponse: {} as PaginatedResponse<NotificationRecipient>,
  },
});

export const facilityApi = apiRoutes({
  get: {
    path: "/api/v1/facility/{facilityId}/",
    method: HttpMethod.GET,
    TResponse: {} as FacilityRead,
  },
});
