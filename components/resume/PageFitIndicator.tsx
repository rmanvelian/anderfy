"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { estimatePageFit } from "@/lib/pageFit";
import type { ResumeData } from "@/types/resume";

export function PageFitIndicator({ resume }: { resume: ResumeData }) {
  const fit = estimatePageFit(resume);

  if (fit.fitsOnePage) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
        <CheckCircle2 className="size-3.5" />
        Fits on one page (estimated)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
      <AlertTriangle className="size-3.5" />
      Likely runs past one page — trim a bullet or two
    </div>
  );
}
