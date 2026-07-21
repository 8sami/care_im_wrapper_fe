import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { navigate } from "raviger";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { patientApi, userApi } from "@/lib/api/care";
import { notificationApi } from "@/lib/api/notifications";
import { config } from "@/lib/config";
import { HttpError, mutate, query } from "@/lib/request";
import { NotificationEventWrite } from "@/lib/types/notifications";

import CareIcon from "@/CAREUI/icons/CareIcon";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import Page from "@/components/Common/Page";
import RecipientPicker from "@/components/Notifications/RecipientPicker";

import useFacilityAccessGuard from "@/hooks/useFacilityAccessGuard";
import useNotificationTemplates from "@/hooks/useNotificationTemplates";
import useNotificationTriggers from "@/hooks/useNotificationTriggers";
import useRecipientSearch from "@/hooks/useRecipientSearch";
import { useTranslation } from "@/hooks/useTranslation";

export default function NotificationCreateEventPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { facilityId } = useFacilityAccessGuard();
  const { triggers } = useNotificationTriggers();
  const { templates } = useNotificationTemplates();

  const manualTriggers = triggers.filter((tr) => tr.trigger_type === "manual");
  const activeTemplates = templates.filter((tpl) => tpl.is_active);

  const [recipientsError, setRecipientsError] = useState<string | null>(null);

  const patients = useRecipientSearch(
    "patient-search",
    (search) =>
      query.debounced(patientApi.list, {
        queryParams: { name: search, limit: config.searchResultsLimit },
      }),
    (p) => ({ id: p.id, label: p.name, sublabel: p.phone_number }),
  );
  const staff = useRecipientSearch(
    "staff-search",
    (search) =>
      query.debounced(userApi.list, {
        queryParams: { search, limit: config.searchResultsLimit },
      }),
    (u) => ({
      id: u.id,
      label: `${u.first_name} ${u.last_name}`.trim() || u.username,
      sublabel: u.username,
    }),
  );

  const formSchema = z.object({
    title: z.string().trim().min(1, t("field_required")),
    description: z.string().trim().optional(),
    trigger_slug: z.string().min(1, t("field_required")),
    template_slug: z.string().min(1, t("field_required")),
    is_urgent: z.boolean(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      trigger_slug: "",
      template_slug: "",
      is_urgent: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: NotificationEventWrite) =>
      mutate(notificationApi.events_create, { silent: true })(body),
    onSuccess: (event) => {
      toast.success(t("notification_created"));
      queryClient.invalidateQueries({ queryKey: ["notification-events"] });
      navigate(`/facility/${facilityId}/settings/notifications/${event.id}`);
    },
    onError: (err) => {
      const message =
        err instanceof HttpError
          ? ((err.cause?.detail as string) ?? t("create_failed"))
          : t("create_failed");
      toast.error(message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (patients.selected.length === 0 && staff.selected.length === 0) {
      setRecipientsError(t("at_least_one_recipient_required"));
      return;
    }
    setRecipientsError(null);
    createMutation.mutate({
      title: values.title,
      description: values.description || undefined,
      is_urgent: values.is_urgent,
      trigger_slug: values.trigger_slug,
      template_slug: values.template_slug,
      recipient_patient_ids: patients.selected.map((p) => p.id),
      recipient_user_ids: staff.selected.map((s) => s.id),
    });
  };

  const backUrl = `/facility/${facilityId}/settings/notifications`;

  return (
    <Page title={t("new_notification")}>
      <div className="mx-auto mt-4 max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel aria-required>{t("title")}</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="trigger_slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel aria-required>{t("trigger")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("select_trigger")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {manualTriggers.map((trigger) => (
                        <SelectItem key={trigger.id} value={trigger.slug}>
                          {trigger.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {manualTriggers.length === 0 && (
                    <p className="text-sm text-gray-500">
                      {t("no_manual_triggers_configured")}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="template_slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel aria-required>{t("template")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("select_template")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.slug}>
                          {template.name} ({template.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_urgent"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between">
                  <FormLabel>{t("mark_as_urgent")}</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <Label>{t("recipients")}</Label>
              <div>
                <p className="mb-1.5 text-xs text-gray-600">{t("patients")}</p>
                <RecipientPicker
                  placeholder={t("search_patients")}
                  searchTerm={patients.searchTerm}
                  onSearchTermChange={patients.setSearchTerm}
                  options={patients.options}
                  isSearching={patients.isSearching}
                  selected={patients.selected}
                  onSelect={patients.select}
                  onRemove={patients.remove}
                />
              </div>
              <div>
                <p className="mb-1.5 text-xs text-gray-600">{t("staff")}</p>
                <RecipientPicker
                  placeholder={t("search_staff")}
                  searchTerm={staff.searchTerm}
                  onSearchTermChange={staff.setSearchTerm}
                  options={staff.options}
                  isSearching={staff.isSearching}
                  selected={staff.selected}
                  onSelect={staff.select}
                  onRemove={staff.remove}
                />
              </div>
              {recipientsError && (
                <p className="text-sm text-red-500">{recipientsError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(backUrl)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={
                  createMutation.isPending || manualTriggers.length === 0
                }
              >
                {createMutation.isPending ? (
                  t("creating")
                ) : (
                  <>
                    <CareIcon icon="l-plus" />
                    {t("create")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </Page>
  );
}
