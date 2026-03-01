/**
 * fileTypes.ts — browser-safe constants shared between the UI and the server.
 *
 * ⚠️  Keep this file free of Node.js-only imports (no fs, pdf-parse, etc.)
 *     so it can be safely imported by Client Components in page.tsx.
 */

/** Value for <input accept="…"> — all document formats the API can parse. */
export const ACCEPTED_EXTENSIONS =
  ".pdf,.doc,.docx,.odt,.odp,.ods,.pptx,.xlsx,.txt,.md,.csv,.rtf";

/** Friendly label shown in the upload button / tooltip. */
export const ACCEPTED_LABEL = "PDF, Word, ODT, PPTX, XLSX, TXT…";
