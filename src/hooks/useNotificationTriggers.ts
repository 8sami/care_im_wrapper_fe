import { notificationApi } from "@/lib/api/notifications";
import { query } from "@/lib/request";

import useIdMappedList from "@/hooks/useIdMappedList";

export default function useNotificationTriggers() {
  const {
    list: triggers,
    listById: triggersById,
    isLoading: isTriggersLoading,
  } = useIdMappedList(
    "notification-triggers",
    query(notificationApi.triggers_list, { queryParams: { limit: 100 } }),
  );

  return { triggers, triggersById, isTriggersLoading };
}
