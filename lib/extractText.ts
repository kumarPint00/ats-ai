/**
 * extractText — universal document-to-text extractor.
 *
 * Supported formats:
 *   .pdf              — pdf-parse
 *   .docx             — mammoth
 *   .doc              — mammoth (best-effort; binary .doc support is limited)
 *   .odt / .ods /
 *   .odp / .pptx /
 *   .xlsx             — officeparser
 *   .txt / .md /
 *   .csv / .rtf /
 *   everything else   — raw UTF-8 text
 */

import pdfParse from "pdf-parse";
import mammoth from "mammoth";
// @ts-ignore — officeparser ships no typedefs
import officeParser from "officeparser";
import path from "path";

/**
 * Extract plain text from a file buffer.
 *
 * @param buf       - raw file bytes
 * @param filename  - original filename (used to detect format by extension)
 * @returns         trimmed plain text, or "" if nothing could be extracted
 */
export async function extractText(buf: Buffer, filename: string): Promise<string> {
  const ext = path.extname(filename).toLowerCase();

  switch (ext) {
    // ── PDF ──────────────────────────────────────────────────────────────────
    case ".pdf": {
      const result = await pdfParse(buf);
      return result.text.trim();
    }

    // ── Word / Open XML ──────────────────────────────────────────────────────
    case ".docx":
    case ".doc": {
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value.trim();
    }

    // ── OpenDocument & Office Open XML (non-Word) ─────────────────────────────
    case ".odt":
    case ".ods":
    case ".odp":
    case ".pptx":
    case ".xlsx": {
      // parseOffice is itself async — returns a Promise when no callback given.
      // It auto-detects the format from the buffer magic bytes.
      // The TS typedef says OfficeParserAST but the runtime value is a plain string.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (await officeParser.parseOffice(buf, { outputErrorToConsole: false })) as any;
      return (String(text ?? "")).trim();
    }

    // ── Plain text fallback (txt, md, csv, rtf, …) ───────────────────────────
    default:
      return buf.toString("utf-8").trim();
  }
}

/**
 * Human-readable list of accepted extensions — used in UI labels and
 * the <input accept="…"> attribute.
 *
 * Re-exported from lib/fileTypes.ts (browser-safe) — do not duplicate here.
 */
export { ACCEPTED_EXTENSIONS, ACCEPTED_LABEL } from "./fileTypes";
