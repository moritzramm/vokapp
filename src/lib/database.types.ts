// Hand-written equivalent of `supabase gen types typescript` for
// supabase/migrations/001_initial_schema.sql. Regenerate when the schema changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type VocabularyRow = {
  id: string;
  user_id: string;
  source_language: string;
  target_language: string;
  question: string;
  answer: string;
  correct_count: number;
  incorrect_count: number;
  last_asked_at: string | null;
  created_at: string;
  updated_at: string;
};

type LearningEventRow = {
  id: string;
  user_id: string;
  vocabulary_id: string;
  was_correct: boolean;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      vocabulary: {
        Row: VocabularyRow;
        Insert: {
          id?: string;
          user_id: string;
          source_language: string;
          target_language: string;
          question: string;
          answer: string;
          correct_count?: number;
          incorrect_count?: number;
          last_asked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<VocabularyRow>;
        Relationships: [];
      };
      learning_events: {
        Row: LearningEventRow;
        Insert: {
          id?: string;
          user_id: string;
          vocabulary_id: string;
          was_correct: boolean;
          created_at?: string;
        };
        Update: Partial<LearningEventRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      record_answer: {
        Args: {
          p_event_id: string;
          p_vocabulary_id: string;
          p_was_correct: boolean;
          p_answered_at?: string;
        };
        Returns: VocabularyRow | null;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type VocabularyRecord = VocabularyRow;
export type LearningEventRecord = LearningEventRow;
