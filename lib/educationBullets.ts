import { sanitizeAndersonFieldValue } from "@/lib/sanitizeAndersonValue";
import { isNoneSpecifiedInUpload, NONE_SPECIFIED_IN_UPLOAD } from "@/lib/uploadNone";
import type { EducationEntry, ResumeData } from "@/types/resume";

/** Anderson education rows that must appear on every school entry. */
export const ANDERSON_EDU_LABELS = ["Honors", "Leadership", "Membership"] as const;

/** Shown when the upload has no value for an Anderson education label. */
export const EDUCATION_NONE_VALUE = NONE_SPECIFIED_IN_UPLOAD;

export type AndersonEduLabel = (typeof ANDERSON_EDU_LABELS)[number];

function nonEmpty(bullets: string[] | undefined): string[] {
  return (bullets ?? []).map((b) => b.trim()).filter(Boolean);
}

function educationKey(entry: Pick<EducationEntry, "school" | "degree">): string {
  return `${entry.school.trim().toLowerCase()}::${entry.degree.trim().toLowerCase()}`;
}

function labelPattern(label: AndersonEduLabel): RegExp {
  // Honors also matches Honor:
  if (label === "Honors") return /^Honors?\s*:\s*(.*)$/i;
  return new RegExp(`^${label}\\s*:\\s*(.*)$`, "i");
}

function isAndersonEduLabel(bullet: string): boolean {
  return /^(Honors?|Leadership|Membership)\s*:/i.test(bullet.trim());
}

/** Template placeholders like "………more………" or empty values → treat as missing. */
export function isEducationPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  if (isNoneSpecifiedInUpload(trimmed)) return true;
  const dotCount = (trimmed.match(/[.…·•]/g) || []).length;
  const moreCount = (trimmed.match(/\bmore\b/gi) || []).length;
  // Anderson DOCX template filler is mostly dots / the word "more".
  if (dotCount >= 6 || moreCount >= 2) return true;
  const stripped = trimmed
    .replace(/[.…·•]/g, "")
    .replace(/\bmore\b/gi, "")
    .replace(/\s+/g, "")
    .replace(/[-–—_/\\]/g, "");
  return stripped.length === 0;
}

function extractLabeledValue(bullets: string[], label: AndersonEduLabel): string | null {
  const re = labelPattern(label);
  for (const bullet of bullets) {
    const match = bullet.trim().match(re);
    if (!match) continue;
    const value = sanitizeAndersonFieldValue(match[1] ?? "");
    if (isEducationPlaceholderValue(value)) return null;
    return value;
  }
  return null;
}

/**
 * Every education entry gets Honors / Leadership / Membership bullets.
 * Uses source text when present; otherwise "(None specified in upload)".
 * Preserves GPA and any other non-Anderson-labeled bullets after those three.
 */
export function ensureAndersonEducationBullets(resume: ResumeData): ResumeData {
  let changed = false;
  const education = resume.education.map((entry) => {
    const existing = nonEmpty(entry.bullets);
    const ensured = ANDERSON_EDU_LABELS.map((label) => {
      const value = extractLabeledValue(existing, label);
      return value ? `${label}: ${value}` : `${label}: ${EDUCATION_NONE_VALUE}`;
    });
    const gpa = existing.filter((b) => /^GPA\s*:/i.test(b));
    const other = existing.filter((b) => !isAndersonEduLabel(b) && !/^GPA\s*:/i.test(b));
    const nextBullets = [...ensured, ...gpa, ...other];
    if (JSON.stringify(nextBullets) !== JSON.stringify(entry.bullets ?? [])) {
      changed = true;
    }
    return { ...entry, bullets: nextBullets };
  });

  return changed ? { ...resume, education } : resume;
}

/**
 * If a school had Honors/Leadership/Membership (or any) bullets in the source
 * but ended up empty after tailor/trim, restore the source bullets — then ensure
 * the three Anderson labels are present.
 */
export function restoreEmptyEducationBullets(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  const sourceById = new Map(source.education.map((e) => [e.id, e]));
  const sourceByKey = new Map(source.education.map((e) => [educationKey(e), e]));

  let changed = false;
  const education = tailored.education.map((entry) => {
    const original = sourceById.get(entry.id) ?? sourceByKey.get(educationKey(entry));
    const sourceBullets = nonEmpty(original?.bullets);
    const currentBullets = nonEmpty(entry.bullets);
    if (sourceBullets.length > 0 && currentBullets.length === 0) {
      changed = true;
      return { ...entry, bullets: [...sourceBullets] };
    }
    if (sourceBullets.length > currentBullets.length) {
      const currentLower = new Set(currentBullets.map((b) => b.toLowerCase()));
      const missing = sourceBullets.filter((b) => !currentLower.has(b.toLowerCase()));
      const labeledMissing = missing.filter((b) => isAndersonEduLabel(b) || /^GPA\s*:/i.test(b));
      if (labeledMissing.length > 0) {
        changed = true;
        return { ...entry, bullets: [...currentBullets, ...labeledMissing] };
      }
    }
    return { ...entry, bullets: currentBullets };
  });

  const restored = changed ? { ...tailored, education } : tailored;
  return ensureAndersonEducationBullets(restored);
}

/** True when every school has Honors, Leadership, and Membership bullets. */
export function hasAndersonEducationBullets(resume: ResumeData): boolean {
  return resume.education.every((ed) => {
    const bullets = nonEmpty(ed.bullets);
    return ANDERSON_EDU_LABELS.every((label) =>
      bullets.some((b) => labelPattern(label).test(b))
    );
  });
}
