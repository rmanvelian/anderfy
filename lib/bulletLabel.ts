/**
 * The Anderson template italicizes a leading label on certain bullets, e.g.
 * "Honors: ..." / "Leadership: ..." (Education) and "Certifications: ..." /
 * "Languages: ..." (Additional). This splits a bullet string into an
 * italicized label (including the colon) and the remaining plain text, when
 * that pattern is present.
 */
export function splitBulletLabel(bullet: string): { label: string | null; rest: string } {
  const match = bullet.match(/^([A-Za-z][A-Za-z0-9 /&-]{1,30}:)\s*([\s\S]*)$/);
  if (!match) return { label: null, rest: bullet };
  return { label: match[1], rest: match[2] };
}
