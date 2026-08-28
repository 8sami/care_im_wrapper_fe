/**
 * The page a patient lands on from a link the bot sent them.
 *
 * No CARE account is involved: the token in the URL is the whole capability, and the
 * backend decides what it opens. This component never asks who the viewer is.
 */
import { useQuery } from "@tanstack/react-query";
import { PrinterIcon } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";

import { documentApi } from "@/lib/api/documents";
import { query } from "@/lib/request";
import { PublicDocument } from "@/lib/types/documents";

import { Button } from "@/components/ui/button";

import DiagnosticReportPrintView from "@/components/print/DiagnosticReportPrintView";
import PrintLayout from "@/components/print/PrintLayout";

import { useTranslation } from "@/hooks/useTranslation";

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

/**
 * A stored document is a finished PDF, so the browser is handed the file rather than an
 * embed: <object>/<iframe> pdf rendering is unreliable on mobile (iOS Safari shows a
 * blank frame), and these links are opened on phones.
 *
 * `replace` rather than an assignment, so this page does not sit in history between the
 * document and wherever the reader came from -- going back would otherwise land here and
 * immediately hand off again.
 */
const HANDOFF_FALLBACK_DELAY_MS = 2000;

function StoredFileHandoff({ url }: { url?: string }) {
  const { t } = useTranslation();
  // Held back so the link does not flash before the redirect fires. It only appears if
  // the redirect has not taken the reader away by now, which means it was blocked.
  const [redirectSeemsBlocked, setRedirectSeemsBlocked] = useState(false);

  useEffect(() => {
    if (!url) return;
    window.location.replace(url);
    const timer = setTimeout(
      () => setRedirectSeemsBlocked(true),
      HANDOFF_FALLBACK_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [url]);

  if (!url) {
    return (
      <Centered>
        <p className="text-sm text-gray-600">
          {t("document_link_unavailable_title")}
        </p>
      </Centered>
    );
  }

  if (!redirectSeemsBlocked) {
    return null;
  }

  return (
    <Centered>
      <a href={url} className="text-sm underline" rel="noreferrer">
        {t("open_document")}
      </a>
    </Centered>
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

  // Nothing while fetching: care_fe already shows its own loader over this page while
  // the plug resolves, and a second spinner straight after it just flickers.
  if (isLoading) {
    return null;
  }

  // Expired, revoked, unknown and withdrawn all arrive as the same 404, deliberately, so
  // there is only one thing to say.
  if (isError || !doc) {
    return (
      <Centered>
        <div className="max-w-md">
          <h1 className="text-lg font-semibold text-gray-900">
            {t("document_link_unavailable_title")}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            {t("document_link_unavailable_body")}
          </p>
        </div>
      </Centered>
    );
  }

  if (doc.mode === "file") {
    return <StoredFileHandoff url={doc.file?.url} />;
  }

  const renderer = RENDERERS[doc.kind];
  if (!renderer) {
    return (
      <Centered>
        <p className="text-sm text-gray-600">
          {t("document_type_unsupported")}
        </p>
      </Centered>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-2 sm:p-6">
      <div className="mb-3 flex justify-end print:hidden">
        <Button variant="primary" onClick={() => window.print()}>
          <PrinterIcon className="size-4" />
          {t("print")}
        </Button>
      </div>

      {/* Padding and paper look live out here, as they do in care_fe's PrintPreview. */}
      <div className="bg-white p-6 text-sm shadow-2xl sm:p-10">
        <PrintLayout facility={doc.facility} templateSlug={doc.template_slug}>
          {renderer(doc)}
        </PrintLayout>
      </div>
    </div>
  );
}
