import { useEffect } from 'react';
import { toUserMessage } from '../lib/errors';
import { notify } from '../lib/toast';
import { href, useRoute, type Route } from '../hooks/useRoute';
import { useUser } from '../hooks/useAuth';
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
  { route: 'einstellungen', label: 'Einstellungen', icon: 'gear' },
];

const TITLES: Record<Route, string> = {
  lernen: 'Lernen',
  vokabeln: 'Vokabeln',
  neu: 'Vokabel hinzufügen',
  statistik: 'Statistik',
  einstellungen: 'Einstellungen',
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
    <wa-page mobile-breakpoint="768" disable-navigation-toggle>
      <header slot="header" className="app-header wa-split">
        <a className="brand wa-cluster wa-gap-xs" href={href('lernen')}>
          <span className="brand-mark" aria-hidden="true">
            <wa-icon name="layer-group"></wa-icon>
          </span>
          <span className="brand-name">Vokabeltrainer</span>
        </a>
        <SyncButton />
      </header>

      <nav slot="navigation" className="side-nav wa-stack wa-gap-3xs" aria-label="Hauptnavigation">
        {NAV.map((item) => (
          <a key={item.route} href={href(item.route)} className="side-nav-link" aria-current={route === item.route ? 'page' : undefined}>
            <wa-icon name={item.icon}></wa-icon>
            <span>{item.label}</span>
          </a>
        ))}
      </nav>

      <div slot="navigation-footer" className="side-nav-footer wa-stack wa-gap-xs">
        <span className="wa-caption-m wa-color-text-quiet user-email" title={user.email}>
          {user.email}
        </span>
        <wa-button appearance="outlined" size="s" onClick={logout}>
          <wa-icon slot="start" name="right-from-bracket"></wa-icon>
          Ausloggen
        </wa-button>
      </div>

      <main className="app-main">
        <ConnectionBanner />
        <h1 className="page-title">{TITLES[route]}</h1>
        {route === 'lernen' && <LearnPage />}
        {route === 'vokabeln' && <VocabularyListPage />}
        {route === 'neu' && <AddPage />}
        {route === 'statistik' && <StatisticsPage />}
        {route === 'einstellungen' && <SettingsPage />}
      </main>

      <nav slot="footer" className="bottom-nav" aria-label="Hauptnavigation">
        {NAV.map((item) => (
          <a key={item.route} href={href(item.route)} className="bottom-nav-link" aria-current={route === item.route ? 'page' : undefined}>
            <wa-icon name={item.icon}></wa-icon>
            <span>{item.route === 'einstellungen' ? 'Mehr' : item.label}</span>
          </a>
        ))}
      </nav>
    </wa-page>
  );
}

function SyncButton() {
  const { reload, loading } = useVocabulary();
  const online = useOnline();
  return (
    <wa-button
      appearance="plain"
      size="m"
      className="sync-button"
      loading={loading}
      disabled={!online}
      aria-label={online ? 'Mit der Cloud synchronisieren' : 'Offline'}
      title={online ? 'Synchronisieren' : 'Offline'}
      onClick={() => void reload()}
    >
      <wa-icon name={online ? 'arrows-rotate' : 'cloud'}></wa-icon>
    </wa-button>
  );
}

function ConnectionBanner() {
  const online = useOnline();
  const { error, pendingAnswers, reload } = useVocabulary();
  if (online && !error && !pendingAnswers) return null;
  const message = !online
    ? 'Du bist offline. Die Cloud-Daten sind gerade nicht erreichbar; Du siehst den zuletzt geladenen Stand.'
    : error ?? '';
  return (
    <wa-callout variant="warning" appearance="filled-outlined" className="connection-banner">
      <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
      <div className="wa-stack wa-gap-2xs">
        {message ? <span>{message}</span> : null}
        {pendingAnswers ? (
          <span>
            {pendingAnswers === 1
              ? '1 Antwort ist noch nicht synchronisiert und wird automatisch gespeichert, sobald die Verbindung wieder steht.'
              : `${pendingAnswers} Antworten sind noch nicht synchronisiert und werden automatisch gespeichert, sobald die Verbindung wieder steht.`}
          </span>
        ) : null}
        {online ? (
          <span>
            <wa-button size="s" appearance="outlined" onClick={() => void reload()}>
              Erneut versuchen
            </wa-button>
          </span>
        ) : null}
      </div>
    </wa-callout>
  );
}
