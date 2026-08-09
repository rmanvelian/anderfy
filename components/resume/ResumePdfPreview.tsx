"use client";

import { useEffect, useState } from "react";
import { PDFViewer } from "@react-pdf/renderer";
import { AndersonResumeDocument } from "@/components/resume/AndersonResumeDocument";
import type { ResumeData } from "@/types/resume";

/**
 * Live PDF preview. Debounces re-renders slightly so typing in the editor
 * doesn't regenerate the PDF blob on every keystroke.
 */
export function ResumePdfPreview({ resume }: { resume: ResumeData }) {
  const [debounced, setDebounced] = useState(resume);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(resume), 350);
    return () => clearTimeout(timeout);
  }, [resume]);

  return (
    <PDFViewer showToolbar={false} className="h-full w-full rounded-md border">
      <AndersonResumeDocument resume={debounced} />
    </PDFViewer>
  );
}
