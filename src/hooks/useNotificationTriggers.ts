import { notificationApi } from "@/lib/api/notifications";
import { config } from "@/lib/config";
import { query } from "@/lib/request";

import useIdMappedList from "@/hooks/useIdMappedList";

export default function useNotificationTriggers() {
  const {
    list: triggers,
    listById: triggersById,
    isLoading: isTriggersLoading,
  } = useIdMappedList(
    "notification-triggers",
    query(notificationApi.triggers_list, {
      queryParams: { limit: config.catalogFetchLimit },
    }),
  );

  return { triggers, triggersById, isTriggersLoading };
}
