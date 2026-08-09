import { extractText, getDocumentProxy } from "unpdf";

export class UnsupportedFileTypeError extends Error {}

/**
 * Extracts raw text from an uploaded resume file. Supports PDF and DOCX; any
 * other type (e.g. .txt, .md) is treated as plain text.
 *
 * Browser-safe (no Node `Buffer`) so the same helper works for GitHub Pages
 * static export and for the Node API routes.
 */
export async function extractTextFromFile(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();
  const bytes = new Uint8Array(buffer);

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return result.value;
  }

  if (lowerName.endsWith(".doc")) {
    throw new UnsupportedFileTypeError(
      "Legacy .doc files aren't supported. Please save/export as .docx or .pdf, or paste the resume text instead."
    );
  }

  // Fall back to treating the upload as plain text (covers .txt, .md, etc.)
  return new TextDecoder("utf-8").decode(bytes);
}
