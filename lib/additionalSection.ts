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
 * Reorder `source` items using `proposed` order, then append any source items
 * the proposal omitted — never drop Additional content the candidate provided.
 */
export function reorderKeepAllAdditional(
  source: string[] | undefined,
  proposed: string[] | undefined
): string[] {
  const originalList = nonEmpty(source);
  if (originalList.length === 0) return [];
  if (!proposed || proposed.length === 0) return originalList;

  const originalByLower = new Map(originalList.map((v) => [v.toLowerCase(), v]));
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const value of proposed) {
    const lower = value.trim().toLowerCase();
    const match = originalByLower.get(lower);
    if (match && !used.has(lower)) {
      ordered.push(match);
      used.add(lower);
    }
  }
  for (const value of originalList) {
    const lower = value.toLowerCase();
    if (!used.has(lower)) ordered.push(value);
  }
  return ordered;
}

/**
 * Union Additional items from source and tailored so the section cannot
 * disappear when either side still has content. Preserves tailored order first,
 * then appends any missing source items.
 */
export function restoreAdditionalFromSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  if (
    !hasAnyAdditional(source.skillsAndInterests) &&
    !hasAnyAdditional(tailored.skillsAndInterests)
  ) {
    return tailored;
  }

  const next: SkillsAndInterests = { ...tailored.skillsAndInterests };
  let changed = false;

  for (const key of ADDITIONAL_KEYS) {
    // Prefer keeping everything from both sides (source is the floor).
    const unionFloor = [
      ...nonEmpty(source.skillsAndInterests[key]),
      ...nonEmpty(next[key]),
    ];
    const restored = reorderKeepAllAdditional(unionFloor, [
      ...nonEmpty(next[key]),
      ...nonEmpty(source.skillsAndInterests[key]),
    ]);
    const current = nonEmpty(next[key]);
    if (JSON.stringify(restored) !== JSON.stringify(current)) {
      next[key] = restored;
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
    if (nonEmpty(tailored.skillsAndInterests[key]).length < sourceValues.length) return false;
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
