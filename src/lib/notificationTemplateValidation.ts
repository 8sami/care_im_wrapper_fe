import { z } from "zod";

// Per-provider rules for a NotificationTemplate.variable_mapping expression
// value. Keyed by NotificationTemplate.provider (care_im_wrapper's
// core/choices.py Provider enum - currently just "whatsapp", more will land
// as providers are added). To support a new provider, add an entry here;
// nothing else in the templates screen needs to change.
type ExpressionSchemaFactory = (
  t: (key: string) => string,
) => z.ZodType<string, z.ZodTypeDef, string>;

const baseExpressionSchema: ExpressionSchemaFactory = (t) =>
  z.string().trim().min(1, t("field_required"));

// Matches a value fully wrapped in a Jinja2 double-brace expression, e.g.
// the exact shape care_im_wrapper's `resolve_variable` (messaging/variables.py)
// renders via `TemplateEngine.render`. Kept out of translated copy: i18next's
// interpolation (skipOnVariables: false in care_fe's i18n.ts) would otherwise
// treat a literal double-brace pair in a translation string as an unresolved
// variable and blank it out.
const DOUBLE_BRACE_EXPRESSION_RE = /^\{\{([\s\S]*)\}\}$/;

function isDoubleBraceExpression(value: string) {
  const match = DOUBLE_BRACE_EXPRESSION_RE.exec(value.trim());
  return !!match && match[1].trim().length > 0;
}

// Meta/WhatsApp-specific: rejects parameter values containing newlines/tabs
// or more than 4 consecutive spaces, and requires the value to be a Jinja2
// double-brace expression (what the backend actually evaluates it as).
const whatsappExpressionSchema: ExpressionSchemaFactory = (t) =>
  baseExpressionSchema(t)
    .refine((value) => !/[\n\r\t]/.test(value), {
      message: t("whatsapp_value_no_newlines_or_tabs"),
    })
    .refine((value) => !/ {5,}/.test(value), {
      message: t("whatsapp_value_no_extra_spaces"),
    })
    .refine(isDoubleBraceExpression, {
      message: t("whatsapp_value_must_be_double_brace_expression"),
    });

const PROVIDER_EXPRESSION_SCHEMAS: Record<string, ExpressionSchemaFactory> = {
  whatsapp: whatsappExpressionSchema,
};

export function expressionSchemaForProvider(
  provider: string,
  t: (key: string) => string,
) {
  return (PROVIDER_EXPRESSION_SCHEMAS[provider] ?? baseExpressionSchema)(t);
}
