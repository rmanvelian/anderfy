import type { ExperienceEntry, ResumeData } from "@/types/resume";

function nonEmpty(bullets: string[] | undefined): string[] {
  return (bullets ?? []).map((b) => b.trim()).filter(Boolean);
}

/**
 * If an experience had bullets in the source resume but ended up with none
 * after tailor/trim, restore the source bullets for that entry.
 */
function experienceKey(entry: Pick<ExperienceEntry, "company" | "title">): string {
  return `${entry.company.trim().toLowerCase()}::${entry.title.trim().toLowerCase()}`;
}

export function restoreEmptyExperienceBullets(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  const sourceById = new Map(source.experience.map((e) => [e.id, e]));
  const sourceByKey = new Map(source.experience.map((e) => [experienceKey(e), e]));
  return {
    ...tailored,
    experience: tailored.experience.map((entry) => {
      const original = sourceById.get(entry.id) ?? sourceByKey.get(experienceKey(entry));
      const sourceBullets = nonEmpty(original?.bullets);
      const currentBullets = nonEmpty(entry.bullets);
      if (sourceBullets.length > 0 && currentBullets.length === 0) {
        return { ...entry, bullets: [...sourceBullets] };
      }
      return { ...entry, bullets: currentBullets };
    }),
  };
}

/**
 * Keep experience bullet counts within one of each other (e.g. 4/3/3 OK,
 * 5/4/3 not). Never drops an experience below 1 bullet if it currently has
 * any. Prefer trimming older (later) entries that sit above the minimum.
 */
export function balanceExperienceBulletCounts(resume: ResumeData): ResumeData {
  const experience: ExperienceEntry[] = resume.experience.map((e) => ({
    ...e,
    bullets: nonEmpty(e.bullets),
  }));

  let guard = 100;
  while (guard-- > 0) {
    const active = experience
      .map((e, index) => ({ e, index, n: e.bullets.length }))
      .filter((x) => x.n > 0);
    if (active.length <= 1) break;

    const min = Math.min(...active.map((x) => x.n));
    const max = Math.max(...active.map((x) => x.n));
    if (max - min <= 1) break;

    // Trim from the oldest entry currently at the max count (keep the extra
    // bullet on more recent roles when possible).
    const atMax = active.filter((x) => x.n === max);
    atMax.sort((a, b) => b.index - a.index);
    const target = atMax[0];
    if (!target || target.n <= 1) break;
    target.e.bullets.pop();
  }

  return { ...resume, experience };
}

/**
 * Pop a single experience bullet for page-fit trimming without emptying a
 * role or breaking the max-min <= 1 balance more than necessary.
 * Returns true if a bullet was removed.
 */
export function trimOneBalancedExperienceBullet(experience: ExperienceEntry[]): boolean {
  const active = experience
    .map((e, index) => ({ e, index, n: e.bullets.length }))
    .filter((x) => x.n > 0);
  if (active.length === 0) return false;

  const min = Math.min(...active.map((x) => x.n));
  // Prefer entries above the current minimum (preserves balance); if all are
  // tied, only trim when every active role still has more than one bullet.
  const aboveMin = active.filter((x) => x.n > min && x.n > 1);
  const tiedAllAboveOne = active.every((x) => x.n > 1) ? active : [];
  const pool = aboveMin.length > 0 ? aboveMin : tiedAllAboveOne;
  if (pool.length === 0) return false;

  pool.sort((a, b) => b.index - a.index);
  pool[0].e.bullets.pop();
  return true;
}

/** Apply restore + balance using the source resume as the floor for empties. */
export function normalizeExperienceBullets(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  return balanceExperienceBulletCounts(restoreEmptyExperienceBullets(tailored, source));
}
