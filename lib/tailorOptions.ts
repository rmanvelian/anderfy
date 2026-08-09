import type { ResumeData } from "@/types/resume";

export interface TailorOptions {
  /** User asked for a fresh draft — change wording, not just reorder. */
  regenerate?: boolean;
  /** Prior tailored draft whose phrasings should be avoided. */
  previousResume?: ResumeData;
}
