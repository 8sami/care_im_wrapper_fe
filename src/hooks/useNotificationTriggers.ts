import { useQuery } from "@tanstack/react-query";

import { notificationApi } from "@/lib/api/notifications";
import { query } from "@/lib/request";

// Triggers are a small, mostly-static catalog; fetch once at a high limit
// instead of paginating, so both the filter Select and event-row lookups
// can share one cached list.
export default function useNotificationTriggers() {
  const { data, isLoading } = useQuery({
    queryKey: ["notification-triggers", "all"],
    queryFn: query(notificationApi.triggers_list, {
      queryParams: { limit: 100 },
    }),
    staleTime: 5 * 60 * 1000,
  });

  const triggers = data?.results ?? [];
  const triggersById = new Map(
    triggers.map((trigger) => [trigger.id, trigger]),
  );

  return { triggers, triggersById, isTriggersLoading: isLoading };
}
