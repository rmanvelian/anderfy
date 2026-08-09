import { restoreAdditionalFromSource } from "@/lib/additionalSection";
import { normalizeExperienceBullets } from "@/lib/experienceBullets";
import { recoverAdditionalFromExperience } from "@/lib/heuristicResume";
import { fitResumeToOnePage } from "@/lib/pageFit";
import type { ResumeData } from "@/types/resume";

/**
 * Post-process a tailored/edited resume against the candidate's source:
 * recover mis-filed Additional rows, restore emptied experience/Additional
 * content, balance experience bullets, and trim for one page without wiping
 * Additional or zeroing roles.
 */
export function finalizeResumeAgainstSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  // Recover Additional from mis-parsed Experience on both sides so older
  // drafts (parsed before Additional header detection was fixed) still get
  // a real Additional section when the rows exist on the page.
  const recoveredSource = recoverAdditionalFromExperience(source);
  const recoveredTailored = recoverAdditionalFromExperience(tailored);

  const withExperience = normalizeExperienceBullets(recoveredTailored, recoveredSource);
  const withAdditional = restoreAdditionalFromSource(withExperience, recoveredSource);
  const fitted = fitResumeToOnePage(withAdditional);
  return restoreAdditionalFromSource(
    normalizeExperienceBullets(fitted, recoveredSource),
    recoveredSource
  );
}
