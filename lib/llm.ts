import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { newId } from "@/lib/id";
import { extractResumeHeuristically, tailorResumeHeuristically } from "@/lib/heuristicResume";
import type { JobPosting, ResumeData, TailorResult } from "@/types/resume";

// Anthropic (Claude) is preferred when ANTHROPIC_API_KEY is set; otherwise fall back to
// OpenAI, then to deterministic mock data if neither key is configured.
type Provider = "anthropic" | "openai";

function getProvider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

export function isMockMode(): boolean {
  return process.env.MOCK_LLM === "1" || getProvider() === null;
}

let openaiClient: OpenAI | null = null;
function getOpenAiClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
}

// Claude doesn't have a strict JSON response mode like OpenAI's `response_format`, so we
// instruct it to return only JSON and defensively strip any surrounding prose/code fences.
function extractJsonObject(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return candidate.trim();
  return candidate.slice(start, end + 1);
}

// --- Schema used to validate the JSON the model returns (ids are added afterwards). ---

const bulletsSchema = z.array(z.string()).default([]);

const educationSchema = z.object({
  school: z.string().default(""),
  location: z.string().optional().default(""),
  degree: z.string().default(""),
  field: z.string().optional().default(""),
  gpa: z.string().optional().default(""),
  honors: z.string().optional().default(""),
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

const leadershipSchema = z.object({
  org: z.string().default(""),
  role: z.string().default(""),
  location: z.string().optional().default(""),
  dates: z.string().optional().default(""),
  bullets: bulletsSchema.optional().default([]),
});

const resumeSchema = z.object({
  contact: z.object({
    name: z.string().default(""),
    phone: z.string().optional().default(""),
    email: z.string().optional().default(""),
    linkedin: z.string().optional().default(""),
    location: z.string().optional().default(""),
  }),
  education: z.array(educationSchema).default([]),
  experience: z.array(experienceSchema).default([]),
  leadership: z.array(leadershipSchema).default([]),
  skillsAndInterests: z
    .object({
      skills: z.array(z.string()).optional().default([]),
      languages: z.array(z.string()).optional().default([]),
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
    leadership: raw.leadership.map((e) => ({ id: newId(), ...e })),
    skillsAndInterests: raw.skillsAndInterests ?? {},
  };
}

async function chatJson(system: string, user: string): Promise<unknown> {
  const provider = getProvider();
  if (provider === "anthropic") {
    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      temperature: 0.4,
      system: `${system}\n\nRespond with ONLY the raw JSON object and no other text, markdown, or code fences.`,
      messages: [{ role: "user", content: user }],
    });
    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || !textBlock.text) {
      throw new Error("The model returned an empty response.");
    }
    return JSON.parse(extractJsonObject(textBlock.text));
  }

  const openai = getOpenAiClient();
  const completion = await openai.chat.completions.create({
    model: OPENAI_MODEL,
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

const EXTRACT_SYSTEM_PROMPT = `You are a resume-parsing assistant. You will be given the raw, messy text extracted from a person's existing resume (any format, any layout). Extract the information into clean, structured JSON that matches this exact shape:

{
  "contact": { "name": string, "phone": string, "email": string, "linkedin": string, "location": string },
  "education": [{ "school": string, "location": string, "degree": string, "field": string, "gpa": string, "honors": string, "gradDate": string, "bullets": string[] }],
  "experience": [{ "company": string, "location": string, "title": string, "startDate": string, "endDate": string, "bullets": string[] }],
  "leadership": [{ "org": string, "role": string, "location": string, "dates": string, "bullets": string[] }],
  "skillsAndInterests": { "skills": string[], "languages": string[], "interests": string[] }
}

Rules:
- Preserve the person's actual content; do not invent employers, schools, or numbers that are not present in the source text.
- List education and experience entries in reverse-chronological order (most recent first).
- Split multi-line bullet fragments into separate strings in the "bullets" array.
- "leadership" is for extracurricular activities, volunteering, or leadership roles that are not paid employment.
- If a field is unknown, use an empty string ("") or empty array ([]) rather than omitting the key.
- Output ONLY the JSON object, no commentary.`;

export async function extractResumeFromText(rawText: string): Promise<ResumeData> {
  if (isMockMode()) {
    return extractResumeHeuristically(rawText);
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
- EDUCATION section, then EXPERIENCE section (most space-consuming), then LEADERSHIP & ACTIVITIES, then ADDITIONAL (skills, languages, interests).
- Every experience/leadership bullet uses the S-T-A-R framework (Situation/Task, Action, Result), starts with a strong past-tense action verb, and quantifies impact wherever possible.
- Content is tailored to the target audience: bullets should be reordered and rewritten (never fabricated) to foreground the experience, skills, and keywords most relevant to the target job posting.

You will be given (1) a candidate's existing resume data as JSON and (2) a target job posting. Rewrite and restructure the resume into the exact same JSON shape as the input, tailored to the job posting:

{
  "contact": { "name": string, "phone": string, "email": string, "linkedin": string, "location": string },
  "education": [{ "school": string, "location": string, "degree": string, "field": string, "gpa": string, "honors": string, "gradDate": string, "bullets": string[] }],
  "experience": [{ "company": string, "location": string, "title": string, "startDate": string, "endDate": string, "bullets": string[] }],
  "leadership": [{ "org": string, "role": string, "location": string, "dates": string, "bullets": string[] }],
  "skillsAndInterests": { "skills": string[], "languages": string[], "interests": string[] }
}

Rules:
- Never invent employers, titles, dates, schools, or metrics that were not present (or reasonably implied) in the source resume. You may rephrase and re-prioritize, not fabricate facts.
- Prioritize and reorder bullets within each entry so the most job-relevant, highest-impact bullets come first.
- Rewrite bullets to be concise (roughly one line each), start with a strong past-tense action verb, and echo language/keywords from the job posting where truthful and natural.
- Keep the total content tight enough to fit on one page: aim for at most 3-4 bullets per recent role, 2-3 for older roles, and trim the "skillsAndInterests" and "leadership" sections if space is tight.
- If information is missing from the source resume, leave the corresponding field as an empty string/array rather than guessing.
- Output a JSON object with exactly two top-level keys: "resume" (the object above) and "notes" (a string array of up to 4 short notes explaining key tailoring decisions you made, e.g. which experience you emphasized and why).`;

export async function tailorResumeToJob(
  resume: ResumeData,
  jobPosting: JobPosting
): Promise<TailorResult> {
  if (isMockMode()) {
    return tailorResumeHeuristically(resume, jobPosting);
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
    leadership: obj.leadership.map(dropId),
    skillsAndInterests: obj.skillsAndInterests,
  });
  const userPrompt = `Candidate resume JSON:\n${JSON.stringify(stripIds(resume))}\n\nTarget job posting${
    jobPosting.title ? ` (title: ${jobPosting.title})` : ""
  }${jobPosting.company ? ` at ${jobPosting.company}` : ""}:\n"""\n${jobPosting.rawText.slice(
    0,
    12000
  )}\n"""`;
  const json = (await chatJson(TAILOR_SYSTEM_PROMPT, userPrompt)) as {
    resume: unknown;
    notes?: unknown;
  };
  const parsedResume = resumeSchema.parse(json.resume);
  const notes = Array.isArray(json.notes) ? json.notes.map((n) => String(n)) : undefined;
  return { resume: attachIds(parsedResume), notes };
}
