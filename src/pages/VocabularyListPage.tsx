import { useDeferredValue, useMemo, useState } from 'react';
import { Dialog } from '../components/Dialog';
import { valueOf } from '../components/fields';
import { AnswerCounts } from '../components/Stat';
import { VocabularyForm } from '../components/VocabularyForm';
import { toUserMessage } from '../lib/errors';
import { languagePairLabel } from '../lib/languages';
import { isDifficult } from '../lib/scheduler';
import { notify } from '../lib/toast';
import type { Vocabulary, VocabularyInput } from '../lib/types';
import { useMediaQuery } from '../hooks/useOnline';
import { href } from '../hooks/useRoute';
import { useVocabulary } from '../hooks/useVocabulary';

const ALL = '__all__';
const pairKey = (v: Pick<Vocabulary, 'sourceLanguage' | 'targetLanguage'>) => encodeURIComponent(`${v.sourceLanguage}\u0000${v.targetLanguage}`);

export function VocabularyListPage() {
  const { vocabularies, loading, update, remove } = useVocabulary();
  const [search, setSearch] = useState('');
  const [pair, setPair] = useState(ALL);
  const deferredSearch = useDeferredValue(search);
  const wide = useMediaQuery('(min-width: 900px)');

  const pairs = useMemo(() => {
    const map = new Map<string, string>();
    for (const v of vocabularies) map.set(pairKey(v), languagePairLabel(v.sourceLanguage, v.targetLanguage));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'de'));
  }, [vocabularies]);

  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLocaleLowerCase('de');
    return vocabularies.filter(
      (v) =>
        (pair === ALL || pairKey(v) === pair) &&
        (!needle || v.question.toLocaleLowerCase('de').includes(needle) || v.answer.toLocaleLowerCase('de').includes(needle)),
    );
  }, [vocabularies, deferredSearch, pair]);

  // Edit / delete dialogs
  const [editing, setEditing] = useState<Vocabulary | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<VocabularyInput | null>(null);
  const [deleting, setDeleting] = useState<Vocabulary | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const startEdit = (v: Vocabulary) => {
    setEditing(v);
    setDraft({ sourceLanguage: v.sourceLanguage, targetLanguage: v.targetLanguage, question: v.question, answer: v.answer });
    setDialogError(null);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing || !draft) return;
    setBusy(true);
    setDialogError(null);
    try {
      await update(editing.id, draft);
      notify('Änderungen gespeichert.');
      setEditOpen(false);
    } catch (e) {
      setDialogError(toUserMessage(e, e instanceof Error ? e.message : undefined));
    } finally {
      setBusy(false);
    }
  };

  const startDelete = (v: Vocabulary) => {
    setDeleting(v);
    setDialogError(null);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDialogError(null);
    try {
      await remove(deleting.id);
      notify(`„${deleting.question}“ wurde gelöscht.`);
      setDeleteOpen(false);
    } catch (e) {
      setDialogError(toUserMessage(e, 'Löschen fehlgeschlagen.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading && vocabularies.length === 0) return <ListSkeleton />;

  if (vocabularies.length === 0) {
    return (
      <EmptyState icon="book" title="Noch keine Vokabeln" text="Lege Deine ersten Vokabeln an – sie stehen danach auf all Deinen Geräten bereit.">
        <wa-button variant="brand" size="l" href={href('neu')}>
          <wa-icon slot="start" name="plus"></wa-icon>
          Vokabel hinzufügen
        </wa-button>
      </EmptyState>
    );
  }

  return (
    <div className="wa-stack wa-gap-l">
      <div className="list-toolbar">
        <wa-input
          type="search"
          placeholder="Suchen"
          aria-label="Vokabeln durchsuchen"
          size="l"
          with-clear
          value={search}
          onInput={(e) => setSearch(valueOf(e))}
        >
          <wa-icon slot="start" name="magnifying-glass"></wa-icon>
        </wa-input>
        <wa-select size="l" aria-label="Nach Sprache filtern" value={pair} onInput={(e) => setPair(valueOf(e) || ALL)}>
          <wa-option value={ALL}>Alle Sprachen</wa-option>
          {pairs.map(([key, label]) => (
            <wa-option key={key} value={key}>
              {label}
            </wa-option>
          ))}
        </wa-select>
      </div>

      <p className="wa-caption-m wa-color-text-quiet" aria-live="polite">
        {filtered.length === vocabularies.length ? `${vocabularies.length} Vokabeln` : `${filtered.length} von ${vocabularies.length} Vokabeln`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState icon="magnifying-glass" title="Nichts gefunden" text="Keine Vokabel passt zu Suche und Filter." />
      ) : wide ? (
        <VocabularyTable items={filtered} onEdit={startEdit} onDelete={startDelete} />
      ) : (
        <ul className="vocab-list wa-list-plain">
          {filtered.map((v) => (
            <li key={v.id}>
              <VocabularyCard v={v} onEdit={startEdit} onDelete={startDelete} />
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editOpen}
        label="Vokabel bearbeiten"
        onClose={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        footer={
          <>
            <wa-button appearance="outlined" size="l" data-dialog="close">
              Abbrechen
            </wa-button>
            <wa-button
              variant="brand"
              size="l"
              loading={busy}
              // The footer lives outside the form; requestSubmit keeps native validation.
              onClick={() => (document.getElementById('edit-vocabulary-form') as HTMLFormElement | null)?.requestSubmit()}
            >
              Speichern
            </wa-button>
          </>
        }
      >
        {draft && editing ? (
          <VocabularyForm key={editing.id} id="edit-vocabulary-form" value={draft} onChange={(update) => setDraft((d) => (d ? update(d) : d))} onSubmit={saveEdit}>
            {dialogError ? (
              <wa-callout variant="danger" size="s">
                <wa-icon slot="icon" name="circle-xmark"></wa-icon>
                {dialogError}
              </wa-callout>
            ) : null}
          </VocabularyForm>
        ) : null}
      </Dialog>

      <Dialog
        open={deleteOpen}
        label="Vokabel löschen?"
        onClose={() => {
          setDeleteOpen(false);
          setDeleting(null);
        }}
        footer={
          <>
            <wa-button appearance="outlined" size="l" data-dialog="close">
              Abbrechen
            </wa-button>
            <wa-button variant="danger" size="l" loading={busy} onClick={confirmDelete}>
              <wa-icon slot="start" name="trash"></wa-icon>
              Löschen
            </wa-button>
          </>
        }
      >
        {deleting ? (
          <div className="wa-stack wa-gap-m">
            <p>
              „<strong>{deleting.question}</strong>“ → „{deleting.answer}“ und die zugehörige Lernstatistik werden auf allen Geräten gelöscht. Das lässt sich nicht
              rückgängig machen.
            </p>
            {dialogError ? (
              <wa-callout variant="danger" size="s">
                <wa-icon slot="icon" name="circle-xmark"></wa-icon>
                {dialogError}
              </wa-callout>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

interface ItemProps {
  v: Vocabulary;
  onEdit: (v: Vocabulary) => void;
  onDelete: (v: Vocabulary) => void;
}

function VocabularyCard({ v, onEdit, onDelete }: ItemProps) {
  return (
    <wa-card className="vocab-card">
      <div className="wa-stack wa-gap-s">
        <div className="wa-stack wa-gap-3xs">
          <span className="vocab-question">{v.question}</span>
          <span className="vocab-answer">{v.answer}</span>
        </div>
        <div className="wa-cluster wa-gap-s wa-align-items-center">
          <span className="wa-caption-m wa-color-text-quiet">{languagePairLabel(v.sourceLanguage, v.targetLanguage)}</span>
          {isDifficult(v) ? <DifficultTag /> : null}
        </div>
        <AnswerCounts correct={v.correctCount} incorrect={v.incorrectCount} />
      </div>
      <div slot="footer" className="card-actions">
        <wa-button appearance="outlined" size="m" onClick={() => onEdit(v)}>
          <wa-icon slot="start" name="pen"></wa-icon>
          Bearbeiten
        </wa-button>
        <wa-button appearance="outlined" variant="danger" size="m" onClick={() => onDelete(v)}>
          <wa-icon slot="start" name="trash"></wa-icon>
          Löschen
        </wa-button>
      </div>
    </wa-card>
  );
}

function VocabularyTable({ items, onEdit, onDelete }: { items: Vocabulary[]; onEdit: (v: Vocabulary) => void; onDelete: (v: Vocabulary) => void }) {
  return (
    <div className="table-wrap">
      <table className="vocab-table">
        <thead>
          <tr>
            <th scope="col">Vokabel</th>
            <th scope="col">Übersetzung</th>
            <th scope="col">Sprachen</th>
            <th scope="col">Statistik</th>
            <th scope="col">
              <span className="wa-visually-hidden">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id}>
              <td className="vocab-question">
                {v.question} {isDifficult(v) ? <DifficultTag /> : null}
              </td>
              <td>{v.answer}</td>
              <td className="wa-color-text-quiet">{languagePairLabel(v.sourceLanguage, v.targetLanguage)}</td>
              <td>
                <AnswerCounts correct={v.correctCount} incorrect={v.incorrectCount} />
              </td>
              <td className="row-actions">
                <wa-button appearance="plain" size="m" onClick={() => onEdit(v)} aria-label={`${v.question} bearbeiten`} title="Bearbeiten">
                  <wa-icon name="pen"></wa-icon>
                </wa-button>
                <wa-button appearance="plain" variant="danger" size="m" onClick={() => onDelete(v)} aria-label={`${v.question} löschen`} title="Löschen">
                  <wa-icon name="trash"></wa-icon>
                </wa-button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DifficultTag() {
  return (
    <wa-tag size="s" variant="warning" appearance="filled" className="difficult-tag">
      <wa-icon name="fire"></wa-icon>&nbsp;schwierig
    </wa-tag>
  );
}

function ListSkeleton() {
  return (
    <div className="wa-stack wa-gap-m" aria-busy="true" aria-label="Vokabeln werden geladen">
      {[0, 1, 2, 3].map((i) => (
        <wa-skeleton key={i} effect="sheen" className="skeleton-card"></wa-skeleton>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: string; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="empty-state wa-stack wa-gap-m wa-align-items-center wa-text-center">
      <span className="empty-icon" aria-hidden="true">
        <wa-icon name={icon}></wa-icon>
      </span>
      <h2 className="wa-heading-m">{title}</h2>
      <p className="wa-body-m wa-color-text-quiet">{text}</p>
      {children}
    </div>
  );
}
