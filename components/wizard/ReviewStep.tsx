"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Download, FileType, Loader2, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageFitIndicator } from "@/components/resume/PageFitIndicator";
import { ResumeEditor } from "@/components/resume/ResumeEditor";
import type { JobPosting, ResumeData } from "@/types/resume";

const ResumePdfPreview = dynamic(
  () => import("@/components/resume/ResumePdfPreview").then((m) => m.ResumePdfPreview),
  { ssr: false, loading: () => <PreviewSkeleton /> }
);

function PreviewSkeleton() {
  return (
    <div className="flex h-full min-h-[600px] w-full items-center justify-center rounded-md border bg-muted/30 text-sm text-muted-foreground">
      Loading preview…
    </div>
  );
}

async function downloadExport(kind: "pdf" | "docx", resume: ResumeData) {
  const res = await fetch(`/api/export/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resume }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Failed to export ${kind.toUpperCase()}.`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] || `resume.${kind}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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

  const handleExport = async (kind: "pdf" | "docx") => {
    setExporting(kind);
    setError(null);
    try {
      await downloadExport(kind, resume);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
              <PageFitIndicator resume={resume} />
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
        <div className="flex items-center justify-between gap-2">
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
        <div className="min-h-[720px] flex-1">
          <ResumePdfPreview resume={resume} />
        </div>
      </div>
    </div>
  );
}
