import { ensureAndersonAdditionalRows } from "@/lib/additionalSection";
import { ensureAndersonEducationBullets } from "@/lib/educationBullets";
import { newId } from "@/lib/id";
import { normalizeResumeText, stripMarkdownHeading } from "@/lib/normalizeResumeText";
import { sanitizeAndersonFieldValue } from "@/lib/sanitizeAndersonValue";
import type {
  ContactInfo,
  EducationEntry,
  ExperienceEntry,
  JobPosting,
  ResumeData,
  SkillsAndInterests,
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
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s,|]+/i;
const DATE_TOKEN = "(?:\\d{4}|[A-Za-z]{3,9}\\.?\\s+\\d{4}|Present|Current|Now)";
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|to)\\s*(${DATE_TOKEN})`, "i");
const SINGLE_DATE_RE = new RegExp(`\\b(${DATE_TOKEN})\\b`, "i");
const HONOR_PHRASES = ["summa cum laude", "magna cum laude", "cum laude", "with honors", "dean's list", "distinction"];
const ACTION_BULLET_START_RE =
  /^(Built|Improved|Led|Managed|Developed|Created|Designed|Implemented|Increased|Reduced|Decreased|Launched|Drove|Owned|Partnered|Collaborated|Analyzed|Delivered|Shipped|Spearheaded|Coordinated|Supported|Helped|Worked|Responsible|Optimized|Automated|Established|Negotiated|Presented|Conducted|Executed|Generated|Grew|Scaled|Transformed|Streamlined)\b/i;

// Anderson-shaped sections. A legacy "leadership" header is folded into Additional
// volunteer lines (or experience when it looks like a full role with bullets).
// "skip" sections (Summary/Objective) are dropped — they are not Anderson sections.
type SectionKey = "education" | "experience" | "leadership" | "skills" | "skip";

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
  "skills/interests": "skills",
  "skills & abilities": "skills",
  "skills and abilities": "skills",
  "technical skills": "skills",
  "professional skills": "skills",
  "core competencies": "skills",
  competencies: "skills",
  additional: "skills",
  "additional information": "skills",
  "additional skills": "skills",
  // Category labels alone may start a skills block (exact match only — never as a
  // prefix, or "Software Engineering Intern" would be misread as Additional).
  certifications: "skills",
  languages: "skills",
  software: "skills",
  interests: "skills",
  // Narrative sections — keep out of Experience/Education freeform noise.
  summary: "skip",
  "professional summary": "skip",
  objective: "skip",
  profile: "skip",
  about: "skip",
  "about me": "skip",
};

/** Longest aliases first so "skills and interests" wins over "skills". */
const SECTION_ALIAS_LIST = Object.keys(SECTION_ALIASES).sort((a, b) => b.length - a.length);

/**
 * Aliases that may appear with trailing guidance or same-line content
 * (e.g. Anderson "ADDITIONAL Try to limit your bullets to 3-4 areas").
 * Short category words like "software" are excluded — exact match only.
 */
const PREFIX_OK_ALIASES = new Set(
  SECTION_ALIAS_LIST.filter(
    (alias) => !["certifications", "languages", "software", "interests", "volunteer"].includes(alias)
  )
);

/** Instructional template fluff after a section header (Anderson DOCX, etc.). */
const SECTION_GUIDANCE_RE =
  /^(try to limit|limit your|optional|include|list your|add your|fill in|placeholder)\b/i;

function detectSection(line: string): { key: SectionKey; remainder: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Strip a leading bullet / markdown heading so "• ADDITIONAL" / "## Experience" match.
  const withoutBullet = stripMarkdownHeading(trimmed.replace(BULLET_PREFIX_RE, "").trim());
  const cleaned = withoutBullet.replace(/:$/, "").toLowerCase();
  if (!cleaned) return null;

  const exact = SECTION_ALIASES[cleaned];
  if (exact) return { key: exact, remainder: "" };

  for (const alias of SECTION_ALIAS_LIST) {
    if (!PREFIX_OK_ALIASES.has(alias)) continue;
    if (cleaned.startsWith(`${alias} `) || cleaned.startsWith(`${alias}\t`)) {
      // Preserve original casing/spacing for the remainder after the alias.
      const aliasPattern = new RegExp(`^${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[:\\s]+`, "i");
      const remainder = withoutBullet.replace(aliasPattern, "").trim();
      const key = SECTION_ALIASES[alias];
      // Avoid treating bullet text like "Experience designing APIs…" as a new
      // section. Allow trailing text only for Additional/skills (Anderson puts
      // guidance on the ADDITIONAL line) or clear template guidance.
      if (
        remainder &&
        key !== "skills" &&
        !SECTION_GUIDANCE_RE.test(remainder)
      ) {
        continue;
      }
      return { key, remainder };
    }
  }

  return null;
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
    const detected = detectSection(line);
    if (detected) {
      current = { key: detected.key, lines: [] };
      sections.push(current);
      // Keep non-guidance text that shared the header line
      // (e.g. "ADDITIONAL Certifications: CFA, Series 63").
      if (
        detected.remainder &&
        !SECTION_GUIDANCE_RE.test(detected.remainder) &&
        !detectSection(detected.remainder)
      ) {
        current.lines.push(detected.remainder);
      }
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

  let name = "";
  for (const line of preambleLines) {
    const trimmed = stripMarkdownHeading(line.trim());
    if (!trimmed) continue;
    if (EMAIL_RE.test(trimmed) || PHONE_RE.test(trimmed) || LINKEDIN_RE.test(trimmed)) continue;
    if (GITHUB_RE.test(trimmed) && trimmed.includes("|")) continue;
    name = trimmed.replace(/^#+\s*/, "").replace(/[|,]+$/, "").trim();
    break;
  }

  return { name, phone, email, linkedin };
}

interface RawEntry {
  headerLines: string[];
  bullets: string[];
}

function isBulletLine(line: string): boolean {
  return BULLET_PREFIX_RE.test(line.trim());
}

/** Anderson education detail rows — must stay on the school, never become a new school. */
const EDU_LABELED_LINE_RE =
  /^(Honors?|Leadership|Membership|GPA|Awards?|Activities|Relevant Coursework)\s*:/i;

function isEducationLabeledLine(line: string): boolean {
  return EDU_LABELED_LINE_RE.test(line.replace(BULLET_PREFIX_RE, "").trim());
}

function headerComplete(headerLines: string[]): boolean {
  // Legacy helper — prefer experienceHeaderReady for work history.
  if (headerLines.length >= 2) return true;
  return DATE_RANGE_RE.test(headerLines.join(" ")) || SINGLE_DATE_RE.test(headerLines.join(" "));
}

/**
 * Experience headers are often 3–4 lines (company, location, title, dates).
 * Do not treat "Company + Location" alone as complete — that splits Anderson
 * pastes into phantom roles and drops real bullets.
 */
function experienceHeaderReady(headerLines: string[]): boolean {
  const joined = headerLines.join(" ");
  if (DATE_RANGE_RE.test(joined)) return true;
  if (headerLines.length >= 3 && SINGLE_DATE_RE.test(joined)) return true;
  // Safety valve for odd layouts with no recognizable dates.
  return headerLines.length >= 5;
}

function isDegreeLikeLine(line: string): boolean {
  return /\b(M\.?B\.?A\.?|B\.?A\.?|B\.?S\.?|B\.?B\.?A\.?|M\.?S\.?|M\.?A\.?|Ph\.?D\.?|Bachelor|Master|Doctor|Associate|Undergraduate)\b/i.test(
    line
  );
}

function isDateOnlyLine(line: string): boolean {
  const cleaned = line.trim();
  if (!cleaned) return false;
  if (DATE_RANGE_RE.test(cleaned)) {
    return cleaned.replace(DATE_RANGE_RE, "").replace(/[|\s,.\-–—]/g, "").length === 0;
  }
  if (SINGLE_DATE_RE.test(cleaned)) {
    return cleaned.replace(SINGLE_DATE_RE, "").replace(/[|\s,.\-–—]/g, "").length === 0;
  }
  return false;
}

function educationHeaderHasDate(headerLines: string[]): boolean {
  return headerLines.some((l) => DATE_RANGE_RE.test(l) || SINGLE_DATE_RE.test(l));
}

function educationHeaderHasDegree(headerLines: string[]): boolean {
  return headerLines.some(isDegreeLikeLine);
}

// Groups a section's raw lines into entries by tracking a "header" phase (company/school
// + dates lines) followed by a "bullets" phase, starting a new entry whenever a non-bullet
// line appears after the current entry's header looks complete or bullets have started.
function groupIntoEntries(
  lines: string[],
  options: { educationMode?: boolean } = {}
): RawEntry[] {
  const educationMode = !!options.educationMode;
  const entries: RawEntry[] = [];
  let current: RawEntry | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const withoutBullet = line.replace(BULLET_PREFIX_RE, "").trim();

    // Honors:/Leadership:/Membership: (with or without a bullet marker) attach to
    // the current school/role instead of opening a phantom entry.
    if (current && isEducationLabeledLine(withoutBullet)) {
      current.bullets.push(withoutBullet);
      continue;
    }

    if (isBulletLine(line)) {
      if (!current) {
        current = { headerLines: [], bullets: [] };
        entries.push(current);
      }
      current.bullets.push(withoutBullet);
      continue;
    }

    // Soft-wrapped PDF/DOCX lines: lowercase continuations belong on the prior bullet.
    if (
      current &&
      current.bullets.length > 0 &&
      looksLikeBulletContinuation(withoutBullet)
    ) {
      const last = current.bullets.length - 1;
      current.bullets[last] = `${current.bullets[last]} ${withoutBullet}`.replace(/\s+/g, " ").trim();
      continue;
    }

    if (educationMode && current && current.bullets.length === 0) {
      // Anderson school headers are often 3–4 lines (school, location, degree, date).
      // Keep absorbing until we see a labeled bullet or a clearly new school.
      const complete =
        educationHeaderHasDate(current.headerLines) &&
        (educationHeaderHasDegree(current.headerLines) || current.headerLines.length >= 3);
      const looksLikeNewSchool =
        complete &&
        !isDegreeLikeLine(line) &&
        !isDateOnlyLine(line) &&
        !isEducationLabeledLine(withoutBullet);
      if (looksLikeNewSchool) {
        current = { headerLines: [line], bullets: [] };
        entries.push(current);
      } else {
        current.headerLines.push(line);
      }
      continue;
    }

    if (!educationMode && current && current.bullets.length === 0 && !experienceHeaderReady(current.headerLines)) {
      current.headerLines.push(line);
      continue;
    }

    // Pasted experience often omits • markers. Once the role header has dates,
    // treat following plain lines as bullets until the next role begins.
    if (
      !educationMode &&
      current &&
      experienceHeaderReady(current.headerLines) &&
      !DATE_RANGE_RE.test(line) &&
      !(current.bullets.length > 0 && looksLikeNewExperienceHeader(line))
    ) {
      current.bullets.push(withoutBullet);
      continue;
    }

    const startNew =
      !current ||
      current.bullets.length > 0 ||
      (educationMode ? headerComplete(current.headerLines) : experienceHeaderReady(current.headerLines));
    if (startNew || !current) {
      current = { headerLines: [], bullets: [] };
      entries.push(current);
    }
    current.headerLines.push(line);
  }

  return entries.filter((e) => e.headerLines.length > 0 || e.bullets.length > 0);
}

/**
 * Fold education entries whose "school" is actually an Honors:/Leadership:/
 * Membership: line into the preceding real school (repairs older parses).
 */
export function foldEducationLabeledPhantoms(education: EducationEntry[]): EducationEntry[] {
  const result: EducationEntry[] = [];
  for (const ed of education) {
    const schoolClean = (ed.school || "").replace(BULLET_PREFIX_RE, "").trim();
    if (isEducationLabeledLine(schoolClean) && result.length > 0) {
      const prev = result[result.length - 1];
      const extras = [schoolClean, ...(ed.bullets ?? []).map((b) => b.trim()).filter(Boolean)];
      prev.bullets = [...(prev.bullets ?? []), ...extras];
      continue;
    }
    // Degree line sometimes captured a labeled detail — move it to bullets.
    const degreeClean = (ed.degree || "").replace(BULLET_PREFIX_RE, "").trim();
    if (isEducationLabeledLine(degreeClean)) {
      result.push({
        ...ed,
        degree: "",
        bullets: [degreeClean, ...(ed.bullets ?? [])],
      });
      continue;
    }
    result.push({ ...ed, bullets: [...(ed.bullets ?? [])] });
  }
  return result;
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

function looksLikeLocationLine(line: string): boolean {
  const trimmed = line.trim().replace(/[|]+/g, " ").replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (/^remote$/i.test(trimmed)) return true;
  // "Los Angeles, CA" / "New York, NY"
  if (/^[A-Za-z .'-]+,\s*[A-Z]{2}\.?$/.test(trimmed)) return true;
  // "Los Angeles, California" / "London, United Kingdom"
  if (/^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/.test(trimmed) && trimmed.split(/\s+/).length <= 5) {
    return !isDegreeLikeLine(trimmed) && !ACTION_BULLET_START_RE.test(trimmed);
  }
  return false;
}

function looksLikeJobTitle(line: string): boolean {
  return /\b(Intern|Engineer|Developer|Manager|Analyst|Consultant|Associate|Director|Lead|Scientist|Designer|Architect|Specialist|Coordinator|Officer|President|Fellow)\b/i.test(
    line
  );
}

/** Peel trailing "Remote" / "City, ST" from "MERIDIAN CLOUD SYSTEMS Austin, TX". */
function peelTrailingLocation(text: string): { name: string; location: string } {
  const trimmed = text.trim();
  const remote = trimmed.match(/\s+(Remote)\s*$/i);
  if (remote && remote.index !== undefined) {
    return { name: trimmed.slice(0, remote.index).trim(), location: "Remote" };
  }
  // Prefer Title-Case city names so we don't swallow ALL-CAPS org words
  // ("UCLA ANDERSON SCHOOL OF MANAGEMENT Los Angeles, CA").
  const citySt = trimmed.match(
    /\s+([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\.?)\s*$/
  );
  if (citySt && citySt.index !== undefined && citySt.index > 2) {
    const loc = citySt[1].trim();
    if (!/\b(School|University|College|Management|Institute|Systems)\b/i.test(loc)) {
      return { name: trimmed.slice(0, citySt.index).trim(), location: loc };
    }
  }
  return splitNameLocation(trimmed);
}

function parseExperienceEntry(headerLines: string[], bullets: string[]): ExperienceEntry {
  const stripped = headerLines.map(stripDateRange);
  const dateLine = stripped.find((s) => s.startDate);
  const startDate = dateLine?.startDate ?? "";
  const endDate = dateLine?.endDate ?? "";

  let company = "";
  let location = "";
  let title = "";

  const contentLines = stripped
    .map((s) => s.text.replace(/[|]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Markdown / LinkedIn style: "Software Engineer — Meridian Cloud Systems"
  const titleCompany = contentLines[0]?.match(/^(.+?)\s+[—–]\s+(.+)$/);
  if (titleCompany && looksLikeJobTitle(titleCompany[1])) {
    title = titleCompany[1].trim();
    const peeled = peelTrailingLocation(titleCompany[2].trim());
    company = peeled.name;
    location = peeled.location;
    if (contentLines[1] && looksLikeLocationLine(contentLines[1])) {
      location = contentLines[1].trim();
    } else if (contentLines[1] && !location) {
      const locPeel = peelTrailingLocation(contentLines[1]);
      if (locPeel.location) location = locPeel.location;
      else if (looksLikeLocationLine(contentLines[1]) || /^remote$/i.test(contentLines[1])) {
        location = contentLines[1];
      }
    }
    return { id: newId(), company, location, title, startDate, endDate, bullets };
  }

  if (contentLines.length >= 3 && looksLikeLocationLine(contentLines[1])) {
    // Anderson: Company / Location / Title [/ Dates]
    const peeled = peelTrailingLocation(contentLines[0]);
    company = peeled.name;
    location = peeled.location || contentLines[1];
    title = contentLines[2];
  } else if (contentLines.length >= 2) {
    // "COMPANY City, ST" + "Title" (+ dates already stripped)
    const peeled = peelTrailingLocation(contentLines[0]);
    company = peeled.name;
    location = peeled.location;
    title = contentLines[1];
    if (!location && contentLines.length >= 3 && looksLikeLocationLine(contentLines[2])) {
      location = contentLines[2];
    }
  } else if (contentLines.length === 1) {
    const [left, right] = splitDelimited(contentLines[0]);
    if (right) {
      const peeled = peelTrailingLocation(left);
      company = peeled.name;
      location = peeled.location;
      title = right;
    } else {
      const peeled = peelTrailingLocation(left);
      company = peeled.name;
      location = peeled.location;
    }
  }

  return { id: newId(), company, location, title, startDate, endDate, bullets };
}

function leadershipToVolunteerLines(headerLines: string[], bullets: string[]): string[] {
  const exp = parseExperienceEntry(headerLines, bullets);
  const roleOrg = [exp.title, exp.company].filter(Boolean).join(", ");
  const dates = [exp.startDate, exp.endDate].filter(Boolean).join(" - ");
  const head = [roleOrg, dates].filter(Boolean).join(" · ");
  const lines: string[] = [];
  if (head) lines.push(head);
  for (const b of bullets) {
    if (b.trim()) lines.push(b.trim());
  }
  return lines;
}

function parseEducationEntry(headerLines: string[], bullets: string[]): EducationEntry {
  const stripped = headerLines.map(stripSingleOrRangeDate);
  const dateLine = stripped.find((s) => s.date);
  const gradDate = dateLine?.date ?? "";

  let school = "";
  let location = "";
  let degreeLine = "";

  const contentLines = stripped
    .map((s) => s.text.replace(/[|]+/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Markdown style often lists degree first, then school.
  if (contentLines.length >= 2 && isDegreeLikeLine(contentLines[0]) && !isDegreeLikeLine(contentLines[1])) {
    degreeLine = contentLines[0];
    const schoolLine = contentLines[1]
      .replace(/\bGraduated\b/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const peeled = peelTrailingLocation(schoolLine);
    school = peeled.name;
    location = peeled.location;
    if (contentLines[2] && looksLikeLocationLine(contentLines[2])) {
      location = contentLines[2];
    }
  } else if (contentLines.length >= 2) {
    const peeled = peelTrailingLocation(contentLines[0]);
    school = peeled.name;
    location = peeled.location;
    if (contentLines.length >= 3 && looksLikeLocationLine(contentLines[1])) {
      location = location || contentLines[1];
      degreeLine = contentLines.slice(2).join(", ");
    } else {
      degreeLine = contentLines.slice(1).join(", ");
    }
  } else if (contentLines.length === 1) {
    // A single header line often packs "School — Degree, Field, GPA X.X" onto one line.
    const [left, right] = splitDelimited(contentLines[0]);
    const peeled = peelTrailingLocation(left);
    school = peeled.name;
    location = peeled.location;
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

  // Anderson shape: degree + program/major live in one "degree" string.
  let degree = degreeLine;
  const inMatch = degreeLine.match(/^(.*?)\s+in\s+(.*)$/i);
  if (inMatch) {
    degree = `${inMatch[1].trim()}, ${inMatch[2].trim()}`;
  }

  const eduBullets = [...bullets];
  if (gpa) eduBullets.unshift(`GPA: ${gpa}`);
  if (honors) eduBullets.unshift(`Honors: ${honors}`);

  return { id: newId(), school, location, degree, gradDate, bullets: eduBullets };
}

// Note: use "Memberships" (plural) only — Anderson education uses "Membership:"
// which must stay on the school, not become Additional → Volunteer.
// Put Frameworks/Tools before Tools so "Frameworks/Tools:" is not split mid-label.
const SKILL_LABEL_LINE_RE =
  /^(certifications?|licenses?|frameworks\/tools|frameworks|practices|languages?|software|tools?|technologies|technical skills?|skills?|volunteer(?:ing)?|memberships|activities|interests?|hobbies)\s*:\s*(.*)$/i;

/** Inline / mid-paragraph Additional labels (common in pasted resume text). */
// Negative lookbehind avoids matching "Tools:" inside "Frameworks/Tools:".
const INLINE_SKILL_LABEL_RE =
  /(?<![A-Za-z/])(Certifications?|Licenses?|Frameworks\/Tools|Frameworks|Practices|Languages?|Software|Tools?|Technologies|Technical Skills?|Skills?|Volunteer(?:ing)?|Memberships|Interests?|Hobbies)\s*:\s*/gi;

const SECTION_BOUNDARY_RE = /\b(?:EDUCATION|EXPERIENCE|ADDITIONAL|SKILLS(?:\s*(?:&|AND)\s*INTERESTS)?)\b/i;

const SKILL_LABEL_SPLIT_RE =
  /(?=(?<![A-Za-z/])(?:Certifications?|Licenses?|Frameworks\/Tools|Frameworks|Practices|Languages?|Software|Tools?|Technologies|Skills?|Volunteer(?:ing)?|Memberships|Interests?|Hobbies)\s*:)/i;

/** Split "Certifications: A; Languages: B; Software: C, D" into labeled rows. */
function expandMultiLabelSkillLines(line: string): string[] {
  const parts = line
    .split(SKILL_LABEL_SPLIT_RE)
    .map((p) => p.trim().replace(/^[;|,\-–—]+\s*/, ""))
    .filter(Boolean);
  return parts.length > 0 ? parts : [line];
}

/** Split skill lists on commas/semicolons without breaking "AWS (EC2, S3, RDS)". */
function splitSkillItems(body: string): string[] {
  const items: string[] = [];
  let current = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;•|]/.test(ch)) {
      const cleaned = sanitizeAndersonFieldValue(current);
      if (cleaned && !/^[\.…]{2,}$/.test(cleaned) && !SECTION_GUIDANCE_RE.test(cleaned)) {
        items.push(cleaned);
      }
      current = "";
      continue;
    }
    current += ch;
  }
  const tail = sanitizeAndersonFieldValue(current);
  if (tail && !/^[\.…]{2,}$/.test(tail) && !SECTION_GUIDANCE_RE.test(tail)) {
    items.push(tail);
  }
  return items;
}

function parseSkillsSection(lines: string[]): SkillsAndInterests {
  const certifications: string[] = [];
  const languages: string[] = [];
  const software: string[] = [];
  const volunteer: string[] = [];
  const interests: string[] = [];

  for (const rawLine of lines) {
    const base = rawLine.replace(BULLET_PREFIX_RE, "").trim();
    if (!base || SECTION_GUIDANCE_RE.test(base)) continue;

    for (const line of expandMultiLabelSkillLines(base)) {
      if (!line || SECTION_GUIDANCE_RE.test(line)) continue;

      const labelMatch = line.match(/^([A-Za-z][A-Za-z &/]*):\s*(.*)$/);
      const label = labelMatch?.[1]?.toLowerCase() ?? "";
      const body = labelMatch ? labelMatch[2] : line;
      const items = splitSkillItems(body);
      if (!items.length) continue;

      if (label.includes("language") || (!labelMatch && /language/i.test(line))) {
        languages.push(...items);
      } else if (label.includes("interest") || label.includes("hobbies") || (!labelMatch && /interests?:/i.test(line))) {
        interests.push(...items);
      } else if (label.includes("certif") || label.includes("license")) {
        certifications.push(...items);
      } else if (
        label.includes("software") ||
        label.includes("tool") ||
        label.includes("framework") ||
        label.includes("practice") ||
        label.includes("technolog") ||
        label.includes("skill")
      ) {
        software.push(...items);
      } else if (
        label.includes("volunteer") ||
        label.includes("activit") ||
        label.includes("leadership") ||
        label.includes("membership")
      ) {
        volunteer.push(...items);
      } else {
        // Unlabeled Additional lines default to software/skills-like items.
        software.push(...items);
      }
    }
  }

  return { certifications, languages, software, volunteer, interests };
}

function skillsItemCount(skills: SkillsAndInterests): number {
  return (
    (skills.certifications?.length ?? 0) +
    (skills.languages?.length ?? 0) +
    (skills.software?.length ?? 0) +
    (skills.volunteer?.length ?? 0) +
    (skills.interests?.length ?? 0)
  );
}

/**
 * Pull Certifications:/Languages:/Software:/… rows from arbitrary resume text,
 * including mid-line and sparsely newline-separated pasted blobs.
 */
export function extractSkillsFromRawText(rawText: string): SkillsAndInterests {
  const labeled: string[] = [];
  const lines = rawText.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));

  for (const rawLine of lines) {
    const cleaned = rawLine.replace(BULLET_PREFIX_RE, "").trim();
    if (!cleaned || isEducationLabeledLine(cleaned)) continue;
    for (const part of expandMultiLabelSkillLines(cleaned)) {
      const partClean = part.trim();
      if (isEducationLabeledLine(partClean)) continue;
      if (SKILL_LABEL_LINE_RE.test(partClean)) labeled.push(partClean);
    }
  }

  // Paste blobs with few newlines: scan the whole string for Label: … segments.
  const collapsed = rawText.replace(/\s+/g, " ").trim();
  if (collapsed) {
    const matches = [...collapsed.matchAll(INLINE_SKILL_LABEL_RE)];
    for (let i = 0; i < matches.length; i += 1) {
      const match = matches[i];
      const start = (match.index ?? 0) + match[0].length;
      const end = i + 1 < matches.length ? (matches[i + 1].index ?? collapsed.length) : collapsed.length;
      const label = match[1];
      let body = collapsed.slice(start, end).trim().replace(/[|;]+$/, "").trim();
      // Stop at the next major resume section so we don't swallow Experience/Education.
      const boundary = body.search(SECTION_BOUNDARY_RE);
      if (boundary >= 0) body = body.slice(0, boundary).trim();
      // Keep inline values short — Additional rows are comma lists, not paragraphs.
      if (body.length > 180) body = body.slice(0, 180).replace(/[,;\s]+$/, "").trim();
      if (label && body) labeled.push(`${label}: ${body}`);
    }
  }

  return parseSkillsSection(labeled);
}

/**
 * Pull Anderson-style Additional rows that were absorbed into Experience
 * (common when the ADDITIONAL header was missed or PDF text collapsed).
 */
function salvageSkillsFromExperience(experience: ExperienceEntry[]): {
  experience: ExperienceEntry[];
  skills: SkillsAndInterests;
} {
  const skillLines: string[] = [];
  const kept: ExperienceEntry[] = [];

  for (const entry of experience) {
    const company = entry.company.replace(BULLET_PREFIX_RE, "").trim();
    const title = entry.title.replace(BULLET_PREFIX_RE, "").trim();
    const bareSkillLabel = /^(certifications?|languages?|software|volunteer|interests?)$/i;
    const companyIsSkill = SKILL_LABEL_LINE_RE.test(company) || bareSkillLabel.test(company);
    const titleIsSkill = SKILL_LABEL_LINE_RE.test(title) || bareSkillLabel.test(title);

    if (companyIsSkill || titleIsSkill) {
      const labelSource = companyIsSkill ? company : title;
      if (SKILL_LABEL_LINE_RE.test(labelSource)) {
        skillLines.push(labelSource);
      } else {
        const values = entry.bullets
          .map((b) => b.replace(BULLET_PREFIX_RE, "").trim())
          .filter((b) => b && !SKILL_LABEL_LINE_RE.test(b));
        if (values.length) skillLines.push(`${labelSource}: ${values.join(", ")}`);
      }
      for (const b of entry.bullets) {
        const cleaned = b.replace(BULLET_PREFIX_RE, "").trim();
        if (SKILL_LABEL_LINE_RE.test(cleaned)) skillLines.push(cleaned);
      }
      continue;
    }

    const remainingBullets: string[] = [];
    for (const b of entry.bullets) {
      const cleaned = b.replace(BULLET_PREFIX_RE, "").trim();
      if (SKILL_LABEL_LINE_RE.test(cleaned)) skillLines.push(cleaned);
      else remainingBullets.push(b);
    }

    // Drop empty phantom "jobs" created from skill labels.
    if (!entry.company && !entry.title && remainingBullets.length === 0) continue;

    kept.push({ ...entry, bullets: remainingBullets });
  }

  return { experience: kept, skills: parseSkillsSection(skillLines) };
}

function emptySkills(): SkillsAndInterests {
  return {
    certifications: [],
    languages: [],
    software: [],
    volunteer: [],
    interests: [],
  };
}

function dedupeStrings(values: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function mergeSkills(a: SkillsAndInterests, b: SkillsAndInterests): SkillsAndInterests {
  return {
    certifications: dedupeStrings([...(a.certifications ?? []), ...(b.certifications ?? [])]),
    languages: dedupeStrings([...(a.languages ?? []), ...(b.languages ?? [])]),
    software: dedupeStrings([...(a.software ?? []), ...(b.software ?? [])]),
    volunteer: dedupeStrings([...(a.volunteer ?? []), ...(b.volunteer ?? [])]),
    interests: dedupeStrings([...(a.interests ?? []), ...(b.interests ?? [])]),
  };
}

/**
 * Move mis-filed Additional rows (Certifications:/Languages:/…) out of
 * Experience into skillsAndInterests. Always peels labeled skill bullets from
 * experience entries; merges into any skills already present.
 */
export function recoverAdditionalFromExperience(resume: ResumeData): ResumeData {
  const { experience, skills } = salvageSkillsFromExperience(resume.experience);
  if (skillsItemCount(skills) === 0) return resume;
  return {
    ...resume,
    experience,
    skillsAndInterests: mergeSkills(resume.skillsAndInterests, skills),
  };
}

/** Repair education entries on already-parsed drafts (phantom Honors schools, etc.). */
export function recoverEducationLabeledBullets(resume: ResumeData): ResumeData {
  const folded = foldEducationLabeledPhantoms(resume.education);
  if (
    folded.length === resume.education.length &&
    folded.every(
      (ed, i) =>
        ed.school === resume.education[i].school &&
        JSON.stringify(ed.bullets ?? []) === JSON.stringify(resume.education[i].bullets ?? [])
    )
  ) {
    return resume;
  }
  return { ...resume, education: folded };
}

export function extractResumeHeuristically(rawText: string): ResumeData {
  const normalized = normalizeResumeText(rawText);
  const lines = normalized.split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const { preamble, sections } = splitIntoSections(lines);
  const contact = extractContact(preamble);

  const education: EducationEntry[] = [];
  const experience: ExperienceEntry[] = [];
  let skillsAndInterests: SkillsAndInterests = emptySkills();

  for (const section of sections) {
    if (section.key === "skip") continue;
    if (section.key === "skills") {
      skillsAndInterests = mergeSkills(skillsAndInterests, parseSkillsSection(section.lines));
      continue;
    }

    const entries = groupIntoEntries(section.lines, {
      educationMode: section.key === "education",
    });
    if (section.key === "education") {
      for (const e of entries) education.push(parseEducationEntry(e.headerLines, e.bullets));
      const folded = foldEducationLabeledPhantoms(education);
      education.length = 0;
      education.push(...folded);
    } else if (section.key === "experience") {
      for (const e of entries) experience.push(parseExperienceEntry(e.headerLines, e.bullets));
    } else if (section.key === "leadership") {
      // Fold into Additional → Volunteer (Anderson has no separate Leadership section).
      const volunteerLines: string[] = [];
      for (const e of entries) {
        volunteerLines.push(...leadershipToVolunteerLines(e.headerLines, e.bullets));
      }
      skillsAndInterests = mergeSkills(skillsAndInterests, { volunteer: volunteerLines });
    }
  }

  // Rescue Additional rows that landed in Experience when the header was missed.
  const salvaged = salvageSkillsFromExperience(experience);
  experience.length = 0;
  experience.push(...salvaged.experience);
  skillsAndInterests = mergeSkills(skillsAndInterests, salvaged.skills);

  // Always scan the raw text for labeled Additional rows — pasted submissions
  // often bury Certifications:/Languages:/Software: inside Experience or in a
  // single blob without a clear ADDITIONAL header.
  skillsAndInterests = mergeSkills(skillsAndInterests, extractSkillsFromRawText(normalized));

  // No EDUCATION/EXPERIENCE headers (or only an ADDITIONAL/Skills block) — the job
  // and school lines usually sit in the preamble. Previously we skipped this path
  // whenever any skill labels were found, which produced Additional-only resumes
  // on the GitHub Pages heuristic path.
  if (!education.length && !experience.length) {
    const bodyLines = freeformBodyLines(preamble.length ? preamble : lines, contact);
    if (bodyLines.length) {
      const entries = groupIntoEntries(bodyLines, { educationMode: false });
      for (const entry of entries) {
        if (looksLikeEducationEntry(entry)) {
          education.push(parseEducationEntry(entry.headerLines, entry.bullets));
        } else {
          experience.push(parseExperienceEntry(entry.headerLines, entry.bullets));
        }
      }
      if (education.length) {
        const folded = foldEducationLabeledPhantoms(education);
        education.length = 0;
        education.push(...folded);
      }
      // Skill-label rows that slipped into freeform entries → Additional.
      const salvagedFreeform = salvageSkillsFromExperience(experience);
      experience.length = 0;
      experience.push(...salvagedFreeform.experience);
      skillsAndInterests = mergeSkills(skillsAndInterests, salvagedFreeform.skills);

      // Last resort: keep the pasted body rather than returning Additional alone.
      if (!education.length && !experience.length) {
        experience.push({
          id: newId(),
          company: "",
          location: "",
          title: "",
          startDate: "",
          endDate: "",
          bullets: bodyLines
            .map((l) => l.replace(BULLET_PREFIX_RE, "").trim())
            .filter(Boolean)
            .slice(0, 20),
        });
      }
    }
  }

  // Anderson format: every school always shows Honors / Leadership / Membership,
  // and Additional always shows all five category rows.
  return ensureAndersonAdditionalRows(
    ensureAndersonEducationBullets({ contact, education, experience, skillsAndInterests })
  );
}

/** Lines that look like real background content (not contact / Additional labels). */
function freeformBodyLines(sourceLines: string[], contact: ContactInfo): string[] {
  return sourceLines.filter((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (index === 0 && contact.name && trimmed === contact.name) return false;
    if (contact.email && trimmed.includes(contact.email) && trimmed.length < contact.email.length + 40) {
      // Contact/meta line — skip when it's mostly contact tokens.
      const withoutContact = trimmed
        .replace(EMAIL_RE, "")
        .replace(PHONE_RE, "")
        .replace(LINKEDIN_RE, "")
        .replace(/[|,\s]+/g, "")
        .trim();
      if (!withoutContact) return false;
    }
    const withoutBullet = trimmed.replace(BULLET_PREFIX_RE, "").trim();
    if (SKILL_LABEL_LINE_RE.test(withoutBullet)) return false;
    const section = detectSection(trimmed);
    if (section?.key === "skills") return false;
    return true;
  });
}

function looksLikeEducationEntry(entry: RawEntry): boolean {
  const first = (entry.headerLines[0] || "").trim();
  // Achievement lines must not be reclassified as schools when a university
  // name appears later in a freeform blob.
  if (ACTION_BULLET_START_RE.test(first)) return false;
  const header = entry.headerLines.join(" ");
  if (isDegreeLikeLine(header)) return true;
  if (entry.bullets.some((b) => isEducationLabeledLine(b))) return true;
  return /\b(University|College|School of|Institute of Technology|UCLA|USC|Stanford|Harvard|MIT|Anderson)\b/i.test(
    first
  );
}

/** Soft-wrapped fragment continuing the previous bullet (common in PDF extract). */
function looksLikeBulletContinuation(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[a-z]/.test(trimmed)) return true;
  if (DATE_RANGE_RE.test(trimmed) || SINGLE_DATE_RE.test(trimmed)) return false;
  if (ACTION_BULLET_START_RE.test(trimmed)) return false;
  if (looksLikeLocationLine(trimmed) || /^remote$/i.test(trimmed)) return false;
  // Short lowercase-heavy fragments after a wrap ("reporting tool", "product decisions").
  const words = trimmed.split(/\s+/);
  if (words.length <= 4 && !/^[A-Z]{2,}(?:\s+[A-Z]{2,})+$/.test(trimmed)) {
    const lower = words.filter((w) => /^[a-z]/.test(w) || /^[a-z]+$/.test(w)).length;
    if (lower >= Math.ceil(words.length / 2)) return true;
  }
  return false;
}

/** True when a trailing "." is a sentence end, not "Co." / "Inc." / "Ltd.". */
function endsLikeSentence(line: string): boolean {
  const trimmed = line.trim();
  if (/[!?]$/.test(trimmed)) return true;
  if (!/\.$/.test(trimmed)) return false;
  if (/\b(Co|Inc|Ltd|LLC|Corp|Univ|Dept|U\.?S|U\.?K)\.$/i.test(trimmed)) return false;
  return true;
}

/** Next role after bullets — org/title line, not an achievement sentence. */
function looksLikeNewExperienceHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 90) return false;
  if (/^[a-z]/.test(trimmed)) return false;
  if (looksLikeBulletContinuation(trimmed)) return false;
  if (endsLikeSentence(trimmed)) return false;
  if (ACTION_BULLET_START_RE.test(trimmed)) return false;
  // Markdown / LinkedIn: "Software Engineer — Meridian Cloud Systems"
  if (/\s+[—–]\s+/.test(trimmed) && looksLikeJobTitle(trimmed)) return true;
  if (DATE_RANGE_RE.test(trimmed)) return true;
  const words = trimmed.split(/\s+/).filter((w) => !/^[—–-]+$/.test(w));
  if (words.length >= 6) return false;
  return true;
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

/** Lightweight verb swaps so heuristic regenerate still changes visible wording. */
const LEAD_VERB_ALTERNATES: Record<string, string[]> = {
  led: ["Directed", "Spearheaded", "Championed"],
  managed: ["Oversaw", "Coordinated", "Ran"],
  developed: ["Built", "Created", "Designed"],
  created: ["Developed", "Built", "Established"],
  built: ["Developed", "Created", "Engineered"],
  improved: ["Increased", "Strengthened", "Enhanced"],
  increased: ["Grew", "Expanded", "Improved"],
  reduced: ["Cut", "Decreased", "Lowered"],
  analyzed: ["Evaluated", "Assessed", "Examined"],
  designed: ["Developed", "Architected", "Created"],
  launched: ["Introduced", "Rolled out", "Initiated"],
  drove: ["Led", "Pushed", "Advanced"],
  owned: ["Led", "Managed", "Directed"],
  collaborated: ["Partnered", "Worked", "Coordinated"],
  implemented: ["Deployed", "Executed", "Rolled out"],
  delivered: ["Shipped", "Completed", "Produced"],
};

function paraphraseBullet(text: string, salt: number): string {
  const match = text.match(/^([A-Za-z]+)(.*)$/);
  if (!match) return text;
  const [, first, rest] = match;
  const key = first.toLowerCase();
  const alts = LEAD_VERB_ALTERNATES[key];
  if (!alts || alts.length === 0) return text;
  const replacement = alts[Math.abs(salt) % alts.length];
  if (replacement.toLowerCase() === key) return text;
  return `${replacement}${rest}`;
}

function reorderBullets(
  bullets: string[] | undefined,
  keywords: Keyword[],
  regenerate = false
): string[] {
  if (!bullets || bullets.length === 0) return bullets ?? [];
  if (bullets.length === 1) {
    return regenerate ? [paraphraseBullet(bullets[0], 1)] : bullets;
  }
  const ordered = bullets
    .map((text, index) => ({ text, index, s: score(text, keywords) }))
    .sort((a, b) => b.s - a.s || (regenerate ? b.index - a.index : a.index - b.index))
    .map((x) => x.text);
  if (!regenerate) return ordered;
  // Rotate lead bullet and paraphrase opening verbs so a regenerate pass is
  // visibly different even without a live LLM.
  const rotated = [...ordered.slice(1), ordered[0]];
  return rotated.map((b, i) => paraphraseBullet(b, i + 1));
}

function reorderByRelevance(
  items: string[] | undefined,
  keywords: Keyword[],
  regenerate = false
): string[] {
  if (!items || items.length <= 1) return items ?? [];
  const ordered = [...items].sort((a, b) => score(b, keywords) - score(a, keywords));
  return regenerate ? [...ordered].reverse() : ordered;
}

export function tailorResumeHeuristically(
  resume: ResumeData,
  jobPosting: JobPosting,
  options: { regenerate?: boolean } = {}
): ResumeData {
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
  const regenerate = !!options.regenerate;

  return {
    contact: resume.contact,
    education: resume.education.map((ed) => ({
      ...ed,
      bullets: reorderBullets(ed.bullets, keywords, regenerate),
    })),
    experience: resume.experience.map((ex) => ({
      ...ex,
      bullets: reorderBullets(ex.bullets, keywords, regenerate),
    })),
    skillsAndInterests: {
      certifications: reorderByRelevance(resume.skillsAndInterests?.certifications, keywords, regenerate),
      languages: resume.skillsAndInterests?.languages ?? [],
      software: reorderByRelevance(resume.skillsAndInterests?.software, keywords, regenerate),
      volunteer: reorderByRelevance(resume.skillsAndInterests?.volunteer, keywords, regenerate),
      interests: resume.skillsAndInterests?.interests ?? [],
    },
  };
}
