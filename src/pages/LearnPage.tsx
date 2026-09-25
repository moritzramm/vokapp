import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { focusWhenReady, valueOf } from '../components/fields';
import { toUserMessage } from '../lib/errors';
import { languagePairLabel } from '../lib/languages';
import { buildSession, isDifficult } from '../lib/scheduler';
import { readSetting, SESSION_SIZES, writeSetting, type SessionSize } from '../lib/settings';
import { notify } from '../lib/toast';
import type { Direction, DirectionMode, LearningMode, Vocabulary } from '../lib/types';
import { useUser } from '../hooks/useAuth';
import { href } from '../hooks/useRoute';
import { useVocabulary } from '../hooks/useVocabulary';
import { recordAnswer } from '../services/learningService';
import { EmptyState } from './VocabularyListPage';

const ALL_PAIRS = '__all__';
const pairKey = (v: Pick<Vocabulary, 'sourceLanguage' | 'targetLanguage'>) => encodeURIComponent(`${v.sourceLanguage}\u0000${v.targetLanguage}`);

interface SessionConfig {
  mode: LearningMode;
  direction: DirectionMode;
  pair: string;
  size: SessionSize;
}

interface Card {
  vocabulary: Vocabulary;
  direction: Direction;
}

function toCards(vocabularies: Vocabulary[], mode: DirectionMode): Card[] {
  return vocabularies.map((vocabulary) => ({
    vocabulary,
    direction: mode === 'mixed' ? (Math.random() < 0.5 ? 'forward' : 'reverse') : mode,
  }));
}

interface SessionResult {
  correct: number;
  incorrect: number;
}

type Phase = { name: 'setup' } | { name: 'session'; id: number; cards: Card[] } | { name: 'done'; total: number; result: SessionResult };

export function LearnPage() {
  const { vocabularies, loading } = useVocabulary();
  const [config, setConfig] = useState<SessionConfig>(() => ({
    mode: readSetting<LearningMode>('learningMode', 'all'),
    direction: readSetting<DirectionMode>('learningDirection', 'forward'),
    pair: ALL_PAIRS,
    size: readSetting<SessionSize>('sessionSize', 20),
  }));
  const [phase, setPhase] = useState<Phase>({ name: 'setup' });

  const updateConfig = (patch: Partial<SessionConfig>) => {
    setConfig((c) => ({ ...c, ...patch }));
    if (patch.mode) writeSetting('learningMode', patch.mode);
    if (patch.direction) writeSetting('learningDirection', patch.direction);
    if (patch.size !== undefined) writeSetting('sessionSize', patch.size);
  };

  const start = useCallback(() => {
    const pool = config.pair === ALL_PAIRS ? vocabularies : vocabularies.filter((v) => pairKey(v) === config.pair);
    const selected = buildSession(config.mode, pool, config.size || pool.length);
    // id: a fresh session (new component state) on every start, even with identical cards
    if (selected.length) setPhase({ name: 'session', id: Date.now(), cards: toCards(selected, config.direction) });
  }, [config, vocabularies]);

  if (phase.name === 'session') {
    return (
      <FlashcardSession
        key={phase.id}
        cards={phase.cards}
        onFinish={(result) => {
          const total = result.correct + result.incorrect;
          setPhase(total ? { name: 'done', total, result } : { name: 'setup' });
        }}
      />
    );
  }

  if (phase.name === 'done') {
    return <SessionSummary total={phase.total} result={phase.result} onRestart={start} onOverview={() => setPhase({ name: 'setup' })} />;
  }

  if (loading && vocabularies.length === 0) {
    return <wa-skeleton effect="sheen" className="skeleton-setup"></wa-skeleton>;
  }

  if (vocabularies.length === 0) {
    return (
      <EmptyState icon="layer-group" title="Bereit zum Lernen?" text="Lege zuerst ein paar Vokabeln an. Danach kannst Du sie hier mit Karteikarten üben.">
        <wa-button variant="brand" size="l" href={href('neu')}>
          <wa-icon slot="start" name="plus"></wa-icon>
          Vokabel hinzufügen
        </wa-button>
      </EmptyState>
    );
  }

  return <SessionSetup vocabularies={vocabularies} config={config} onChange={updateConfig} onStart={start} />;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function SessionSetup({
  vocabularies,
  config,
  onChange,
  onStart,
}: {
  vocabularies: Vocabulary[];
  config: SessionConfig;
  onChange: (patch: Partial<SessionConfig>) => void;
  onStart: () => void;
}) {
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

  // Reset a pair filter that no longer exists (e.g. vocab deleted on another device).
  const pair = config.pair === ALL_PAIRS || pairs.some(([key]) => key === config.pair) ? config.pair : ALL_PAIRS;
  const pool = pair === ALL_PAIRS ? vocabularies : vocabularies.filter((v) => pairKey(v) === pair);
  const difficultCount = pool.filter(isDifficult).length;
  const available = config.mode === 'difficult' ? difficultCount : pool.length;
  const sessionLength = config.size ? Math.min(config.size, available) : available;

  // Concrete language names when only one pair is in play, generic wording otherwise.
  const single = pair !== ALL_PAIRS || pairs.length === 1 ? pool[0] : undefined;
  const from = single?.sourceLanguage ?? 'Vokabel';
  const to = single?.targetLanguage ?? 'Übersetzung';
  const directionHint =
    config.direction === 'forward'
      ? `${from} wird gezeigt, ${to} ist gefragt.`
      : config.direction === 'reverse'
        ? `${to} wird gezeigt, ${from} ist gefragt.`
        : `Jede Karte kommt zufällig in eine der beiden Richtungen.`;

  return (
    <div className="page-narrow wa-stack wa-gap-xl">
      <wa-radio-group
        label="Was möchtest Du lernen?"
        orientation="horizontal"
        size="l"
        className="segmented"
        value={config.mode}
        onInput={(e) => onChange({ mode: valueOf(e) as LearningMode })}
      >
        <wa-radio appearance="button" value="all">
          Alle · {pool.length}
        </wa-radio>
        <wa-radio appearance="button" value="difficult">
          <wa-icon name="fire"></wa-icon>&nbsp;Schwierige · {difficultCount}
        </wa-radio>
      </wa-radio-group>

      {pairs.length > 1 ? (
        <wa-select label="Sprachen" size="l" value={pair} onInput={(e) => onChange({ pair: valueOf(e) || ALL_PAIRS })}>
          <wa-option value={ALL_PAIRS}>Alle Sprachpaare</wa-option>
          {pairs.map(([key, { label, count }]) => (
            <wa-option key={key} value={key}>
              {label} ({count})
            </wa-option>
          ))}
        </wa-select>
      ) : null}

      <wa-radio-group
        label="Richtung"
        hint={directionHint}
        orientation="horizontal"
        size="l"
        className="segmented"
        value={config.direction}
        onInput={(e) => onChange({ direction: valueOf(e) as DirectionMode })}
      >
        <wa-radio appearance="button" value="forward" aria-label={`${from} nach ${to}`}>
          {single ? `${abbreviate(from)} → ${abbreviate(to)}` : 'Normal'}
        </wa-radio>
        <wa-radio appearance="button" value="reverse" aria-label={`${to} nach ${from}`}>
          {single ? `${abbreviate(to)} → ${abbreviate(from)}` : 'Umgekehrt'}
        </wa-radio>
        <wa-radio appearance="button" value="mixed">
          Gemischt
        </wa-radio>
      </wa-radio-group>

      <wa-radio-group
        label="Karten pro Runde"
        orientation="horizontal"
        size="l"
        className="segmented"
        value={String(config.size)}
        onInput={(e) => onChange({ size: Number(valueOf(e)) as SessionSize })}
      >
        {SESSION_SIZES.map((size) => (
          <wa-radio key={size} appearance="button" value={String(size)}>
            {size === 0 ? 'Alle' : size}
          </wa-radio>
        ))}
      </wa-radio-group>

      {config.mode === 'difficult' ? (
        <p className="wa-body-s wa-color-text-quiet">
          Schwierig sind Vokabeln, bei denen mindestens jede vierte Antwort falsch war. Häufig falsch beantwortete und lange nicht geübte Karten kommen öfter
          dran.
        </p>
      ) : null}

      {available === 0 ? (
        <wa-callout variant="success">
          <wa-icon slot="icon" name="circle-check"></wa-icon>
          Aktuell gibt es keine schwierigen Vokabeln{pair !== ALL_PAIRS ? ' in diesem Sprachpaar' : ''}. Stark!
        </wa-callout>
      ) : null}

      <wa-button variant="brand" size="xl" className="full-width" disabled={available === 0} onClick={onStart}>
        <wa-icon slot="start" name="graduation-cap"></wa-icon>
        {sessionLength === 1 ? '1 Karte lernen' : `${sessionLength} Karten lernen`}
      </wa-button>
    </div>
  );
}

/** Short language label for the direction buttons (e.g. "Französisch" → "FR"); the hint shows the full names. */
function abbreviate(language: string): string {
  const known: Record<string, string> = { Deutsch: 'DE', Englisch: 'EN', Französisch: 'FR' };
  return known[language] ?? (language.length > 8 ? `${language.slice(0, 6)}.` : language);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

function FlashcardSession({ cards, onFinish }: { cards: Card[]; onFinish: (result: SessionResult) => void }) {
  const user = useUser();
  const { applyServerRow, forgetRow, refreshPending } = useVocabulary();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const result = useRef<SessionResult>({ correct: 0, incorrect: 0 });
  const warnedOffline = useRef(false);
  const revealButton = useRef<{ focus: () => void } | null>(null);

  const { vocabulary: card, direction } = cards[index];
  const front = direction === 'forward' ? { language: card.sourceLanguage, text: card.question } : { language: card.targetLanguage, text: card.answer };
  const back = direction === 'forward' ? { language: card.targetLanguage, text: card.answer } : { language: card.sourceLanguage, text: card.question };
  const progress = (index / cards.length) * 100;

  useEffect(() => {
    if (!revealed) focusWhenReady(revealButton.current);
  }, [index, revealed]);

  const answer = useCallback(
    (wasCorrect: boolean) => {
      if (!revealed) return;
      if (wasCorrect) result.current.correct++;
      else result.current.incorrect++;

      // Persist immediately (not at the end of the session), without blocking the next card.
      recordAnswer(user.id, card.id, wasCorrect, direction)
        .then((outcome) => {
          if (outcome.status === 'saved') applyServerRow(outcome.vocabulary);
          if (outcome.status === 'deleted') forgetRow(card.id);
          if (outcome.status === 'queued') {
            refreshPending();
            if (!warnedOffline.current) {
              warnedOffline.current = true;
              notify('Keine Verbindung: Deine Antworten werden gespeichert, sobald Du wieder online bist.', 'warning');
            }
          }
        })
        .catch((error) => notify(toUserMessage(error, 'Die Antwort konnte nicht gespeichert werden.'), 'danger'));

      if (index + 1 >= cards.length) {
        onFinish({ ...result.current });
      } else {
        setIndex(index + 1);
        setRevealed(false);
      }
    },
    [revealed, user.id, card, direction, index, cards.length, onFinish, applyServerRow, forgetRow, refreshPending],
  );

  // Keyboard: Space/Enter = reveal, ← or 1 = falsch, → or 2 = gewusst
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && (event.key === 'ArrowLeft' || event.key === '1')) {
        event.preventDefault();
        answer(false);
      } else if (revealed && (event.key === 'ArrowRight' || event.key === '2')) {
        event.preventDefault();
        answer(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, answer]);

  return (
    <div className="session">
      <div className="session-header">
        <div className="wa-split wa-align-items-center">
          <span className="session-count" aria-live="polite">
            {index + 1} / {cards.length}
          </span>
          <wa-button appearance="plain" size="m" onClick={() => onFinish({ ...result.current })}>
            Beenden
          </wa-button>
        </div>
        <wa-progress-bar value={progress} label="Fortschritt der Lernrunde" className="session-progress"></wa-progress-bar>
      </div>

      <article className="flashcard" key={`${index}-${card.id}`} aria-live="polite">
        <div className="flashcard-side">
          <span className="flashcard-language">{front.language}</span>
          <p className="flashcard-text">{front.text}</p>
        </div>
        {revealed ? (
          <div className="flashcard-side flashcard-answer">
            <wa-divider></wa-divider>
            <span className="flashcard-language">{back.language}</span>
            <p className="flashcard-text">{back.text}</p>
          </div>
        ) : null}
      </article>

      <div className="session-actions">
        {revealed ? (
          <div className="answer-buttons">
            <wa-button variant="danger" appearance="outlined" size="xl" onClick={() => answer(false)}>
              <wa-icon slot="start" name="xmark"></wa-icon>
              Falsch
            </wa-button>
            <wa-button variant="success" size="xl" onClick={() => answer(true)}>
              <wa-icon slot="start" name="check"></wa-icon>
              Gewusst
            </wa-button>
          </div>
        ) : (
          <wa-button
            ref={(el: { focus: () => void } | null) => {
              revealButton.current = el;
            }}
            variant="brand" size="xl" className="full-width" onClick={() => setRevealed(true)}>
            <wa-icon slot="start" name="eye"></wa-icon>
            Antwort aufdecken
          </wa-button>
        )}
        <p className="keyboard-hint wa-caption-s wa-color-text-quiet">Tastatur: Leertaste aufdecken · ← falsch · → gewusst</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function SessionSummary({ total, result, onRestart, onOverview }: { total: number; result: SessionResult; onRestart: () => void; onOverview: () => void }) {
  const rate = total ? Math.round((result.correct / total) * 100) : 0;
  return (
    <div className="page-narrow wa-stack wa-gap-xl summary">
      <div className="wa-stack wa-gap-s wa-align-items-center wa-text-center">
        <wa-progress-ring value={rate} label="Trefferquote" className="summary-ring">
          {total ? `${rate} %` : '–'}
        </wa-progress-ring>
        <h2 className="wa-heading-xl">Lernsession beendet</h2>
        <p className="wa-body-l wa-color-text-quiet">{total === 1 ? '1 Vokabel' : `${total} Vokabeln`}</p>
      </div>
      <div className="summary-grid">
        <div className="stat-tile">
          <span className="stat-label">Gewusst</span>
          <span className="stat-value count-correct">{result.correct}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-label">Falsch</span>
          <span className="stat-value count-incorrect">{result.incorrect}</span>
        </div>
      </div>
      <div className="wa-stack wa-gap-s">
        <wa-button variant="brand" size="l" className="full-width" onClick={onRestart}>
          <wa-icon slot="start" name="rotate"></wa-icon>
          Nochmal lernen
        </wa-button>
        <wa-button appearance="outlined" size="l" className="full-width" onClick={onOverview}>
          Zur Übersicht
        </wa-button>
      </div>
    </div>
  );
}
