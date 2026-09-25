import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { toUserMessage } from '../lib/errors';
import type { Vocabulary, VocabularyInput } from '../lib/types';
import { flushPendingAnswers, pendingAnswerCount } from '../services/learningService';
import * as vocabularyService from '../services/vocabularyService';
import type { ImportRow } from '../services/vocabularyService';

/**
 * Holds the signed-in user's vocabulary in memory. Supabase stays the source
 * of truth: the list is (re)loaded on start, when the tab becomes visible
 * again and when the device comes back online, so changes from other devices
 * show up without a manual reload. All mutations go to Supabase first and
 * update the local list only after success.
 */
interface VocabularyContextValue {
  vocabularies: Vocabulary[];
  loading: boolean;
  /** Last load error (German, user-facing); null if the last load succeeded. */
  error: string | null;
  lastSyncedAt: Date | null;
  pendingAnswers: number;
  reload: () => Promise<void>;
  create: (input: VocabularyInput) => Promise<Vocabulary>;
  createMany: (rows: ImportRow[]) => Promise<Vocabulary[]>;
  update: (id: string, input: VocabularyInput) => Promise<Vocabulary>;
  remove: (id: string) => Promise<void>;
  /** Apply a row returned by the server (e.g. after recording an answer). */
  applyServerRow: (vocabulary: Vocabulary) => void;
  forgetRow: (id: string) => void;
  refreshPending: () => void;
}

const VocabularyContext = createContext<VocabularyContextValue | null>(null);

const MIN_RELOAD_INTERVAL_MS = 15_000;

export function VocabularyProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [vocabularies, setVocabularies] = useState<Vocabulary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [pendingAnswers, setPendingAnswers] = useState(() => pendingAnswerCount(userId));
  const inFlight = useRef<Promise<void> | null>(null);
  const lastLoad = useRef(0);

  const refreshPending = useCallback(() => setPendingAnswers(pendingAnswerCount(userId)), [userId]);

  const reload = useCallback(() => {
    if (inFlight.current) return inFlight.current;
    const run = (async () => {
      try {
        if (pendingAnswerCount(userId)) await flushPendingAnswers(userId);
        const data = await vocabularyService.getVocabularies();
        setVocabularies(data);
        setError(null);
        setLastSyncedAt(new Date());
      } catch (e) {
        // Keep showing the last known data; only report the problem.
        setError(toUserMessage(e, 'Die Vokabeln konnten nicht geladen werden.'));
      } finally {
        lastLoad.current = Date.now();
        setLoading(false);
        refreshPending();
        inFlight.current = null;
      }
    })();
    inFlight.current = run;
    return run;
  }, [userId, refreshPending]);

  useEffect(() => {
    void reload();
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current > MIN_RELOAD_INTERVAL_MS) void reload();
    };
    const onOnline = () => void reload();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
    };
  }, [reload]);

  const create = useCallback(
    async (input: VocabularyInput) => {
      const created = await vocabularyService.createVocabulary(userId, input);
      setVocabularies((list) => [created, ...list]);
      return created;
    },
    [userId],
  );

  const createMany = useCallback(
    async (rows: ImportRow[]) => {
      const created = await vocabularyService.createVocabularies(userId, rows);
      setVocabularies((list) => [...created, ...list]);
      return created;
    },
    [userId],
  );

  const applyServerRow = useCallback((row: Vocabulary) => {
    setVocabularies((list) => list.map((v) => (v.id === row.id ? row : v)));
  }, []);

  const forgetRow = useCallback((id: string) => {
    setVocabularies((list) => list.filter((v) => v.id !== id));
  }, []);

  const update = useCallback(
    async (id: string, input: VocabularyInput) => {
      const updated = await vocabularyService.updateVocabulary(id, input);
      applyServerRow(updated);
      return updated;
    },
    [applyServerRow],
  );

  const remove = useCallback(
    async (id: string) => {
      await vocabularyService.deleteVocabulary(id);
      forgetRow(id);
    },
    [forgetRow],
  );

  const value = useMemo<VocabularyContextValue>(
    () => ({
      vocabularies,
      loading,
      error,
      lastSyncedAt,
      pendingAnswers,
      reload,
      create,
      createMany,
      update,
      remove,
      applyServerRow,
      forgetRow,
      refreshPending,
    }),
    [vocabularies, loading, error, lastSyncedAt, pendingAnswers, reload, create, createMany, update, remove, applyServerRow, forgetRow, refreshPending],
  );

  return <VocabularyContext.Provider value={value}>{children}</VocabularyContext.Provider>;
}

export function useVocabulary(): VocabularyContextValue {
  const value = useContext(VocabularyContext);
  if (!value) throw new Error('useVocabulary outside VocabularyProvider');
  return value;
}
