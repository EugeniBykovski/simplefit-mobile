/** The longest code the backend reads (`MemberSecrets.normalize_join_code`). */
export const JOIN_CODE_MAX_LENGTH = 32;

/**
 * How a typed or pasted code is shown: capitals, with the `ABCD-EFGH` hyphen once
 * it has more than four symbols. For display only: the backend alone decides what
 * is a code (it also reads spaces, lower case and `O`/`I`/`L`), so nothing is
 * rejected or corrected here, and anything longer than a code stays as it was
 * typed for the backend's one answer.
 */
export function formatJoinCode(value: string): string {
  const symbols = value.toUpperCase().replace(/[\s-]/g, "");
  if (symbols.length <= 4 || symbols.length > 8) return value.toUpperCase();
  return `${symbols.slice(0, 4)}-${symbols.slice(4)}`;
}
