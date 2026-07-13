import { navigate } from "raviger";
import { useEffect } from "react";
import { toast } from "sonner";

import useCurrentFacility from "@/hooks/useCurrentFacility";
import { useTranslation } from "@/hooks/useTranslation";

// Shared by every facility-scoped screen: the useCurrentFacility fetch
// doubles as the access probe (research §12.3), so a load failure means
// either a foreign facility id or no read permission. Redirect rather than
// leave a blank page (V6).
export default function useFacilityAccessGuard() {
  const { t } = useTranslation();
  const { facilityId, facility, isFacilityLoading, isFacilityError } =
    useCurrentFacility();

  useEffect(() => {
    if (!isFacilityLoading && isFacilityError) {
      toast.error(t("no_permission_to_view_page"));
      navigate("/");
    }
  }, [isFacilityLoading, isFacilityError, t]);

  return { facilityId, facility, isFacilityLoading, isFacilityError };
}
