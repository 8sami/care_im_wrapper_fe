import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "raviger";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { notificationApi } from "@/lib/api/notifications";
import { config } from "@/lib/config";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { HttpError, mutate, query } from "@/lib/request";
import {
  NOTIFICATION_STATUS_BADGE,
  NotificationDeliveryStatus,
  NotificationEvent,
  NotificationRecipient,
  TRIGGER_TYPE_BADGE,
} from "@/lib/types/notifications";

import CareIcon from "@/CAREUI/icons/CareIcon";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipComponent } from "@/components/ui/tooltip";

import Page from "@/components/Common/Page";
import { TableSkeleton } from "@/components/Common/SkeletonLoading";

import useFacilityAccessGuard from "@/hooks/useFacilityAccessGuard";
import useFilters from "@/hooks/useFilters";
import useNotificationTemplates from "@/hooks/useNotificationTemplates";
import useNotificationTriggers from "@/hooks/useNotificationTriggers";
import { useTranslation } from "@/hooks/useTranslation";

// Nothing can change once every recipient has been read or has failed, so polling stops.
const TERMINAL_STATUSES: NotificationDeliveryStatus[] = ["read", "failed"];

const STATUS_ORDER: (NotificationDeliveryStatus | "pending")[] = [
  "pending",
  "sent",
  "delivered",
  "read",
  "failed",
];

function isSettled(event?: NotificationEvent) {
  return (
    !!event &&
    event.recipients.every(
      (r) =>
        r.latest_status !== null && TERMINAL_STATUSES.includes(r.latest_status),
    )
  );
}

// clipboard is undefined outside a secure context and writeText can reject, so await the
// outcome -- reporting success unconditionally claimed a copy that never happened.
async function copyToClipboard(text: string, t: (key: string) => string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t("copied_to_clipboard"));
  } catch {
    toast.error(t("copy_failed"));
  }
}

function latestStatusDate(recipient: NotificationRecipient) {
  const latest = recipient.status_history.at(-1);
  return latest?.created_date ?? recipient.created_date;
}

// A dispatch failure and a later provider-reported failure each write their own row, so a
// recipient can have several. Rows predating failure-payload capture have none.
function failureDetails(recipient: NotificationRecipient) {
  return recipient.status_history.filter(
    (status) => status.state === "failed" && status.payload,
  );
}

// Collapsible key/value list, reused for the event's input variables (size "sm") and each
// recipient's server-captured sent_parameters (size "xs"). showKey/hideKey name which.
function ValuesToggle({
  values,
  size = "xs",
  showKey = "show_values",
  hideKey = "hide_values",
}: {
  values: Record<string, unknown>;
  size?: "sm" | "xs";
  showKey?: string;
  hideKey?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const entries = Object.entries(values ?? {});
  if (entries.length === 0) {
    return null;
  }
  const text = size === "sm" ? "text-sm" : "text-xs";
  return (
    <div className={size === "sm" ? "" : "mt-1 pt-1"}>
      <Button
        variant="ghost"
        size="sm"
        className={`h-auto p-0 ${text} text-primary-700`}
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? t(hideKey) : t(showKey)}
        <CareIcon icon={open ? "l-angle-up" : "l-angle-down"} />
      </Button>
      {open && (
        <dl className={`mt-2 space-y-1 ${text}`}>
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="font-mono text-gray-500">{key}:</dt>
              <dd className={size === "sm" ? "" : "break-all"}>
                {String(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default function NotificationEventDetailPage({
  eventId,
}: {
  eventId: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { facilityId, facility, isFacilityLoading } = useFacilityAccessGuard();
  const { triggersById } = useNotificationTriggers();
  const { templatesById } = useNotificationTemplates();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const [errorRecipient, setErrorRecipient] =
    useState<NotificationRecipient | null>(null);

  const { qParams, resultsPerPage, Pagination } = useFilters({
    limit: config.recipientsPageSize,
  });

  const canDispatch = hasPermission(
    "can_dispatch_notification_event",
    facility?.permissions ?? [],
  );

  // Explicit generic: refetchInterval below reads back its own query's data, which makes
  // the result type circular for inference.
  const { data: event, isLoading: isEventLoading } =
    useQuery<NotificationEvent>({
      queryKey: ["notification-event", eventId],
      queryFn: query(notificationApi.events_retrieve, {
        pathParams: { id: eventId },
      }),
      enabled: !!facility,
      // Refetch while any recipient is unsettled (summary badges read event.recipients too).
      // Stops once all are settled -- the payload embeds full status history, so it's not free.
      refetchInterval: (q) =>
        autoRefresh && !isSettled(q.state.data) ? config.pollIntervalMs : false,
    });

  const { data: recipientsData, isLoading: isRecipientsLoading } = useQuery({
    queryKey: ["notification-recipients", facilityId, eventId, qParams.page],
    queryFn: query(notificationApi.recipients_list, {
      queryParams: {
        event: eventId,
        facility: facilityId,
        limit: resultsPerPage,
        offset: ((qParams.page || 1) - 1) * resultsPerPage,
      },
    }),
    enabled: !!facility,
    refetchInterval:
      autoRefresh && !isSettled(event) ? config.pollIntervalMs : false,
  });

  const dispatchMutation = useMutation({
    mutationFn: () =>
      mutate(notificationApi.events_dispatch, {
        pathParams: { id: eventId },
        silent: true,
      })(undefined),
    onSuccess: (result) => {
      toast.success(result.detail);
      queryClient.invalidateQueries({
        queryKey: ["notification-event", eventId],
      });
      queryClient.invalidateQueries({
        queryKey: ["notification-recipients", facilityId, eventId],
      });
      setConfirmDispatch(false);
    },
    onError: (err) => {
      const message =
        err instanceof HttpError
          ? ((err.cause?.detail as string) ?? t("dispatch_failed"))
          : t("dispatch_failed");
      toast.error(message);
      setConfirmDispatch(false);
    },
  });

  if (isFacilityLoading || isEventLoading || !event) {
    return (
      <Page title={t("notifications")}>
        <TableSkeleton count={5} />
      </Page>
    );
  }

  const trigger = triggersById.get(event.trigger_id);
  const template = templatesById.get(event.template_id);
  const pendingCount = event.recipients.filter(
    (r) => r.latest_status === null,
  ).length;
  const statusCounts = new Map<string, number>();
  for (const r of event.recipients) {
    const key = r.latest_status ?? "pending";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
  }

  const recipients = recipientsData?.results ?? [];
  const backUrl = `/facility/${facilityId}/settings/notifications`;

  return (
    <Page title={event.title} hideTitleOnPage>
      <Link
        href={backUrl}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <CareIcon icon="l-arrow-left" className="size-4" />
        {t("back_to_notifications")}
      </Link>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{event.title}</h1>
            {trigger && (
              <Badge variant={TRIGGER_TYPE_BADGE[trigger.trigger_type]}>
                {trigger.name}
              </Badge>
            )}
            {template && <Badge variant="secondary">{template.name}</Badge>}
            {event.is_urgent && <Badge variant="danger">{t("urgent")}</Badge>}
          </div>
          {event.description && (
            <p className="mb-1 text-sm text-gray-700">{event.description}</p>
          )}
          <p className="text-xs text-gray-500">
            {t("created_on")} {formatDateTime(event.created_date)}
            {event.created_by && (
              <>
                {" "}
                · {t("by")} {event.created_by.first_name}{" "}
                {event.created_by.last_name}
              </>
            )}
          </p>
        </div>

        {canDispatch && (
          <Button
            className="w-full md:w-auto"
            disabled={pendingCount === 0}
            onClick={() => setConfirmDispatch(true)}
          >
            <CareIcon icon="l-message" />
            {t("dispatch_n_pending", { count: pendingCount })}
          </Button>
        )}
      </div>

      {/* Delivery summary */}
      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_ORDER.filter((status) => statusCounts.has(status)).map(
          (status) => (
            <Badge key={status} variant={NOTIFICATION_STATUS_BADGE[status]}>
              {t("status_count", {
                count: statusCounts.get(status),
                status: t(status),
              })}
            </Badge>
          ),
        )}
      </div>

      {/* Message details */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">{t("message_details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">
            <span className="text-gray-500">{t("template")}: </span>
            {template ? (
              <>
                <span className="font-medium">{template.name}</span>{" "}
                <span className="text-gray-500">
                  ({template.provider} · {t(template.category)})
                </span>
              </>
            ) : (
              "—"
            )}
          </div>
          <ValuesToggle
            values={event.variable_values ?? {}}
            size="sm"
            showKey="show_input_variables"
            hideKey="hide_input_variables"
          />
        </CardContent>
      </Card>

      {/* Recipients */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t("recipients")} (
            {recipientsData?.count ?? event.recipients.length})
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh" className="text-sm">
              {t("auto_refresh")}
            </Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
        </div>

        {isRecipientsLoading ? (
          <TableSkeleton count={3} columns={6} />
        ) : recipients.length === 0 ? (
          <p className="text-sm text-gray-500">{t("no_recipients")}</p>
        ) : (
          <>
            {/* Mobile: card grid */}
            <div className="grid gap-3 md:hidden">
              {recipients.map((recipient) => (
                <Card key={recipient.id} className="p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {recipient.recipient_name ?? recipient.recipient_phone}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          NOTIFICATION_STATUS_BADGE[
                            recipient.latest_status ?? "pending"
                          ]
                        }
                      >
                        {t(recipient.latest_status ?? "pending")}
                      </Badge>
                      {failureDetails(recipient).length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 text-xs text-red-600"
                          onClick={() => setErrorRecipient(recipient)}
                        >
                          {t("see_error")}
                        </Button>
                      )}
                    </div>
                  </div>
                  {recipient.recipient_name && (
                    <div className="mb-1 text-xs text-gray-500">
                      {recipient.recipient_phone}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{recipient.provider}</span>
                    <TooltipComponent
                      content={formatDateTime(latestStatusDate(recipient))}
                    >
                      <span>
                        {formatRelativeTime(latestStatusDate(recipient))}
                      </span>
                    </TooltipComponent>
                  </div>
                  <ValuesToggle
                    values={recipient.sent_parameters}
                    showKey="show_sent_values"
                    hideKey="hide_sent_values"
                  />
                </Card>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden min-w-0 overflow-x-auto rounded-lg bg-white shadow-sm md:block">
              <Table className="min-w-full">
                <TableHeader className="bg-gray-100 text-gray-700 [&_tr]:border-b-0">
                  <TableRow>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      {t("recipient")}
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      {t("channel")}
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      {t("status")}
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      {t("tracking_id")}
                    </TableHead>
                    <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                      {t("when")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-gray-200 bg-white">
                  {recipients.map((recipient) => (
                    <Fragment key={recipient.id}>
                      <TableRow className="hover:bg-gray-50">
                        <TableCell className="px-6 py-3">
                          <div className="text-sm text-gray-950">
                            {recipient.recipient_name ??
                              recipient.recipient_phone}
                          </div>
                          {recipient.recipient_name && (
                            <div className="text-xs text-gray-500">
                              {recipient.recipient_phone}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <Badge variant="secondary">
                            {recipient.provider}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                NOTIFICATION_STATUS_BADGE[
                                  recipient.latest_status ?? "pending"
                                ]
                              }
                            >
                              {t(recipient.latest_status ?? "pending")}
                            </Badge>
                            {failureDetails(recipient).length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-auto p-0 text-xs text-red-600"
                                onClick={() => setErrorRecipient(recipient)}
                              >
                                <CareIcon
                                  icon="l-info-circle"
                                  className="size-3"
                                />
                                {t("see_error")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3 font-mono text-xs">
                          {recipient.tracking_id ? (
                            <button
                              type="button"
                              className="max-w-40 truncate hover:underline"
                              onClick={() =>
                                copyToClipboard(recipient.tracking_id ?? "", t)
                              }
                            >
                              {recipient.tracking_id}
                            </button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-3">
                          <TooltipComponent
                            content={formatDateTime(
                              latestStatusDate(recipient),
                            )}
                          >
                            <span className="text-xs text-gray-500">
                              {formatRelativeTime(latestStatusDate(recipient))}
                            </span>
                          </TooltipComponent>
                        </TableCell>
                      </TableRow>
                      {Object.keys(recipient.sent_parameters ?? {}).length >
                        0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="px-6 pt-0 pb-3">
                            <ValuesToggle
                              values={recipient.sent_parameters}
                              showKey="show_sent_values"
                              hideKey="hide_sent_values"
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {Pagination({ totalCount: recipientsData?.count ?? 0 })}
      </div>

      <Dialog
        open={!!errorRecipient}
        onOpenChange={(open) => !open && setErrorRecipient(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("delivery_error")}</DialogTitle>
            <DialogDescription>
              {t("delivery_error_description", {
                recipient:
                  errorRecipient?.recipient_name ??
                  errorRecipient?.recipient_phone ??
                  "",
              })}
            </DialogDescription>
          </DialogHeader>
          {errorRecipient && (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto">
              {failureDetails(errorRecipient).map((status) => (
                <div key={status.created_date}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">
                      {formatDateTime(status.created_date)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs mb-2"
                      onClick={() =>
                        copyToClipboard(
                          JSON.stringify(status.payload, null, 2),
                          t,
                        )
                      }
                    >
                      <CareIcon icon="l-copy" className="size-3" />
                      {t("copy")}
                    </Button>
                  </div>
                  <pre className="overflow-x-auto rounded bg-gray-900 p-3 font-mono text-xs whitespace-pre-wrap text-gray-400">
                    {JSON.stringify(status.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDispatch} onOpenChange={setConfirmDispatch}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dispatch_notification")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dispatch_confirm_description", { count: pendingCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={dispatchMutation.isPending}
              onClick={() => dispatchMutation.mutate()}
            >
              {t("dispatch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}
