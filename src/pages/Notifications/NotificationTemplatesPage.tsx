import CareIcon from "@/CAREUI/icons/CareIcon";

import { Card } from "@/components/ui/card";

import Page from "@/components/Common/Page";

import { useTranslation } from "@/hooks/useTranslation";

// Placeholder for the templates screen.
export default function NotificationTemplatesPage() {
  const { t } = useTranslation();

  return (
    <Page title={t("notification_templates")}>
      <Card className="mt-4 flex flex-col items-center justify-center border-dashed p-8 text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-3">
          <CareIcon
            icon="l-comment-alt-lines"
            className="size-6 text-primary"
          />
        </div>
        <h3 className="mb-1 text-lg font-semibold">
          {t("notification_templates")}
        </h3>
        <p className="text-sm text-gray-500">
          {t("notification_templates_coming_soon")}
        </p>
      </Card>
    </Page>
  );
}
