/**
 * Converts a 2-letter ISO country code into its flag emoji.
 * Works by mapping ASCII letters to their Regional Indicator Symbol equivalents.
 */
export function getFlagEmoji(code: string): string {
  if (code.length !== 2) return "🏳️";
  const base = 127397;
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map((c) => base + c.charCodeAt(0)),
  );
}
