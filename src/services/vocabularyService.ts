import type { Vocabulary, VocabularyInput } from '../lib/types';
import { normalizeInput, validateInput } from '../lib/validation';
import { toVocabulary } from './mappers';
import { getSupabase } from './supabase';

const PAGE_SIZE = 1000; // PostgREST returns at most 1000 rows per request by default
const INSERT_CHUNK = 500;

/**
 * All vocabularies of the logged-in user. RLS restricts the result to the
 * caller's rows; no user filter is needed (or trusted) on the client.
 */
export async function getVocabularies(): Promise<Vocabulary[]> {
  const supabase = getSupabase();
  const result: Vocabulary[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    result.push(...data.map(toVocabulary));
    if (data.length < PAGE_SIZE) return result;
  }
}

function toInsertRow(userId: string, input: VocabularyInput) {
  const v = normalizeInput(input);
  const problems = validateInput(v);
  if (problems.length) throw new Error(problems.join(' '));
  return {
    user_id: userId,
    source_language: v.sourceLanguage,
    target_language: v.targetLanguage,
    question: v.question,
    answer: v.answer,
  };
}

/** userId must come from the authenticated session, never from user input. */
export async function createVocabulary(userId: string, input: VocabularyInput): Promise<Vocabulary> {
  const { data, error } = await getSupabase().from('vocabulary').insert(toInsertRow(userId, input)).select().single();
  if (error) throw error;
  return toVocabulary(data);
}

export interface ImportRow extends VocabularyInput {
  correctCount: number;
  incorrectCount: number;
  lastAskedAt: string | null;
}

/** Bulk insert for the JSON import. Statistics are taken over, ownership is not. */
export async function createVocabularies(userId: string, rows: ImportRow[]): Promise<Vocabulary[]> {
  const supabase = getSupabase();
  const created: Vocabulary[] = [];
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK).map((row) => ({
      ...toInsertRow(userId, row),
      correct_count: row.correctCount,
      incorrect_count: row.incorrectCount,
      last_asked_at: row.lastAskedAt,
    }));
    const { data, error } = await supabase.from('vocabulary').insert(chunk).select();
    if (error) throw error;
    created.push(...data.map(toVocabulary));
  }
  return created;
}

export async function updateVocabulary(id: string, input: VocabularyInput): Promise<Vocabulary> {
  const v = normalizeInput(input);
  const problems = validateInput(v);
  if (problems.length) throw new Error(problems.join(' '));
  const { data, error } = await getSupabase()
    .from('vocabulary')
    .update({
      source_language: v.sourceLanguage,
      target_language: v.targetLanguage,
      question: v.question,
      answer: v.answer,
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return toVocabulary(data);
}

export async function deleteVocabulary(id: string): Promise<void> {
  const { error } = await getSupabase().from('vocabulary').delete().eq('id', id);
  if (error) throw error;
}
