// Types for the patient-facing document page.
//
// `report` is passed through from CARE's own DiagnosticReportRetrieveSpec, i.e. the exact
// body care_fe's authenticated retrieve endpoint returns. It is typed loosely on purpose:
// the print view consumes it the same way care_fe's does, and mirroring core's full
// observation schema here would be a second copy to keep in step for no benefit.

/** Mirror of care_fe's `PrintTemplate` (src/types/facility/printTemplate.ts). */
export interface PageMargin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PageConfig {
  size?: "A4" | "A5" | "Letter" | "Legal";
  orientation?: "portrait" | "landscape";
  margin?: PageMargin;
}

export interface LogoConfig {
  url: string;
  width?: number;
  height?: number;
  alignment: "left" | "center" | "right";
}

export interface ImageConfig {
  url: string;
  height?: number;
}

export interface BrandingConfig {
  logo?: LogoConfig;
  header_image?: ImageConfig;
  footer_image?: ImageConfig;
}

export interface WatermarkConfig {
  enabled?: boolean;
  text?: string;
  opacity?: number;
  rotation?: number;
}

export interface PrintTemplate {
  slug: string;
  page?: PageConfig;
  print_setup?: { auto_print?: boolean };
  branding?: BrandingConfig;
  watermark?: WatermarkConfig;
}

/** Only the fields the print layout reads; the endpoint deliberately sends no more. */
export interface DocumentFacility {
  name?: string;
  address?: string;
  phone_number?: string;
  print_templates?: PrintTemplate[];
}

export interface DocumentAttachment {
  id: string;
  name: string;
  /** Leading dot included, e.g. ".pdf" — matches FileUpload.get_extension(). */
  extension: string;
  /** Short-lived signed URL, minted per request. */
  url: string;
}

export type DocumentMode = "render" | "file";

export interface PublicDocument {
  /** Registered kind slug, e.g. "diagnostic_report". Selects the renderer. */
  kind: string;
  mode: DocumentMode;
  /** Facility print_templates slug for this document; "" for file-mode documents. */
  template_slug: string;
  facility?: DocumentFacility;

  // mode: "render"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report?: any;
  files?: DocumentAttachment[];

  // mode: "file"
  file?: { url: string };
}
