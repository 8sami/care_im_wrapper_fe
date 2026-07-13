import { navigate } from "raviger";
import { useEffect } from "react";
import { toast } from "sonner";

import CareIcon from "@/CAREUI/icons/CareIcon";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import Page from "@/components/Common/Page";
import { TableSkeleton } from "@/components/Common/SkeletonLoading";

import useCurrentFacility from "@/hooks/useCurrentFacility";
import { useTranslation } from "@/hooks/useTranslation";

// Placeholder for the events list screen.
export default function NotificationEventsPage() {
  const { t } = useTranslation();
  const { facility, isFacilityLoading, isFacilityError } = useCurrentFacility();

  useEffect(() => {
    if (!isFacilityLoading && isFacilityError) {
      toast.error(t("no_permission_to_view_page"));
      navigate("/");
    }
  }, [isFacilityLoading, isFacilityError, t]);

  if (isFacilityLoading || !facility) {
    return (
      <Page title={t("notifications")}>
        <TableSkeleton count={5} />
      </Page>
    );
  }

  return (
    <Page title={t("notifications")}>
      <Card className="mt-4 flex flex-col items-center justify-center border-dashed p-8 text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-3">
          <CareIcon icon="l-bell" className="size-6 text-primary" />
        </div>
        <h3 className="mb-1 text-lg font-semibold">{t("notifications")}</h3>
        <p className="text-sm text-gray-500">
          {t("notifications_coming_soon")}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => toast.success("PLUGIN TOAST TEST")}
        >
          {t("test_toast")}
        </Button>
      </Card>
    </Page>
  );
}
