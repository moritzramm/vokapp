import type { LearningMode, Vocabulary } from './types';

/**
 * Card selection for a learning session.
 *
 * Deliberately simple and transparent. To add a real spaced-repetition
 * algorithm (e.g. SM-2) later, implement another SessionStrategy — it gets
 * the full vocabulary list (incl. statistics) and returns the cards in order.
 * Per-card SM-2 state (ease, interval, due date) would become new columns on
 * public.vocabulary; the answer history is already in public.learning_events.
 */
export interface SessionStrategy {
  select(vocabularies: Vocabulary[], size: number, now: Date): Vocabulary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Share of wrong answers, smoothed so a single answer does not dominate (0..1). */
export function errorRate(v: Vocabulary): number {
  return (v.incorrectCount + 1) / (v.correctCount + v.incorrectCount + 2);
}

/**
 * A vocabulary counts as difficult if it was answered wrong at least once and
 * at least a quarter of all answers were wrong.
 */
export function isDifficult(v: Vocabulary): boolean {
  const total = v.correctCount + v.incorrectCount;
  return v.incorrectCount > 0 && v.incorrectCount / total >= 0.25;
}

/**
 * Weight for the "difficult" mode:
 *   smoothed error rate (0..1)
 * + up to 0.3 for cards that have not been asked for a while (30 days = max)
 */
export function difficultyWeight(v: Vocabulary, now: Date): number {
  const daysSinceAsked = v.lastAskedAt ? (now.getTime() - new Date(v.lastAskedAt).getTime()) / DAY_MS : 30;
  const staleness = Math.min(Math.max(daysSinceAsked, 0) / 30, 1) * 0.3;
  return errorRate(v) + staleness;
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Weighted random order without replacement (Efraimidis–Spirakis). */
function weightedOrder<T>(items: readonly T[], weight: (item: T) => number, random = Math.random): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(random(), 1 / Math.max(weight(item), 0.0001)) }))
    .sort((a, b) => b.key - a.key)
    .map((entry) => entry.item);
}

const strategies: Record<LearningMode, SessionStrategy> = {
  all: {
    select: (vocabularies, size) => shuffle(vocabularies).slice(0, size),
  },
  difficult: {
    // Higher weight = more likely to come early and to make it into the session.
    select: (vocabularies, size, now) =>
      weightedOrder(vocabularies.filter(isDifficult), (v) => difficultyWeight(v, now) ** 2).slice(0, size),
  },
};

export function buildSession(mode: LearningMode, vocabularies: Vocabulary[], size: number, now = new Date()): Vocabulary[] {
  return strategies[mode].select(vocabularies, size, now);
}
