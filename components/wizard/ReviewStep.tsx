"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileType, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageFitIndicator } from "@/components/resume/PageFitIndicator";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import { downloadResumeExport } from "@/lib/clientExport";
import { tailorResumeClient } from "@/lib/clientResume";
import { estimatePageFit, fitResumeToOnePage } from "@/lib/pageFit";
import type { JobPosting, ResumeData } from "@/types/resume";

const ResumePdfPreview = dynamic(
  () => import("@/components/resume/ResumePdfPreview").then((m) => m.ResumePdfPreview),
  { ssr: false, loading: () => <PreviewSkeleton /> }
);

function PreviewSkeleton({ label = "Loading preview…" }: { label?: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function ReviewStep({
  resume,
  sourceResume,
  jobPosting,
  onChange,
  onBack,
  onStartOver,
}: {
  resume: ResumeData;
  sourceResume: ResumeData;
  jobPosting: JobPosting;
  onChange: (next: ResumeData) => void;
  onBack: () => void;
  onStartOver: () => void;
}) {
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the draft on one page even if the user pastes a lot into the editor.
  useEffect(() => {
    if (regenerating) return;
    if (estimatePageFit(resume).fitsOnePage) return;
    const fitted = fitResumeToOnePage(resume);
    if (JSON.stringify(fitted) !== JSON.stringify(resume)) {
      onChange(fitted);
    }
  }, [resume, onChange, regenerating]);

  const handleGenerateNew = async () => {
    if (!jobPosting.rawText.trim()) {
      onBack();
      return;
    }
    setRegenerating(true);
    setError(null);
    try {
      const next = await tailorResumeClient(sourceResume, jobPosting, {
        regenerate: true,
        previousResume: resume,
      });
      onChange(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate a new resume.");
    } finally {
      setRegenerating(false);
    }
  };

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
          <Button variant="outline" onClick={onBack} disabled={regenerating}>
            Back
          </Button>
          <Button variant="outline" onClick={onStartOver} disabled={regenerating}>
            Start over
          </Button>
          <Button variant="outline" onClick={handleGenerateNew} disabled={regenerating}>
            {regenerating ? <Loader2 className="size-4 animate-spin" /> : null}
            Generate new resume
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Live preview</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleExport("docx")}
              disabled={exporting !== null || regenerating}
            >
              {exporting === "docx" ? <Loader2 className="size-4 animate-spin" /> : <FileType className="size-4" />}
              Download DOCX
            </Button>
            <Button onClick={() => handleExport("pdf")} disabled={exporting !== null || regenerating}>
              {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Download PDF
            </Button>
          </div>
        </div>
        <div className="w-full overflow-hidden rounded-md border bg-white aspect-[8.5/11]">
          {regenerating ? (
            <PreviewSkeleton label="Generating a new resume…" />
          ) : (
            <ResumePdfPreview resume={resume} />
          )}
        </div>
      </div>
    </div>
  );
}
