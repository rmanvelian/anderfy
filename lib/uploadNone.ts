/** Placeholder when the candidate's upload has no value for a required Anderson row. */
export const NONE_SPECIFIED_IN_UPLOAD = "(None specified in upload)";

export function isNoneSpecifiedInUpload(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return true;
  if (/^none$/i.test(trimmed)) return true;
  return /^\(?none specified in upload\)?$/i.test(trimmed);
}
