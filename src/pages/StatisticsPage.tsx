import { useEffect, useState } from 'react';
import { toUserMessage } from '../lib/errors';
import { languagePairLabel } from '../lib/languages';
import type { DailyActivity, Statistics } from '../lib/statistics';
import { useVocabulary } from '../hooks/useVocabulary';
import { ACTIVITY_DAYS, getStatistics } from '../services/learningService';
import { AnswerCounts } from '../components/Stat';

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

  if (error && !stats) {
    return (
      <wa-callout variant="danger">
        <wa-icon slot="icon" name="circle-xmark"></wa-icon>
        {error}
      </wa-callout>
    );
  }

  if (!stats) {
    return (
      <div className="stats-grid" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <wa-skeleton key={i} effect="sheen" className="skeleton-tile"></wa-skeleton>
        ))}
      </div>
    );
  }

  return (
    <div className="wa-stack wa-gap-2xl">
      <section className="stats-grid" aria-label="Überblick">
        <StatTile label="Vokabeln insgesamt" value={number.format(stats.totalVocabularies)} />
        <StatTile label="Richtige Antworten" value={number.format(stats.correctAnswers)} tone="correct" />
        <StatTile label="Falsche Antworten" value={number.format(stats.incorrectAnswers)} tone="incorrect" />
        <StatTile label="Trefferquote" value={stats.accuracy === null ? '–' : percent.format(stats.accuracy)} />
        <StatTile label="Schwierige Vokabeln" value={number.format(stats.difficultCount)} icon="fire" />
        <StatTile label="Noch nie abgefragt" value={number.format(stats.neverAskedCount)} />
      </section>

      <section className="wa-stack wa-gap-m">
        <h2 className="wa-heading-m">Lernaktivität der letzten {ACTIVITY_DAYS} Tage</h2>
        <ActivityChart days={stats.activity} />
      </section>

      <section className="wa-stack wa-gap-m">
        <h2 className="wa-heading-m">Zuletzt gelernt</h2>
        {stats.recentlyLearned.length === 0 ? (
          <p className="wa-body-m wa-color-text-quiet">Noch keine Lernrunde absolviert.</p>
        ) : (
          <ul className="recent-list wa-list-plain">
            {stats.recentlyLearned.map((v) => (
              <li key={v.id} className="recent-item">
                <div className="wa-stack wa-gap-3xs recent-main">
                  <span className="vocab-question">
                    {v.question} <span className="wa-color-text-quiet">→ {v.answer}</span>
                  </span>
                  <span className="wa-caption-m wa-color-text-quiet">
                    {languagePairLabel(v.sourceLanguage, v.targetLanguage)} · <wa-relative-time date={v.lastAskedAt ?? undefined} lang="de"></wa-relative-time>
                  </span>
                </div>
                <AnswerCounts correct={v.correctCount} incorrect={v.incorrectCount} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value, tone, icon }: { label: string; value: string; tone?: 'correct' | 'incorrect'; icon?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-label">
        {icon ? <wa-icon name={icon}></wa-icon> : null} {label}
      </span>
      <span className={`stat-value${tone ? ` count-${tone}` : ''}`}>{value}</span>
    </div>
  );
}

const dayLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
const shortDay = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'numeric' });

/**
 * Single series (answers per day) in the brand color, so no legend is needed.
 * The correct/incorrect split is in the tooltip and in the table for screen readers.
 */
function ActivityChart({ days }: { days: DailyActivity[] }) {
  const max = Math.max(1, ...days.map((d) => d.correct + d.incorrect));
  const total = days.reduce((sum, d) => sum + d.correct + d.incorrect, 0);
  const toDate = (key: string) => new Date(`${key}T12:00:00`);

  if (total === 0) {
    return <p className="wa-body-m wa-color-text-quiet">In den letzten {ACTIVITY_DAYS} Tagen wurde noch nicht gelernt.</p>;
  }

  return (
    <figure className="activity">
      <div className="activity-chart" aria-hidden="true">
        <span className="activity-max wa-caption-xs wa-color-text-quiet">{max}</span>
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
        <div className="activity-axis wa-caption-xs wa-color-text-quiet">
          <span>{shortDay.format(toDate(days[0].date))}</span>
          <span>heute</span>
        </div>
      </div>
      <figcaption className="wa-caption-s wa-color-text-quiet">Antworten pro Tag · insgesamt {number.format(total)}</figcaption>
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
