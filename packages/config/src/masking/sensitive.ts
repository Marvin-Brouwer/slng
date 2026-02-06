import type { MaskedValue } from "../types.js";

const DEFAULT_VISIBLE_CHARS = 6;

/**
 * Mark a value as sensitive. The first `n` characters are shown,
 * the rest replaced with `*`.
 *
 * @param value  The full string value
 * @param n      Number of leading characters to keep visible (default: 6)
 *
 * @example
 * ```ts
 * import { sensitive } from '@slng/config'
 *
 * sensitive("marvin.brouwer@gmail.com")
 * // Displays: "marvin.*****************"
 *
 * sensitive("marvin.brouwer@gmail.com", 3)
 * // Displays: "mar********************"
 * ```
 */
export function sensitive(value: string, n?: number): MaskedValue {
  const visible = n ?? DEFAULT_VISIBLE_CHARS;
  const prefix = value.slice(0, visible);
  const maskedLength = Math.max(0, value.length - visible);
  const displayValue = prefix + "*".repeat(maskedLength);

  return {
    __masked: true,
    type: "sensitive",
    value,
    displayValue,
  };
}
