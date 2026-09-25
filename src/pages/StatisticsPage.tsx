import { useEffect, useMemo, useState } from 'react';
import { toUserMessage } from '../lib/errors';
import { errorRate, isDifficult } from '../lib/scheduler';
import { writeSetting } from '../lib/settings';
import type { DailyActivity, Statistics } from '../lib/statistics';
import type { LearningMode } from '../lib/types';
import { navigate } from '../hooks/useRoute';
import { useVocabulary } from '../hooks/useVocabulary';
import { ACTIVITY_DAYS, getStatistics } from '../services/learningService';
import { EmptyState, InlineError } from './VocabularyListPage';

const percent = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('de-DE');

export function StatisticsPage() {
  const { vocabularies, loading: vocabLoading } = useVocabulary();
  const [stats, setStats] = useState<Statistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recomputed whenever the synced vocabulary changes (e.g. after answers on another device).
  useEffect(() => {
    if (vocabLoading && vocabularies.length === 0) return;
    let cancelled = false;
    getStatistics(vocabularies)
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError(toUserMessage(e, 'Die Statistik konnte nicht geladen werden.')));
    return () => {
      cancelled = true;
    };
  }, [vocabularies, vocabLoading]);

  const difficult = useMemo(() => vocabularies.filter(isDifficult).sort((a, b) => errorRate(b) - errorRate(a)), [vocabularies]);

  if (error && !stats) return <InlineError>{error}</InlineError>;

  if (!stats) {
    return <wa-skeleton effect="sheen" className="skeleton-block" aria-label="Statistik wird geladen"></wa-skeleton>;
  }

  if (stats.totalVocabularies === 0) {
    return <EmptyState title="Noch keine Statistik" text="Sobald Du Vokabeln angelegt und geübt hast, siehst Du hier Deinen Fortschritt." />;
  }

  const answered = stats.correctAnswers + stats.incorrectAnswers;

  const learnDifficult = () => {
    writeSetting<LearningMode>('learningMode', 'difficult');
    navigate('lernen');
  };

  return (
    <div className="stats-layout">
      <section className="stats-lead" aria-label="Überblick">
        <p className="lead-sentence">
          {answered === 0
            ? 'Du hast noch keine Karte geübt.'
            : `${number.format(answered)} Antworten, davon ${stats.accuracy === null ? '–' : percent.format(stats.accuracy)} richtig.`}
        </p>
        <dl className="fact-list fact-list-4">
          <div>
            <dt>Vokabeln</dt>
            <dd>{number.format(stats.totalVocabularies)}</dd>
          </div>
          <div>
            <dt>Richtig</dt>
            <dd className="count-correct">{number.format(stats.correctAnswers)}</dd>
          </div>
          <div>
            <dt>Falsch</dt>
            <dd className="count-incorrect">{number.format(stats.incorrectAnswers)}</dd>
          </div>
          <div>
            <dt>Noch nie geübt</dt>
            <dd>{number.format(stats.neverAskedCount)}</dd>
          </div>
        </dl>
      </section>

      <section className="stack-section" aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="section-title">
          Letzte {ACTIVITY_DAYS} Tage
        </h2>
        <ActivityChart days={stats.activity} />
      </section>

      <section className="stack-section" aria-labelledby="difficult-heading">
        <div className="section-head">
          <h2 id="difficult-heading" className="section-title">
            Schwierige Vokabeln ({difficult.length})
          </h2>
          {difficult.length ? (
            <wa-button size="s" appearance="outlined" onClick={learnDifficult}>
              Diese lernen
            </wa-button>
          ) : null}
        </div>
        {difficult.length === 0 ? (
          <p className="quiet-text">Keine. Eine Vokabel gilt als schwierig, wenn mindestens jede vierte Antwort falsch war.</p>
        ) : (
          <ul className="grouped-list">
            {difficult.slice(0, 8).map((v) => (
              <li key={v.id} className="grouped-row">
                <span className="row-main">
                  <span className="row-title">{v.question}</span>
                  <span className="row-sub">{v.answer}</span>
                </span>
                <span className="counts">
                  <span className="count-correct">{v.correctCount}</span>
                  <span className="count-sep">/</span>
                  <span className="count-incorrect">{v.incorrectCount}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack-section" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="section-title">
          Zuletzt geübt
        </h2>
        {stats.recentlyLearned.length === 0 ? (
          <p className="quiet-text">Noch keine Lernrunde.</p>
        ) : (
          <ul className="grouped-list">
            {stats.recentlyLearned.map((v) => (
              <li key={v.id} className="grouped-row">
                <span className="row-main">
                  <span className="row-title">{v.question}</span>
                  <span className="row-sub">{v.answer}</span>
                </span>
                <wa-relative-time className="row-time" date={v.lastAskedAt ?? undefined} lang="de"></wa-relative-time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const dayLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const shortDay = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });

/**
 * Single series (answers per day), so no legend is needed. The correct/wrong
 * split is in each bar's tooltip and in the table for screen readers.
 */
function ActivityChart({ days }: { days: DailyActivity[] }) {
  const max = Math.max(1, ...days.map((d) => d.correct + d.incorrect));
  const total = days.reduce((sum, d) => sum + d.correct + d.incorrect, 0);
  const toDate = (key: string) => new Date(`${key}T12:00:00`);

  if (total === 0) return <p className="quiet-text">In den letzten {ACTIVITY_DAYS} Tagen wurde nicht geübt.</p>;

  return (
    <figure className="activity">
      <div className="activity-chart" aria-hidden="true">
        <span className="activity-max">{max}</span>
        <div className="activity-bars">
          {days.map((d) => {
            const count = d.correct + d.incorrect;
            const tip = `${dayLabel.format(toDate(d.date))}: ${count} Antworten (${d.correct} gewusst, ${d.incorrect} falsch)`;
            return (
              <div key={d.date} className="activity-slot" title={tip}>
                <div className="activity-bar" style={{ height: `${(count / max) * 100}%` }} data-empty={count === 0 || undefined}></div>
              </div>
            );
          })}
        </div>
        <div className="activity-axis">
          <span>{shortDay.format(toDate(days[0].date))}</span>
          <span>heute</span>
        </div>
      </div>
      <figcaption className="quiet-text">
        Antworten pro Tag, zusammen {number.format(total)}
      </figcaption>
      <table className="wa-visually-hidden">
        <caption>Antworten pro Tag</caption>
        <thead>
          <tr>
            <th scope="col">Tag</th>
            <th scope="col">Gewusst</th>
            <th scope="col">Falsch</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th scope="row">{dayLabel.format(toDate(d.date))}</th>
              <td>{d.correct}</td>
              <td>{d.incorrect}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
