import { useRef, useState } from 'react';
import { focusWhenReady } from '../components/fields';
import { VocabularyForm } from '../components/VocabularyForm';
import { toUserMessage } from '../lib/errors';
import { readSetting, writeSetting } from '../lib/settings';
import { notify } from '../lib/toast';
import type { VocabularyInput } from '../lib/types';
import { duplicateKey } from '../lib/validation';
import { useVocabulary } from '../hooks/useVocabulary';

interface LastPair {
  sourceLanguage: string;
  targetLanguage: string;
}

export function AddPage() {
  const { create, vocabularies } = useVocabulary();
  const questionRef = useRef<{ focus: () => void } | null>(null);
  const [value, setValue] = useState<VocabularyInput>(() => {
    const last = readSetting<LastPair>('lastLanguagePair', { sourceLanguage: 'Französisch', targetLanguage: 'Deutsch' });
    return { ...last, question: '', answer: '' };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDuplicate = value.question.trim() !== '' && vocabularies.some((v) => duplicateKey(v) === duplicateKey(value));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // The user id is taken from the authenticated session inside the provider.
      await create(value);
      writeSetting<LastPair>('lastLanguagePair', { sourceLanguage: value.sourceLanguage.trim(), targetLanguage: value.targetLanguage.trim() });
      notify(`„${value.question.trim()}“ wurde hinzugefügt.`);
      setValue((v) => ({ ...v, question: '', answer: '' }));
      focusWhenReady(questionRef.current);
    } catch (e) {
      // Keep the input so nothing typed is lost.
      setError(toUserMessage(e, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page-narrow">
      <wa-card>
        <VocabularyForm questionRef={questionRef} value={value} onChange={setValue} onSubmit={save}>
          {isDuplicate ? (
            <wa-callout variant="neutral" size="s">
              <wa-icon slot="icon" name="circle-check"></wa-icon>
              Diese Vokabel gibt es für dieses Sprachpaar bereits. Du kannst sie trotzdem speichern.
            </wa-callout>
          ) : null}
          {error ? (
            <wa-callout variant="danger" size="s">
              <wa-icon slot="icon" name="circle-xmark"></wa-icon>
              {error}
            </wa-callout>
          ) : null}
          <wa-button type="submit" variant="brand" size="l" loading={busy} className="full-width">
            <wa-icon slot="start" name="plus"></wa-icon>
            Vokabel hinzufügen
          </wa-button>
        </VocabularyForm>
      </wa-card>
    </div>
  );
}
