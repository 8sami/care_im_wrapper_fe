import { useQuery } from "@tanstack/react-query";

import { config } from "@/lib/config";
import { PaginatedResponse } from "@/lib/request";

// Fetches a small, static catalog once and exposes it as both a list and an id -> item map.
export default function useIdMappedList<T extends { id: string }>(
  queryKey: string,
  queryFn: (context: { signal: AbortSignal }) => Promise<PaginatedResponse<T>>,
) {
  const { data, isLoading } = useQuery({
    queryKey: [queryKey, "all"],
    queryFn,
    staleTime: config.catalogStaleMs,
  });

  const list = data?.results ?? [];
  const listById = new Map(list.map((item) => [item.id, item]));

  return { list, listById, isLoading };
}
