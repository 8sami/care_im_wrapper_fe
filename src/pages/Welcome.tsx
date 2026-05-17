import { useTranslation } from "@/hooks/useTranslation";

export default function Welcome() {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto max-w-2xl py-8 px-4">
      {t("welcome_to_care_im_wrapper_fe")}
      <p className="text-muted-foreground">
        {t("care_im_wrapper_fe_description")}
      </p>
    </div>
  );
}
