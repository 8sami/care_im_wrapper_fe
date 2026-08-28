/**
 * Diagnostic report, laid out as care_fe prints it.
 *
 * VENDORED from care_fe
 * `src/pages/Facility/services/diagnosticReports/DiagnosticReportPrint.tsx`
 * @ 2ea00b1d0e5e8054591ec07058e030a44490d572
 *
 * Two differences from that file, both because there is no signed-in user here:
 *  - it takes `report`, `files` and `facility` as props instead of fetching them itself
 *    (the public endpoint supplies all three, already signed);
 *  - PDF attachments render in an <object> rather than via react-pdf. care_fe rasterises
 *    each PDF page so it prints inline; matching that needs react-pdf plus a worker, and a
 *    worker URL does not resolve reliably from inside a federated remote. Images render
 *    identically. See the note on AttachmentList below.
 *
 * i18n: these vendored files import `useTranslation` from react-i18next directly rather
 * than this plug's `@/hooks/useTranslation`. That is deliberate — the labels here ("test",
 * "reference_range", "conclusion" …) are care_fe's own keys and live in the host's default
 * namespace, whereas the plug's hook scopes lookups to the `care_im_wrapper` namespace and
 * would miss every one of them.
 */
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

import { formatName, formatPatientAge } from "@/lib/format";
import { DocumentAttachment } from "@/lib/types/documents";

import { DiagnosticReportResultsTable } from "@/components/print/DiagnosticReportResultsTable";
import PrintFooter from "@/components/print/PrintFooter";

/* eslint-disable @typescript-eslint/no-explicit-any */

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

function isExtension(file: DocumentAttachment, extensions: string[]) {
  const ext = (file.extension || "").toLowerCase().replace(/^\./, "");
  return extensions.includes(ext);
}

function LabelledValue({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6rem_auto_1fr] items-center">
      <span className="text-gray-600">{label}</span>
      <span className="text-gray-600">:</span>
      <span className="wrap-break-word ml-2 font-semibold">{value}</span>
    </div>
  );
}

function AttachmentList({ files }: { files: DocumentAttachment[] }) {
  const { t } = useTranslation();

  const images = files.filter((file) => isExtension(file, IMAGE_EXTENSIONS));
  const pdfs = files.filter((file) => isExtension(file, ["pdf"]));

  if (!images.length && !pdfs.length) return null;

  return (
    <div className="mt-8 space-y-12">
      {pdfs.map((file) => (
        <div key={file.id} className="break-before-page">
          <div className="mb-2 text-sm font-medium text-gray-500">
            {file.name}
          </div>
          <object
            data={file.url}
            type="application/pdf"
            className="h-[80vh] w-full print:hidden"
            aria-label={file.name}
          >
            <a href={file.url} target="_blank" rel="noreferrer">
              {file.name}
            </a>
          </object>
          {/* Printed output cannot embed a PDF, so the reader gets its name instead of a
              silently blank page. */}
          <p className="hidden text-xs text-gray-500 print:block">
            {t("attachment_available_online", { defaultValue: "Attachment:" })}{" "}
            {file.name}
          </p>
        </div>
      ))}
      {images.map((file) => (
        <div
          key={file.id}
          className="break-before-page flex w-full flex-col justify-center"
        >
          <img
            src={file.url}
            alt={file.name}
            className="mx-auto h-auto max-w-full"
            style={{ maxWidth: "600px" }}
          />
        </div>
      ))}
    </div>
  );
}

export default function DiagnosticReportPrintView({
  report,
  files = [],
}: {
  report: any;
  files?: DocumentAttachment[];
}) {
  const { t } = useTranslation();

  const patient = report?.encounter?.patient;
  const officialIdentifiers = (patient?.instance_identifiers ?? []).filter(
    (identifier: any) => identifier?.config?.config?.use === "official",
  );

  // care_fe hides observations withdrawn as data-entry errors; so must this.
  const observations = (report?.observations ?? []).filter(
    (observation: any) => observation?.status !== "entered_in_error",
  );

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">
        {report?.service_request?.title || t("diagnostic_report", { count: 1 })}
      </h2>

      <div className="grid gap-x-6 gap-y-1 border-t border-gray-200 pt-2 md:grid-cols-2 print:grid-cols-2">
        <LabelledValue label={t("patient")} value={patient?.name} />
        {officialIdentifiers.map((identifier: any) => (
          <LabelledValue
            key={identifier.config.id}
            label={identifier.config.config.display}
            value={identifier.value}
          />
        ))}
        {patient && (
          <LabelledValue
            label={`${t("age")} / ${t("sex")}`}
            value={
              <>
                {formatPatientAge(patient)} /
                <span className="ml-1 capitalize">{patient.gender}</span>
              </>
            }
          />
        )}
        <LabelledValue
          label={t("category")}
          value={report?.category?.display || "-"}
        />
        <LabelledValue
          label={t("report_date")}
          value={
            report?.created_date
              ? format(new Date(report.created_date), "dd-MM-yyyy")
              : "-"
          }
        />
        <LabelledValue
          label={t("requested_by")}
          value={formatName(report?.requester)}
        />
        {report?.encounter?.current_location && (
          <LabelledValue
            label={t("location")}
            value={report.encounter.current_location.name}
          />
        )}
      </div>

      <div className="mt-8 space-y-8">
        <div>
          <h2 className="mb-4 text-lg font-semibold">{t("test_results")}</h2>
          <DiagnosticReportResultsTable observations={observations} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
        {report?.note && (
          <div className="col-span-full">
            <div className="mb-1 text-sm font-medium text-gray-500">
              {t("notes")}
            </div>
            <div className="text-sm whitespace-pre-wrap">{report.note}</div>
          </div>
        )}
        {report?.conclusion && (
          <div className="col-span-full">
            <div className="mb-1 text-sm font-medium text-gray-500">
              {t("conclusion")}
            </div>
            <div className="text-sm whitespace-pre-wrap">
              {report.conclusion}
            </div>
          </div>
        )}
      </div>

      <AttachmentList files={files} />

      <PrintFooter className="mt-12 border-t pt-4" />
    </div>
  );
}
