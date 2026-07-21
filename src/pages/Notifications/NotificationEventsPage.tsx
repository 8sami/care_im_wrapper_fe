import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useState } from "react";
import { toast } from "sonner";

import { notificationApi } from "@/lib/api/notifications";
import { config } from "@/lib/config";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { hasPermission } from "@/lib/permissions";
import { HttpError, mutate, query } from "@/lib/request";
import {
  NOTIFICATION_STATUS_BADGE,
  NotificationEvent,
  NotificationRecipient,
  TRIGGER_TYPE_BADGE,
} from "@/lib/types/notifications";
import { activateOnKey } from "@/lib/utils";

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
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipComponent } from "@/components/ui/tooltip";

import Page from "@/components/Common/Page";
import {
  CardGridSkeleton,
  TableSkeleton,
} from "@/components/Common/SkeletonLoading";

import useFacilityAccessGuard from "@/hooks/useFacilityAccessGuard";
import useFilters from "@/hooks/useFilters";
import useNotificationTriggers from "@/hooks/useNotificationTriggers";
import { useTranslation } from "@/hooks/useTranslation";

function RecipientStatusSummary({
  recipients,
}: {
  recipients: NotificationRecipient[];
}) {
  const { t } = useTranslation();
  const counts = new Map<string, number>();
  for (const r of recipients) {
    const key = r.latest_status ?? "pending";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {[...counts.entries()].map(([status, count]) => (
        <Badge
          key={status}
          variant={
            NOTIFICATION_STATUS_BADGE[
              status as keyof typeof NOTIFICATION_STATUS_BADGE
            ]
          }
        >
          {t("recipient_status_count", {
            count,
            total: recipients.length,
            status: t(status),
          })}
        </Badge>
      ))}
    </span>
  );
}

function NotificationEventsEmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { t } = useTranslation();
  return (
    <Card className="mt-4 flex flex-col items-center justify-center border-dashed p-8 text-center">
      <div className="mb-4 rounded-full bg-primary/10 p-3">
        <CareIcon icon="l-bell-slash" className="size-6 text-primary" />
      </div>
      <h3 className="mb-1 text-lg font-semibold">{t("no_notifications")}</h3>
      <p className="text-sm text-gray-500">
        {hasFilters
          ? t("no_notifications_match_filters")
          : t("no_notifications_subtext")}
      </p>
    </Card>
  );
}

export default function NotificationEventsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { facilityId, facility, isFacilityLoading } = useFacilityAccessGuard();
  const { qParams, updateQuery, removeFilter, resultsPerPage, Pagination } =
    useFilters({
      limit: config.listPageSize,
    });
  const { triggers, triggersById } = useNotificationTriggers();
  const [dispatchTarget, setDispatchTarget] =
    useState<NotificationEvent | null>(null);

  const canCreate = hasPermission(
    "can_create_notification_event",
    facility?.permissions ?? [],
  );
  const canDispatch = hasPermission(
    "can_dispatch_notification_event",
    facility?.permissions ?? [],
  );

  const { data, isLoading } = useQuery({
    queryKey: [
      "notification-events",
      facilityId,
      qParams.page,
      qParams.trigger,
      qParams.is_urgent,
    ],
    queryFn: query(notificationApi.events_list, {
      queryParams: {
        facility: facilityId,
        trigger: qParams.trigger,
        is_urgent: qParams.is_urgent,
        limit: resultsPerPage,
        offset: ((qParams.page || 1) - 1) * resultsPerPage,
      },
    }),
    enabled: !!facility,
  });

  const dispatchMutation = useMutation({
    mutationFn: (eventId: string) =>
      mutate(notificationApi.events_dispatch, {
        pathParams: { id: eventId },
        silent: true,
      })(undefined),
    onSuccess: (result) => {
      toast.success(result.detail);
      queryClient.invalidateQueries({ queryKey: ["notification-events"] });
      setDispatchTarget(null);
    },
    onError: (err) => {
      const message =
        err instanceof HttpError
          ? ((err.cause?.detail as string) ?? t("dispatch_failed"))
          : t("dispatch_failed");
      toast.error(message);
      setDispatchTarget(null);
    },
  });

  const events = data?.results ?? [];
  const hasFilters = !!qParams.trigger || !!qParams.is_urgent;
  const baseUrl = `/facility/${facilityId}/settings/notifications`;

  return (
    <Page
      title={t("notifications")}
      options={
        canCreate ? (
          <Button
            className="w-full sm:w-auto"
            onClick={() => navigate(`${baseUrl}/new`)}
          >
            <CareIcon icon="l-plus" />
            {t("new_notification")}
          </Button>
        ) : undefined
      }
    >
      <div className="mt-4 flex flex-col gap-4 border-t border-gray-200 py-4 md:flex-row md:items-center md:justify-between">
        <Tabs
          value={qParams.is_urgent === "true" ? "urgent" : "all"}
          onValueChange={(value) =>
            value === "urgent"
              ? updateQuery({ is_urgent: "true" })
              : removeFilter("is_urgent")
          }
        >
          <TabsList>
            <TabsTrigger value="all">{t("all")}</TabsTrigger>
            <TabsTrigger value="urgent">{t("urgent")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select
          value={qParams.trigger ?? "all"}
          onValueChange={(value) =>
            value === "all"
              ? removeFilter("trigger")
              : updateQuery({ trigger: value })
          }
        >
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder={t("trigger")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("all_triggers")}</SelectItem>
            {triggers.map((trigger) => (
              <SelectItem key={trigger.id} value={trigger.slug}>
                {trigger.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isFacilityLoading || isLoading ? (
        <>
          <div className="grid gap-4 md:hidden">
            <CardGridSkeleton count={4} />
          </div>
          <div className="hidden md:block">
            <TableSkeleton count={5} />
          </div>
        </>
      ) : events.length === 0 ? (
        <NotificationEventsEmptyState hasFilters={hasFilters} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {events.map((event) => (
              <NotificationEventCard
                key={event.id}
                event={event}
                triggerName={triggersById.get(event.trigger_id)?.name}
                triggerType={triggersById.get(event.trigger_id)?.trigger_type}
                canDispatch={canDispatch}
                onDispatch={() => setDispatchTarget(event)}
                onView={() => navigate(`${baseUrl}/${event.id}`)}
              />
            ))}
          </div>
          {/* Desktop: table */}
          <div className="hidden min-w-0 overflow-x-auto rounded-lg bg-white shadow-sm md:block">
            <Table className="min-w-full">
              <TableHeader className="bg-gray-100 text-gray-700 [&_tr]:border-b-0">
                <TableRow>
                  <TableHead className="w-2/5 px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("title")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("trigger")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("status")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("when")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs font-medium tracking-wider uppercase">
                    {t("actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200 bg-white">
                {events.map((event) => {
                  const trigger = triggersById.get(event.trigger_id);
                  const pendingCount = event.recipients.filter(
                    (r) => r.latest_status === null,
                  ).length;
                  return (
                    <TableRow
                      key={event.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`${baseUrl}/${event.id}`)}
                      {...activateOnKey(() =>
                        navigate(`${baseUrl}/${event.id}`),
                      )}
                    >
                      <TableCell className="max-w-0 px-6 py-3">
                        <div
                          className="truncate text-sm font-semibold text-gray-950"
                          title={event.title}
                        >
                          {event.title}
                        </div>
                        {event.description && (
                          <div
                            className="truncate text-xs text-gray-500"
                            title={event.description}
                          >
                            {event.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-3">
                        {trigger ? (
                          <Badge
                            variant={TRIGGER_TYPE_BADGE[trigger.trigger_type]}
                          >
                            {trigger.name}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-3">
                        <RecipientStatusSummary recipients={event.recipients} />
                      </TableCell>
                      <TableCell className="px-6 py-3">
                        <TooltipComponent
                          content={formatDateTime(event.created_date)}
                        >
                          <span className="text-xs text-gray-500">
                            {formatRelativeTime(event.created_date)}
                          </span>
                        </TooltipComponent>
                      </TableCell>
                      <TableCell
                        className="px-6 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <CareIcon icon="l-ellipsis-v" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => navigate(`${baseUrl}/${event.id}`)}
                            >
                              {t("view")}
                            </DropdownMenuItem>
                            {canDispatch && (
                              <DropdownMenuItem
                                disabled={pendingCount === 0}
                                onClick={() => setDispatchTarget(event)}
                              >
                                {t("dispatch")}
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {Pagination({ totalCount: data?.count ?? 0 })}

      <AlertDialog
        open={!!dispatchTarget}
        onOpenChange={(open) => !open && setDispatchTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dispatch_notification")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dispatch_confirm_description", {
                count:
                  dispatchTarget?.recipients.filter(
                    (r) => r.latest_status === null,
                  ).length ?? 0,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={dispatchMutation.isPending}
              onClick={() =>
                dispatchTarget && dispatchMutation.mutate(dispatchTarget.id)
              }
            >
              {t("dispatch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function NotificationEventCard({
  event,
  triggerName,
  triggerType,
  canDispatch,
  onDispatch,
  onView,
}: {
  event: NotificationEvent;
  triggerName?: string;
  triggerType?: keyof typeof TRIGGER_TYPE_BADGE;
  canDispatch: boolean;
  onDispatch: () => void;
  onView: () => void;
}) {
  const { t } = useTranslation();
  const pendingCount = event.recipients.filter(
    (r) => r.latest_status === null,
  ).length;

  return (
    <Card className="min-w-0 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold" title={event.title}>
            {event.title}
          </div>
          {event.description && (
            <div
              className="truncate text-xs text-gray-500"
              title={event.description}
            >
              {event.description}
            </div>
          )}
        </div>
        <TooltipComponent content={formatDateTime(event.created_date)}>
          <span className="shrink-0 text-xs text-gray-500">
            {formatRelativeTime(event.created_date)}
          </span>
        </TooltipComponent>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {triggerName && triggerType && (
          <Badge variant={TRIGGER_TYPE_BADGE[triggerType]}>{triggerName}</Badge>
        )}
      </div>
      <div className="mb-3">
        <RecipientStatusSummary recipients={event.recipients} />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onView}>
          {t("view")}
        </Button>
        {canDispatch && (
          <Button
            className="flex-1"
            disabled={pendingCount === 0}
            onClick={onDispatch}
          >
            {t("dispatch")}
          </Button>
        )}
      </div>
    </Card>
  );
}
