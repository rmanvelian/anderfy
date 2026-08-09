import { exceedsMaxBulletLength } from "@/lib/bulletLength";
import { introducesUnverifiedNumbers } from "@/lib/numberGuard";

interface WithIdAndBullets {
  id: string;
  bullets?: string[];
}

export interface ProposedEntry {
  id: string;
  bullets: string[];
}

/**
 * Merges the model's proposed (id, rewritten-bullets, order) back onto the
 * user's original entries. Factual fields (company, school, title, dates,
 * location, degree, etc.) always come from the original entry — the model
 * never controls them, so it structurally cannot rename/invent an employer,
 * school, or date.
 *
 * Bullet text can only change under two conditions, both enforced here
 * rather than merely requested by the prompt:
 *  1. The entry must already have at least one original bullet — an entry
 *     with zero original bullets has nothing legitimate to rephrase, so any
 *     bullet the model proposes for it is necessarily invented and is
 *     dropped entirely (this is what catches things like an LLM inventing
 *     "relevant coursework" for an education entry that listed none).
 *  2. The rewritten bullets must not introduce a number absent from the
 *     original bullets (see `introducesUnverifiedNumbers`), and none of them
 *     may run past the ~two-line budget (see `exceedsMaxBulletLength`);
 *     otherwise the original bullets are kept as-is.
 *
 * Entries the model doesn't mention are appended afterward, unchanged, in
 * their original relative order — nothing from the source resume is ever
 * silently dropped.
 */
export function mergeOrderedEntries<T extends WithIdAndBullets>(
  original: T[],
  proposed: ProposedEntry[]
): T[] {
  const byId = new Map(original.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of proposed) {
    const source = byId.get(item.id);
    if (!source || seen.has(item.id)) continue;
    seen.add(item.id);

    const sourceBullets = source.bullets || [];
    const proposedBullets = (item.bullets || []).filter((b) => b && b.trim());

    let safeBullets: string[];
    if (sourceBullets.length === 0) {
      // Nothing here to legitimately rephrase — anything proposed would be invented.
      safeBullets = [];
    } else if (
      proposedBullets.length > 0 &&
      !introducesUnverifiedNumbers(proposedBullets, sourceBullets) &&
      !exceedsMaxBulletLength(proposedBullets)
    ) {
      safeBullets = proposedBullets;
    } else {
      safeBullets = sourceBullets;
    }

    result.push({ ...source, bullets: safeBullets });
  }

  for (const entry of original) {
    if (!seen.has(entry.id)) result.push(entry);
  }

  return result;
}

/**
 * Keeps only proposed values that already exist (case-insensitively) in the
 * original list, in the model's proposed order — the model can select/trim/
 * reorder but never introduce a brand-new item. Falls back to the original
 * list untouched if the model proposed nothing usable.
 */
export function sanitizeStringList(original: string[] | undefined, proposed: string[] | undefined): string[] {
  const originalList = original || [];
  if (!proposed || proposed.length === 0) return originalList;

  const originalByLower = new Map(originalList.map((v) => [v.trim().toLowerCase(), v]));
  const kept: string[] = [];
  const usedLower = new Set<string>();
  for (const value of proposed) {
    const lower = value.trim().toLowerCase();
    const match = originalByLower.get(lower);
    if (match && !usedLower.has(lower)) {
      kept.push(match);
      usedLower.add(lower);
    }
  }
  return kept.length > 0 ? kept : originalList;
}
