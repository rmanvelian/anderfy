import { newId } from "@/lib/id";
import type {
  ContactInfo,
  EducationEntry,
  ExperienceEntry,
  JobPosting,
  LeadershipEntry,
  ResumeData,
  SkillsAndInterests,
  TailorResult,
} from "@/types/resume";

// A zero-cost, local (non-AI) fallback used when no LLM provider is configured (or
// MOCK_LLM=1). Unlike a canned sample, everything below is derived from the resume
// text and job posting the user actually provided: `extractResumeHeuristically`
// parses real section/entry/bullet structure out of raw resume text with regex and
// layout heuristics, and `tailorResumeHeuristically` re-prioritizes that real content
// (bullets, skills) by keyword overlap with the real job posting. It won't rewrite
// prose the way an LLM would, but it never fabricates or substitutes placeholder data.

const BULLET_PREFIX_RE = /^[•\u2022\u25CF\u25AA\u25E6○●▪]\s*|^[-*]\s+/;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,|]+/i;
const LOCATION_RE = /\b[A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+)*,\s*[A-Z]{2}\b/;
const DATE_TOKEN = "(?:\\d{4}|[A-Za-z]{3,9}\\.?\\s+\\d{4}|Present|Current|Now)";
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${DATE_TOKEN})`, "i");
const SINGLE_DATE_RE = new RegExp(`\\b(${DATE_TOKEN})\\b`, "i");
const HONOR_PHRASES = ["summa cum laude", "magna cum laude", "cum laude", "with honors", "dean's list", "distinction"];

type SectionKey = "education" | "experience" | "leadership" | "skills";

const SECTION_ALIASES: Record<string, SectionKey> = {
  education: "education",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "relevant experience": "experience",
  employment: "experience",
  "employment history": "experience",
  leadership: "leadership",
  "leadership & activities": "leadership",
  "leadership and activities": "leadership",
  "leadership experience": "leadership",
  activities: "leadership",
  "extracurricular activities": "leadership",
  extracurriculars: "leadership",
  volunteer: "leadership",
  "volunteer experience": "leadership",
  skills: "skills",
  "skills & interests": "skills",
  "skills and interests": "skills",
  additional: "skills",
  "additional information": "skills",
};

function detectSection(line: string): SectionKey | null {
  const cleaned = line.trim().replace(/:$/, "").toLowerCase();
  if (!cleaned || cleaned.length > 40) return null;
  return SECTION_ALIASES[cleaned] ?? null;
}

interface RawSection {
  key: SectionKey;
  lines: string[];
}

function splitIntoSections(lines: string[]): { preamble: string[]; sections: RawSection[] } {
  const preamble: string[] = [];
  const sections: RawSection[] = [];
  let current: RawSection | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const key = detectSection(line);
    if (key) {
      current = { key, lines: [] };
      sections.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  return { preamble, sections };
}

function extractContact(preambleLines: string[]): ContactInfo {
  const joined = preambleLines.join(" \n ");
  const email = joined.match(EMAIL_RE)?.[0]?.trim() ?? "";
  const linkedin = joined.match(LINKEDIN_RE)?.[0]?.trim() ?? "";
  const phone = joined.match(PHONE_RE)?.[0]?.trim() ?? "";
  const location = joined.match(LOCATION_RE)?.[0]?.trim() ?? "";

  let name = "";
  for (const line of preambleLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (EMAIL_RE.test(trimmed) || PHONE_RE.test(trimmed) || LINKEDIN_RE.test(trimmed)) continue;
    name = trimmed.replace(/[|,]+$/, "").trim();
    break;
  }

  return { name, phone, email, linkedin, location };
}

interface RawEntry {
  headerLines: string[];
  bullets: string[];
}

function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(line.trim());
}

function headerComplete(headerLines: string[]): boolean {
  if (headerLines.length >= 2) return true;
  return DATE_RANGE_RE.test(headerLines.join(" ")) || SINGLE_DATE_RE.test(headerLines.join(" "));
}

// Groups a section's raw lines into entries by tracking a "header" phase (company/school
// + dates lines) followed by a "bullets" phase, starting a new entry whenever a non-bullet
// line appears after the current entry's header looks complete or bullets have started.
function groupIntoEntries(lines: string[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let current: RawEntry | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (isBulletLine(line)) {
      if (!current) {
        current = { headerLines: [], bullets: [] };
        entries.push(current);
      }
      current.bullets.push(line.replace(BULLET_PREFIX_RE, "").trim());
    } else {
      const startNew = !current || current.bullets.length > 0 || headerComplete(current.headerLines);
      if (startNew || !current) {
        current = { headerLines: [], bullets: [] };
        entries.push(current);
      }
      current.headerLines.push(line);
    }
  }

  return entries.filter((e) => e.headerLines.length > 0 || e.bullets.length > 0);
}

function stripDateRange(text: string): { text: string; startDate: string; endDate: string } {
  const match = text.match(DATE_RANGE_RE);
  if (!match || match.index === undefined) return { text: text.trim(), startDate: "", endDate: "" };
  const cleaned = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/[|,\-–—]+\s*$/, "")
    .replace(/^[|,\-–—]+\s*/, "")
    .trim();
  return { text: cleaned, startDate: match[1].trim(), endDate: match[2].trim() };
}

function stripSingleOrRangeDate(text: string): { text: string; date: string } {
  const range = stripDateRange(text);
  if (range.startDate) return { text: range.text, date: `${range.startDate} - ${range.endDate}` };
  const match = text.match(SINGLE_DATE_RE);
  if (!match || match.index === undefined) return { text: text.trim(), date: "" };
  const cleaned = (text.slice(0, match.index) + text.slice(match.index + match[0].length))
    .replace(/[|,\-–—]+\s*$/, "")
    .replace(/^[|,\-–—]+\s*/, "")
    .trim();
  return { text: cleaned, date: match[1].trim() };
}

function splitNameLocation(line: string): { name: string; location: string } {
  const parts = line.split(",").map((p) => p.trim());
  // "Name, City, ST" (3+ comma-separated parts): treat the last two as a "City, ST" location.
  if (parts.length >= 3) {
    return { name: parts.slice(0, -2).join(", "), location: parts.slice(-2).join(", ") };
  }
  if (parts.length === 2 && parts[1].length <= 20) {
    return { name: parts[0], location: parts[1] };
  }
  return { name: line.trim(), location: "" };
}

function splitDelimited(text: string): [string, string] {
  for (const d of [" — ", " – ", " - ", " | ", ", "]) {
    const idx = text.indexOf(d);
    if (idx !== -1) return [text.slice(0, idx).trim(), text.slice(idx + d.length).trim()];
  }
  return [text.trim(), ""];
}

function parseExperienceEntry(headerLines: string[], bullets: string[]): ExperienceEntry {
  const stripped = headerLines.map(stripDateRange);
  const dateLine = stripped.find((s) => s.startDate);
  const startDate = dateLine?.startDate ?? "";
  const endDate = dateLine?.endDate ?? "";

  let company = "";
  let location = "";
  let title = "";

  if (stripped.length >= 2) {
    const { name, location: loc } = splitNameLocation(stripped[0].text);
    company = name;
    location = loc;
    title = stripped[1].text || stripped.slice(2).map((s) => s.text).join(" ");
  } else if (stripped.length === 1) {
    const [left, right] = splitDelimited(stripped[0].text);
    if (right) {
      const { name, location: loc } = splitNameLocation(left);
      company = name;
      location = loc;
      title = right;
    } else {
      company = left;
    }
  }

  return { id: newId(), company, location, title, startDate, endDate, bullets };
}

function parseLeadershipEntry(headerLines: string[], bullets: string[]): LeadershipEntry {
  const exp = parseExperienceEntry(headerLines, bullets);
  const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" - ");
  return { id: newId(), org: exp.company, role: exp.title, location: exp.location, dates, bullets };
}

function parseEducationEntry(headerLines: string[], bullets: string[]): EducationEntry {
  const stripped = headerLines.map(stripSingleOrRangeDate);
  const dateLine = stripped.find((s) => s.date);
  const gradDate = dateLine?.date ?? "";

  let school = "";
  let location = "";
  let degreeLine = "";

  if (stripped.length >= 2) {
    const { name, location: loc } = splitNameLocation(stripped[0].text);
    school = name;
    location = loc;
    degreeLine = stripped.slice(1).map((s) => s.text).join(", ");
  } else if (stripped.length === 1) {
    // A single header line often packs "School — Degree, Field, GPA X.X" onto one line.
    const [left, right] = splitDelimited(stripped[0].text);
    const { name, location: loc } = splitNameLocation(left);
    school = name;
    location = loc;
    degreeLine = right;
  }

  let gpa = "";
  const gpaMatch = degreeLine.match(/GPA[:\s]*([\d.]+(?:\s*\/\s*[\d.]+)?)/i);
  if (gpaMatch) {
    gpa = gpaMatch[1];
    degreeLine = degreeLine.replace(gpaMatch[0], "").trim();
  }

  let honors = "";
  for (const phrase of HONOR_PHRASES) {
    const re = new RegExp(phrase, "i");
    if (re.test(degreeLine)) {
      honors = degreeLine.match(re)?.[0] ?? phrase;
      degreeLine = degreeLine.replace(re, "").trim();
      break;
    }
  }

  degreeLine = degreeLine.replace(/^[,\-–—]+\s*/, "").replace(/[,\-–—]+\s*$/, "").trim();

  let degree = degreeLine;
  let field = "";
  const inMatch = degreeLine.match(/^(.*?)\s+in\s+(.*)$/i);
  if (inMatch) {
    degree = inMatch[1].trim();
    field = inMatch[2].trim();
  } else {
    const commaIdx = degreeLine.indexOf(",");
    if (commaIdx !== -1) {
      degree = degreeLine.slice(0, commaIdx).trim();
      field = degreeLine.slice(commaIdx + 1).trim();
    }
  }

  return { id: newId(), school, location, degree, field, gpa, honors, gradDate, bullets };
}

function parseSkillsSection(lines: string[]): SkillsAndInterests {
  const skills: string[] = [];
  const languages: string[] = [];
  const interests: string[] = [];

  for (const line of lines) {
    const labelMatch = line.match(/^([A-Za-z][A-Za-z &]*):\s*(.*)$/);
    const label = labelMatch?.[1]?.toLowerCase() ?? "";
    const body = labelMatch ? labelMatch[2] : line;
    const items = body
      .split(/[,;•]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!items.length) continue;

    if (label.includes("language") || (!labelMatch && /language/i.test(line))) {
      languages.push(...items);
    } else if (label.includes("interest") || label.includes("hobbies") || (!labelMatch && /interests?:/i.test(line))) {
      interests.push(...items);
    } else {
      skills.push(...items);
    }
  }

  return { skills, languages, interests };
}

export function extractResumeHeuristically(rawText: string): ResumeData {
  const lines = rawText.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const { preamble, sections } = splitIntoSections(lines);
  const contact = extractContact(preamble);

  const education: EducationEntry[] = [];
  const experience: ExperienceEntry[] = [];
  const leadership: LeadershipEntry[] = [];
  let skillsAndInterests: SkillsAndInterests = { skills: [], languages: [], interests: [] };

  for (const section of sections) {
    if (section.key === "skills") {
      const parsed = parseSkillsSection(section.lines);
      skillsAndInterests = {
        skills: [...(skillsAndInterests.skills ?? []), ...(parsed.skills ?? [])],
        languages: [...(skillsAndInterests.languages ?? []), ...(parsed.languages ?? [])],
        interests: [...(skillsAndInterests.interests ?? []), ...(parsed.interests ?? [])],
      };
      continue;
    }

    const entries = groupIntoEntries(section.lines);
    if (section.key === "education") {
      for (const e of entries) education.push(parseEducationEntry(e.headerLines, e.bullets));
    } else if (section.key === "experience") {
      for (const e of entries) experience.push(parseExperienceEntry(e.headerLines, e.bullets));
    } else if (section.key === "leadership") {
      for (const e of entries) leadership.push(parseLeadershipEntry(e.headerLines, e.bullets));
    }
  }

  // No recognizable section headers at all (e.g. a short pasted paragraph) — keep the
  // person's actual text as a single unlabeled experience entry rather than dropping it.
  if (!education.length && !experience.length && !leadership.length && !skillsAndInterests.skills?.length) {
    const body = lines.filter((l, i) => l.trim() && !(i === 0 && l.trim() === contact.name));
    if (body.length) {
      experience.push({
        id: newId(),
        company: "",
        location: "",
        title: "",
        startDate: "",
        endDate: "",
        bullets: body.map((l) => l.replace(BULLET_PREFIX_RE, "").trim()).slice(0, 20),
      });
    }
  }

  return { contact, education, experience, leadership, skillsAndInterests };
}

// --- Local (non-AI) tailoring: re-prioritize the user's real bullets/skills by their
// keyword overlap with the real job posting text. Content is only reordered, never
// rewritten or fabricated. ---

const STOPWORDS = new Set([
  "the", "and", "for", "are", "with", "that", "this", "from", "will", "you", "your",
  "have", "has", "our", "their", "a", "an", "to", "of", "in", "on", "at", "by", "is",
  "as", "be", "or", "we", "they", "it", "its", "who", "what", "when", "where", "how",
  "not", "but", "can", "may", "should", "must", "also", "using", "use", "across",
  "into", "within", "about", "more", "other", "than", "then", "these", "those",
  "such", "including", "etc", "strong", "excellent", "required", "requirements",
  "responsibilities", "role", "join", "team", "looking", "preferred", "ability",
  "years", "year", "work", "working", "job", "please", "company", "all", "any",
  "experience", "related", "plus", "help", "new", "one", "well", "based", "own",
]);

interface Keyword {
  word: string;
  count: number;
}

function extractKeywords(text: string, excludeWords: Set<string> = new Set(), limit = 25): Keyword[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .split(/\s+/)
    // Strip a lone trailing "." (end-of-sentence punctuation) without touching
    // internal dots in compound terms like "node.js".
    .map((w) => w.replace(/(?<!\.)\.$/, ""))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !excludeWords.has(w) && !/^\d+$/.test(w));
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

function score(text: string, keywords: Keyword[]): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const { word, count } of keywords) {
    if (lower.includes(word)) total += count;
  }
  return total;
}

function reorderBullets(bullets: string[] | undefined, keywords: Keyword[]): string[] {
  if (!bullets || bullets.length <= 1) return bullets ?? [];
  return bullets
    .map((text, index) => ({ text, index, s: score(text, keywords) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((x) => x.text);
}

function reorderByRelevance(items: string[] | undefined, keywords: Keyword[]): string[] {
  if (!items || items.length <= 1) return items ?? [];
  return [...items].sort((a, b) => score(b, keywords) - score(a, keywords));
}

export function tailorResumeHeuristically(resume: ResumeData, jobPosting: JobPosting): TailorResult {
  // Deliberately excludes the employer's own name: it's noise for scoring bullet/skill
  // relevance, not a signal of what the role actually needs.
  const companyWords = new Set(
    (jobPosting.company ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9+#./\s-]/g, " ")
      .split(/\s+/)
      .map((w) => w.replace(/(?<!\.)\.$/, ""))
      .filter(Boolean)
  );
  const keywords = extractKeywords(`${jobPosting.title ?? ""} ${jobPosting.rawText}`, companyWords);

  const tailored: ResumeData = {
    contact: resume.contact,
    education: resume.education.map((ed) => ({ ...ed, bullets: reorderBullets(ed.bullets, keywords) })),
    experience: resume.experience.map((ex) => ({ ...ex, bullets: reorderBullets(ex.bullets, keywords) })),
    leadership: resume.leadership.map((l) => ({ ...l, bullets: reorderBullets(l.bullets, keywords) })),
    skillsAndInterests: {
      skills: reorderByRelevance(resume.skillsAndInterests?.skills, keywords),
      languages: resume.skillsAndInterests?.languages ?? [],
      interests: resume.skillsAndInterests?.interests ?? [],
    },
  };

  const matchedKeywords = keywords.filter((k) => score(k.word, keywords) > 0).slice(0, 8).map((k) => k.word);
  const notes = [
    "Local mode (no AI model called): your existing bullets and skills were reordered by keyword overlap with the job posting; nothing was rewritten or invented.",
    matchedKeywords.length
      ? `Top job posting keywords used for scoring: ${matchedKeywords.join(", ")}.`
      : "Couldn't detect strong keywords in the job posting text, so ordering was left mostly unchanged.",
    "For AI-rewritten bullets tailored in language/tone to the posting, configure a real ANTHROPIC_API_KEY or OPENAI_API_KEY.",
  ];

  return { resume: tailored, notes };
}
