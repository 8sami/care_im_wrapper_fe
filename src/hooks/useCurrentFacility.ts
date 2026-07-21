import { useQuery } from "@tanstack/react-query";
import { useFullPath } from "raviger";

import { facilityApi } from "@/lib/api/notifications";
import { config } from "@/lib/config";
import { query } from "@/lib/request";

function extractFacilityId(path: string): string {
  const segments = path.split("/");
  if (segments[1] === "facility" && segments[2]) {
    return segments[2];
  }
  throw new Error(
    "useCurrentFacility can only be used on a /facility/:facilityId/... route",
  );
}

// facilityId is the facility external_id, used as-is. This fetch also
// doubles as the access probe (a foreign or tampered id 403s or 404s here).
// Marked silent since the host can't recognize this plugin's error class,
// so callers own the "no permission" messaging themselves.
export default function useCurrentFacility() {
  const facilityId = extractFacilityId(useFullPath());

  const {
    data: facility,
    isLoading: isFacilityLoading,
    isError: isFacilityError,
  } = useQuery({
    queryKey: ["facility", facilityId],
    queryFn: query(facilityApi.get, {
      pathParams: { facilityId },
      silent: true,
    }),
    staleTime: config.catalogStaleMs,
  });

  return { facilityId, facility, isFacilityLoading, isFacilityError };
}
