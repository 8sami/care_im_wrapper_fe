import { pdfjs } from "react-pdf";

// VENDORED from care_fe `src/lib/pdfWorker.ts`.
//
// Configures the pdf.js worker for react-pdf. Import this module once in any component
// that renders react-pdf's <Document>/<Page>.
//
// `import.meta.url` resolves against this plug's own asset origin, not care_fe's, so the
// worker is fetched from wherever the plug is served. That origin already sends
// permissive CORS headers (see the preview block in vite.config.mts), which is what makes
// a cross-origin worker load possible at all.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();
