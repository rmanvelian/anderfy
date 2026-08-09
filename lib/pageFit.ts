import { ADDITIONAL_TRIM_ORDER } from "@/lib/additionalSection";
import { trimOneBalancedExperienceBullet } from "@/lib/experienceBullets";
import type { ResumeData, SkillsAndInterests } from "@/types/resume";

// Rough heuristic (not a real PDF layout pass) for the one-page Anderson
// target. Tuned against AndersonResumeDocument's 11pt body text, 0.5in
// margins, and one-blank-line spacing between entries/sections.
export const CHARS_PER_BULLET_LINE = 88;
// Leave a small cushion so borderline content doesn't spill past one page
// in the real PDF/DOCX layout even if the line estimate is slightly optimistic.
const AVAILABLE_LINES_ONE_PAGE = 40;

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

function cloneResume(resume: ResumeData): ResumeData {
  return {
    contact: { ...resume.contact },
    education: resume.education.map((e) => ({ ...e, bullets: [...(e.bullets ?? [])] })),
    experience: resume.experience.map((e) => ({ ...e, bullets: [...e.bullets] })),
    skillsAndInterests: {
      certifications: [...(resume.skillsAndInterests.certifications ?? [])],
      languages: [...(resume.skillsAndInterests.languages ?? [])],
      software: [...(resume.skillsAndInterests.software ?? [])],
      volunteer: [...(resume.skillsAndInterests.volunteer ?? [])],
      interests: [...(resume.skillsAndInterests.interests ?? [])],
    },
  };
}

/**
 * Shorten Additional lists without removing a category row. Keeps ≥1 item in
 * each non-empty category so the Additional section stays visible.
 */
function trimAdditionalExtras(skills: SkillsAndInterests): boolean {
  for (const key of ADDITIONAL_TRIM_ORDER) {
    const list = skills[key];
    if (list && list.length > 1) {
      list.pop();
      return true;
    }
  }
  return false;
}

function trimOneEducationBullet(resume: ResumeData): boolean {
  for (let i = resume.education.length - 1; i >= 0; i--) {
    const bullets = resume.education[i].bullets ?? [];
    if (bullets.length > 0) {
      bullets.pop();
      resume.education[i].bullets = bullets;
      return true;
    }
  }
  return false;
}

/**
 * Trim bullets / Additional extras until the resume is estimated to fit on one
 * page. Never empties an experience entry, never removes the last item from an
 * Additional category (so software/certs/languages/interests rows survive), and
 * trims experience in a balanced way (max−min bullet counts stay within 1).
 */
export function fitResumeToOnePage(resume: ResumeData): ResumeData {
  const next = cloneResume(resume);
  let guard = 200;

  while (!estimatePageFit(next).fitsOnePage && guard-- > 0) {
    // Shorten Additional lists first, but keep every category row that exists.
    if (trimAdditionalExtras(next.skillsAndInterests)) continue;

    if (trimOneEducationBullet(next)) continue;

    if (trimOneBalancedExperienceBullet(next.experience)) continue;

    // Stop rather than wiping Additional or emptying experience roles. A slight
    // heuristic overflow is preferable to dropping the Additional section.
    break;
  }

  return next;
}
