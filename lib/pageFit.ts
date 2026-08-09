import { ADDITIONAL_TRIM_ORDER } from "@/lib/additionalSection";
import { trimOneBalancedExperienceBullet } from "@/lib/experienceBullets";
import type { ResumeData, SkillsAndInterests } from "@/types/resume";

// Rough heuristic (not a real PDF layout pass) for the one-page Anderson
// target. Tuned against AndersonResumeDocument: Letter, 0.5in margins (~720pt
// usable height), 11pt Times at lineHeight 1.2 (~13.2pt/line) ⇒ ~54 lines.
export const CHARS_PER_BULLET_LINE = 95;
// Small cushion under the physical ~54-line capacity so we fill the page
// without routinely over-trimming into large bottom whitespace.
const AVAILABLE_LINES_ONE_PAGE = 52;

const ADDITIONAL_LABELS: Record<(typeof ADDITIONAL_TRIM_ORDER)[number], string> = {
  certifications: "Certifications",
  languages: "Languages",
  software: "Software",
  volunteer: "Volunteer",
  interests: "Interests",
};

function bulletLines(bullets?: string[]): number {
  if (!bullets) return 0;
  return bullets
    .filter((b) => b && b.trim())
    .reduce((sum, b) => sum + Math.max(1, Math.ceil(b.length / CHARS_PER_BULLET_LINE)), 0);
}

function additionalContentLines(skills: SkillsAndInterests | undefined): number {
  if (!skills) return 0;
  let rows = 0;
  let lines = 0;
  for (const key of ADDITIONAL_TRIM_ORDER) {
    const values = (skills[key] ?? []).map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) continue;
    rows += 1;
    const text = `${ADDITIONAL_LABELS[key]}: ${values.join(", ")}`;
    lines += Math.max(1, Math.ceil(text.length / CHARS_PER_BULLET_LINE));
  }
  if (rows === 0) return 0;
  return 2 + lines; // section heading + gap + rows
}

export function estimateResumeLines(resume: ResumeData): number {
  let lines = 2; // name + contact

  if (resume.education.length > 0) {
    lines += 2; // section heading + gap
    resume.education.forEach((ed, index) => {
      lines += 2 + bulletLines(ed.bullets);
      // Inter-entry gap only between entries (not after the last).
      if (index < resume.education.length - 1) lines += 1;
    });
  }

  if (resume.experience.length > 0) {
    lines += 2;
    resume.experience.forEach((ex, index) => {
      lines += 2 + bulletLines(ex.bullets);
      if (index < resume.experience.length - 1) lines += 1;
    });
  }

  lines += additionalContentLines(resume.skillsAndInterests);

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
 * Shorten Additional lists without removing a category row. Only useful when
 * the estimate counts wrapped Additional content (trimming items frees lines).
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
  // Never remove required Anderson Honors/Leadership/Membership rows. Only trim
  // other education bullets (e.g. extra freeform lines); GPA is secondary.
  for (let i = resume.education.length - 1; i >= 0; i--) {
    const bullets = resume.education[i].bullets ?? [];
    const removableIdx = [...bullets]
      .map((b, idx) => ({ b, idx }))
      .reverse()
      .find(({ b }) => !/^(Honors?|Leadership|Membership)\s*:/i.test(b.trim()));
    if (removableIdx) {
      bullets.splice(removableIdx.idx, 1);
      resume.education[i].bullets = bullets;
      return true;
    }
  }
  return false;
}

/**
 * Trim until the resume is estimated to fit on one page. Prefer trimming
 * experience extras first so education Honors/Leadership/Membership and full
 * Additional lists are kept whenever the page still has room.
 */
export function fitResumeToOnePage(resume: ResumeData): ResumeData {
  const next = cloneResume(resume);
  let guard = 200;

  while (!estimatePageFit(next).fitsOnePage && guard-- > 0) {
    // 1) Experience extras (balanced, never empty a role)
    if (trimOneBalancedExperienceBullet(next.experience)) continue;

    // 2) Education extras (never empty a school that still has bullets)
    if (trimOneEducationBullet(next)) continue;

    // 3) Additional extras last — only when wrapped rows are still over budget
    if (trimAdditionalExtras(next.skillsAndInterests)) continue;

    break;
  }

  return next;
}
