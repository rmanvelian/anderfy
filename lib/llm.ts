import OpenAI from "openai";
import { z } from "zod";
import { newId } from "@/lib/id";
import { mockResumeData } from "@/lib/mock-data";
import type { JobPosting, ResumeData } from "@/types/resume";

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function isMockMode(): boolean {
  return process.env.MOCK_LLM === "1" || !process.env.OPENAI_API_KEY;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
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

const resumeSchema = z.object({
  contact: z.object({
    name: z.string().default(""),
    phone: z.string().optional().default(""),
    email: z.string().optional().default(""),
    linkedin: z.string().optional().default(""),
  }),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  skillsAndInterests: z
    .object({
      certifications: z.array(z.string()).optional().default([]),
      languages: z.array(z.string()).optional().default([]),
      software: z.array(z.string()).optional().default([]),
      volunteer: z.array(z.string()).optional().default([]),
      interests: z.array(z.string()).optional().default([]),
    })
    .optional(),
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

async function chatJson(system: string, user: string): Promise<unknown> {
  const openai = getClient();
  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("The model returned an empty response.");
  return JSON.parse(content);
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
- If a field is unknown, use an empty string ("") or empty array ([]) rather than omitting the key.
- Output ONLY the JSON object, no commentary.`;

export async function extractResumeFromText(rawText: string): Promise<ResumeData> {
  if (isMockMode()) {
    return mockResumeData();
  }
  const json = await chatJson(
    EXTRACT_SYSTEM_PROMPT,
    `Raw resume text:\n"""\n${rawText.slice(0, 20000)}\n"""`
  );
  const parsed = resumeSchema.parse(json);
  return attachIds(parsed);
}

const TAILOR_SYSTEM_PROMPT = `You are an expert MBA career coach who specializes in the UCLA Anderson School of Management (Parker Career Management Center) resume format. That format is:
- One page, reverse-chronological, standard conservative business formatting (no colors, no graphics).
- Sections in this order: EDUCATION, EXPERIENCE (most space-consuming), then ADDITIONAL (certifications, languages, software, volunteer work, interests).
- Every experience bullet uses the S-T-A-R framework (Situation/Task, Action, Result), starts with a strong past-tense action verb, and quantifies impact wherever possible.
- Education bullets use labeled bullets in the form "Honors: ...", "Leadership: ...", or "Membership: ..." rather than free-form prose.
- Content is tailored to the target audience: bullets should be reordered and rewritten (never fabricated) to foreground the experience, skills, and keywords most relevant to the target job posting.

You will be given (1) a candidate's existing resume data as JSON and (2) a target job posting. Rewrite and restructure the resume into the exact same JSON shape as the input, tailored to the job posting:

${RESUME_JSON_SHAPE}

Rules:
- Never invent employers, titles, dates, schools, or metrics that were not present (or reasonably implied) in the source resume. You may rephrase and re-prioritize, not fabricate facts.
- Prioritize and reorder bullets within each entry so the most job-relevant, highest-impact bullets come first.
- Rewrite experience bullets to be concise (roughly one line each), start with a strong past-tense action verb, and echo language/keywords from the job posting where truthful and natural.
- Keep the total content tight enough to fit on one page: aim for at most 3-4 bullets per recent role, 2-3 for older roles, and trim the "skillsAndInterests" section if space is tight.
- If information is missing from the source resume, leave the corresponding field as an empty string/array rather than guessing.
- Output ONLY the resume JSON object described above (no wrapper object, no commentary).`;

export async function tailorResumeToJob(
  resume: ResumeData,
  jobPosting: JobPosting
): Promise<ResumeData> {
  if (isMockMode()) {
    return mockResumeData();
  }
  const dropId = <T extends { id: string }>(obj: T): Omit<T, "id"> => {
    const rest: Record<string, unknown> = { ...obj };
    delete rest.id;
    return rest as Omit<T, "id">;
  };
  const stripIds = (obj: ResumeData) => ({
    contact: obj.contact,
    education: obj.education.map(dropId),
    experience: obj.experience.map(dropId),
    skillsAndInterests: obj.skillsAndInterests,
  });
  const userPrompt = `Candidate resume JSON:\n${JSON.stringify(stripIds(resume))}\n\nTarget job posting${
    jobPosting.title ? ` (title: ${jobPosting.title})` : ""
  }${jobPosting.company ? ` at ${jobPosting.company}` : ""}:\n"""\n${jobPosting.rawText.slice(
    0,
    12000
  )}\n"""`;
  const json = await chatJson(TAILOR_SYSTEM_PROMPT, userPrompt);
  const parsed = resumeSchema.parse(json);
  return attachIds(parsed);
}
