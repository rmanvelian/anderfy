import { sanitizeAndersonFieldList } from "@/lib/sanitizeAndersonValue";
import { isNoneSpecifiedInUpload, NONE_SPECIFIED_IN_UPLOAD } from "@/lib/uploadNone";
import type { ResumeData, SkillsAndInterests } from "@/types/resume";

export const ADDITIONAL_KEYS = [
  "certifications",
  "languages",
  "software",
  "volunteer",
  "interests",
] as const;

export const ADDITIONAL_LABELS: Record<(typeof ADDITIONAL_KEYS)[number], string> = {
  certifications: "Certifications",
  languages: "Languages",
  software: "Software",
  volunteer: "Volunteer",
  interests: "Interests",
};

/** Shown when the upload has no items for an Additional category. */
export const ADDITIONAL_NONE_VALUE = NONE_SPECIFIED_IN_UPLOAD;

type AdditionalKey = (typeof ADDITIONAL_KEYS)[number];

function nonEmpty(values: string[] | undefined): string[] {
  return (values ?? []).map((v) => v.trim()).filter(Boolean);
}

function realItems(values: string[] | undefined): string[] {
  return sanitizeAndersonFieldList(values).filter((v) => !isNoneSpecifiedInUpload(v));
}

function hasAnyAdditional(skills: SkillsAndInterests | undefined): boolean {
  if (!skills) return false;
  return ADDITIONAL_KEYS.some((key) => realItems(skills[key]).length > 0);
}

/**
 * Reorder `source` items using `proposed` order, then append any source items
 * the proposal omitted — never drop Additional content either side provided.
 * If source is empty but proposed has real items, keep the proposed items
 * (critical when the LLM finds skills the heuristic missed).
 */
export function reorderKeepAllAdditional(
  source: string[] | undefined,
  proposed: string[] | undefined
): string[] {
  const originalList = realItems(source);
  const proposedReal = realItems(proposed);
  if (originalList.length === 0) return proposedReal;
  if (proposedReal.length === 0) return originalList;

  const floorByLower = new Map(
    [...originalList, ...proposedReal].map((v) => [v.toLowerCase(), v])
  );
  const ordered: string[] = [];
  const used = new Set<string>();
  for (const value of proposedReal) {
    const lower = value.toLowerCase();
    const match = floorByLower.get(lower);
    if (match && !used.has(lower)) {
      ordered.push(match);
      used.add(lower);
    }
  }
  for (const value of originalList) {
    const lower = value.toLowerCase();
    if (!used.has(lower)) {
      ordered.push(value);
      used.add(lower);
    }
  }
  return ordered;
}

/** Union two Additional category lists without placeholders or duplicates. */
export function unionAdditionalLists(
  a: string[] | undefined,
  b: string[] | undefined
): string[] {
  return reorderKeepAllAdditional([...realItems(a), ...realItems(b)], b);
}

/** Merge two skills objects, keeping every real item from either side. */
export function mergeSkillsAndInterests(
  a: SkillsAndInterests | undefined,
  b: SkillsAndInterests | undefined
): SkillsAndInterests {
  return {
    certifications: unionAdditionalLists(a?.certifications, b?.certifications),
    languages: unionAdditionalLists(a?.languages, b?.languages),
    software: unionAdditionalLists(a?.software, b?.software),
    volunteer: unionAdditionalLists(a?.volunteer, b?.volunteer),
    interests: unionAdditionalLists(a?.interests, b?.interests),
  };
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
    // Still ensure placeholder rows so Additional always renders.
    return ensureAndersonAdditionalRows(tailored);
  }

  const next: SkillsAndInterests = { ...tailored.skillsAndInterests };
  let changed = false;

  for (const key of ADDITIONAL_KEYS) {
    const unionFloor = [
      ...realItems(source.skillsAndInterests[key]),
      ...realItems(next[key]),
    ];
    const restored = reorderKeepAllAdditional(unionFloor, [
      ...realItems(next[key]),
      ...realItems(source.skillsAndInterests[key]),
    ]);
    const current = realItems(next[key]);
    if (JSON.stringify(restored) !== JSON.stringify(current)) {
      next[key] = restored;
      changed = true;
    }
  }

  const merged = changed ? { ...tailored, skillsAndInterests: next } : tailored;
  return ensureAndersonAdditionalRows(merged);
}

/**
 * Every Additional category always has at least one value. Uses upload items
 * when present; otherwise "(None specified in upload)".
 */
export function ensureAndersonAdditionalRows(resume: ResumeData): ResumeData {
  const next: SkillsAndInterests = { ...resume.skillsAndInterests };
  let changed = false;

  for (const key of ADDITIONAL_KEYS) {
    const values = realItems(next[key]);
    const ensured = values.length > 0 ? values : [ADDITIONAL_NONE_VALUE];
    if (JSON.stringify(ensured) !== JSON.stringify(next[key] ?? [])) {
      next[key] = ensured;
      changed = true;
    }
  }

  return changed ? { ...resume, skillsAndInterests: next } : resume;
}

/** True when every source Additional category that had items still has ≥1 real item. */
export function additionalPreservedFromSource(
  tailored: ResumeData,
  source: ResumeData
): boolean {
  for (const key of ADDITIONAL_KEYS) {
    const sourceValues = realItems(source.skillsAndInterests[key]);
    if (sourceValues.length === 0) continue;
    if (realItems(tailored.skillsAndInterests[key]).length < sourceValues.length) return false;
  }
  return true;
}

export function countAdditionalItems(skills: SkillsAndInterests | undefined): number {
  if (!skills) return 0;
  return ADDITIONAL_KEYS.reduce((sum, key) => sum + realItems(skills[key]).length, 0);
}

/** Softest → hardest when shortening Additional lists during page-fit. */
export const ADDITIONAL_TRIM_ORDER: AdditionalKey[] = [
  "interests",
  "volunteer",
  "software",
  "languages",
  "certifications",
];

/** Build the five Anderson Additional bullet strings for render/export. */
export function additionalBulletLines(skills: SkillsAndInterests | undefined): string[] {
  const ensured = ensureAndersonAdditionalRows({
    contact: { name: "" },
    education: [],
    experience: [],
    skillsAndInterests: skills ?? {},
  }).skillsAndInterests;

  return ADDITIONAL_KEYS.map((key) => {
    const values = nonEmpty(ensured[key]);
    const display = values.length > 0 ? values.join(", ") : ADDITIONAL_NONE_VALUE;
    return `${ADDITIONAL_LABELS[key]}: ${display}`;
  });
}
