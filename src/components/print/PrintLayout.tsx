/**
 * Facility letterhead for printed documents.
 *
 * VENDORED from care_fe `src/CAREUI/misc/PrintPreview.tsx` @ eab3b7588384ea62b5e728f37b88e1f511cc3bc8
 * A federated plug cannot import host source, so this is a copy. Keep the layout, template
 * resolution and watermark logic in step with that file — it is what makes a patient's page
 * look like the print preview staff see. Re-sync by diffing against the commit above.
 *
 * Deliberately NOT copied: the page chrome around it (back button, keyboard shortcut badges,
 * page title bar, auto-print). Those are staff affordances with nothing to do with the
 * printed output, and none of them make sense on a patient's page.
 */
import { ReactNode } from "react";

import type {
  DocumentFacility,
  LogoConfig,
  PrintTemplate,
  WatermarkConfig,
} from "@/lib/types/documents";
import { cn } from "@/lib/utils";

const TILE_W = 220;
const TILE_H = 100;

/** Exact template first, then the facility's "default", then nothing. */
export function resolvePrintTemplate(
  facility: DocumentFacility | undefined,
  templateSlug?: string,
): PrintTemplate | undefined {
  const templates = facility?.print_templates;
  if (!templates?.length) return undefined;

  const match = templateSlug
    ? templates.find((t) => t.slug === templateSlug)
    : undefined;

  return match ?? templates.find((t) => t.slug === "default");
}

function buildPageStyle(template?: PrintTemplate): string | null {
  const page = template?.page;
  if (!page) return null;

  const parts: string[] = [];

  if (page.size || page.orientation) {
    const sizeParts = [page.size, page.orientation].filter(Boolean).join(" ");
    parts.push(`size: ${sizeParts}`);
  }

  if (page.margin) {
    const { top, right, bottom, left } = page.margin;
    parts.push(`margin: ${top}mm ${right}mm ${bottom}mm ${left}mm`);
  }

  if (parts.length === 0) return null;

  return `@media print { @page { ${parts.join("; ")}; } }`;
}

function buildWatermarkSvg(text: string, rotation: number): string {
  const encoded = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE_W}' height='${TILE_H}'><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' transform='rotate(${rotation} ${TILE_W / 2} ${TILE_H / 2})' font-size='12' font-weight='600' font-family='sans-serif' letter-spacing='2' fill='currentColor'>${encoded}</text></svg>`;
}

function TiledWatermark({ watermark }: { watermark: WatermarkConfig }) {
  const opacity = watermark.opacity ?? 0.08;
  const rotation = watermark.rotation ?? -30;
  const svg = buildWatermarkSvg(watermark.text!, rotation);
  const dataUri = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 select-none text-gray-900"
      aria-hidden="true"
      style={{
        backgroundImage: dataUri,
        backgroundRepeat: "repeat",
        backgroundSize: `${TILE_W}px ${TILE_H}px`,
        opacity,
      }}
    />
  );
}

function FacilityInfo({ facility }: { facility: DocumentFacility }) {
  return (
    <div className="text-left">
      <h1 className="text-2xl font-semibold">{facility.name}</h1>
      <div className="wrap-break-word text-xs whitespace-pre-wrap text-gray-500">
        {facility.address}
        <p className="text-xs text-gray-500">{facility.phone_number}</p>
      </div>
    </div>
  );
}

/** care_fe's configured mainLogo, which the host publishes on window.__CORE_ENV__. */
function coreLogoUrl(): string | undefined {
  const mainLogo = window.__CORE_ENV__?.mainLogo as
    | { dark?: string; light?: string }
    | undefined;
  return mainLogo?.dark ?? mainLogo?.light;
}

function FacilityLogo({ logo }: { logo?: LogoConfig }) {
  const logoUrl = logo?.url || undefined;
  // Same fallback as care_fe: a facility with no mark of its own still shows the CARE
  // logo, so the header is never logo-less. Reading it from the host's config rather
  // than hardcoding a path keeps a REACT_MAIN_LOGO override working.
  const src = logoUrl ?? coreLogoUrl();
  if (!src) return null;

  const hasCustomDims = !!(logoUrl && (logo?.width || logo?.height));

  return (
    <img
      src={src}
      alt={logoUrl ? "Facility brand mark" : "Care Logo"}
      className={cn(
        "mb-2 object-contain sm:mb-0",
        !hasCustomDims && "h-10 w-auto",
      )}
      style={
        logoUrl
          ? {
              ...(logo?.width ? { width: `${logo.width}px` } : {}),
              ...(logo?.height ? { height: `${logo.height}px` } : {}),
            }
          : undefined
      }
    />
  );
}

/**
 * Wraps a document in its facility's letterhead, watermark and page setup.
 *
 * `id="section-to-print"` is load bearing: care_fe's global print stylesheet hides
 * everything else on the page when printing, so the browser's print output is this
 * subtree alone. That stylesheet belongs to the host, not to this plug.
 */
export default function PrintLayout({
  facility,
  templateSlug,
  children,
}: {
  facility?: DocumentFacility;
  templateSlug?: string;
  children: ReactNode;
}) {
  const printTemplate = resolvePrintTemplate(facility, templateSlug);
  const headerImage = printTemplate?.branding?.header_image;
  const footerImage = printTemplate?.branding?.footer_image;
  const logo = printTemplate?.branding?.logo;
  const watermark = printTemplate?.watermark;
  const pageStyle = buildPageStyle(printTemplate);
  const alignment = logo?.url ? (logo?.alignment ?? "right") : "right";

  return (
    <div
      id="section-to-print"
      className="relative w-full overflow-clip bg-white p-6 text-sm sm:p-10"
    >
      {pageStyle && <style>{pageStyle}</style>}
      {watermark?.enabled && watermark.text && (
        <TiledWatermark watermark={watermark} />
      )}

      {facility &&
        (headerImage?.url ? (
          <div className="mb-2 flex items-start justify-between pb-2">
            <img
              src={headerImage.url}
              alt="Custom Header"
              className="h-auto max-w-3xl flex-1 object-contain"
              style={
                headerImage.height
                  ? { maxHeight: `${headerImage.height}px` }
                  : undefined
              }
            />
          </div>
        ) : alignment === "center" ? (
          <div className="mb-3 flex flex-col items-center gap-2 border-b border-gray-200 pb-2">
            <FacilityLogo logo={logo} />
            <div className="w-full">
              <FacilityInfo facility={facility} />
            </div>
          </div>
        ) : (
          <div className="mb-3 flex items-start justify-between border-b border-gray-200 pb-2">
            {alignment === "left" ? (
              <>
                <FacilityLogo logo={logo} />
                <FacilityInfo facility={facility} />
              </>
            ) : (
              <>
                <FacilityInfo facility={facility} />
                <FacilityLogo logo={logo} />
              </>
            )}
          </div>
        ))}

      <div className="flex-1">{children}</div>

      {footerImage?.url && (
        <div className="mt-auto pt-2">
          <img
            src={footerImage.url}
            alt="Footer"
            className="h-auto w-full object-contain"
            style={
              footerImage.height
                ? { maxHeight: `${footerImage.height}px` }
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
