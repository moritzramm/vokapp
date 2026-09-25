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
    <div className="page-narrow wa-stack wa-gap-2xl">
      <section className="settings-section wa-stack wa-gap-m">
        <h2>Darstellung</h2>
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

      <section className="settings-section wa-stack wa-gap-m">
        <h2>Datenverwaltung</h2>
        <div className="wa-stack wa-gap-s">
          <wa-button appearance="outlined" size="l" className="full-width" loading={exporting === 'json'} onClick={() => exportAs('json')}>
            <wa-icon slot="start" name="file-arrow-down"></wa-icon>
            Vokabeln als JSON exportieren
          </wa-button>
          <wa-button appearance="outlined" size="l" className="full-width" loading={exporting === 'csv'} onClick={() => exportAs('csv')}>
            <wa-icon slot="start" name="file-csv"></wa-icon>
            Vokabeln als CSV exportieren
          </wa-button>
          <wa-button appearance="outlined" size="l" className="full-width" onClick={() => fileInput.current?.click()}>
            <wa-icon slot="start" name="file-arrow-up"></wa-icon>
            JSON importieren
          </wa-button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onFile} />
        </div>
        <p className="wa-caption-m wa-color-text-quiet">
          Der Export enthält nur Deine Vokabeln und Lernstatistik – keine Zugangs- oder Kontodaten. Beim Import werden bereits vorhandene Vokabeln übersprungen;
          es wird nichts überschrieben oder gelöscht.
        </p>
      </section>

      <section className="settings-section wa-stack wa-gap-m">
        <h2>Account</h2>
        <div className="wa-stack wa-gap-3xs">
          <span className="wa-caption-m wa-color-text-quiet">E-Mail</span>
          <span className="account-email">{user.email}</span>
        </div>
        <wa-button appearance="outlined" variant="danger" size="l" className="full-width" onClick={logout}>
          <wa-icon slot="start" name="right-from-bracket"></wa-icon>
          Ausloggen
        </wa-button>
      </section>

      <wa-callout variant="neutral" appearance="filled">
        <wa-icon slot="icon" name="shield-halved"></wa-icon>
        Deine Vokabeln werden in Deinem persönlichen Supabase-Konto gespeichert. Du kannst von jedem Gerät auf Deine Daten zugreifen, wenn Du Dich mit demselben
        Konto anmeldest.
      </wa-callout>

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
            <wa-button appearance="outlined" size="l" data-dialog="close">
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
        <div className="wa-stack wa-gap-m">
          {importError ? (
            <wa-callout variant="danger" size="s">
              <wa-icon slot="icon" name="circle-xmark"></wa-icon>
              {importError}
            </wa-callout>
          ) : null}
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
            <wa-icon name="layer-group"></wa-icon> {duplicates} bereits vorhanden – werden übersprungen
          </li>
        ) : null}
        {problems.length ? (
          <li>
            <wa-icon name="triangle-exclamation" className="count-incorrect"></wa-icon> {problems.length} ungültige Einträge – werden nicht importiert
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
