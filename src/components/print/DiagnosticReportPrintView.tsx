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
 *  - `PrintFooter` drops "printed by", since there is nobody signed in to name.
 *
 * Attachments follow care_fe exactly: react-pdf rasterises every page of a PDF so it
 * prints inline with the report, and images render after them, each starting a new page.
 *
 * Uses react-i18next directly, not this plug's namespaced `useTranslation`: these labels
 * are care_fe's own keys, in the host's default namespace.
 */
import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page } from "react-pdf";

import { formatName, formatPatientAge } from "@/lib/format";
import "@/lib/pdfWorker";
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

function PDFRenderer({ fileUrl }: { fileUrl: string }) {
  const [numPages, setNumPages] = useState<number>(0);
  const { t } = useTranslation();

  return (
    <div className="break-before-page">
      <Document
        file={fileUrl}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        error={<div className="text-red-500">{t("error_loading_pdf")}</div>}
        loading={<div className="text-gray-500">{t("loading")}</div>}
      >
        <div className="flex w-full flex-col justify-center">
          {Array.from(new Array(numPages), (_, index) => (
            <Page
              key={`page_${index + 1}`}
              pageNumber={index + 1}
              width={Math.min(window.innerWidth * 0.9, 600)}
              scale={1.2}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          ))}
        </div>
      </Document>
    </div>
  );
}

function ImageRenderer({
  fileUrl,
  fileName,
}: {
  fileUrl: string;
  fileName?: string;
}) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="break-before-page flex w-full flex-col justify-center">
      {isLoading && (
        <div className="py-4 text-center text-gray-500">{t("loading")}</div>
      )}
      {hasError && (
        <div className="py-4 text-center text-red-500">
          {t("error_loading_image")}
        </div>
      )}
      <img
        src={fileUrl}
        alt={fileName || t("diagnostic_report_image")}
        className={`mx-auto h-auto max-w-full ${isLoading || hasError ? "hidden" : ""}`}
        style={{ maxWidth: "600px" }}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

function AttachmentList({ files }: { files: DocumentAttachment[] }) {
  const pdfFiles = files.filter((file) => isExtension(file, ["pdf"]));
  const imageFiles = files.filter((file) =>
    isExtension(file, IMAGE_EXTENSIONS),
  );

  if (!files.length) return null;

  return (
    <div className="mt-8">
      {pdfFiles.length > 0 && (
        <div className="mt-8">
          <div className="space-y-12">
            {pdfFiles.map((file) => (
              <div key={`content-${file.id}`}>
                <PDFRenderer fileUrl={file.url} />
              </div>
            ))}
          </div>
        </div>
      )}
      {imageFiles.length > 0 && (
        <div className="mt-8">
          <div className="space-y-12">
            {imageFiles.map((file) => (
              <div key={`content-${file.id}`}>
                <ImageRenderer fileUrl={file.url} fileName={file.name} />
              </div>
            ))}
          </div>
        </div>
      )}
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
