# Vokabeltrainer

Mobile-first Web-App zum Verwalten eigener Vokabeln und Lernen mit Karteikarten.
Vokabeln und Lernfortschritt liegen zentral in **Supabase**, damit Handy, Tablet und PC
mit demselben Konto denselben Stand sehen.

**Stack:** React 19, TypeScript, Vite, [Web Awesome](https://webawesome.com/) 3 (UI-Komponenten),
`@supabase/supabase-js` (Auth, PostgreSQL, Row Level Security). Kein weiteres UI-Framework.

---

## Schnellstart (lokal)

```bash
npm install
cp .env.example .env      # Werte eintragen, siehe unten
npm run dev               # http://localhost:5173
npm run build             # Production-Build nach dist/
```

`.env` (wird nicht eingecheckt):

```text
VITE_SUPABASE_URL=https://<projekt-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Beide Werte stehen im Supabase-Dashboard unter **Project Settings → API Keys**.
Fehlen sie, zeigt die App einen Konfigurationshinweis statt abzustürzen.

## Supabase einrichten

1. Projekt auf [supabase.com](https://supabase.com) anlegen.
2. **Datenbank-Schema:** Die Dateien in `supabase/migrations/` der Reihe nach im SQL-Editor
   ausführen (oder mit der Supabase CLI: `supabase link` + `supabase db push`):
   - `001_initial_schema.sql` – Tabellen, RLS, Funktion `record_answer`
   - `002_learning_direction.sql` – speichert die Lernrichtung in `learning_events`
     (ohne diese Migration funktioniert die App weiter, die Richtung wird dann nur nicht gespeichert)
3. **Auth:** Unter *Authentication → Sign In / Providers* „Email“ aktivieren.
   Empfohlen: „Confirm email“ eingeschaltet lassen.
4. **Redirect-URLs** (wichtig für Bestätigungs- und Passwort-Reset-Links):
   Unter *Authentication → URL Configuration*
   - **Site URL:** `https://USERNAME.github.io/vokabel-app/`
   - **Redirect URLs:** zusätzlich `https://USERNAME.github.io/vokabel-app/**`
     und für die lokale Entwicklung `http://localhost:5173/**`

   Die App schickt als Redirect immer ihre eigene Basis-URL mit (`emailRedirectTo` /
   `redirectTo`). Steht diese nicht in der Liste, leitet Supabase auf die Site URL um.
5. Optional: Unter *Authentication → Emails* die Mail-Texte auf Deutsch anpassen und für
   den Produktivbetrieb einen eigenen SMTP-Server hinterlegen (der eingebaute Versand ist
   stark limitiert).

## Deployment auf GitHub Pages

Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht bei jedem Push auf `main`.

1. Repository → *Settings → Pages* → **Source: GitHub Actions**.
2. Repository → *Settings → Secrets and variables → Actions* anlegen
   (als **Variables**; Secrets funktionieren ebenfalls):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Push auf `main`. Die App liegt danach unter `https://USERNAME.github.io/<repo-name>/`.

Der Basispfad wird aus dem Repository-Namen abgeleitet (`BASE_PATH`, siehe `vite.config.ts`);
bei einem `USERNAME.github.io`-Repository ist er `/`. Die App nutzt Hash-Routing (`#/vokabeln`),
dadurch funktionieren Reloads auf GitHub Pages ohne 404-Workaround.

## Sicherheit

- Im Browser landen **nur** Project URL und **Publishable Key**. Alles mit `VITE_`-Präfix ist
  öffentlich (steht im ausgelieferten JavaScript). Ein Secret-/Service-Role-Key gehört
  **niemals** in `.env`, GitHub-Variablen oder -Secrets dieses Builds. App und Workflow
  verweigern erkennbare Secret Keys (`sb_secret_…`, JWT mit Rolle `service_role`).
- Zugriffsschutz erfolgt ausschließlich über Supabase Auth + **Row Level Security**:
  - RLS ist auf `vocabulary` und `learning_events` aktiv; jede Policy prüft
    `user_id = auth.uid()` für die Rolle `authenticated`.
  - Die Rolle `anon` hat keinerlei Tabellenrechte.
  - `user_id` wird nie aus Benutzereingaben übernommen (Default `auth.uid()` + Policy-Check;
    beim Import werden `id`/`user_id` aus der Datei ignoriert).
  - `learning_events` hat einen zusammengesetzten Fremdschlüssel `(vocabulary_id, user_id)`,
    ein Ereignis kann also nur auf eine eigene Vokabel zeigen.
  - `record_answer` läuft als `SECURITY INVOKER` mit festem `search_path`, RLS greift auch dort.
- Abmelden beendet nur die Sitzung auf dem aktuellen Gerät.

**RLS selbst prüfen** (SQL-Editor, zwei Testkonten A und B):

```sql
-- als Benutzer A ausführen (Supabase-Dashboard: "Run as" / oder via API mit As JWT)
select count(*) from public.vocabulary where user_id <> auth.uid();  -- muss 0 sein
```

### Datenschutz (DSGVO) – kurz

- Gespeichert werden E-Mail-Adresse (Supabase Auth), Vokabeln und Lernereignisse (Zeitpunkt,
  richtig/falsch). Keine Tracking- oder Analyse-Dienste, keine Drittanbieter-Requests:
  Icons (Font Awesome Free) und Schriften (Systemschriften) werden lokal ausgeliefert.
- `localStorage` enthält nur: Supabase-Session, Theme, zuletzt gewähltes Sprachpaar,
  Lernrunden-Einstellungen und ggf. noch nicht synchronisierte Antworten (Offline-Warteschlange).
- Für einen öffentlichen Betrieb fehlen noch: Impressum/Datenschutzerklärung, ein
  Auftragsverarbeitungsvertrag mit Supabase, die Wahl einer EU-Region für das Projekt sowie
  eine Funktion „Konto löschen“ (derzeit nur über das Supabase-Dashboard; durch
  `on delete cascade` werden dabei alle Daten des Kontos entfernt).

## Architektur

```text
src/
  services/            Einzige Stelle mit Supabase-Zugriffen
    supabase.ts          Client (persistente Session, Key-Prüfung)
    authService.ts       Login, Registrierung, Logout, Passwort-Reset
    vocabularyService.ts CRUD, Paging über 1000 Zeilen, Bulk-Import
    learningService.ts   recordAnswer (RPC + Offline-Warteschlange), Statistik
  lib/
    scheduler.ts         Auswahl der Karten je Lernmodus (austauschbare Strategie)
    statistics.ts        Kennzahlen aus Vokabeln + Lernereignissen
    importExport.ts      JSON/CSV-Export, validierter JSON-Import
    validation.ts        Feldregeln (identisch zu den DB-Constraints)
  hooks/               Auth-, Vokabel-, Theme-Kontext, Hash-Router
  pages/               Lernen, Vokabeln, Hinzufügen, Statistik, Einstellungen, Login
  components/          App-Shell (wa-page), Formulare, Dialoge
supabase/migrations/   Reproduzierbares Schema inkl. RLS
public/icons/          Selbst gehostete Font-Awesome-Free-Icons (CC BY 4.0)
```

**Datenfluss & Synchronisation**

- Supabase ist die Quelle der Wahrheit. Die Vokabelliste wird beim Start, beim Zurückkehren
  in den Tab (max. alle 15 s), nach Wiederherstellung der Verbindung und per Sync-Button neu
  geladen. Änderungen werden erst nach erfolgreichem Speichern lokal übernommen.
- Jede Antwort wird **sofort** über die Funktion `record_answer` gespeichert: Zähler werden
  atomar in der Datenbank erhöht (kein Überschreiben, wenn zwei Geräte gleichzeitig lernen)
  und ein Eintrag in `learning_events` angelegt.
- **Offline:** Schlägt das Speichern mangels Verbindung fehl, landet die Antwort in einer
  kleinen Warteschlange im `localStorage` und wird automatisch nachgereicht. Jede Antwort
  trägt eine clientseitige UUID; Wiederholungen werden serverseitig nicht doppelt gezählt.
  Anlegen/Bearbeiten/Löschen erfordern eine Verbindung; die Eingaben bleiben bei Fehlern erhalten.

**Lernmodi**

- *Richtung:* normal (Vokabel → Übersetzung), umgekehrt oder gemischt (zufällig je Karte).
  Die Zähler richtig/falsch gelten gemeinsam für beide Richtungen; die Richtung jeder Antwort
  steht in `learning_events.direction` und kann später separat ausgewertet werden.
- *Alle Vokabeln:* zufällig gemischt.
- *Schwierige Vokabeln:* Vokabeln mit mindestens einer falschen Antwort und einer
  Fehlerquote ≥ 25 %. Die Reihenfolge ist gewichtet zufällig; Gewicht =
  (geglättete Fehlerquote `(falsch+1)/(gesamt+2)` + bis zu 0,3 für lange nicht Geübtes)².
- Erweiterung um SM-2 o. ä.: neue `SessionStrategy` in `lib/scheduler.ts`; zusätzliche
  Kartenzustände (Intervall, Ease, Fälligkeit) als Spalten an `vocabulary`, die vollständige
  Antworthistorie liegt bereits in `learning_events`.

**Import-Strategie:** Es werden nur bekannte Felder übernommen. Einträge, die es mit gleichem
Sprachpaar und gleicher Vokabel (Groß-/Kleinschreibung egal) schon gibt, werden übersprungen;
es wird nie etwas überschrieben oder gelöscht. Ungültige Einträge werden mit Position angezeigt.
Limits: 5 MB, 10 000 Einträge.

## Hinweise

- `beispiele/franzoesisch-grundwortschatz.json`: 30 französische Grundvokabeln zum Ausprobieren,
  einzuspielen über *Einstellungen → JSON importieren*.
- Die Sprachauswahl bietet Deutsch, Englisch und Französisch (plus bereits verwendete Sprachen);
  alles andere über „Andere Sprache …“. Die Liste steht in `src/lib/languages.ts`.

- Tastatur im Lernmodus: Leertaste = aufdecken, ← / 1 = falsch, → / 2 = gewusst.
- `vendor/webawesome/` enthält eine lokale Kopie des Web-Awesome-Pakets (inkl. Doku unter
  `dist-cdn/llms.txt`) als Referenz. Der Build nutzt das npm-Paket `@awesome.me/webawesome`
  in derselben Version (3.14.0).
- Icons: [Font Awesome Free](https://fontawesome.com) 7.3.1, Lizenz CC BY 4.0 (`public/icons/LICENSE.txt`).
  Es liegen nur die verwendeten Icons in `public/icons/solid/`. Für ein neues `<wa-icon name="…">`
  die passende SVG aus `@fortawesome/fontawesome-free` (`svgs/solid/`) dorthin kopieren.
