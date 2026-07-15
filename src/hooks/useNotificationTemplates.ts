import { notificationApi } from "@/lib/api/notifications";
import { query } from "@/lib/request";

import useIdMappedList from "@/hooks/useIdMappedList";

export default function useNotificationTemplates() {
  const {
    list: templates,
    listById: templatesById,
    isLoading: isTemplatesLoading,
  } = useIdMappedList(
    "notification-templates",
    query(notificationApi.templates_list, { queryParams: { limit: 100 } }),
  );

  return { templates, templatesById, isTemplatesLoading };
}
