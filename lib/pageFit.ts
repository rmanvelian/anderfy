import type { ResumeData } from "@/types/resume";

// Rough heuristic (not a real PDF layout pass) to warn users when their
// content is likely to spill past the one-page target used by the Anderson
// format. Tuned against the AndersonResumeDocument's font sizes/margins.
const CHARS_PER_BULLET_LINE = 100;
const AVAILABLE_LINES_ONE_PAGE = 46;

function bulletLines(bullets?: string[]): number {
  if (!bullets) return 0;
  return bullets
    .filter((b) => b && b.trim())
    .reduce((sum, b) => sum + Math.max(1, Math.ceil(b.length / CHARS_PER_BULLET_LINE)), 0);
}

export function estimateResumeLines(resume: ResumeData): number {
  let lines = 3; // name + contact + rule

  if (resume.education.length > 0) {
    lines += 2; // section heading
    for (const ed of resume.education) {
      lines += 2 + bulletLines(ed.bullets);
    }
  }

  if (resume.experience.length > 0) {
    lines += 2;
    for (const ex of resume.experience) {
      lines += 2 + bulletLines(ex.bullets);
    }
  }

  const leadership = resume.leadership.filter((l) => l.org || l.role);
  if (leadership.length > 0) {
    lines += 2;
    for (const l of leadership) {
      lines += 2 + bulletLines(l.bullets);
    }
  }

  const s = resume.skillsAndInterests;
  const additionalRows = [s?.skills, s?.languages, s?.interests].filter(
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
