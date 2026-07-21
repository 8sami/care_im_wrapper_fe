import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, navigate } from "raviger";
import { useContext, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { notificationApi } from "@/lib/api/notifications";
import { expressionSchemaForProvider } from "@/lib/notificationTemplateValidation";
import { hasPermission } from "@/lib/permissions";
import { HttpError, mutate, query } from "@/lib/request";
import {
  NotificationSchemaField,
  NotificationTemplate,
} from "@/lib/types/notifications";

import CareIcon from "@/CAREUI/icons/CareIcon";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

import Page from "@/components/Common/Page";
import { CardGridSkeleton } from "@/components/Common/SkeletonLoading";

import { useTranslation } from "@/hooks/useTranslation";

// Mirrors the backend's _PLACEHOLDER_RE. Built per use, not shared: a /g regex's mutable
// lastIndex would make shared .test() calls interfere.
const placeholderRe = () => /\{\{\s*([^}]+?)\s*\}\}/g;

// The backend addresses a template's dynamic URL button suffix through this fixed
// mapping key, not a HEADER/BODY placeholder (whatsapp._build_button_components).
const URL_SUFFIX_KEY = "url_suffix";

interface TemplateComponent {
  type?: string;
  format?: string;
  text?: string;
  buttons?: { type?: string; url?: string }[];
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

// Keys are fixed by the approved template text; only their values are editable.
function extractPlaceholderKeys(payload: NotificationTemplate["payload"]) {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const component of textComponents(payload)) {
    for (const match of (component.text ?? "").matchAll(placeholderRe())) {
      const key = match[1];
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
}

// A dynamic URL button (its url carries a {{...}}) needs a url_suffix mapping the
// HEADER/BODY placeholder scan won't surface -- mirrors whatsapp._build_button_components.
function hasDynamicUrlButton(
  payload: NotificationTemplate["payload"],
): boolean {
  const components = (payload?.components as TemplateComponent[]) ?? [];
  return components.some(
    (c) =>
      (c.type ?? "").toUpperCase() === "BUTTONS" &&
      (c.buttons ?? []).some(
        (b) =>
          (b.type ?? "").toUpperCase() === "URL" &&
          placeholderRe().test(b.url ?? ""),
      ),
  );
}

// Fills placeholders with rendered values; unresolved keys are left as-is.
function substituteBody(text: string, rendered: Record<string, string>) {
  return text.replace(placeholderRe(), (match, key: string) =>
    rendered[key] !== undefined ? rendered[key] || "" : match,
  );
}

// Value rules vary per provider; see lib/notificationTemplateValidation.
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

// Nested fields expand to reveal children; leaf fields insert an
// object.<path> expression into the focused variable input.
function ObjectFieldNode({
  field,
  pathPrefix,
  onInsert,
  disabled,
}: {
  field: NotificationSchemaField;
  pathPrefix: string[];
  onInsert: (expr: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = [...pathPrefix, field.key];
  const dotted = path.join(".");
  const hasChildren = !!field.fields?.length;

  if (hasChildren) {
    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-100">
          <CareIcon
            icon={open ? "l-angle-down" : "l-angle-right"}
            className="size-4 shrink-0 text-gray-400"
          />
          {field.display}
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-3 border-l border-gray-200 pl-2">
          {field.fields!.map((child) => (
            <ObjectFieldNode
              key={child.key}
              field={child}
              pathPrefix={path}
              onInsert={onInsert}
              disabled={disabled}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onInsert(`{{ object.${dotted} }}`)}
      title={field.description || dotted}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
    >
      <span>{field.display}</span>
      <code className="shrink-0 font-mono text-xs text-gray-400">{`object.${dotted}`}</code>
    </button>
  );
}

function FieldPicker({
  objectFields,
  extraFields,
  onInsert,
  disabled,
}: {
  objectFields: NotificationSchemaField[];
  extraFields: NotificationSchemaField[];
  onInsert: (expr: string) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      {objectFields.length > 0 && (
        <div>
          {objectFields.map((field) => (
            <ObjectFieldNode
              key={field.key}
              field={field}
              pathPrefix={[]}
              onInsert={onInsert}
              disabled={disabled}
            />
          ))}
        </div>
      )}
      {extraFields.length > 0 && (
        <div className="mt-2 border-t border-gray-200 pt-2">
          <div className="px-2 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            {t("additional_fields")}
          </div>
          {extraFields.map((field) => (
            <button
              key={field.key}
              type="button"
              disabled={disabled}
              onClick={() => onInsert(`{{ ${field.key} }}`)}
              title={field.description || field.key}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              <span>{field.display}</span>
              <code className="shrink-0 font-mono text-xs text-gray-400">
                {field.key}
              </code>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BodyCard({
  components,
  transform,
}: {
  components: TemplateComponent[];
  transform?: (text: string) => string;
}) {
  return (
    <div className="space-y-3">
      {components.map((component, index) => (
        <div key={index} className="space-y-1">
          <div className="text-xs font-semibold tracking-wide text-gray-400 uppercase">
            {component.type}
          </div>
          <div className="font-mono text-sm whitespace-pre-wrap text-gray-900">
            {transform ? transform(component.text ?? "") : component.text}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationTemplateVariablesPage({
  templateId,
}: {
  templateId: string;
}) {
  const { t } = useTranslation();
  const auth = useContext(window.AuthUserContext);
  const canManage = hasPermission(
    "can_manage_notification_template",
    auth?.user?.permissions ?? [],
  );

  const { data: template, isLoading } = useQuery({
    queryKey: ["notification-template", templateId],
    queryFn: query(notificationApi.templates_retrieve, {
      pathParams: { id: templateId },
    }),
  });

  const backLink = (
    <Link
      href="/admin/notification-templates"
      className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    >
      <CareIcon icon="l-arrow-left" className="size-4" />
      {t("notification_templates")}
    </Link>
  );

  if (isLoading) {
    return (
      <Page title={t("variable_mapping")}>
        {backLink}
        <div className="mt-4 grid gap-4">
          <CardGridSkeleton count={3} />
        </div>
      </Page>
    );
  }

  if (!template) {
    return (
      <Page title={t("variable_mapping")}>
        {backLink}
        <Card className="mt-4 p-8 text-center text-sm text-gray-500">
          {t("template_not_found")}
        </Card>
      </Page>
    );
  }

  return (
    <Page title={template.name}>
      {backLink}
      <TemplateVariablesEditor
        key={template.id}
        template={template}
        canManage={canManage}
      />
    </Page>
  );
}

function TemplateVariablesEditor({
  template,
  canManage,
}: {
  template: NotificationTemplate;
  canManage: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const bodyComponents = useMemo(
    () => textComponents(template.payload),
    [template.payload],
  );
  const keys = useMemo(() => {
    const bodyKeys = extractPlaceholderKeys(template.payload);
    return hasDynamicUrlButton(template.payload) &&
      !bodyKeys.includes(URL_SUFFIX_KEY)
      ? [...bodyKeys, URL_SUFFIX_KEY]
      : bodyKeys;
  }, [template.payload]);
  // Which variable input a picker click inserts into; defaults to the first row.
  const [focusedIndex, setFocusedIndex] = useState(0);

  const form = useForm<FormValues>({
    resolver: zodResolver(buildFormSchema(t, template.provider, keys.length)),
    defaultValues: {
      variables: keys.map((key) => {
        const value = template.variable_mapping?.[key];
        return typeof value === "string" ? value : "";
      }),
    },
  });

  // Browsable field schema for this template's linked trigger context(s).
  const { data: schema } = useQuery({
    queryKey: ["notification-template-schema", template.id],
    queryFn: query(notificationApi.template_schema, {
      pathParams: { id: template.id },
    }),
    enabled: canManage && keys.length > 0,
  });

  const currentMapping = () =>
    Object.fromEntries(
      keys.map((key, index) => [key, form.getValues(`variables.${index}`)]),
    );

  const insertField = (expr: string) => {
    form.setValue(`variables.${focusedIndex}`, expr, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.clearErrors(`variables.${focusedIndex}`);
  };

  const previewMutation = useMutation({
    mutationFn: (variable_mapping: Record<string, string>) =>
      mutate(notificationApi.template_preview_variable_mapping, {
        pathParams: { id: template.id },
        silent: true,
      })({ variable_mapping }),
    onError: () => toast.error(t("preview_failed")),
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
      navigate("/admin/notification-templates");
    },
    onError: (err) => {
      // Server sends {"errors": {placeholder_key: message}} for per-field validation.
      if (
        err instanceof HttpError &&
        err.cause &&
        typeof err.cause.errors === "object" &&
        err.cause.errors !== null
      ) {
        const fieldErrors = err.cause.errors as Record<string, string>;
        let matched = false;
        for (const [key, message] of Object.entries(fieldErrors)) {
          const index = keys.indexOf(key);
          if (index >= 0) {
            form.setError(`variables.${index}`, { type: "server", message });
            matched = true;
          }
        }
        if (matched) {
          toast.error(t("variable_mapping_update_failed"));
          return;
        }
      }
      const message =
        err instanceof HttpError
          ? ((err.cause?.detail as string) ??
            t("variable_mapping_update_failed"))
          : t("variable_mapping_update_failed");
      toast.error(message);
    },
  });

  const onSubmit = (values: FormValues) => {
    // Preserve mapping keys not shown here rather than dropping them on save.
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

  const hasSchemaFields =
    !!schema &&
    (schema.object_fields.length > 0 || schema.extra_context_fields.length > 0);

  const metaBadges = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary">{template.provider}</Badge>
      <Badge variant="outline">{t(template.parameter_format)}</Badge>
      {template.language_code && (
        <span className="text-xs text-gray-500">{template.language_code}</span>
      )}
    </div>
  );

  const messageBody = (
    <Card>
      <CardHeader className="min-h-8 flex-row items-center space-y-0 pb-3">
        <CardTitle className="text-base">{t("message_body")}</CardTitle>
      </CardHeader>
      <CardContent>
        {bodyComponents.length === 0 ? (
          <p className="text-sm text-gray-500">{t("no_message_body_synced")}</p>
        ) : (
          <BodyCard components={bodyComponents} />
        )}
      </CardContent>
    </Card>
  );

  const rendered = previewMutation.data?.rendered;
  const previewBox = (
    <Card>
      <CardHeader className="min-h-8 flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">{t("rendered_preview")}</CardTitle>
        {canManage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={previewMutation.isPending}
            onClick={() => previewMutation.mutate(currentMapping())}
          >
            {previewMutation.isPending ? t("previewing") : t("preview")}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {previewMutation.data?.detail ? (
          <p className="text-sm text-gray-500">{previewMutation.data.detail}</p>
        ) : rendered ? (
          <BodyCard
            components={bodyComponents}
            transform={(text) => substituteBody(text, rendered)}
          />
        ) : (
          <p className="text-sm text-gray-500">{t("no_preview_available")}</p>
        )}
      </CardContent>
    </Card>
  );

  if (keys.length === 0) {
    return (
      <div className="mt-4 space-y-6">
        {metaBadges}
        <div className="max-w-2xl">{messageBody}</div>
        <p className="text-sm text-gray-500">{t("no_variables_detected")}</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="mt-4 space-y-6">
        {metaBadges}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-gray-900">
            {t("variable_mapping")}
          </h3>
          {keys.map((key, index) => (
            <div key={key} className="space-y-1">
              <div className="font-mono text-sm font-medium text-gray-900">
                {key}
              </div>
              <div className="font-mono text-sm text-gray-600">
                {form.getValues(`variables.${index}`) || "—"}
              </div>
            </div>
          ))}
        </div>
        {/* No previewBox here: rendering a preview needs can_manage, so for a read-only
            viewer that card can only ever say "no preview available". */}
        <div className="max-w-2xl">{messageBody}</div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-8">
        {metaBadges}

        {/* Variable mapping (primary, editable) and the field picker beside it. */}
        <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("variable_mapping")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {keys.map((key, index) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`variables.${index}`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-mono">{key}</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white font-mono text-sm"
                          {...field}
                          onFocus={() => setFocusedIndex(index)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="flex flex-col lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("available_fields")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              {schema && !hasSchemaFields ? (
                <p className="text-sm text-gray-500">
                  {t("link_trigger_to_see_fields")}
                </p>
              ) : hasSchemaFields ? (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <p className="text-sm text-gray-500">
                    {t("insert_field_hint")}
                  </p>
                  <ScrollArea className="min-h-0 flex-1 rounded-lg border border-gray-200">
                    <div className="p-2">
                      <FieldPicker
                        objectFields={schema!.object_fields}
                        extraFields={schema!.extra_context_fields}
                        onInsert={insertField}
                        disabled={mutation.isPending}
                      />
                    </div>
                  </ScrollArea>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {/* Template body and its rendered preview, kept for reference below. */}
        <div className="grid gap-4 lg:max-w-4xl lg:grid-cols-2 lg:items-start">
          {messageBody}
          {previewBox}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/notification-templates")}
          >
            {t("cancel")}
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </Form>
  );
}
