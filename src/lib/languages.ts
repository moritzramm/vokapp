/** Suggestions for the language fields. Any other value can be typed in. */
export const COMMON_LANGUAGES = ['Deutsch', 'Englisch', 'Französisch'];

export function languagePairLabel(source: string, target: string): string {
  return `${source} → ${target}`;
}
