import { isNetworkError } from '../lib/errors';
import type { LearningEvent, Vocabulary } from '../lib/types';
import { computeStatistics, type Statistics } from '../lib/statistics';
import { toLearningEvent, toVocabulary } from './mappers';
import { getSupabase } from './supabase';
import { getVocabularies } from './vocabularyService';

/**
 * Answers are persisted immediately via the record_answer RPC. If the cloud is
 * unreachable, the answer is parked in a small outbox in localStorage and sent
 * later. Every answer carries a client-generated id, so a retry is never
 * counted twice (see record_answer in the migration).
 */

interface PendingAnswer {
  eventId: string;
  vocabularyId: string;
  wasCorrect: boolean;
  answeredAt: string;
}

export type RecordResult =
  | { status: 'saved'; vocabulary: Vocabulary }
  | { status: 'queued' }
  | { status: 'deleted' };

const outboxKey = (userId: string) => `vokabel-app:outbox:${userId}`;

function readOutbox(userId: string): PendingAnswer[] {
  try {
    const raw = localStorage.getItem(outboxKey(userId));
    return raw ? (JSON.parse(raw) as PendingAnswer[]) : [];
  } catch {
    return [];
  }
}

function writeOutbox(userId: string, items: PendingAnswer[]): void {
  try {
    if (items.length) localStorage.setItem(outboxKey(userId), JSON.stringify(items));
    else localStorage.removeItem(outboxKey(userId));
  } catch {
    // Storage full or blocked: nothing more we can do locally.
  }
}

export function pendingAnswerCount(userId: string): number {
  return readOutbox(userId).length;
}

async function send(answer: PendingAnswer): Promise<Vocabulary | null> {
  const { data, error } = await getSupabase().rpc('record_answer', {
    p_event_id: answer.eventId,
    p_vocabulary_id: answer.vocabularyId,
    p_was_correct: answer.wasCorrect,
    p_answered_at: answer.answeredAt,
  });
  if (error) throw error;
  // A function returning a NULL composite comes back as null or as an all-null object.
  return data && data.id ? toVocabulary(data) : null;
}

export async function recordAnswer(userId: string, vocabularyId: string, wasCorrect: boolean): Promise<RecordResult> {
  const answer: PendingAnswer = {
    eventId: crypto.randomUUID(),
    vocabularyId,
    wasCorrect,
    answeredAt: new Date().toISOString(),
  };
  try {
    const vocabulary = await send(answer);
    return vocabulary ? { status: 'saved', vocabulary } : { status: 'deleted' };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    writeOutbox(userId, [...readOutbox(userId), answer]);
    return { status: 'queued' };
  }
}

/** Sends queued answers. Returns how many were delivered. Stops at the first network error. */
export async function flushPendingAnswers(userId: string): Promise<number> {
  let queue = readOutbox(userId);
  let delivered = 0;
  while (queue.length) {
    try {
      await send(queue[0]);
    } catch (error) {
      if (isNetworkError(error)) break;
      // Permanent error (e.g. no permission): drop the item instead of blocking the queue.
      console.warn('Dropping pending answer', error);
    }
    queue = queue.slice(1);
    writeOutbox(userId, queue);
    delivered++;
  }
  return delivered;
}

export async function getLearningEvents(sinceDays: number): Promise<LearningEvent[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (sinceDays - 1));
  const { data, error } = await getSupabase()
    .from('learning_events')
    .select('id, vocabulary_id, was_correct, created_at')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;
  return data.map(toLearningEvent);
}

export const ACTIVITY_DAYS = 14;

export async function getStatistics(vocabularies?: Vocabulary[]): Promise<Statistics> {
  const [vocabs, events] = await Promise.all([
    vocabularies ? Promise.resolve(vocabularies) : getVocabularies(),
    getLearningEvents(ACTIVITY_DAYS),
  ]);
  return computeStatistics(vocabs, events, ACTIVITY_DAYS);
}
