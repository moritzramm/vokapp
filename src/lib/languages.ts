/** Suggestions for the language fields. Any other value can be typed in. */
export const COMMON_LANGUAGES = [
  'Deutsch',
  'Englisch',
  'Französisch',
  'Spanisch',
  'Italienisch',
  'Portugiesisch',
  'Niederländisch',
  'Schwedisch',
  'Polnisch',
  'Türkisch',
  'Latein',
  'Japanisch',
  'Chinesisch',
];

export function languagePairLabel(source: string, target: string): string {
  return `${source} → ${target}`;
}
