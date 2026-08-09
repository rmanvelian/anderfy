import type { ResumeData } from "@/types/resume";

// Rough heuristic (not a real PDF layout pass) to warn users when their
// content is likely to spill past the one-page target used by the Anderson
// format. Tuned against AndersonResumeDocument's 11pt body text, 0.5in
// margins, and one-blank-line spacing between entries/sections.
const CHARS_PER_BULLET_LINE = 88;
const AVAILABLE_LINES_ONE_PAGE = 42;

function bulletLines(bullets?: string[]): number {
  if (!bullets) return 0;
  return bullets
    .filter((b) => b && b.trim())
    .reduce((sum, b) => sum + Math.max(1, Math.ceil(b.length / CHARS_PER_BULLET_LINE)), 0);
}

export function estimateResumeLines(resume: ResumeData): number {
  let lines = 2; // name + contact

  if (resume.education.length > 0) {
    lines += 2; // section heading + gap
    for (const ed of resume.education) {
      lines += 2 + bulletLines(ed.bullets) + 1; // header rows + bullets + inter-entry gap
    }
  }

  if (resume.experience.length > 0) {
    lines += 2;
    for (const ex of resume.experience) {
      lines += 2 + bulletLines(ex.bullets) + 1;
    }
  }

  const s = resume.skillsAndInterests;
  const additionalRows = [s?.certifications, s?.languages, s?.software, s?.volunteer, s?.interests].filter(
    (arr) => arr && arr.length > 0
  ).length;
  if (additionalRows > 0) {
    lines += 2 + additionalRows;
  }

  return lines;
}

export interface PageFitEstimate {
  estimatedLines: number;
  availableLines: number;
  fitsOnePage: boolean;
  overflowRatio: number;
}

export function estimatePageFit(resume: ResumeData): PageFitEstimate {
  const estimatedLines = estimateResumeLines(resume);
  return {
    estimatedLines,
    availableLines: AVAILABLE_LINES_ONE_PAGE,
    fitsOnePage: estimatedLines <= AVAILABLE_LINES_ONE_PAGE,
    overflowRatio: estimatedLines / AVAILABLE_LINES_ONE_PAGE,
  };
}
