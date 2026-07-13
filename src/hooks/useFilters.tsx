import { QueryParam, setQueryParamsOptions, useQueryParams } from "raviger";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

import PaginationComponent from "@/components/Common/Pagination";

export type FilterState = Record<string, unknown>;

// Slimmed-down port of care_fe's useFilters: query-param pagination only,
// no FilterBadge or localStorage cache since this plugin doesn't need them.
export default function useFilters({
  limit = 14,
  defaultQueryParams = {},
}: {
  limit?: number;
  defaultQueryParams?: QueryParam;
}) {
  const hasPagination = limit > 0;
  const [qParams, _setQueryParams] = useQueryParams();

  const setQueryParams = (
    query: QueryParam,
    options?: setQueryParamsOptions,
  ) => {
    _setQueryParams(query, { ...options, replace: true });
  };

  const updateQuery = (filter: FilterState) => {
    const nextFilter = hasPagination ? { page: 1, limit, ...filter } : filter;
    setQueryParams(Object.assign({}, qParams, nextFilter), {
      overwrite: true,
    });
  };

  const updatePage = (page: number) => {
    if (!hasPagination) return;
    setQueryParams(Object.assign({}, qParams, { page }), { overwrite: true });
  };

  const removeFilters = (params?: string[]) => {
    params ??= Object.keys(qParams);
    setQueryParams(removeFromQuery(qParams, params));
  };
  const removeFilter = (param: string) => removeFilters([param]);

  useEffect(() => {
    const defaults = Object.fromEntries(
      Object.entries(defaultQueryParams).filter(
        ([key]) => qParams[key] === undefined,
      ),
    );
    if (Object.keys(defaults).length > 0) {
      setQueryParams({ ...defaults, ...qParams });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const Pagination = ({
    totalCount,
    noMargin,
  }: {
    totalCount: number;
    noMargin?: boolean;
  }) => {
    if (!hasPagination) return null;
    return (
      <div
        className={cn(
          "flex w-full justify-center",
          totalCount > limit ? "visible" : "invisible",
          !noMargin && "mt-4",
        )}
      >
        <PaginationComponent
          cPage={qParams.page}
          defaultPerPage={limit}
          data={{ totalCount }}
          onChange={(page) => updatePage(page)}
        />
      </div>
    );
  };

  return {
    qParams,
    resultsPerPage: limit,
    // Resets to page 1 unless the filter object itself sets page.
    updateQuery,
    updatePage,
    removeFilter,
    removeFilters,
    Pagination,
  };
}

const removeFromQuery = (query: Record<string, unknown>, params: string[]) => {
  const result = { ...query };
  for (const param of params) {
    delete result[param];
  }
  return result;
};
