import { useRef, useState, type ChangeEvent } from 'react';
import { logout } from '../components/AppShell';
import { Dialog } from '../components/Dialog';
import { valueOf } from '../components/fields';
import { toUserMessage } from '../lib/errors';
import { analyzeImport, downloadFile, exportFilename, MAX_IMPORT_BYTES, toCsv, toJson, type ImportAnalysis } from '../lib/importExport';
import type { ThemeChoice } from '../lib/settings';
import { notify } from '../lib/toast';
import { useUser } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useVocabulary } from '../hooks/useVocabulary';
import { InlineError } from './VocabularyListPage';
import { getVocabularies } from '../services/vocabularyService';

export function SettingsPage() {
  const user = useUser();
  const { theme, setTheme } = useTheme();
  const { vocabularies, createMany } = useVocabulary();
  const fileInput = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const exportAs = async (format: 'json' | 'csv') => {
    setExporting(format);
    try {
      // Always export the current cloud state, not a possibly stale local copy.
      const data = await getVocabularies();
      if (format === 'json') downloadFile(toJson(data), exportFilename('json'), 'application/json');
      else downloadFile(toCsv(data), exportFilename('csv'), 'text/csv;charset=utf-8');
      notify(`${data.length} Vokabeln exportiert.`);
    } catch (e) {
      notify(toUserMessage(e, 'Export fehlgeschlagen.'), 'danger');
    } finally {
      setExporting(null);
    }
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (!file) return;
    setImportError(null);
    setAnalysis(null);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error('Die Datei ist größer als 5 MB.');
      // Compare against the current cloud state to detect duplicates reliably.
      const existing = await getVocabularies().catch(() => vocabularies);
      setAnalysis(analyzeImport(await file.text(), existing));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Die Datei konnte nicht gelesen werden.');
    }
    setImportOpen(true);
  };

  const runImport = async () => {
    if (!analysis?.rows.length) return;
    setImporting(true);
    setImportError(null);
    try {
      const created = await createMany(analysis.rows);
      notify(`${created.length} Vokabeln importiert.`);
      setImportOpen(false);
    } catch (e) {
      setImportError(toUserMessage(e, 'Der Import ist fehlgeschlagen. Es wurden eventuell nur Teile übernommen – ein erneuter Import überspringt bereits vorhandene Einträge.'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="settings-layout">
      <section className="settings-group" aria-labelledby="account-heading">
        <h2 id="account-heading" className="section-title">
          Konto
        </h2>
        <div className="grouped-list">
          <div className="grouped-row">
            <span className="row-main">
              <span className="row-sub">Angemeldet als</span>
              <span className="row-title account-email">{user.email}</span>
            </span>
          </div>
          <button type="button" className="grouped-row row-action" onClick={logout}>
            <wa-icon name="right-from-bracket"></wa-icon>
            <span>Ausloggen</span>
          </button>
        </div>
      </section>

      <section className="settings-group" aria-labelledby="theme-heading">
        <h2 id="theme-heading" className="section-title">
          Darstellung
        </h2>
        <wa-radio-group
          label="Farbschema"
          orientation="horizontal"
          size="m"
          className="segmented"
          value={theme}
          onInput={(e) => setTheme(valueOf(e) as ThemeChoice)}
        >
          <wa-radio appearance="button" value="light">
            <wa-icon name="sun"></wa-icon>&nbsp;Hell
          </wa-radio>
          <wa-radio appearance="button" value="dark">
            <wa-icon name="moon"></wa-icon>&nbsp;Dunkel
          </wa-radio>
          <wa-radio appearance="button" value="system">
            <wa-icon name="circle-half-stroke"></wa-icon>&nbsp;System
          </wa-radio>
        </wa-radio-group>
      </section>

      <section className="settings-group" aria-labelledby="data-heading">
        <h2 id="data-heading" className="section-title">
          Daten
        </h2>
        <div className="grouped-list">
          <button type="button" className="grouped-row row-action" disabled={exporting !== null} onClick={() => exportAs('json')}>
            <wa-icon name="file-arrow-down"></wa-icon>
            <span className="row-main">
              <span className="row-title">Als JSON exportieren</span>
              <span className="row-sub">Zum Sichern oder erneuten Importieren</span>
            </span>
            {exporting === 'json' ? <wa-spinner></wa-spinner> : null}
          </button>
          <button type="button" className="grouped-row row-action" disabled={exporting !== null} onClick={() => exportAs('csv')}>
            <wa-icon name="file-csv"></wa-icon>
            <span className="row-main">
              <span className="row-title">Als CSV exportieren</span>
              <span className="row-sub">Für Excel oder andere Tabellen</span>
            </span>
            {exporting === 'csv' ? <wa-spinner></wa-spinner> : null}
          </button>
          <button type="button" className="grouped-row row-action" onClick={() => fileInput.current?.click()}>
            <wa-icon name="file-arrow-up"></wa-icon>
            <span className="row-main">
              <span className="row-title">JSON importieren</span>
              <span className="row-sub">Vorhandene Vokabeln werden übersprungen, nichts wird überschrieben</span>
            </span>
          </button>
        </div>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </section>

      <p className="privacy-note">
        Deine Vokabeln werden in Deinem persönlichen Supabase-Konto gespeichert. Du kannst von jedem Gerät auf Deine Daten zugreifen, wenn Du Dich mit demselben
        Konto anmeldest. Exporte enthalten nur Vokabeln und Lernstatistik, keine Zugangsdaten.
      </p>

      <Dialog
        open={importOpen}
        label="JSON importieren"
        onClose={() => {
          setImportOpen(false);
          setAnalysis(null);
          setImportError(null);
        }}
        footer={
          <>
            <wa-button appearance="outlined" size="l" onClick={() => setImportOpen(false)}>
              {analysis?.rows.length ? 'Abbrechen' : 'Schließen'}
            </wa-button>
            {analysis?.rows.length ? (
              <wa-button variant="brand" size="l" loading={importing} onClick={runImport}>
                {analysis.rows.length === 1 ? '1 Vokabel importieren' : `${analysis.rows.length} Vokabeln importieren`}
              </wa-button>
            ) : null}
          </>
        }
      >
        <div className="dialog-body">
          {importError ? <InlineError>{importError}</InlineError> : null}
          {analysis ? <ImportSummary analysis={analysis} /> : null}
        </div>
      </Dialog>
    </div>
  );
}

function ImportSummary({ analysis }: { analysis: ImportAnalysis }) {
  const { rows, duplicates, problems } = analysis;
  return (
    <div className="wa-stack wa-gap-s">
      <ul className="import-summary wa-list-plain wa-stack wa-gap-2xs">
        <li>
          <wa-icon name="circle-check" className="count-correct"></wa-icon> {rows.length} neue Vokabeln
        </li>
        {duplicates ? (
          <li>
            <wa-icon name="layer-group"></wa-icon> {duplicates} schon vorhanden, werden übersprungen
          </li>
        ) : null}
        {problems.length ? (
          <li>
            <wa-icon name="triangle-exclamation" className="count-incorrect"></wa-icon> {problems.length} ungültige Einträge, werden nicht importiert
          </li>
        ) : null}
      </ul>
      {problems.length ? (
        <details className="import-problems">
          <summary>Ungültige Einträge anzeigen</summary>
          <ul className="wa-list-plain wa-stack wa-gap-2xs wa-caption-m">
            {problems.slice(0, 50).map((p) => (
              <li key={p.row}>
                Eintrag {p.row}: {p.message}
              </li>
            ))}
            {problems.length > 50 ? <li>… und {problems.length - 50} weitere</li> : null}
          </ul>
        </details>
      ) : null}
      {rows.length === 0 ? <p className="wa-body-s wa-color-text-quiet">Es gibt nichts zu importieren.</p> : null}
    </div>
  );
}
