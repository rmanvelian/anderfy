import type { EducationEntry, ResumeData } from "@/types/resume";

function nonEmpty(bullets: string[] | undefined): string[] {
  return (bullets ?? []).map((b) => b.trim()).filter(Boolean);
}

function educationKey(entry: Pick<EducationEntry, "school" | "degree">): string {
  return `${entry.school.trim().toLowerCase()}::${entry.degree.trim().toLowerCase()}`;
}

/**
 * If a school had Honors/Leadership/Membership (or any) bullets in the source
 * but ended up empty after tailor/trim, restore the source bullets.
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
    // If tailor kept fewer labeled Anderson bullets than the source, put the
    // missing Honors/Leadership/Membership lines back.
    if (sourceBullets.length > currentBullets.length) {
      const currentLower = new Set(currentBullets.map((b) => b.toLowerCase()));
      const missing = sourceBullets.filter((b) => !currentLower.has(b.toLowerCase()));
      const labeledMissing = missing.filter((b) =>
        /^(Honors?|Leadership|Membership|GPA)\s*:/i.test(b)
      );
      if (labeledMissing.length > 0) {
        changed = true;
        return { ...entry, bullets: [...currentBullets, ...labeledMissing] };
      }
    }
    return { ...entry, bullets: currentBullets };
  });

  return changed ? { ...tailored, education } : tailored;
}
