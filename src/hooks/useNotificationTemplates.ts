import { useQuery } from "@tanstack/react-query";

import { notificationApi } from "@/lib/api/notifications";
import { query } from "@/lib/request";

// Templates are a small, mostly-static catalog; fetch once at a high limit
// instead of paginating, so event rows/forms can look one up by id from a
// shared cache rather than each running its own query.
export default function useNotificationTemplates() {
  const { data, isLoading } = useQuery({
    queryKey: ["notification-templates", "all"],
    queryFn: query(notificationApi.templates_list, {
      queryParams: { limit: 100 },
    }),
    staleTime: 5 * 60 * 1000,
  });

  const templates = data?.results ?? [];
  const templatesById = new Map(
    templates.map((template) => [template.id, template]),
  );

  return { templates, templatesById, isTemplatesLoading: isLoading };
}
