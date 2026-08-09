import type { ResumeData, SkillsAndInterests } from "@/types/resume";

export const ADDITIONAL_KEYS = [
  "certifications",
  "languages",
  "software",
  "volunteer",
  "interests",
] as const;

type AdditionalKey = (typeof ADDITIONAL_KEYS)[number];

function nonEmpty(values: string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim()).filter(Boolean);
}

function hasAnyAdditional(skills: SkillsAndInterests | undefined): boolean {
  if (!skills) return false;
  return ADDITIONAL_KEYS.some((key) => nonEmpty(skills[key]).length > 0);
}

/**
 * If tailor/page-fit wiped Additional categories that existed in the source
 * resume, restore those source lists so the Anderson Additional section remains.
 */
export function restoreAdditionalFromSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  if (!hasAnyAdditional(source.skillsAndInterests)) return tailored;

  const next: SkillsAndInterests = { ...tailored.skillsAndInterests };
  let changed = false;

  for (const key of ADDITIONAL_KEYS) {
    const sourceValues = nonEmpty(source.skillsAndInterests[key]);
    const currentValues = nonEmpty(next[key]);
    if (sourceValues.length > 0 && currentValues.length === 0) {
      next[key] = [...sourceValues];
      changed = true;
    } else if (currentValues.length !== (next[key] ?? []).length) {
      next[key] = currentValues;
      changed = true;
    }
  }

  return changed ? { ...tailored, skillsAndInterests: next } : tailored;
}

/** True when every source Additional category that had items still has ≥1. */
export function additionalPreservedFromSource(
  tailored: ResumeData,
  source: ResumeData
): boolean {
  for (const key of ADDITIONAL_KEYS) {
    const sourceValues = nonEmpty(source.skillsAndInterests[key]);
    if (sourceValues.length === 0) continue;
    if (nonEmpty(tailored.skillsAndInterests[key]).length === 0) return false;
  }
  return true;
}

export function countAdditionalItems(skills: SkillsAndInterests | undefined): number {
  if (!skills) return 0;
  return ADDITIONAL_KEYS.reduce((sum, key) => sum + nonEmpty(skills[key]).length, 0);
}

/** Softest → hardest when shortening Additional lists during page-fit. */
export const ADDITIONAL_TRIM_ORDER: AdditionalKey[] = [
  "interests",
  "volunteer",
  "software",
  "languages",
  "certifications",
];
