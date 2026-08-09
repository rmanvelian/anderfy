import {
  ensureAndersonAdditionalRows,
  restoreAdditionalFromSource,
} from "@/lib/additionalSection";
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
 * Honors/Leadership/Membership, keep all Additional category rows (with
 * "(None specified in upload)" when empty), and trim experience only when
 * needed for one page.
 */
export function finalizeResumeAgainstSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  const recoveredSource = ensureAndersonAdditionalRows(
    ensureAndersonEducationBullets(
      recoverEducationLabeledBullets(recoverAdditionalFromExperience(source))
    )
  );
  const recoveredTailored = ensureAndersonAdditionalRows(
    ensureAndersonEducationBullets(
      recoverEducationLabeledBullets(recoverAdditionalFromExperience(tailored))
    )
  );

  let next = normalizeExperienceBullets(recoveredTailored, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  next = restoreAdditionalFromSource(next, recoveredSource);
  next = fitResumeToOnePage(next);
  next = normalizeExperienceBullets(next, recoveredSource);
  next = restoreEmptyEducationBullets(next, recoveredSource);
  // Always re-apply Additional after fit — page-fit must not leave it empty.
  next = restoreAdditionalFromSource(next, recoveredSource);
  next = ensureAndersonEducationBullets(next);
  return ensureAndersonAdditionalRows(next);
}
