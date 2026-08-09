import { restoreAdditionalFromSource } from "@/lib/additionalSection";
import {
  ensureAndersonEducationBullets,
  restoreEmptyEducationBullets,
} from "@/lib/educationBullets";
import { normalizeExperienceBullets } from "@/lib/experienceBullets";
import {
  recoverAdditionalFromExperience,
  recoverEducationLabeledBullets,
} from "@/lib/heuristicResume";
import { fitResumeToOnePage } from "@/lib/pageFit";
import type { ResumeData } from "@/types/resume";

/**
 * Post-process a tailored/edited resume against the candidate's source:
 * recover mis-filed Education/Additional rows, ensure every school has
 * Honors/Leadership/Membership, restore Additional items, and trim for one
 * page only when necessary.
 */
export function finalizeResumeAgainstSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  const recoveredSource = ensureAndersonEducationBullets(
    recoverEducationLabeledBullets(recoverAdditionalFromExperience(source))
  );
  const recoveredTailored = ensureAndersonEducationBullets(
    recoverEducationLabeledBullets(recoverAdditionalFromExperience(tailored))
  );

  let next = normalizeExperienceBullets(recoveredTailored, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  next = restoreAdditionalFromSource(next, recoveredSource);
  next = fitResumeToOnePage(next);
  next = normalizeExperienceBullets(next, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  next = restoreAdditionalFromSource(next, recoveredSource);
  next = fitResumeToOnePage(next);
  next = normalizeExperienceBullets(next, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  next = restoreAdditionalFromSource(next, recoveredSource);
  return ensureAndersonEducationBullets(next);
}
