"use client";

import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { AndersonResumeDocument } from "@/components/resume/AndersonResumeDocument";
import { PREVIEW_LETTERBOX_BG } from "@/lib/previewTheme";
import type { ResumeData } from "@/types/resume";

/**
 * Live PDF preview. Debounces re-renders, then mounts the PDF in an iframe
 * with page-fit so the letter page is centered in the frame (even top/bottom
 * bars) instead of stuck to the top like PDFViewer tends to do.
 */
export function ResumePdfPreview({ resume }: { resume: ResumeData }) {
  const [debounced, setDebounced] = useState(resume);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(resume), 350);
    return () => clearTimeout(timeout);
  }, [resume]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      const blob = await pdf(<AndersonResumeDocument resume={debounced} />).toBlob();
      if (cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
    })().catch(() => {
      if (!cancelled) setUrl(null);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [debounced]);

  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: PREVIEW_LETTERBOX_BG }}
    >
      {url ? (
        <iframe
          title="Resume preview"
          // view=Fit centers the page in the viewer; toolbar/navpanes off for a clean frame.
          src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=Fit`}
          className="h-full w-full border-0"
          style={{ backgroundColor: PREVIEW_LETTERBOX_BG }}
        />
      ) : (
        <span className="text-sm text-white/70">Loading preview…</span>
      )}
    </div>
  );
}
