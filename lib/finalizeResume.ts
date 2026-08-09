import { restoreAdditionalFromSource } from "@/lib/additionalSection";
import { normalizeExperienceBullets } from "@/lib/experienceBullets";
import { fitResumeToOnePage } from "@/lib/pageFit";
import type { ResumeData } from "@/types/resume";

/**
 * Post-process a tailored/edited resume against the candidate's source:
 * restore emptied experience/Additional content, balance experience bullets,
 * and trim for one page without wiping Additional or zeroing roles.
 */
export function finalizeResumeAgainstSource(
  tailored: ResumeData,
  source: ResumeData
): ResumeData {
  const withExperience = normalizeExperienceBullets(tailored, source);
  const withAdditional = restoreAdditionalFromSource(withExperience, source);
  const fitted = fitResumeToOnePage(withAdditional);
  return restoreAdditionalFromSource(
    normalizeExperienceBullets(fitted, source),
    source
  );
}
