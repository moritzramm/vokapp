/** Maps Supabase / network errors to short German messages for the UI. */

export class OfflineError extends Error {
  constructor() {
    super('Die Cloud-Daten sind gerade nicht erreichbar. Bitte prüfe Deine Internetverbindung.');
    this.name = 'OfflineError';
  }
}

export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (error instanceof OfflineError) return true;
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : '';
  const name = error instanceof Error ? error.name : '';
  return (
    name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message)
  );
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-Mail oder Passwort ist falsch.',
  email_not_confirmed: 'Bitte bestätige zuerst Deine E-Mail-Adresse über den Link in der Bestätigungs-E-Mail.',
  user_already_exists: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  email_exists: 'Für diese E-Mail-Adresse gibt es bereits ein Konto.',
  weak_password: 'Das Passwort ist zu schwach. Bitte wähle ein längeres Passwort.',
  same_password: 'Das neue Passwort muss sich vom alten unterscheiden.',
  over_email_send_rate_limit: 'Zu viele E-Mails in kurzer Zeit. Bitte warte einen Moment.',
  over_request_rate_limit: 'Zu viele Anfragen. Bitte warte einen Moment.',
  email_address_invalid: 'Diese E-Mail-Adresse ist ungültig.',
  validation_failed: 'Bitte prüfe Deine Eingaben.',
  signup_disabled: 'Registrierungen sind derzeit deaktiviert.',
  session_expired: 'Deine Sitzung ist abgelaufen. Bitte melde Dich erneut an.',
  otp_expired: 'Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen an.',
};

export function toUserMessage(error: unknown, fallback = 'Etwas ist schiefgelaufen. Bitte versuche es erneut.'): string {
  if (isNetworkError(error)) return new OfflineError().message;
  if (error && typeof error === 'object') {
    const code = 'code' in error ? String((error as { code: unknown }).code ?? '') : '';
    if (code && AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
    // PostgREST: JWT expired / RLS denial
    if (code === 'PGRST301' || code === '42501') return 'Keine Berechtigung. Bitte melde Dich erneut an.';
    if (code === '23514') return 'Ein Feld ist leer oder zu lang.';
  }
  return fallback;
}
