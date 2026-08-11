/**
 * Normalize pasted/uploaded resume text before heuristic parsing.
 * Strips markdown headings/emphasis, drops Summary/Objective bodies, and
 * normalizes dashes so Anderson section detection can see real headers.
 */

const SKIP_SECTION_RE =
  /^(#{1,6}\s*)?(summary|professional summary|objective|profile|about|about me)\s*$/i;

const REAL_SECTION_RE =
  /^(#{1,6}\s*)?(education|experience|work experience|professional experience|relevant experience|employment|skills|skills\s*&\s*interests|skills\s+and\s+interests|additional|additional information|leadership|volunteer|certifications|languages|software|interests)\b/i;

/** Unwrap **, __, *, _, and backticks (repeat for light nesting). */
export function stripMarkdownEmphasis(line: string): string {
  let s = line;
  for (let i = 0; i < 3; i += 1) {
    const next = s
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/_([^_\n]+)_/g, "$1")
      .replace(/`([^`]+)`/g, "$1");
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Strip leading markdown heading markers (#, ##, …). */
export function stripMarkdownHeading(line: string): string {
  return line.replace(/^\s{0,3}#{1,6}\s+/, "");
}

/**
 * Prepare raw resume text for section/entry parsing.
 * Keeps line structure; removes markdown noise; omits Summary/Objective blocks.
 */
export function normalizeResumeText(rawText: string): string {
  const incoming = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out: string[] = [];
  let skipping = false;

  for (const rawLine of incoming.split("\n")) {
    let line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();
    if (!trimmed) {
      if (!skipping) out.push("");
      continue;
    }

    // Detect skippable sections before stripping so "# Summary" still matches.
    if (SKIP_SECTION_RE.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      if (REAL_SECTION_RE.test(trimmed)) {
        skipping = false;
      } else {
        continue;
      }
    }

    line = stripMarkdownHeading(line);
    line = stripMarkdownEmphasis(line);
    // Normalize exotic dashes used in markdown date ranges / title—company.
    line = line.replace(/\u2013|\u2014/g, "—");
    // Drop leftover emphasis-only wrappers like leading/trailing * from italics lines.
    line = line.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "");
    out.push(line);
  }

  return out.join("\n");
}
