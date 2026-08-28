/**
 * The page a patient lands on from a link the bot sent them.
 *
 * No CARE account is involved: the token in the URL is the whole capability, and the
 * backend decides what it opens. This component never asks who the viewer is.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, PrinterIcon } from "lucide-react";
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { documentApi } from "@/lib/api/documents";
import { query } from "@/lib/request";
import { PublicDocument } from "@/lib/types/documents";

import { Button } from "@/components/ui/button";

import DiagnosticReportPrintView from "@/components/print/DiagnosticReportPrintView";
import PrintLayout from "@/components/print/PrintLayout";

/**
 * Renderers for `mode: "render"` documents, keyed by the backend's kind slug.
 * Adding a document type is one entry here and one in the backend's documents/kinds.py.
 */
const RENDERERS: Record<string, (doc: PublicDocument) => ReactNode> = {
  diagnostic_report: (doc) => (
    <DiagnosticReportPrintView report={doc.report} files={doc.files} />
  ),
};

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      {children}
    </div>
  );
}

export default function PublicDocumentPage({ token }: { token: string }) {
  const { t } = useTranslation();

  const {
    data: doc,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-document", token],
    queryFn: query(documentApi.public_document, {
      pathParams: { token },
      noAuth: true,
      silent: true,
    }),
    retry: false,
  });

  if (isLoading) {
    return (
      <Centered>
        <Loader2Icon
          className="size-6 animate-spin text-gray-500"
          aria-label="Loading"
        />
      </Centered>
    );
  }

  // Expired, revoked, unknown and withdrawn all arrive as the same 404, deliberately, so
  // there is only one thing to say.
  if (isError || !doc) {
    return (
      <Centered>
        <div className="max-w-md">
          <h1 className="text-lg font-semibold text-gray-900">
            {t("document_link_unavailable_title", {
              defaultValue: "This link is no longer available",
            })}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t("document_link_unavailable_body", {
              defaultValue:
                "It may have expired. Message the bot again to get a fresh link.",
            })}
          </p>
        </div>
      </Centered>
    );
  }

  if (doc.mode === "file") {
    return (
      <Centered>
        <div>
          <object
            data={doc.file?.url}
            type="application/pdf"
            className="h-[80vh] w-[90vw]"
            aria-label={t("document", { defaultValue: "Document" })}
          >
            <a href={doc.file?.url} target="_blank" rel="noreferrer">
              {t("open_document", { defaultValue: "Open document" })}
            </a>
          </object>
        </div>
      </Centered>
    );
  }

  const renderer = RENDERERS[doc.kind];
  if (!renderer) {
    return (
      <Centered>
        <p className="text-sm text-gray-600">
          {t("document_type_unsupported", {
            defaultValue: "This document cannot be displayed here.",
          })}
        </p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-2 sm:p-6">
      <div className="mb-3 flex justify-end print:hidden">
        <Button variant="primary" onClick={() => window.print()}>
          <PrinterIcon className="size-4" />
          {t("print", { defaultValue: "Print" })}
        </Button>
      </div>

      <div className="shadow-2xl">
        <PrintLayout facility={doc.facility} templateSlug={doc.template_slug}>
          {renderer(doc)}
        </PrintLayout>
      </div>
    </div>
  );
}
