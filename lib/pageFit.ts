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

/** Drop the last item from the first non-empty Additional list (least critical). */
function trimAdditional(skills: SkillsAndInterests): boolean {
  const keys: (keyof SkillsAndInterests)[] = [
    "interests",
    "volunteer",
    "software",
    "languages",
    "certifications",
  ];
  for (const key of keys) {
    const list = skills[key];
    if (list && list.length > 0) {
      list.pop();
      return true;
    }
  }
  return false;
}

/**
 * Trim bullets / Additional items until the resume is estimated to fit on one
 * page. Never empties an experience entry that still has bullets, and trims
 * experience in a balanced way (max−min bullet counts stay within 1).
 */
export function fitResumeToOnePage(resume: ResumeData): ResumeData {
  const next = cloneResume(resume);
  let guard = 200;

  while (!estimatePageFit(next).fitsOnePage && guard-- > 0) {
    // Soft content first — don't strip experience roles bare.
    if (trimAdditional(next.skillsAndInterests)) continue;

    let trimmedEducation = false;
    for (let i = next.education.length - 1; i >= 0; i--) {
      const bullets = next.education[i].bullets ?? [];
      if (bullets.length > 0) {
        bullets.pop();
        next.education[i].bullets = bullets;
        trimmedEducation = true;
        break;
      }
    }
    if (trimmedEducation) continue;

    if (trimOneBalancedExperienceBullet(next.experience)) continue;

    // Nothing safe left to remove.
    break;
  }

  return next;
}
