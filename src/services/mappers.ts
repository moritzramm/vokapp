import type { LearningEventRecord, VocabularyRecord } from '../lib/database.types';
import type { LearningEvent, Vocabulary } from '../lib/types';

export function toVocabulary(row: VocabularyRecord): Vocabulary {
  return {
    id: row.id,
    sourceLanguage: row.source_language,
    targetLanguage: row.target_language,
    question: row.question,
    answer: row.answer,
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    lastAskedAt: row.last_asked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toLearningEvent(row: Pick<LearningEventRecord, 'id' | 'vocabulary_id' | 'was_correct' | 'created_at'>): LearningEvent {
  return {
    id: row.id,
    vocabularyId: row.vocabulary_id,
    wasCorrect: row.was_correct,
    createdAt: row.created_at,
  };
}
