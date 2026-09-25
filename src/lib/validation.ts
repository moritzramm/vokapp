import type { VocabularyInput } from './types';

// Must match the check constraints in supabase/migrations/001_initial_schema.sql.
export const LIMITS = {
  language: 50,
  text: 500,
} as const;

export function normalizeInput(input: VocabularyInput): VocabularyInput {
  return {
    sourceLanguage: input.sourceLanguage.trim(),
    targetLanguage: input.targetLanguage.trim(),
    question: input.question.trim(),
    answer: input.answer.trim(),
  };
}

/** Returns a list of problems in German; empty when valid. Expects normalized input. */
export function validateInput(input: VocabularyInput): string[] {
  const problems: string[] = [];
  const check = (value: string, label: string, max: number) => {
    if (!value) problems.push(`${label} fehlt.`);
    else if (value.length > max) problems.push(`${label} ist länger als ${max} Zeichen.`);
  };
  check(input.sourceLanguage, 'Ausgangssprache', LIMITS.language);
  check(input.targetLanguage, 'Zielsprache', LIMITS.language);
  check(input.question, 'Vokabel', LIMITS.text);
  check(input.answer, 'Übersetzung', LIMITS.text);
  return problems;
}

/** Key used to detect duplicates (case-insensitive, same language pair and word). */
export function duplicateKey(v: Pick<VocabularyInput, 'sourceLanguage' | 'targetLanguage' | 'question'>): string {
  return [v.sourceLanguage, v.targetLanguage, v.question].map((s) => s.trim().toLocaleLowerCase('de')).join('\u0000');
}
