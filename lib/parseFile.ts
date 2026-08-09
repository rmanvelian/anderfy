import { extractText, getDocumentProxy } from "unpdf";

export class UnsupportedFileTypeError extends Error {}

/**
 * Extracts raw text from an uploaded resume file. Supports PDF and DOCX; any
 * other type (e.g. .txt, .md) is treated as plain text.
 */
export async function extractTextFromFile(
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<string> {
  const lowerName = fileName.toLowerCase();

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  }

  if (lowerName.endsWith(".doc")) {
    throw new UnsupportedFileTypeError(
      "Legacy .doc files aren't supported. Please save/export as .docx or .pdf, or paste the resume text instead."
    );
  }

  // Fall back to treating the upload as plain text (covers .txt, .md, etc.)
  return Buffer.from(buffer).toString("utf-8");
}
