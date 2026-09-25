import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../components/Dialog';
import { valueOf } from '../components/fields';
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
const pairKey = (v: Pick<Vocabulary, 'sourceLanguage' | 'targetLanguage'>) => `${v.sourceLanguage}\u0000${v.targetLanguage}`;

export function VocabularyListPage() {
  const { vocabularies, loading, update, remove } = useVocabulary();
  const [search, setSearch] = useState('');
  const [pair, setPair] = useState(ALL);
  const deferredSearch = useDeferredValue(search);
  const wide = useMediaQuery('(min-width: 900px)');

  const pairs = useMemo(() => {
    const map = new Map<string, { label: string; count: number }>();
    for (const v of vocabularies) {
      const key = pairKey(v);
      const entry = map.get(key) ?? { label: languagePairLabel(v.sourceLanguage, v.targetLanguage), count: 0 };
      entry.count++;
      map.set(key, entry);
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label, 'de'));
  }, [vocabularies]);

  const activePair = pair === ALL || pairs.some(([key]) => key === pair) ? pair : ALL;

  const filtered = useMemo(() => {
    const needle = deferredSearch.trim().toLocaleLowerCase('de');
    return vocabularies.filter(
      (v) =>
        (activePair === ALL || pairKey(v) === activePair) &&
        (!needle || v.question.toLocaleLowerCase('de').includes(needle) || v.answer.toLocaleLowerCase('de').includes(needle)),
    );
  }, [vocabularies, deferredSearch, activePair]);

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
    setEditOpen(false);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setDialogError(null);
    try {
      await remove(deleting.id);
      notify(`„${deleting.question}“ gelöscht.`);
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
      <EmptyState title="Noch keine Vokabeln" text="Leg Deine erste Vokabel an. Sie steht danach auf allen Deinen Geräten bereit.">
        <wa-button variant="brand" size="l" href={href('neu')}>
          <wa-icon slot="start" name="plus"></wa-icon>
          Vokabel hinzufügen
        </wa-button>
      </EmptyState>
    );
  }

  return (
    <div className="list-page">
      <div className="list-toolbar">
        <wa-input type="search" placeholder="Suchen" aria-label="Vokabeln durchsuchen" size="l" with-clear value={search} onInput={(e) => setSearch(valueOf(e))}>
          <wa-icon slot="start" name="magnifying-glass"></wa-icon>
        </wa-input>
        {pairs.length > 1 ? (
          <div className="chip-row" role="group" aria-label="Nach Sprachpaar filtern">
            <Chip active={activePair === ALL} onClick={() => setPair(ALL)}>
              Alle ({vocabularies.length})
            </Chip>
            {pairs.map(([key, { label, count }]) => (
              <Chip key={key} active={activePair === key} onClick={() => setPair(key)}>
                {label} ({count})
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      <p className="list-count" aria-live="polite">
        {filtered.length === vocabularies.length ? `${vocabularies.length} Vokabeln` : `${filtered.length} von ${vocabularies.length} Vokabeln`}
      </p>

      {filtered.length === 0 ? (
        <EmptyState title="Nichts gefunden" text="Keine Vokabel passt zu Suche und Filter." />
      ) : wide ? (
        <VocabularyTable items={filtered} onEdit={startEdit} onDelete={startDelete} />
      ) : (
        <ul className="grouped-list vocab-rows">
          {filtered.map((v) => (
            <VocabularyRow key={v.id} v={v} showPair={pairs.length > 1 && activePair === ALL} onEdit={startEdit} onDelete={startDelete} />
          ))}
        </ul>
      )}

      <Dialog
        open={editOpen}
        label="Vokabel bearbeiten"
        onClose={() => {
          setEditOpen(false);
          setEditing((current) => (deleteOpen ? current : null));
        }}
        footer={
          <>
            {editing ? (
              <wa-button appearance="plain" variant="danger" size="l" className="footer-start" onClick={() => startDelete(editing)}>
                <wa-icon slot="start" name="trash"></wa-icon>
                Löschen
              </wa-button>
            ) : null}
            <wa-button appearance="outlined" size="l" onClick={() => setEditOpen(false)}>
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
            {dialogError ? <InlineError>{dialogError}</InlineError> : null}
            <p className="field-note">
              Bisher {editing.correctCount}-mal gewusst, {editing.incorrectCount}-mal falsch. Die Statistik bleibt beim Bearbeiten erhalten.
            </p>
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
            <wa-button appearance="outlined" size="l" onClick={() => setDeleteOpen(false)}>
              Abbrechen
            </wa-button>
            <wa-button variant="danger" size="l" loading={busy} onClick={confirmDelete}>
              Endgültig löschen
            </wa-button>
          </>
        }
      >
        {deleting ? (
          <div className="dialog-body">
            <p>
              <strong>{deleting.question}</strong> ({deleting.answer}) und die zugehörige Lernstatistik werden auf allen Geräten gelöscht. Das lässt sich nicht
              rückgängig machen.
            </p>
            {dialogError ? <InlineError>{dialogError}</InlineError> : null}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

interface ItemProps {
  v: Vocabulary;
  onEdit: (v: Vocabulary) => void;
  onDelete: (v: Vocabulary) => void;
}

function RowMenu({ v, onEdit, onDelete }: ItemProps) {
  return (
    <wa-dropdown
      placement="bottom-end"
      onClick={(e: MouseEvent) => e.stopPropagation()}
      onwa-select={(e: Event) => {
        const item = (e as CustomEvent<{ item: { value: string } }>).detail.item;
        if (item.value === 'edit') onEdit(v);
        if (item.value === 'delete') onDelete(v);
      }}
    >
      <wa-button slot="trigger" appearance="plain" size="m" className="row-menu" aria-label={`Aktionen für ${v.question}`}>
        <wa-icon name="ellipsis"></wa-icon>
      </wa-button>
      <wa-dropdown-item value="edit">
        <wa-icon slot="icon" name="pen"></wa-icon>
        Bearbeiten
      </wa-dropdown-item>
      <wa-dropdown-item value="delete" variant="danger">
        <wa-icon slot="icon" name="trash"></wa-icon>
        Löschen
      </wa-dropdown-item>
    </wa-dropdown>
  );
}

function Difficult() {
  return (
    <span className="difficult">
      <span className="difficult-dot" aria-hidden="true"></span>
      schwierig
    </span>
  );
}

function Counts({ v }: { v: Vocabulary }) {
  return (
    <span className="counts" aria-label={`${v.correctCount}-mal gewusst, ${v.incorrectCount}-mal falsch`}>
      <span className="count-correct">{v.correctCount}</span>
      <span className="count-sep">/</span>
      <span className="count-incorrect">{v.incorrectCount}</span>
    </span>
  );
}

function VocabularyRow({ v, showPair, onEdit, onDelete }: ItemProps & { showPair: boolean }) {
  const difficult = isDifficult(v);
  return (
    <li className="grouped-row vocab-row">
      <button type="button" className="row-button" onClick={() => onEdit(v)}>
        <span className="row-main">
          <span className="row-title">{v.question}</span>
          <span className="row-sub">{v.answer}</span>
          {showPair || difficult ? (
            <span className="row-meta">
              {showPair ? languagePairLabel(v.sourceLanguage, v.targetLanguage) : null}
              {difficult ? <Difficult /> : null}
            </span>
          ) : null}
        </span>
        <Counts v={v} />
      </button>
      <RowMenu v={v} onEdit={onEdit} onDelete={onDelete} />
    </li>
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
            <th scope="col" className="num">
              Gewusst / falsch
            </th>
            <th scope="col">
              <span className="wa-visually-hidden">Aktionen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((v) => (
            <tr key={v.id} onClick={() => onEdit(v)}>
              <td className="cell-title">
                {v.question} {isDifficult(v) ? <Difficult /> : null}
              </td>
              <td>{v.answer}</td>
              <td className="cell-quiet">{languagePairLabel(v.sourceLanguage, v.targetLanguage)}</td>
              <td className="num">
                <Counts v={v} />
              </td>
              <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                <wa-button appearance="plain" size="s" onClick={() => onEdit(v)} aria-label={`${v.question} bearbeiten`} title="Bearbeiten">
                  <wa-icon name="pen"></wa-icon>
                </wa-button>
                <wa-button appearance="plain" variant="danger" size="s" onClick={() => onDelete(v)} aria-label={`${v.question} löschen`} title="Löschen">
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

function ListSkeleton() {
  return (
    <div className="grouped-list" aria-busy="true" aria-label="Vokabeln werden geladen">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="grouped-row">
          <wa-skeleton effect="sheen" className="skeleton-row"></wa-skeleton>
        </div>
      ))}
    </div>
  );
}

export function InlineError({ children }: { children: ReactNode }) {
  return (
    <p className="notice notice-danger" role="alert">
      <wa-icon name="circle-xmark"></wa-icon>
      <span>{children}</span>
    </p>
  );
}

export function EmptyState({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2 className="empty-title">{title}</h2>
      <p className="empty-text">{text}</p>
      {children}
    </div>
  );
}
