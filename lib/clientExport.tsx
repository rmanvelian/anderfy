"use client";

import { pdf } from "@react-pdf/renderer";
import { AndersonResumeDocument } from "@/components/resume/AndersonResumeDocument";
import { withBasePath } from "@/lib/apiBase";
import { buildResumeDocxBlob } from "@/lib/docx-export";
import { filenameForResume } from "@/lib/filename";
import type { ResumeData } from "@/types/resume";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Download PDF/DOCX via the Node API when available; otherwise generate the
 * file entirely in the browser (required for GitHub Pages static hosting).
 */
export async function downloadResumeExport(
  kind: "pdf" | "docx",
  resume: ResumeData
): Promise<void> {
  try {
    const res = await fetch(withBasePath(`/api/export/${kind}`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resume }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || filenameForResume(resume, kind);
      triggerDownload(blob, filename);
      return;
    }
    if (res.status !== 404 && res.status !== 405) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error || `Failed to export ${kind.toUpperCase()}.`);
    }
  } catch (error) {
    if (error instanceof Error && !isNetworkOrMissingApi(error)) throw error;
  }

  if (kind === "pdf") {
    const blob = await pdf(<AndersonResumeDocument resume={resume} />).toBlob();
    triggerDownload(blob, filenameForResume(resume, "pdf"));
    return;
  }

  const blob = await buildResumeDocxBlob(resume);
  triggerDownload(blob, filenameForResume(resume, "docx"));
}

function isNetworkOrMissingApi(error: Error): boolean {
  return (
    error.name === "TypeError" ||
    /Failed to fetch|NetworkError|Load failed|fetch/i.test(error.message)
  );
}
