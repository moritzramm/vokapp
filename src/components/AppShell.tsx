import { useEffect, useId } from 'react';
import { toUserMessage } from '../lib/errors';
import { notify } from '../lib/toast';
import { href, useRoute, type Route } from '../hooks/useRoute';
import { useUser } from '../hooks/useAuth';
import { FocusModeProvider } from '../hooks/useFocusMode';
import { useOnline } from '../hooks/useOnline';
import { useVocabulary } from '../hooks/useVocabulary';
import { signOut } from '../services/authService';
import { AddPage } from '../pages/AddPage';
import { LearnPage } from '../pages/LearnPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StatisticsPage } from '../pages/StatisticsPage';
import { VocabularyListPage } from '../pages/VocabularyListPage';

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: 'lernen', label: 'Lernen', icon: 'graduation-cap' },
  { route: 'vokabeln', label: 'Vokabeln', icon: 'list' },
  { route: 'neu', label: 'Hinzufügen', icon: 'plus' },
  { route: 'statistik', label: 'Statistik', icon: 'chart-simple' },
  { route: 'einstellungen', label: 'Konto', icon: 'gear' },
];

const TITLES: Record<Route, string> = {
  lernen: 'Lernen',
  vokabeln: 'Vokabeln',
  neu: 'Vokabel hinzufügen',
  statistik: 'Statistik',
  einstellungen: 'Konto und Einstellungen',
};

export async function logout() {
  try {
    await signOut();
  } catch (error) {
    notify(toUserMessage(error, 'Abmelden fehlgeschlagen.'), 'danger');
  }
}

export function AppShell() {
  const route = useRoute();
  const user = useUser();

  useEffect(() => {
    document.title = `${TITLES[route]} · Vokabeltrainer`;
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <FocusModeProvider>
      {(focus) => (
        <wa-page mobile-breakpoint="768" disable-navigation-toggle data-focus={focus || undefined}>
          <a slot="navigation-header" className="wordmark" href={href('lernen')}>
            <Logo />
            <span>Vokabeltrainer</span>
          </a>

          <nav slot="navigation" className="side-nav" aria-label="Hauptnavigation">
            {NAV.map((item) => (
              <a key={item.route} href={href(item.route)} className="side-nav-link" aria-current={route === item.route ? 'page' : undefined}>
                <wa-icon name={item.icon}></wa-icon>
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <div slot="navigation-footer" className="side-nav-footer">
            <span className="user-email" title={user.email}>
              {user.email}
            </span>
            <wa-button appearance="plain" size="s" onClick={logout}>
              <wa-icon slot="start" name="right-from-bracket"></wa-icon>
              Ausloggen
            </wa-button>
          </div>

          <main className="app-main">
            {focus ? null : (
              <header className="page-head">
                <h1 className="page-title">{TITLES[route]}</h1>
                <SyncButton />
              </header>
            )}
            <ConnectionBanner />
            {route === 'lernen' && <LearnPage />}
            {route === 'vokabeln' && <VocabularyListPage />}
            {route === 'neu' && <AddPage />}
            {route === 'statistik' && <StatisticsPage />}
            {route === 'einstellungen' && <SettingsPage />}
          </main>

          <nav slot="footer" className="bottom-nav" aria-label="Hauptnavigation">
            {NAV.map((item) =>
              item.route === 'neu' ? (
                <a key={item.route} href={href(item.route)} className="bottom-nav-add" aria-label="Vokabel hinzufügen" aria-current={route === item.route ? 'page' : undefined}>
                  <wa-icon name="plus"></wa-icon>
                </a>
              ) : (
                <a key={item.route} href={href(item.route)} className="bottom-nav-link" aria-current={route === item.route ? 'page' : undefined}>
                  <wa-icon name={item.icon}></wa-icon>
                  <span>{item.label}</span>
                </a>
              ),
            )}
          </nav>
        </wa-page>
      )}
    </FocusModeProvider>
  );
}

const V_PATH = 'M4 6h15l13 33L45 6h15L40 57H24z';
// Fine steps so the extruded side looks smooth even at large sizes.
const EXTRUSION_STEPS = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.5];

/**
 * Monogram "V" with depth: gradient front face, extrusion towards bottom right
 * (stacked, shifted copies) and a light edge on the top-left bevel.
 * Colours come from CSS so the logo follows light/dark mode.
 */
export function Logo({ size = 'm' }: { size?: 'm' | 'l' }) {
  const id = useId();
  return (
    <svg className={`logo logo-${size}`} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" className="logo-stop-1" />
          <stop offset="0.45" className="logo-stop-2" />
          <stop offset="1" className="logo-stop-3" />
        </linearGradient>
      </defs>
      <path className="logo-edge" transform="translate(5.5 6.6)" d={V_PATH} />
      {EXTRUSION_STEPS.map((step) => (
        <path key={step} className="logo-side" transform={`translate(${step} ${step * 1.2})`} d={V_PATH} />
      ))}
      <path fill={`url(#${id}-face)`} d={V_PATH} />
      <path className="logo-highlight" d="M4 6h15l-.8 2H6.9L25.4 55H24z" />
      <path className="logo-highlight logo-highlight-soft" d="M45 6h15l-.9 2H46.2z" />
    </svg>
  );
}

function SyncButton() {
  const { reload, loading, lastSyncedAt } = useVocabulary();
  const online = useOnline();
  const label = !online
    ? 'Offline'
    : lastSyncedAt
      ? `Synchronisiert um ${lastSyncedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}. Jetzt synchronisieren`
      : 'Jetzt synchronisieren';
  return (
    <wa-button appearance="plain" size="m" className="sync-button" loading={loading} disabled={!online} aria-label={label} title={label} onClick={() => void reload()}>
      <wa-icon name={online ? 'arrows-rotate' : 'cloud'}></wa-icon>
    </wa-button>
  );
}

function ConnectionBanner() {
  const online = useOnline();
  const { error, pendingAnswers, reload } = useVocabulary();
  if (online && !error && !pendingAnswers) return null;
  const parts: string[] = [];
  if (!online) parts.push('Offline – Du siehst den zuletzt geladenen Stand.');
  else if (error) parts.push(error);
  if (pendingAnswers) {
    parts.push(
      pendingAnswers === 1
        ? '1 Antwort wird gespeichert, sobald die Verbindung wieder steht.'
        : `${pendingAnswers} Antworten werden gespeichert, sobald die Verbindung wieder steht.`,
    );
  }
  return (
    <div className="connection-strip" role="status">
      <wa-icon name={online ? 'triangle-exclamation' : 'cloud'}></wa-icon>
      <span>{parts.join(' ')}</span>
      {online && error ? (
        <wa-button appearance="plain" size="s" onClick={() => void reload()}>
          Erneut versuchen
        </wa-button>
      ) : null}
    </div>
  );
}
