import { z } from "zod";
import { MAX_BULLET_CHARS } from "@/lib/bulletLength";
import { extractResumeHeuristically, tailorResumeHeuristically } from "@/lib/heuristicResume";
import { newId } from "@/lib/id";
import { chatStructured, isLlmConfigured } from "@/lib/llmClient";
import { reorderKeepAllAdditional } from "@/lib/additionalSection";
import { finalizeResumeAgainstSource } from "@/lib/finalizeResume";
import { fitResumeToOnePage } from "@/lib/pageFit";
import { mergeOrderedEntries } from "@/lib/tailorMerge";
import type { TailorOptions } from "@/lib/tailorOptions";
import type { JobPosting, ResumeData } from "@/types/resume";

export type { TailorOptions } from "@/lib/tailorOptions";

export function isMockMode(): boolean {
  return process.env.MOCK_LLM === "1" || !isLlmConfigured();
}

// --- Schema used to validate the JSON the model returns (ids are added afterwards). ---

const bulletsSchema = z.array(z.string()).default([]);

const educationSchema = z.object({
  school: z.string().default(""),
  location: z.string().optional().default(""),
  degree: z.string().default(""),
  gradDate: z.string().default(""),
  bullets: bulletsSchema.optional().default([]),
});

const experienceSchema = z.object({
  company: z.string().default(""),
  location: z.string().optional().default(""),
  title: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  bullets: bulletsSchema,
});

const skillsAndInterestsSchema = z.object({
  certifications: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default([]),
  software: z.array(z.string()).optional().default([]),
  volunteer: z.array(z.string()).optional().default([]),
  interests: z.array(z.string()).optional().default([]),
});

const resumeSchema = z.object({
  contact: z.object({
    name: z.string().default(""),
    phone: z.string().optional().default(""),
    email: z.string().optional().default(""),
    linkedin: z.string().optional().default(""),
  }),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  skillsAndInterests: skillsAndInterestsSchema.optional(),
});

type RawResume = z.infer<typeof resumeSchema>;

function attachIds(raw: RawResume): ResumeData {
  return {
    contact: raw.contact,
    education: raw.education.map((e) => ({ id: newId(), ...e })),
    experience: raw.experience.map((e) => ({ id: newId(), ...e })),
    skillsAndInterests: raw.skillsAndInterests ?? {},
  };
}

const RESUME_JSON_SHAPE = `{
  "contact": { "name": string, "phone": string, "email": string, "linkedin": string },
  "education": [{ "school": string, "location": string, "degree": string, "gradDate": string, "bullets": string[] }],
  "experience": [{ "company": string, "location": string, "title": string, "startDate": string, "endDate": string, "bullets": string[] }],
  "skillsAndInterests": { "certifications": string[], "languages": string[], "software": string[], "volunteer": string[], "interests": string[] }
}`;

const EXTRACT_SYSTEM_PROMPT = `You are a resume-parsing assistant. You will be given the raw, messy text extracted from a person's existing resume (any format, any layout). Extract the information into clean, structured JSON that matches this exact shape:

${RESUME_JSON_SHAPE}

Rules:
- Preserve the person's actual content; do not invent employers, schools, or numbers that are not present in the source text.
- List education and experience entries in reverse-chronological order (most recent first).
- "degree" should read like "M.B.A., Full-Time Program" or "B.A., Economics" (degree + program/major together in one string).
- Split multi-line bullet fragments into separate strings in the "bullets" array.
- For EVERY education entry, always include exactly these labeled bullets in this order: "Honors: ...", "Leadership: ...", "Membership: ...". Use the candidate's text when present; if a category is missing or only template placeholder dots, use "(None specified in upload)" (e.g. "Honors: (None specified in upload)"). Do not omit these three bullets.
- ALWAYS populate "skillsAndInterests" from any Additional / Skills / Skills & Interests section (Anderson resumes label this ADDITIONAL). Map labeled rows into the matching arrays:
  - "Certifications: ..." → certifications
  - "Languages: ..." → languages
  - "Software: ..." / "Skills: ..." / "Tools: ..." → software
  - "Volunteer: ..." / "Memberships: ..." → volunteer
  - "Interests: ..." → interests
  Split comma/semicolon-separated values into individual array items. Do not leave skillsAndInterests empty when such rows exist in the source.
- Volunteering/leadership activities that are NOT part of a person's formal education should go in "skillsAndInterests.volunteer" instead.
- If a field is unknown, use an empty string ("") or empty array ([]) rather than omitting the key.`;

function skillsCount(skills: ResumeData["skillsAndInterests"] | undefined): number {
  if (!skills) return 0;
  return (
    (skills.certifications?.length ?? 0) +
    (skills.languages?.length ?? 0) +
    (skills.software?.length ?? 0) +
    (skills.volunteer?.length ?? 0) +
    (skills.interests?.length ?? 0)
  );
}

export async function extractResumeFromText(rawText: string): Promise<ResumeData> {
  if (isMockMode()) {
    return fitResumeToOnePage(extractResumeHeuristically(rawText));
  }
  const parsed = await chatStructured(
    EXTRACT_SYSTEM_PROMPT,
    `Raw resume text:\n"""\n${rawText.slice(0, 20000)}\n"""`,
    resumeSchema
  );
  const withIds = attachIds(parsed);
  const heuristic = extractResumeHeuristically(rawText);
  // If the model omitted Additional/skills, fill from the heuristic parser so the
  // Anderson Additional section is not lost.
  if (skillsCount(withIds.skillsAndInterests) === 0 && skillsCount(heuristic.skillsAndInterests) > 0) {
    withIds.skillsAndInterests = heuristic.skillsAndInterests;
  } else if (skillsCount(heuristic.skillsAndInterests) > 0) {
    withIds.skillsAndInterests = {
      certifications: reorderKeepAllAdditional(
        heuristic.skillsAndInterests.certifications,
        withIds.skillsAndInterests.certifications
      ),
      languages: reorderKeepAllAdditional(
        heuristic.skillsAndInterests.languages,
        withIds.skillsAndInterests.languages
      ),
      software: reorderKeepAllAdditional(
        heuristic.skillsAndInterests.software,
        withIds.skillsAndInterests.software
      ),
      volunteer: reorderKeepAllAdditional(
        heuristic.skillsAndInterests.volunteer,
        withIds.skillsAndInterests.volunteer
      ),
      interests: reorderKeepAllAdditional(
        heuristic.skillsAndInterests.interests,
        withIds.skillsAndInterests.interests
      ),
    };
  }
  // Prefer heuristic education bullets when the model left a school empty but
  // Honors/Leadership/Membership were present in the source text.
  return finalizeResumeAgainstSource(withIds, {
    ...withIds,
    education: withIds.education.map((ed) => {
      if ((ed.bullets?.length ?? 0) > 0) return ed;
      const match = heuristic.education.find(
        (h) => h.school.trim().toLowerCase() === ed.school.trim().toLowerCase()
      );
      if (match && (match.bullets?.length ?? 0) > 0) {
        return { ...ed, bullets: [...match.bullets!] };
      }
      return ed;
    }),
    skillsAndInterests: withIds.skillsAndInterests,
  });
}

// --- Tailoring ---
//
// Deliberately narrow contract: the model may ONLY (a) choose which existing
// education/experience entries (by id) to feature and in what order, (b)
// rewrite each entry's bullets, and (c) select/reorder existing
// skillsAndInterests values. It never touches factual fields (company,
// school, title, dates, location, contact info) — those are always copied
// verbatim from the user's original resume in `mergeOrderedEntries`, so the
// model has no way to rename/invent an employer, school, or date. Rewritten
// bullets are additionally checked by `introducesUnverifiedNumbers` and
// discarded (falling back to the original bullets) if they contain a number
// not present anywhere in the source bullets for that entry. Together this
// makes fabricated facts structurally very difficult, not just discouraged
// by the prompt below.

const tailorResponseSchema = z.object({
  education: z
    .array(z.object({ id: z.string(), bullets: z.array(z.string()).default([]) }))
    .default([]),
  experience: z
    .array(z.object({ id: z.string(), bullets: z.array(z.string()).default([]) }))
    .default([]),
  skillsAndInterests: skillsAndInterestsSchema.optional(),
});

const TAILOR_SYSTEM_PROMPT = `You are an expert MBA career coach who specializes in the UCLA Anderson School of Management (Parker Career Management Center) resume format: one page, reverse-chronological, conservative business formatting, EDUCATION then EXPERIENCE then ADDITIONAL, with every experience bullet using the S-T-A-R framework (strong past-tense action verb, quantified result) and education bullets using labeled bullets like "Honors: ...", "Leadership: ...", "Membership: ...".

You will be given (1) the candidate's full resume as JSON, including an "id" for each education/experience entry, and (2) a target job posting.

Your ONLY job is to decide which entries to feature and in what order, and to rewrite each featured entry's bullets to prioritize what's most relevant to the job posting. You are NOT rewriting the candidate's factual history — you are re-emphasizing and re-phrasing existing, true content.

THE SINGLE MOST IMPORTANT RULE: every fact in your output — every number, percentage, dollar amount, team size, tool, technology, company, client type, or outcome — MUST already appear somewhere in the candidate's resume JSON below. The job posting exists only to tell you what to emphasize and which language/keywords to echo; it is never a source of new facts about the candidate. If you are not certain a number or detail is already in the candidate's resume, do not include it — reuse the original bullet text instead of guessing. Do not average, estimate, round to a "nicer" number, or infer a metric that isn't explicitly stated. Never invent employers, schools, honors, or achievements. For education, always keep the Anderson labeled bullets Honors:/Leadership:/Membership: — copy the candidate's values, or use "(None specified in upload)" when the source has nothing for that label (do not invent awards).

Output JSON of this exact shape:
{
  "education": [ { "id": "<id copied from an input education entry>", "bullets": string[] } ],
  "experience": [ { "id": "<id copied from an input experience entry>", "bullets": string[] } ],
  "skillsAndInterests": { "certifications": string[], "languages": string[], "software": string[], "volunteer": string[], "interests": string[] }
}

Rules:
- List ids in your desired display order (most relevant to this job posting first). You do not need to include every entry — any you omit will automatically be kept, unchanged, in their original position, so only include an entry if you're reordering it and/or rewriting its bullets.
- Every value in "skillsAndInterests" must be copied verbatim (exact spelling) from the candidate's original skillsAndInterests. You may reorder items for relevance, but keep ALL of them — do not omit certifications, languages, software, volunteer, or interests the candidate already listed.
- For every education entry, always output Honors:, Leadership:, and Membership: bullets (in that order). Keep the candidate's values; if a label is missing in the source, use "(None specified in upload)". Do not drop these three bullets.
- Keep each bullet no longer than roughly two lines (about ${MAX_BULLET_CHARS} characters) when rendered on the resume — ideally one line — starting with a strong past-tense action verb, echoing job-posting language only where it truthfully matches something the candidate already did.
- Fill the one-page Anderson layout: prefer keeping education labeled bullets and the full Additional section; trim only by slightly shortening experience bullets when necessary.
- EXPERIENCE BULLET COUNTS (hard requirements):
  1. Never leave an experience entry with zero bullets if that entry had bullets in the source resume — include at least one rewritten (or original) bullet for every such role.
  2. Across all experience entries that have bullets, the number of bullets per entry may differ by at most ONE. Examples: 4/3/3 is OK; 5/4/3 is NOT (5−3=2). Prefer giving the most recent / most relevant role the higher count when you need the +1.
  3. Typical targets: 3-4 bullets for the top role(s) and 2-3 for others, while obeying the max-difference-of-one rule and the one-page goal.`;

function collectBulletPhrasings(resume: ResumeData | undefined): string[] {
  if (!resume) return [];
  return [
    ...resume.education.flatMap((e) => e.bullets ?? []),
    ...resume.experience.flatMap((e) => e.bullets ?? []),
  ]
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 40);
}

function normalizeBullet(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Fraction of `next` bullets that already appear (normalized) in `previous`. */
function phrasingOverlap(previous: ResumeData | undefined, next: ResumeData): number {
  const prev = new Set(collectBulletPhrasings(previous).map(normalizeBullet));
  const nxt = collectBulletPhrasings(next);
  if (nxt.length === 0) return 1;
  const hits = nxt.filter((b) => prev.has(normalizeBullet(b))).length;
  return hits / nxt.length;
}

function buildTailoredResume(
  resume: ResumeData,
  parsed: z.infer<typeof tailorResponseSchema>
): ResumeData {
  const merged: ResumeData = {
    contact: resume.contact,
    education: mergeOrderedEntries(resume.education, parsed.education),
    experience: mergeOrderedEntries(resume.experience, parsed.experience),
    skillsAndInterests: {
      certifications: reorderKeepAllAdditional(
        resume.skillsAndInterests.certifications,
        parsed.skillsAndInterests?.certifications
      ),
      languages: reorderKeepAllAdditional(
        resume.skillsAndInterests.languages,
        parsed.skillsAndInterests?.languages
      ),
      software: reorderKeepAllAdditional(
        resume.skillsAndInterests.software,
        parsed.skillsAndInterests?.software
      ),
      volunteer: reorderKeepAllAdditional(
        resume.skillsAndInterests.volunteer,
        parsed.skillsAndInterests?.volunteer
      ),
      interests: reorderKeepAllAdditional(
        resume.skillsAndInterests.interests,
        parsed.skillsAndInterests?.interests
      ),
    },
  };
  return finalizeResumeAgainstSource(merged, resume);
}

function regenerateInstructions(previousBullets: string[], attempt: number): string {
  const intensity =
    attempt === 0
      ? "Produce a meaningfully different wording pass — different opening verbs, sentence structures, and which accomplishments you lead with"
      : "Your previous rewrite was too similar. You MUST change nearly every bullet's opening verb and sentence structure. Prefer alternate true accomplishments from the same roles when available";
  const banned =
    previousBullets.length > 0
      ? `\nDo NOT reuse or lightly edit these prior phrasings:\n${previousBullets.map((b) => `- ${b}`).join("\n")}`
      : "";
  return `\n\nREGENERATION REQUEST (attempt ${attempt + 1}): The candidate rejected a prior draft. ${intensity}, while still synthesizing the job posting with the candidate's real experience. Keep every number/fact grounded in the source resume JSON. Do not invent employers, titles, dates, or metrics.${banned}`;
}

export async function tailorResumeToJob(
  resume: ResumeData,
  jobPosting: JobPosting,
  options: TailorOptions = {}
): Promise<ResumeData> {
  if (isMockMode()) {
    return finalizeResumeAgainstSource(
      tailorResumeHeuristically(resume, jobPosting, options),
      resume
    );
  }

  const previousBullets = options.regenerate ? collectBulletPhrasings(options.previousResume) : [];
  const basePrompt = `Candidate resume JSON (source of truth — do not add facts beyond what's here):\n${JSON.stringify(
    resume
  )}\n\nTarget job posting${jobPosting.title ? ` (title: ${jobPosting.title})` : ""}${
    jobPosting.company ? ` at ${jobPosting.company}` : ""
  } (context only, not a source of facts about the candidate):\n"""\n${jobPosting.rawText.slice(
    0,
    12000
  )}\n"""`;

  const maxAttempts = options.regenerate ? 2 : 1;
  let tailored: ResumeData | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const userPrompt =
      basePrompt + (options.regenerate ? regenerateInstructions(previousBullets, attempt) : "");

    const parsed = await chatStructured(TAILOR_SYSTEM_PROMPT, userPrompt, tailorResponseSchema, {
      // OpenAI only — Anthropic Sonnet 5 rejects temperature.
      temperature: options.regenerate ? 0.9 : 0.4,
      // Stronger effort on regenerate so Claude actually varies phrasing.
      effort: options.regenerate ? (attempt === 0 ? "high" : "xhigh") : undefined,
    });

    tailored = buildTailoredResume(resume, parsed);

    if (!options.regenerate) break;
    // If the new draft still shares most bullet strings with the rejected one,
    // try one harder pass before returning.
    if (phrasingOverlap(options.previousResume, tailored) < 0.45) break;
  }

  return tailored ?? resume;
}
