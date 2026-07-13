import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { toast } from "sonner";

import { notificationApi } from "@/lib/api/notifications";
import { hasPermission } from "@/lib/permissions";
import { HttpError, mutate, query } from "@/lib/request";
import {
  NOTIFICATION_CATEGORY_BADGE,
  NotificationTemplate,
  TEMPLATE_APPROVAL_BADGE,
} from "@/lib/types/notifications";

import CareIcon from "@/CAREUI/icons/CareIcon";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import Page from "@/components/Common/Page";
import {
  CardGridSkeleton,
  TableSkeleton,
} from "@/components/Common/SkeletonLoading";

import useFilters from "@/hooks/useFilters";
import { useTranslation } from "@/hooks/useTranslation";

export default function NotificationTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const auth = useContext(window.AuthUserContext);
  const { qParams, resultsPerPage, Pagination } = useFilters({
    limit: 15,
  });

  const canManage = hasPermission(
    "can_manage_notification_template",
    auth?.user?.permissions ?? [],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["notification-templates", qParams.page],
    queryFn: query(notificationApi.templates_list, {
      queryParams: {
        limit: resultsPerPage,
        offset: ((qParams.page || 1) - 1) * resultsPerPage,
      },
    }),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) =>
      mutate(notificationApi.template_toggle_active, {
        pathParams: { id },
        silent: true,
      })(undefined),
    onSuccess: () => {
      toast.success(t("template_updated"));
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
    },
    onError: (err) => {
      const message =
        err instanceof HttpError
          ? ((err.cause?.detail as string) ?? t("template_update_failed"))
          : t("template_update_failed");
      toast.error(message);
    },
  });

  const templates = data?.results ?? [];

  return (
    <Page title={t("notification_templates")}>
      {isLoading ? (
        <>
          <div className="mt-4 grid gap-4 md:hidden">
            <CardGridSkeleton count={4} />
          </div>
          <div className="mt-4 hidden md:block">
            <TableSkeleton count={5} />
          </div>
        </>
      ) : templates.length === 0 ? (
        <Card className="mt-4 flex flex-col items-center justify-center border-dashed p-8 text-center">
          <div className="mb-4 rounded-full bg-primary/10 p-3">
            <CareIcon
              icon="l-comment-alt-lines"
              className="size-6 text-primary"
            />
          </div>
          <h3 className="mb-1 text-lg font-semibold">
            {t("no_templates_configured")}
          </h3>
        </Card>
      ) : (
        <>
          {/* Mobile: card grid */}
          <div className="mt-4 grid gap-4 md:hidden">
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                canManage={canManage}
                onToggle={() => toggleMutation.mutate(template.id)}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="mt-4 hidden min-w-0 overflow-x-auto rounded-lg bg-white shadow-sm md:block">
            <Table className="min-w-full divide-y divide-gray-200">
              <TableHeader className="bg-gray-100 text-gray-700">
                <TableRow>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("name")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("channel")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("category")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("approval")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("language")}
                  </TableHead>
                  <TableHead className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                    {t("active")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-200 bg-white">
                {templates.map((template) => (
                  <TableRow key={template.id} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-3">
                      <div className="text-sm font-semibold text-gray-950">
                        {template.name}
                      </div>
                      <div className="font-mono text-xs text-gray-500">
                        {template.slug}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <Badge variant="secondary">{template.provider}</Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <Badge
                        variant={NOTIFICATION_CATEGORY_BADGE[template.category]}
                      >
                        {t(template.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      <Badge
                        variant={
                          TEMPLATE_APPROVAL_BADGE[template.approval_status]
                        }
                      >
                        {t(template.approval_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-6 py-3 text-sm text-gray-500">
                      {template.language_code ?? "—"}
                    </TableCell>
                    <TableCell className="px-6 py-3">
                      {canManage ? (
                        <Switch
                          checked={template.is_active}
                          disabled={toggleMutation.isPending}
                          onCheckedChange={() =>
                            toggleMutation.mutate(template.id)
                          }
                        />
                      ) : (
                        <Badge
                          variant={template.is_active ? "green" : "secondary"}
                        >
                          {template.is_active ? t("active") : t("inactive")}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {Pagination({ totalCount: data?.count ?? 0 })}
    </Page>
  );
}

function TemplateCard({
  template,
  canManage,
  onToggle,
}: {
  template: NotificationTemplate;
  canManage: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{template.name}</div>
          <div className="font-mono text-xs text-gray-500">{template.slug}</div>
        </div>
        {canManage ? (
          <Switch checked={template.is_active} onCheckedChange={onToggle} />
        ) : (
          <Badge variant={template.is_active ? "green" : "secondary"}>
            {template.is_active ? t("active") : t("inactive")}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{template.provider}</Badge>
        <Badge variant={NOTIFICATION_CATEGORY_BADGE[template.category]}>
          {t(template.category)}
        </Badge>
        <Badge variant={TEMPLATE_APPROVAL_BADGE[template.approval_status]}>
          {t(template.approval_status)}
        </Badge>
        {template.language_code && (
          <span className="text-xs text-gray-500">
            {template.language_code}
          </span>
        )}
      </div>
    </Card>
  );
}
