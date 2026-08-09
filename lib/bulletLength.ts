import { CHARS_PER_BULLET_LINE } from "@/lib/pageFit";

const MAX_BULLET_LINES = 2;
export const MAX_BULLET_CHARS = CHARS_PER_BULLET_LINE * MAX_BULLET_LINES;

/** True if any bullet would likely wrap past two lines in the rendered resume. */
export function exceedsMaxBulletLength(bullets: string[]): boolean {
  return bullets.some((b) => b.length > MAX_BULLET_CHARS);
}
