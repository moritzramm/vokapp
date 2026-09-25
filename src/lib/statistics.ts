import { isDifficult } from './scheduler';
import type { LearningEvent, Vocabulary } from './types';

export interface DailyActivity {
  date: string; // YYYY-MM-DD, local time
  correct: number;
  incorrect: number;
}

export interface Statistics {
  totalVocabularies: number;
  correctAnswers: number;
  incorrectAnswers: number;
  /** 0..1, null if nothing has been answered yet */
  accuracy: number | null;
  difficultCount: number;
  neverAskedCount: number;
  recentlyLearned: Vocabulary[];
  activity: DailyActivity[];
}

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeStatistics(vocabularies: Vocabulary[], events: LearningEvent[], days: number, now = new Date()): Statistics {
  const correctAnswers = vocabularies.reduce((sum, v) => sum + v.correctCount, 0);
  const incorrectAnswers = vocabularies.reduce((sum, v) => sum + v.incorrectCount, 0);
  const answered = correctAnswers + incorrectAnswers;

  const activity: DailyActivity[] = [];
  const byDate = new Map<string, DailyActivity>();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const entry = { date: localDateKey(day), correct: 0, incorrect: 0 };
    activity.push(entry);
    byDate.set(entry.date, entry);
  }
  for (const event of events) {
    const entry = byDate.get(localDateKey(new Date(event.createdAt)));
    if (!entry) continue;
    if (event.wasCorrect) entry.correct++;
    else entry.incorrect++;
  }

  return {
    totalVocabularies: vocabularies.length,
    correctAnswers,
    incorrectAnswers,
    accuracy: answered ? correctAnswers / answered : null,
    difficultCount: vocabularies.filter(isDifficult).length,
    neverAskedCount: vocabularies.filter((v) => !v.lastAskedAt).length,
    recentlyLearned: vocabularies
      .filter((v) => v.lastAskedAt)
      .sort((a, b) => Date.parse(b.lastAskedAt ?? '') - Date.parse(a.lastAskedAt ?? ''))
      .slice(0, 8),
    activity,
  };
}
