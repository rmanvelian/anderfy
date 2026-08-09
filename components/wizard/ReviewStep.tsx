"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileType, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageFitIndicator } from "@/components/resume/PageFitIndicator";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { downloadResumeExport } from "@/lib/clientExport";
import { estimatePageFit, fitResumeToOnePage } from "@/lib/pageFit";
import type { JobPosting, ResumeData } from "@/types/resume";

const ResumePdfPreview = dynamic(
  () => import("@/components/resume/ResumePdfPreview").then((m) => m.ResumePdfPreview),
  { ssr: false, loading: () => <PreviewSkeleton /> }
);

function PreviewSkeleton() {
  return (
    <div className="flex aspect-[8.5/11] w-full items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
      Loading preview…
    </div>
  );
}

export function ReviewStep({
  resume,
  jobPosting,
  onChange,
  onRetailor,
  onStartOver,
}: {
  resume: ResumeData;
  jobPosting: JobPosting;
  onChange: (next: ResumeData) => void;
  onRetailor: () => void;
  onStartOver: () => void;
}) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the draft on one page even if the user pastes a lot into the editor.
  useEffect(() => {
    if (estimatePageFit(resume).fitsOnePage) return;
    const fitted = fitResumeToOnePage(resume);
    if (JSON.stringify(fitted) !== JSON.stringify(resume)) {
      onChange(fitted);
    }
  }, [resume, onChange]);

  const handleExport = async (kind: "pdf" | "docx") => {
    setExporting(kind);
    setError(null);
    try {
      await downloadResumeExport(kind, fitResumeToOnePage(resume));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="eyebrow">Step 3</span>
                <h2 className="mt-1 text-lg font-semibold">Review &amp; edit</h2>
                <p className="text-sm text-muted-foreground">
                  Everything here is editable — AI output is a draft, not the final word.
                </p>
              </div>
              <PageFitIndicator />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Something went wrong</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <ResumeEditor resume={resume} onChange={onChange} />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={onStartOver}>
            Start over
          </Button>
          <Button variant="outline" onClick={onRetailor}>
            <Sparkles className="size-4" />
            {jobPosting.rawText.trim() ? "Re-tailor to job posting" : "Tailor to a job posting"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Live preview</h2>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleExport("docx")} disabled={exporting !== null}>
              {exporting === "docx" ? <Loader2 className="size-4 animate-spin" /> : <FileType className="size-4" />}
              Download DOCX
            </Button>
            <Button onClick={() => handleExport("pdf")} disabled={exporting !== null}>
              {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PDF
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-md border bg-white aspect-[8.5/11]">
          <ResumePdfPreview resume={resume} />
        </div>
      </div>
    </div>
  );
}
