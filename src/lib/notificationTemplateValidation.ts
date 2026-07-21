import { z } from "zod";

// Per-provider rules for a variable_mapping expression value. To add a
// provider, add an entry to PROVIDER_EXPRESSION_SCHEMAS below.
// zod 4 dropped the three-generic ZodType<Output, Def, Input>; it is ZodType<Output, Input>.
type ExpressionSchemaFactory = (
  t: (key: string) => string,
) => z.ZodType<string, string>;

const baseExpressionSchema: ExpressionSchemaFactory = (t) =>
  z.string().trim().min(1, t("field_required"));

// Matches a value fully wrapped in a Jinja2 double-brace expression. Kept out
// of translated copy since i18next would treat the braces as an interpolation.
const DOUBLE_BRACE_EXPRESSION_RE = /^\{\{([\s\S]*)\}\}$/;

function isDoubleBraceExpression(value: string) {
  const match = DOUBLE_BRACE_EXPRESSION_RE.exec(value.trim());
  return !!match && match[1].trim().length > 0;
}

// WhatsApp rejects newlines/tabs and 5+ consecutive spaces in parameter values.
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
