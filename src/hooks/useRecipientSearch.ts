import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  MIN_SEARCH_LENGTH,
  RecipientOption,
} from "@/components/Notifications/RecipientPicker";

// Debounced search paired with a locally held multi-select.
export default function useRecipientSearch<TItem>(
  queryKey: string,
  searchQueryFn: (
    search: string,
  ) => (context: { signal: AbortSignal }) => Promise<{ results: TItem[] }>,
  toOption: (item: TItem) => RecipientOption,
) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selected, setSelected] = useState<RecipientOption[]>([]);

  const { data, isFetching } = useQuery({
    queryKey: [queryKey, searchTerm],
    queryFn: searchQueryFn(searchTerm),
    enabled: searchTerm.trim().length >= MIN_SEARCH_LENGTH,
  });

  return {
    searchTerm,
    setSearchTerm,
    options: (data?.results ?? []).map(toOption),
    isSearching: isFetching,
    selected,
    select: (option: RecipientOption) =>
      setSelected((prev) => [...prev, option]),
    remove: (id: string) =>
      setSelected((prev) => prev.filter((option) => option.id !== id)),
  };
}
