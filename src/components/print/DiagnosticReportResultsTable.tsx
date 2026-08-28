/**
 * Observation results table for a diagnostic report.
 *
 * VENDORED from care_fe
 * `src/pages/Facility/services/diagnosticReports/components/DiagnosticReportResultsTable.tsx`
 * @ 2ea00b1d0e5e8054591ec07058e030a44490d572
 * A federated plug cannot import host source. Re-sync by diffing against that commit.
 *
 * Qualified-range conditions render through the vendored `ConditionOperationSummary`,
 * matching care_fe. Its one divergence (server-resolved tag names) is documented there.
 *
 * Uses react-i18next directly, not this plug's namespaced `useTranslation`: these labels
 * are care_fe's own keys, in the host's default namespace.
 */
import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import ConditionOperationSummary from "@/components/print/ConditionOperationSummary";

/* eslint-disable @typescript-eslint/no-explicit-any */

function formatRange(range: { min?: number | null; max?: number | null }) {
  if (range.min != null && range.max != null)
    return `${range.min} - ${range.max}`;
  if (range.min != null) return `> ${range.min}`;
  if (range.max != null) return `< ${range.max}`;
  return "";
}

export function DiagnosticReportResultsTable({
  observations,
}: {
  observations: any[];
}) {
  const { t } = useTranslation();

  const showInterpretation =
    observations.some((observation) => observation.interpretation?.display) ||
    observations.some((observation) =>
      observation.component?.some(
        (component: any) => component.interpretation?.display,
      ),
    );

  const renderReferenceRange = (referenceRange: any[]) => {
    if (!referenceRange?.length) return "-";

    return referenceRange.map((range, index) => {
      const rangeText = formatRange(range);
      const label = range.interpretation?.display;
      if (!label && !rangeText) return null;

      return (
        <span key={`reference-range-${index}`} className="block">
          {label ? `${label}: ` : ""}
          {rangeText}
        </span>
      );
    });
  };

  const renderQualifiedRanges = (qualifiedRanges: any[]) => {
    if (!qualifiedRanges?.length) return "-";

    return qualifiedRanges.map((qualifiedRange, index) => (
      <div
        key={qualifiedRange.id ?? index}
        className="flex flex-col gap-1 text-sm font-normal text-gray-500"
      >
        <div className="flex flex-row space-x-2 divide-x divide-gray-300 text-sm">
          {qualifiedRange.conditions?.map(
            (condition: any, conditionIndex: number) => (
              <span
                className="pr-2 text-gray-900"
                key={`condition-${conditionIndex}`}
              >
                <ConditionOperationSummary
                  condition={condition}
                  shortDisplay={true}
                />
              </span>
            ),
          )}
        </div>
        {qualifiedRange.ranges?.map((range: any, rangeIndex: number) => {
          const rangeText = formatRange(range);
          const label = range.interpretation?.display;
          if (!rangeText && !label) return null;

          return (
            <span key={rangeIndex} className="ml-2 self-start text-gray-900">
              {label ? `${label}: ` : ""}
              {rangeText}
            </span>
          );
        })}
        {index < qualifiedRanges.length - 1 && (
          <div className="mb-2 h-px w-full shrink-0 bg-gray-200" />
        )}
      </div>
    ));
  };

  const renderInterpretation = (interpretation: any) => {
    if (!interpretation) return "-";

    const { display, highlight = false, code } = interpretation;
    return (
      <div className="flex items-center gap-1">
        <span className={cn(highlight ? "font-bold" : "font-normal")}>
          {code?.display ? code.display : display}
        </span>
      </div>
    );
  };

  const renderValue = (holder: any) => {
    const highlight = holder.interpretation?.highlight ?? false;
    return (
      <div
        className={cn(
          "whitespace-normal",
          highlight ? "font-bold" : "font-normal",
        )}
      >
        <span>{holder.value?.value}</span>
        {holder.value?.unit && (
          <span className="ml-1 text-gray-500">
            {holder.value.unit.code || holder.value.unit.display}
          </span>
        )}
      </div>
    );
  };

  const renderComponents = (components: any[], observationDefinition: any) =>
    components.map((component, index) => {
      const componentQualifiedRange = observationDefinition?.component?.find(
        (c: any) => c.code?.code === component.code?.code,
      )?.qualified_ranges;

      return (
        <TableRow
          key={component.code?.code ?? index}
          className={cn(
            "border-0 bg-gray-50/50 text-sm text-gray-950",
            index === components.length - 1 && "border-b",
          )}
        >
          <TableCell className="wrap-break-word border-r border-b border-gray-300 pl-4 align-top whitespace-normal">
            <div className="h-px w-2 bg-gray-400" />
            {component.code?.display}
          </TableCell>
          <TableCell className="wrap-break-word border-r border-b border-gray-300 align-top whitespace-normal">
            {renderValue(component)}
          </TableCell>
          <TableCell className="wrap-break-word border-r border-b border-gray-300 align-top whitespace-normal">
            {component.reference_range?.length
              ? renderReferenceRange(component.reference_range)
              : componentQualifiedRange &&
                renderQualifiedRanges(componentQualifiedRange)}
          </TableCell>
          {showInterpretation && (
            <TableCell className="wrap-break-word border-b border-gray-300 align-top whitespace-normal">
              {component.interpretation &&
                renderInterpretation(component.interpretation)}
            </TableCell>
          )}
        </TableRow>
      );
    });

  const renderObservation = (observation: any) => {
    const hasComponents =
      observation.component && observation.component.length > 0;

    return (
      <>
        <TableRow
          key={observation.id}
          className={cn(
            "divide-x divide-gray-300 text-sm text-gray-950",
            hasComponents && "border-b-0",
          )}
        >
          <TableCell className="wrap-break-word align-top whitespace-normal">
            {observation.observation_definition?.title ||
              observation.observation_definition?.code?.display}
          </TableCell>
          <TableCell className="wrap-break-word align-top whitespace-normal">
            {!hasComponents && renderValue(observation)}
          </TableCell>
          <TableCell className="wrap-break-word align-top whitespace-normal">
            {!hasComponents &&
              (observation.reference_range?.length
                ? renderReferenceRange(observation.reference_range)
                : observation.observation_definition &&
                  renderQualifiedRanges(
                    observation.observation_definition.qualified_ranges,
                  ))}
          </TableCell>
          {showInterpretation && (
            <TableCell className="wrap-break-word align-top whitespace-normal">
              {!hasComponents &&
                observation.interpretation &&
                renderInterpretation(observation.interpretation)}
            </TableCell>
          )}
        </TableRow>
        {hasComponents &&
          observation.observation_definition &&
          renderComponents(
            observation.component,
            observation.observation_definition,
          )}
      </>
    );
  };

  if (!observations?.length) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <Table className="w-full table-fixed cursor-default border-collapse bg-white shadow-sm">
        <TableHeader className="bg-gray-100">
          <TableRow className="divide-x-1 divide-gray-300">
            <TableHead className="w-[25%] pt-2 align-top text-sm font-medium text-gray-700">
              {t("test")}
            </TableHead>
            <TableHead className="w-[25%] pt-2 align-top text-sm font-medium text-gray-700">
              {t("result")}
            </TableHead>
            <TableHead className="wrap-break-word w-[25%] pt-2 align-top text-sm font-medium whitespace-normal text-gray-700">
              {t("reference_range")}
            </TableHead>
            {showInterpretation && (
              <TableHead className="wrap-break-word w-[25%] pt-2 align-top text-sm font-medium whitespace-normal text-gray-700">
                {t("interpretation")}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {observations.map((observation) => (
            <Fragment key={observation.id}>
              {renderObservation(observation)}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
