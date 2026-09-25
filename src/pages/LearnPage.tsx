import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { focusWhenReady, valueOf } from '../components/fields';
import { toUserMessage } from '../lib/errors';
import { languagePairLabel } from '../lib/languages';
import { buildSession, isDifficult } from '../lib/scheduler';
import { readSetting, SESSION_SIZES, writeSetting, type SessionSize } from '../lib/settings';
import { notify } from '../lib/toast';
import type { Direction, DirectionMode, LearningMode, Vocabulary } from '../lib/types';
import { useUser } from '../hooks/useAuth';
import { useFocusMode } from '../hooks/useFocusMode';
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

interface SessionResult {
  correct: number;
  incorrect: number;
  /** Cards answered wrong, in the order they were asked. */
  wrong: Card[];
}

function toCards(vocabularies: Vocabulary[], mode: DirectionMode): Card[] {
  return vocabularies.map((vocabulary) => ({
    vocabulary,
    direction: mode === 'mixed' ? (Math.random() < 0.5 ? 'forward' : 'reverse') : mode,
  }));
}

type Phase = { name: 'setup' } | { name: 'session'; id: number; cards: Card[] } | { name: 'done'; result: SessionResult };

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

  const startWith = (cards: Card[]) => {
    // id: a fresh session (new component state) on every start, even with identical cards
    if (cards.length) setPhase({ name: 'session', id: Date.now(), cards });
  };

  const start = useCallback(() => {
    const pool = config.pair === ALL_PAIRS ? vocabularies : vocabularies.filter((v) => pairKey(v) === config.pair);
    startWith(toCards(buildSession(config.mode, pool, config.size || pool.length), config.direction));
  }, [config, vocabularies]);

  if (phase.name === 'session') {
    return (
      <FlashcardSession
        key={phase.id}
        cards={phase.cards}
        onFinish={(result) => setPhase(result.correct + result.incorrect ? { name: 'done', result } : { name: 'setup' })}
      />
    );
  }

  if (phase.name === 'done') {
    // Repeat the wrong cards with the latest data (e.g. edited in the meantime), same directions.
    const repeatWrong = () => {
      const byId = new Map(vocabularies.map((v) => [v.id, v]));
      startWith(
        phase.result.wrong
          .map((card) => ({ ...card, vocabulary: byId.get(card.vocabulary.id) }))
          .filter((card): card is Card => card.vocabulary !== undefined),
      );
    };
    return <SessionSummary result={phase.result} onRepeatWrong={repeatWrong} onRestart={start} onDone={() => setPhase({ name: 'setup' })} />;
  }

  if (loading && vocabularies.length === 0) {
    return <wa-skeleton effect="sheen" className="skeleton-block"></wa-skeleton>;
  }

  if (vocabularies.length === 0) {
    return (
      <EmptyState title="Noch nichts zu lernen" text="Lege Deine ersten Vokabeln an oder importiere eine Liste unter Konto → JSON importieren.">
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

const MODE_LABEL: Record<LearningMode, string> = { all: 'Alle Vokabeln', difficult: 'Nur schwierige' };

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

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
  const neverAsked = pool.filter((v) => !v.lastAskedAt).length;
  const learnedToday = pool.filter((v) => isToday(v.lastAskedAt)).length;
  const available = config.mode === 'difficult' ? difficultCount : pool.length;
  const sessionLength = config.size ? Math.min(config.size, available) : available;

  // Concrete language names when only one pair is in play, generic wording otherwise.
  const single = pair !== ALL_PAIRS || pairs.length === 1 ? pool[0] : undefined;
  const from = single?.sourceLanguage ?? 'Vokabel';
  const to = single?.targetLanguage ?? 'Übersetzung';
  const directionText = config.direction === 'forward' ? `${from} → ${to}` : config.direction === 'reverse' ? `${to} → ${from}` : 'Richtung gemischt';
  const pairText = pair === ALL_PAIRS ? (pairs.length > 1 ? 'alle Sprachpaare' : '') : (pairs.find(([key]) => key === pair)?.[1].label ?? '');

  return (
    <div className="learn-layout">
      <section className="learn-start" aria-labelledby="learn-start-heading">
        <h2 id="learn-start-heading" className="deck-sentence">
          {pool.length === 1 ? '1 Vokabel' : `${pool.length} Vokabeln`}
          {difficultCount ? `, davon ${difficultCount} schwierig` : ''}
        </h2>

        {available === 0 ? (
          <p className="notice notice-success">
            <wa-icon name="circle-check"></wa-icon>
            Keine schwierigen Vokabeln{pair !== ALL_PAIRS ? ' in diesem Sprachpaar' : ''}. Stell unter „Runde anpassen“ auf „Alle“, um weiterzuüben.
          </p>
        ) : null}

        <wa-button variant="brand" size="xl" className="start-button" disabled={available === 0} onClick={onStart}>
          {sessionLength === 1 ? '1 Karte lernen' : `${sessionLength} Karten lernen`}
        </wa-button>

        <p className="round-summary">{[MODE_LABEL[config.mode], directionText, pairText].filter(Boolean).join(', ')}</p>

        <wa-details summary="Runde anpassen" appearance="plain" className="round-options">
          <div className="round-options-body">
            <wa-radio-group
              label="Karten"
              orientation="horizontal"
              size="m"
              className="segmented"
              value={config.mode}
              onInput={(e) => onChange({ mode: valueOf(e) as LearningMode })}
            >
              <wa-radio appearance="button" value="all">
                Alle ({pool.length})
              </wa-radio>
              <wa-radio appearance="button" value="difficult">
                Schwierige ({difficultCount})
              </wa-radio>
            </wa-radio-group>

            <wa-radio-group
              label="Richtung"
              orientation="horizontal"
              size="m"
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

            {pairs.length > 1 ? (
              <wa-select label="Sprachpaar" size="m" value={pair} onInput={(e) => onChange({ pair: valueOf(e) || ALL_PAIRS })}>
                <wa-option value={ALL_PAIRS}>Alle Sprachpaare</wa-option>
                {pairs.map(([key, { label, count }]) => (
                  <wa-option key={key} value={key}>
                    {label} ({count})
                  </wa-option>
                ))}
              </wa-select>
            ) : null}

            <wa-radio-group
              label="Karten pro Runde"
              orientation="horizontal"
              size="m"
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

            <p className="field-note">
              Schwierig ist eine Vokabel, wenn mindestens jede vierte Antwort falsch war. Häufig falsche und lange nicht geübte Karten kommen öfter dran.
            </p>
          </div>
        </wa-details>
      </section>

      <aside className="deck-facts" aria-labelledby="deck-facts-heading">
        <h2 id="deck-facts-heading" className="section-title">
          Dein Stapel
        </h2>
        <dl className="fact-list">
          <div>
            <dt>Noch nie geübt</dt>
            <dd>{neverAsked}</dd>
          </div>
          <div>
            <dt>Schwierig</dt>
            <dd>{difficultCount}</dd>
          </div>
          <div>
            <dt>Heute geübt</dt>
            <dd>{learnedToday}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

/** Short language label for the direction buttons (e.g. "Französisch" → "FR"); full names are in the summary line. */
function abbreviate(language: string): string {
  const known: Record<string, string> = { Deutsch: 'DE', Englisch: 'EN', Französisch: 'FR' };
  return known[language] ?? (language.length > 8 ? `${language.slice(0, 6)}.` : language);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

const FEEDBACK_MS = 180;
const SWIPE_THRESHOLD = 0.28; // share of the card width

function FlashcardSession({ cards, onFinish }: { cards: Card[]; onFinish: (result: SessionResult) => void }) {
  useFocusMode();
  const user = useUser();
  const { applyServerRow, forgetRow, refreshPending } = useVocabulary();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [dragX, setDragX] = useState(0);
  const result = useRef<SessionResult>({ correct: 0, incorrect: 0, wrong: [] });
  const warnedOffline = useRef(false);
  const revealButton = useRef<{ focus: () => void } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);

  const { vocabulary: card, direction } = cards[index];
  const front = direction === 'forward' ? { language: card.sourceLanguage, text: card.question } : { language: card.targetLanguage, text: card.answer };
  const back = direction === 'forward' ? { language: card.targetLanguage, text: card.answer } : { language: card.sourceLanguage, text: card.question };

  useEffect(() => {
    if (!revealed) focusWhenReady(revealButton.current);
  }, [index, revealed]);

  const finish = useCallback(() => onFinish({ ...result.current, wrong: [...result.current.wrong] }), [onFinish]);

  const answer = useCallback(
    (wasCorrect: boolean) => {
      if (!revealed || feedback) return;
      if (wasCorrect) result.current.correct++;
      else {
        result.current.incorrect++;
        result.current.wrong.push(cards[index]);
      }

      // Persist immediately (not at the end of the session), without blocking the next card.
      recordAnswer(user.id, card.id, wasCorrect, direction)
        .then((outcome) => {
          if (outcome.status === 'saved') applyServerRow(outcome.vocabulary);
          if (outcome.status === 'deleted') forgetRow(card.id);
          if (outcome.status === 'queued') {
            refreshPending();
            if (!warnedOffline.current) {
              warnedOffline.current = true;
              notify('Offline: Deine Antworten werden gespeichert, sobald Du wieder online bist.', 'warning');
            }
          }
        })
        .catch((error) => notify(toUserMessage(error, 'Die Antwort konnte nicht gespeichert werden.'), 'danger'));

      // Short colour confirmation on the card, then the next card.
      setFeedback(wasCorrect ? 'correct' : 'wrong');
      window.setTimeout(() => {
        setFeedback(null);
        setDragX(0);
        if (index + 1 >= cards.length) finish();
        else {
          setIndex(index + 1);
          setRevealed(false);
        }
      }, FEEDBACK_MS);
    },
    [revealed, feedback, cards, index, user.id, card, direction, finish, applyServerRow, forgetRow, refreshPending],
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
      } else if (event.key === 'Escape') {
        finish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, answer, finish]);

  // Swipe (touch or mouse) once the answer is visible: left = falsch, right = gewusst.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (!revealed || feedback) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    if (dragX !== 0 || (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))) {
      if (dragX === 0) {
        try {
          stageRef.current?.setPointerCapture(e.pointerId);
        } catch {
          // pointer already gone; dragging still works while it stays over the card
        }
      }
      setDragX(dx);
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    drag.current = null;
    const width = stageRef.current?.offsetWidth ?? 320;
    if (Math.abs(dragX) > width * SWIPE_THRESHOLD) answer(dragX > 0);
    else setDragX(0);
  };

  const swipeIntent = dragX > 24 ? 'correct' : dragX < -24 ? 'wrong' : null;
  const state = feedback ?? swipeIntent;

  return (
    <div className="session">
      <div className="session-bar">
        <wa-button appearance="plain" size="m" className="session-close" aria-label="Runde beenden" title="Runde beenden (Esc)" onClick={finish}>
          <wa-icon name="xmark"></wa-icon>
        </wa-button>
        <wa-progress-bar value={(index / cards.length) * 100} label="Fortschritt der Lernrunde" className="session-progress"></wa-progress-bar>
        <span className="session-count" aria-live="polite">
          {index + 1} / {cards.length}
        </span>
      </div>

      <div
        ref={stageRef}
        className="index-card-stage"
        data-state={state ?? undefined}
        data-dragging={dragX !== 0 || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          drag.current = null;
          setDragX(0);
        }}
        style={dragX ? { transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)` } : undefined}
      >
        <article key={`${index}-${card.id}`} className="index-card" data-revealed={revealed || undefined} onClick={() => !revealed && setRevealed(true)}>
          <div className="index-card-face index-card-front" aria-hidden={revealed}>
            <span className="card-language">{front.language}</span>
            <p className="card-word">{front.text}</p>
            <span className="card-hint">Tippen zum Aufdecken</span>
          </div>
          <div className="index-card-face index-card-back" aria-hidden={!revealed} aria-live="polite">
            <span className="card-language">{front.language}</span>
            <p className="card-prompt">{front.text}</p>
            <span className="card-language">{back.language}</span>
            <p className="card-word">{revealed ? back.text : ''}</p>
          </div>
        </article>
      </div>

      <div className="session-actions">
        {revealed ? (
          <div className="answer-buttons">
            <wa-button variant="danger" appearance="outlined" size="xl" disabled={!!feedback} onClick={() => answer(false)}>
              <wa-icon slot="start" name="xmark"></wa-icon>
              Falsch
            </wa-button>
            <wa-button variant="success" size="xl" disabled={!!feedback} onClick={() => answer(true)}>
              <wa-icon slot="start" name="check"></wa-icon>
              Gewusst
            </wa-button>
          </div>
        ) : (
          <wa-button
            ref={(el: { focus: () => void } | null) => {
              revealButton.current = el;
            }}
            variant="brand"
            size="xl"
            className="full-width"
            onClick={() => setRevealed(true)}
          >
            Antwort aufdecken
          </wa-button>
        )}
        <p className="session-hint">
          <span className="hint-touch">{revealed ? 'Oder wischen: links falsch, rechts gewusst' : ' '}</span>
          <span className="hint-keys">Leertaste aufdecken, ← falsch, → gewusst, Esc beenden</span>
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

function SessionSummary({
  result,
  onRepeatWrong,
  onRestart,
  onDone,
}: {
  result: SessionResult;
  onRepeatWrong: () => void;
  onRestart: () => void;
  onDone: () => void;
}) {
  const total = result.correct + result.incorrect;
  const rate = total ? Math.round((result.correct / total) * 100) : 0;
  const hasWrong = result.wrong.length > 0;

  return (
    <div className="summary">
      <div className="summary-head">
        <wa-progress-ring value={rate} label="Trefferquote" className="summary-ring">
          {rate} %
        </wa-progress-ring>
        <div>
          <h2 className="summary-title">Runde beendet</h2>
          <p className="summary-text">
            {result.correct} von {total} gewusst{hasWrong ? `, ${result.incorrect} falsch` : ''}.
          </p>
        </div>
      </div>

      {hasWrong ? (
        <section className="stack-section" aria-labelledby="wrong-heading">
          <h3 id="wrong-heading" className="section-title">
            Falsch beantwortet
          </h3>
          <ul className="grouped-list">
            {result.wrong.map(({ vocabulary: v, direction }, i) => (
              <li key={`${v.id}-${i}`} className="grouped-row">
                <span className="row-main">
                  <span className="row-title">{direction === 'forward' ? v.question : v.answer}</span>
                  <span className="row-sub">{direction === 'forward' ? v.answer : v.question}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="notice notice-success">
          <wa-icon name="circle-check"></wa-icon>
          Alles gewusst.
        </p>
      )}

      <div className="summary-actions">
        {hasWrong ? (
          <wa-button variant="brand" size="l" onClick={onRepeatWrong}>
            <wa-icon slot="start" name="rotate"></wa-icon>
            {result.wrong.length === 1 ? 'Falsche Karte wiederholen' : `${result.wrong.length} falsche wiederholen`}
          </wa-button>
        ) : null}
        <wa-button variant={hasWrong ? 'neutral' : 'brand'} appearance={hasWrong ? 'outlined' : 'accent'} size="l" onClick={onRestart}>
          Neue Runde
        </wa-button>
        <wa-button appearance="plain" size="l" onClick={onDone}>
          Fertig
        </wa-button>
      </div>
    </div>
  );
}
