import { z } from "zod";
import { MAX_BULLET_CHARS } from "@/lib/bulletLength";
import { newId } from "@/lib/id";
import { chatStructured, isLlmConfigured } from "@/lib/llmClient";
import { mockResumeData } from "@/lib/mock-data";
import { mergeOrderedEntries, sanitizeStringList } from "@/lib/tailorMerge";
import type { JobPosting, ResumeData } from "@/types/resume";

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
- For education bullets, use labeled bullets in the form "Honors: ...", "Leadership: ...", or "Membership: ..." when that information is present (e.g. honors/awards, extracurricular leadership roles, club memberships) — this mirrors the Anderson resume format's convention.
- Volunteering/leadership activities that are NOT part of a person's formal education should go in "skillsAndInterests.volunteer" instead.
- If a field is unknown, use an empty string ("") or empty array ([]) rather than omitting the key.`;

export async function extractResumeFromText(rawText: string): Promise<ResumeData> {
  if (isMockMode()) {
    return mockResumeData();
  }
  const parsed = await chatStructured(
    EXTRACT_SYSTEM_PROMPT,
    `Raw resume text:\n"""\n${rawText.slice(0, 20000)}\n"""`,
    resumeSchema
  );
  return attachIds(parsed);
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

THE SINGLE MOST IMPORTANT RULE: every fact in your output — every number, percentage, dollar amount, team size, tool, technology, company, client type, or outcome — MUST already appear somewhere in the candidate's resume JSON below. The job posting exists only to tell you what to emphasize and which language/keywords to echo; it is never a source of new facts about the candidate. If you are not certain a number or detail is already in the candidate's resume, do not include it — reuse the original bullet text instead of guessing. Do not average, estimate, round to a "nicer" number, or infer a metric that isn't explicitly stated. If an entry (e.g. an education entry) has no existing bullets, leave it with no bullets — do not invent content like "relevant coursework" or achievements just to fill space.

Output JSON of this exact shape:
{
  "education": [ { "id": "<id copied from an input education entry>", "bullets": string[] } ],
  "experience": [ { "id": "<id copied from an input experience entry>", "bullets": string[] } ],
  "skillsAndInterests": { "certifications": string[], "languages": string[], "software": string[], "volunteer": string[], "interests": string[] }
}

Rules:
- List ids in your desired display order (most relevant to this job posting first). You do not need to include every entry — any you omit will automatically be kept, unchanged, in their original position, so only include an entry if you're reordering it and/or rewriting its bullets.
- Every value in "skillsAndInterests" must be copied verbatim (exact spelling) from the candidate's original skillsAndInterests — you may select a relevant subset and reorder them, but never add a new one.
- Keep each bullet no longer than roughly two lines (about ${MAX_BULLET_CHARS} characters) when rendered on the resume — ideally one line — starting with a strong past-tense action verb, echoing job-posting language only where it truthfully matches something the candidate already did.
- Aim for at most 3-4 bullets for the most relevant/recent entries and 2-3 for others, to help the final resume fit one page.`;

export async function tailorResumeToJob(
  resume: ResumeData,
  jobPosting: JobPosting
): Promise<ResumeData> {
  if (isMockMode()) {
    return mockResumeData();
  }

  const userPrompt = `Candidate resume JSON (source of truth — do not add facts beyond what's here):\n${JSON.stringify(
    resume
  )}\n\nTarget job posting${jobPosting.title ? ` (title: ${jobPosting.title})` : ""}${
    jobPosting.company ? ` at ${jobPosting.company}` : ""
  } (context only, not a source of facts about the candidate):\n"""\n${jobPosting.rawText.slice(
    0,
    12000
  )}\n"""`;

  const parsed = await chatStructured(TAILOR_SYSTEM_PROMPT, userPrompt, tailorResponseSchema);

  return {
    contact: resume.contact,
    education: mergeOrderedEntries(resume.education, parsed.education),
    experience: mergeOrderedEntries(resume.experience, parsed.experience),
    skillsAndInterests: {
      certifications: sanitizeStringList(resume.skillsAndInterests.certifications, parsed.skillsAndInterests?.certifications),
      languages: sanitizeStringList(resume.skillsAndInterests.languages, parsed.skillsAndInterests?.languages),
      software: sanitizeStringList(resume.skillsAndInterests.software, parsed.skillsAndInterests?.software),
      volunteer: sanitizeStringList(resume.skillsAndInterests.volunteer, parsed.skillsAndInterests?.volunteer),
      interests: sanitizeStringList(resume.skillsAndInterests.interests, parsed.skillsAndInterests?.interests),
    },
  };
}
