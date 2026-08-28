/**
 * One-line summary of a qualified range's condition ("Female", "2 to 12 years").
 *
 * VENDORED from care_fe `src/types/base/condition/condition.ts`
 * (the `ConditionOperationSummary` component) @ eab3b7588384ea62b5e728f37b88e1f511cc3bc8
 *
 * DIVERGENCE, in the has_tag branch only: care_fe resolves tag names in the browser via
 * `useTagConfigs`, which calls the authenticated /api/v1/tag_config/ endpoint. A patient
 * reading this page has no CARE session, so the plug's public endpoint resolves those
 * names server side and attaches them as `tag_displays` (see documents/kinds.py).
 * The equality and in_range branches are byte-for-byte care_fe's logic.
 *
 * i18n note as per the other files here: keys such as `condition_metric__*` and `GENDER__*`
 * belong to the host's default namespace, so this uses react-i18next directly.
 */
import { useTranslation } from "react-i18next";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ConditionOperationSummary({
  condition,
  shortDisplay = false,
}: {
  condition: any;
  shortDisplay?: boolean;
}) {
  const { t } = useTranslation();
  const conditionName = t(`condition_metric__${condition.metric}`);

  switch (condition.operation) {
    case "equality": {
      const value =
        typeof condition.value === "object" && "value" in condition.value
          ? condition.value.value
          : condition.value;
      let valueDisplay = String(value);
      if (condition.metric === "patient_gender") {
        valueDisplay = t(`GENDER__${value}`);
      } else if (condition.metric === "encounter_class") {
        valueDisplay = t(`encounter_class__${value}`);
      }
      const valueType =
        typeof condition.value === "object" && "value_type" in condition.value
          ? condition?.value.value_type
          : "";
      return shortDisplay
        ? `${valueDisplay} ${valueType}`
        : `${conditionName} is equal to ${valueDisplay} ${valueType}`;
    }
    case "in_range": {
      const valueType =
        "value_type" in condition.value ? condition?.value.value_type : "";
      return shortDisplay
        ? `${condition.value.min} to ${condition.value.max} ${valueType}`
        : `${conditionName} is in range ${condition.value.min} to ${condition.value.max} ${valueType}`;
    }
    case "has_tag": {
      // Resolved server side; absent if none of the ids matched a live tag.
      const tagDisplay = (condition.tag_displays ?? []).join(", ");
      if (!tagDisplay) return null;
      const tagResource =
        condition.metric === "encounter_tag" ? "encounter" : "patient";
      return shortDisplay
        ? `${tagDisplay}`
        : `Has any of the following ${tagResource} tag(s): ${tagDisplay}`;
    }
    default:
      return null;
  }
}
