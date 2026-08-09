"use client";

import { CheckCircle2 } from "lucide-react";

/**
 * One-page length is enforced by `fitResumeToOnePage` on parse/tailor/export
 * and while editing. This never shows an overflow warning.
 */
export function PageFitIndicator() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
      <CheckCircle2 className="size-3.5" />
      Fits on one page
    </div>
  );
}
