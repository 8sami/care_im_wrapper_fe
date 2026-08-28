/**
 * VENDORED from care_fe `src/components/Common/PrintFooter.tsx`.
 *
 * DIVERGENCE: care_fe's version reads the signed-in user via `useAuthUser()` to print
 * "Printed by <staff name>". There is no signed-in user on a patient's page, so that half
 * is dropped and only the generated-on timestamp remains.
 *
 * i18n: these vendored files import `useTranslation` from react-i18next directly rather
 * than this plug's `@/hooks/useTranslation`. That is deliberate — the labels here ("test",
 * "reference_range", "conclusion" …) are care_fe's own keys and live in the host's default
 * namespace, whereas the plug's hook scopes lookups to the `care_im_wrapper` namespace and
 * would miss every one of them.
 */
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

export default function PrintFooter({
  className = "",
}: {
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={`mt-2 flex flex-wrap justify-between text-[10px] text-gray-500 ${className}`}
    >
      <p />
      <p>
        <span className="font-semibold">{t("generated_on")} </span>
        <span>{format(new Date(), "PPP 'at' p")}</span>
      </p>
    </div>
  );
}
