export interface Vocabulary {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  question: string;
  answer: string;
  correctCount: number;
  incorrectCount: number;
  lastAskedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Fields a user may edit. Statistics and ownership are never part of it. */
export interface VocabularyInput {
  sourceLanguage: string;
  targetLanguage: string;
  question: string;
  answer: string;
}

export interface LearningEvent {
  id: string;
  vocabularyId: string;
  wasCorrect: boolean;
  createdAt: string;
}

export type LearningMode = 'all' | 'difficult';
