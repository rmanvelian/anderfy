/**
 * Strip markdown / paste artifacts (*, #, backticks, etc.) from Anderson
 * labeled-field values (Honors, Leadership, Membership, Certifications,
 * Languages, Software, Volunteer, Interests) while preserving normal
 * punctuation and tech tokens like C# / F#.
 */
export function sanitizeAndersonFieldValue(value: string): string {
  let s = value.trim();
  if (!s) return "";

  // Unwrap common markdown emphasis / code spans (repeat for nesting).
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

  // Drop leading list / heading markers from paste/markdown.
  s = s.replace(/^[#*_>•▪◦·●○\-–—]+\s*/, "");

  // Remove remaining asterisks (decorative; not used in these field values).
  s = s.replace(/\*/g, "");

  // Remove # except when part of a token like C# / F# (alnum immediately before #).
  let withoutHash = "";
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (ch === "#") {
      const prev = i > 0 ? s[i - 1] : "";
      if (/[A-Za-z0-9]/.test(prev)) withoutHash += ch;
      continue;
    }
    withoutHash += ch;
  }
  s = withoutHash;

  return s.replace(/\s+/g, " ").trim();
}

export function sanitizeAndersonFieldList(values: string[] | undefined): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const cleaned = sanitizeAndersonFieldValue(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}
