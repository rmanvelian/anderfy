// Detects when AI-rewritten bullet text introduces a number that wasn't
// present anywhere in the original bullets it's rewriting — a strong signal
// of a fabricated metric (e.g. a made-up percentage or dollar figure).
// Tolerant of reformatting (e.g. "$50,000" vs "50k" both normalize to 50000).

const NUMBER_TOKEN_RE = /\$?\d[\d,]*(?:\.\d+)?\s*(?:%|k|m|bn|b)?\b/gi;

const MULTIPLIERS: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, bn: 1e9 };

function normalizeToken(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const isPercent = trimmed.endsWith("%");
  const suffixMatch = trimmed.match(/(k|bn|m|b)$/);
  const numericPart = trimmed
    .replace(/[$,%]/g, "")
    .replace(/(k|bn|m|b)$/, "")
    .trim();
  if (!numericPart || Number.isNaN(Number(numericPart))) return null;
  let value = Number(numericPart);
  if (suffixMatch) value *= MULTIPLIERS[suffixMatch[1]] ?? 1;
  return isPercent ? `${value}%` : `${value}`;
}

export function extractNumberTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const match of text.matchAll(NUMBER_TOKEN_RE)) {
    const normalized = normalizeToken(match[0]);
    if (normalized) tokens.add(normalized);
  }
  return tokens;
}

/**
 * Returns true if any bullet in `newBullets` contains a number not found in
 * any bullet of `sourceBullets` — i.e. a likely-fabricated figure.
 */
export function introducesUnverifiedNumbers(newBullets: string[], sourceBullets: string[]): boolean {
  const allowed = new Set<string>();
  for (const b of sourceBullets) for (const t of extractNumberTokens(b)) allowed.add(t);

  for (const bullet of newBullets) {
    for (const token of extractNumberTokens(bullet)) {
      if (!allowed.has(token)) return true;
    }
  }
  return false;
}
