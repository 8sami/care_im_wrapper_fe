import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { notificationApi } from "@/lib/api/notifications";
import { expressionSchemaForProvider } from "@/lib/notificationTemplateValidation";
import { HttpError, mutate } from "@/lib/request";
import { NotificationTemplate } from "@/lib/types/notifications";

import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { useTranslation } from "@/hooks/useTranslation";

// Mirrors the plugin backend's `_PLACEHOLDER_RE` in messaging/whatsapp.py,
// which extracts `{{ key }}` placeholders from a synced Meta template's
// HEADER/BODY text to determine which variable_mapping keys are needed.
const PLACEHOLDER_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

interface TemplateComponent {
  type?: string;
  format?: string;
  text?: string;
}

function textComponents(
  payload: NotificationTemplate["payload"],
): TemplateComponent[] {
  const components = (payload?.components as TemplateComponent[]) ?? [];
  return components.filter(
    (c) =>
      ["HEADER", "BODY"].includes((c.type ?? "").toUpperCase()) &&
      (c.format ?? "TEXT").toUpperCase() === "TEXT",
  );
}

// The set of variables a template accepts is fixed by its Meta/provider-approved
// body text, not something staff can add to or remove from — only the expression
// each placeholder resolves to (the "value") is editable.
function extractPlaceholderKeys(payload: NotificationTemplate["payload"]) {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const component of textComponents(payload)) {
    for (const match of (component.text ?? "").matchAll(PLACEHOLDER_RE)) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

// The required keys come straight from the fetched template's payload
// (extractPlaceholderKeys). Each value's own rules come from the template's
// provider (lib/notificationTemplateValidation) since different providers
// impose different constraints on parameter values.
function buildFormSchema(
  t: (key: string) => string,
  provider: string,
  count: number,
) {
  return z.object({
    variables: z.array(expressionSchemaForProvider(provider, t)).length(count),
  });
}

type FormValues = z.infer<ReturnType<typeof buildFormSchema>>;

interface TemplateVariablesSheetProps {
  template: NotificationTemplate | null;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TemplateVariablesSheet({
  template,
  canManage,
  onOpenChange,
}: TemplateVariablesSheetProps) {
  return (
    <Sheet open={!!template} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-y-auto sm:max-w-lg">
        {template && (
          <TemplateVariablesForm
            key={template.id}
            template={template}
            canManage={canManage}
            onDone={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function TemplateVariablesForm({
  template,
  canManage,
  onDone,
}: {
  template: NotificationTemplate;
  canManage: boolean;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const bodyComponents = useMemo(
    () => textComponents(template.payload),
    [template.payload],
  );
  // Fixed, derived from the approved template text - never added to or removed from here.
  const keys = useMemo(
    () => extractPlaceholderKeys(template.payload),
    [template.payload],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(buildFormSchema(t, template.provider, keys.length)),
    defaultValues: {
      variables: keys.map((key) => {
        const value = template.variable_mapping?.[key];
        return typeof value === "string" ? value : "";
      }),
    },
  });

  const mutation = useMutation({
    mutationFn: (variable_mapping: Record<string, string>) =>
      mutate(notificationApi.template_set_variable_mapping, {
        pathParams: { id: template.id },
        silent: true,
      })({ variable_mapping }),
    onSuccess: () => {
      toast.success(t("variable_mapping_updated"));
      queryClient.invalidateQueries({ queryKey: ["notification-templates"] });
      onDone();
    },
    onError: (err) => {
      const message =
        err instanceof HttpError
          ? ((err.cause?.detail as string) ??
            t("variable_mapping_update_failed"))
          : t("variable_mapping_update_failed");
      toast.error(message);
    },
  });

  const onSubmit = (values: FormValues) => {
    // Keys outside the current template text aren't shown/editable here, but are
    // preserved rather than silently dropped from the stored mapping.
    const existingMapping = template.variable_mapping ?? {};
    const extras = Object.entries(existingMapping).filter(
      (entry): entry is [string, string] =>
        !keys.includes(entry[0]) && typeof entry[1] === "string",
    );
    const variable_mapping = Object.fromEntries([
      ...extras,
      ...keys.map((key, index) => [key, values.variables[index]] as const),
    ]);
    mutation.mutate(variable_mapping);
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{template.name}</SheetTitle>
        <SheetDescription className="font-mono text-xs">
          {template.slug}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">{template.provider}</Badge>
        <Badge variant="outline">{t(template.parameter_format)}</Badge>
        {template.language_code && (
          <span className="text-xs text-gray-500">
            {template.language_code}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("message_body")}</Label>
        {bodyComponents.length === 0 ? (
          <p className="text-sm text-gray-500">{t("no_message_body_synced")}</p>
        ) : (
          <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
            {bodyComponents.map((component, index) => (
              <div key={index}>
                <div className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                  {component.type}
                </div>
                <div className="font-mono text-sm whitespace-pre-wrap text-gray-900">
                  {component.text}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">{t("no_variables_detected")}</p>
      ) : canManage ? (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4"
          >
            <div className="space-y-4">
              <Label>{t("variable_mapping")}</Label>
              {keys.map((key, index) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`variables.${index}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono text-xs">{key}</FormLabel>
                      <FormControl>
                        <Input className="font-mono text-xs" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <SheetFooter className="mt-auto">
              <Button type="button" variant="outline" onClick={onDone}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? t("saving") : t("save")}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      ) : (
        <div className="space-y-2">
          <Label>{t("variable_mapping")}</Label>
          <dl className="space-y-1 text-sm">
            {keys.map((key, index) => (
              <div key={key} className="flex gap-2">
                <dt className="font-mono text-gray-500">{key}:</dt>
                <dd className="font-mono">
                  {form.getValues(`variables.${index}`) || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  );
}
