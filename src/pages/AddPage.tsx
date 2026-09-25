import { useRef, useState } from 'react';
import { focusWhenReady } from '../components/fields';
import { VocabularyForm } from '../components/VocabularyForm';
import { toUserMessage } from '../lib/errors';
import { readSetting, writeSetting } from '../lib/settings';
import { notify } from '../lib/toast';
import type { Vocabulary, VocabularyInput } from '../lib/types';
import { duplicateKey } from '../lib/validation';
import { useVocabulary } from '../hooks/useVocabulary';
import { InlineError } from './VocabularyListPage';

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
  // Only for this visit of the page; the data itself is in Supabase.
  const [added, setAdded] = useState<Vocabulary[]>([]);

  const isDuplicate = value.question.trim() !== '' && vocabularies.some((v) => duplicateKey(v) === duplicateKey(value));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      // The user id is taken from the authenticated session inside the provider.
      const created = await create(value);
      writeSetting<LastPair>('lastLanguagePair', { sourceLanguage: value.sourceLanguage.trim(), targetLanguage: value.targetLanguage.trim() });
      notify(`„${created.question}“ hinzugefügt.`);
      setAdded((list) => [created, ...list]);
      setValue((v) => ({ ...v, question: '', answer: '' }));
      focusWhenReady(questionRef.current);
    } catch (e) {
      // Keep the input so nothing typed is lost.
      setError(toUserMessage(e, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  };

  // Rows deleted elsewhere disappear from the "just added" list as well.
  const stillThere = added.filter((a) => vocabularies.some((v) => v.id === a.id));

  return (
    <div className="add-layout">
      <div className="panel">
        <VocabularyForm questionRef={questionRef} value={value} onChange={setValue} onSubmit={save}>
          {isDuplicate ? <p className="field-note">Diese Vokabel gibt es für dieses Sprachpaar schon. Du kannst sie trotzdem speichern.</p> : null}
          {error ? <InlineError>{error}</InlineError> : null}
          <wa-button type="submit" variant="brand" size="l" loading={busy} className="full-width">
            Speichern
          </wa-button>
        </VocabularyForm>
      </div>

      {stillThere.length ? (
        <section className="stack-section" aria-labelledby="added-heading">
          <h2 id="added-heading" className="section-title">
            Gerade hinzugefügt
          </h2>
          <ul className="grouped-list">
            {stillThere.map((v) => (
              <li key={v.id} className="grouped-row">
                <span className="row-main">
                  <span className="row-title">{v.question}</span>
                  <span className="row-sub">{v.answer}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
