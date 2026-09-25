import { useMemo, type FormEvent, type RefObject } from 'react';
import type { VocabularyInput } from '../lib/types';
import { LIMITS } from '../lib/validation';
import { useVocabulary } from '../hooks/useVocabulary';
import { valueOf } from './fields';
import { LanguageField } from './LanguageField';

interface Props {
  id?: string;
  value: VocabularyInput;
  /** Functional update, so fast consecutive inputs (e.g. autofill) never overwrite each other. */
  onChange: (update: (current: VocabularyInput) => VocabularyInput) => void;
  onSubmit: () => void;
  /** Receives the "Vokabel" input, e.g. to focus it after saving. */
  questionRef?: RefObject<Focusable | null>;
  children?: React.ReactNode;
}

type Focusable = { focus: () => void };

export function useUsedLanguages(): string[] {
  const { vocabularies } = useVocabulary();
  return useMemo(() => {
    const set = new Set<string>();
    for (const v of vocabularies) {
      set.add(v.sourceLanguage);
      set.add(v.targetLanguage);
    }
    return [...set];
  }, [vocabularies]);
}

/** Shared by "Hinzufügen" and the edit dialog. Ownership is never part of the form. */
export function VocabularyForm({ id, value, onChange, onSubmit, questionRef, children }: Props) {
  const usedLanguages = useUsedLanguages();
  const set = (patch: Partial<VocabularyInput>) => onChange((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form id={id} className="vocab-form wa-stack wa-gap-l" onSubmit={submit}>
      <div className="language-pair">
        <LanguageField label="Ausgangssprache" value={value.sourceLanguage} usedLanguages={usedLanguages} onChange={(sourceLanguage) => set({ sourceLanguage })} />
        <LanguageField label="Zielsprache" value={value.targetLanguage} usedLanguages={usedLanguages} onChange={(targetLanguage) => set({ targetLanguage })} />
      </div>
      <wa-input
        ref={(el: Focusable | null) => {
          if (questionRef) questionRef.current = el;
        }}
        label="Vokabel"
        placeholder="z. B. apple"
        size="l"
        required
        maxlength={LIMITS.text}
        autocapitalize="off"
        enterkeyhint="next"
        value={value.question}
        onInput={(e) => set({ question: valueOf(e) })}
      ></wa-input>
      <wa-input
        label="Übersetzung"
        placeholder="z. B. Apfel"
        size="l"
        required
        maxlength={LIMITS.text}
        autocapitalize="off"
        enterkeyhint="done"
        value={value.answer}
        onInput={(e) => set({ answer: valueOf(e) })}
      ></wa-input>
      {children}
    </form>
  );
}
