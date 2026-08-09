import { restoreAdditionalFromSource } from "@/lib/additionalSection";
import { restoreEmptyEducationBullets } from "@/lib/educationBullets";
import { normalizeExperienceBullets } from "@/lib/experienceBullets";
import {
  recoverAdditionalFromExperience,
  recoverEducationLabeledBullets,
} from "@/lib/heuristicResume";
import { fitResumeToOnePage } from "@/lib/pageFit";
import type { ResumeData } from "@/types/resume";

/**
 * Post-process a tailored/edited resume against the candidate's source:
 * recover mis-filed Education/Additional rows, restore emptied content,
 * balance experience bullets, and trim for one page only when necessary —
 * preferring to fill the page rather than leave large bottom whitespace.
 */
export function finalizeResumeAgainstSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  const recoveredSource = recoverEducationLabeledBullets(
    recoverAdditionalFromExperience(source)
  );
  const recoveredTailored = recoverEducationLabeledBullets(
    recoverAdditionalFromExperience(tailored)
  );

  let next = normalizeExperienceBullets(recoveredTailored, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  next = restoreAdditionalFromSource(next, recoveredSource);
  next = fitResumeToOnePage(next);
  // Re-apply floors after fit so trim cannot leave empty schools/roles or
  // drop Additional items the page still has room for (fit already stops early).
  next = normalizeExperienceBullets(next, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  next = restoreAdditionalFromSource(next, recoveredSource);
  // If restore re-added content that barely overflows the heuristic, trim once
  // more — but restore Additional/education floors again afterward.
  next = fitResumeToOnePage(next);
  next = normalizeExperienceBullets(next, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  return restoreAdditionalFromSource(next, recoveredSource);
}
