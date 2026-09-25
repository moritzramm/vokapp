import { useState, type FormEvent } from 'react';
import { Logo } from '../components/AppShell';
import { MIN_PASSWORD_LENGTH, valueOf } from '../components/fields';
import { toUserMessage } from '../lib/errors';
import { InlineError } from './VocabularyListPage';
import { notify } from '../lib/toast';
import { signOut, updatePassword } from '../services/authService';

/** Shown after opening a password-reset link (Supabase event PASSWORD_RECOVERY). */
export function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
    if (password !== passwordRepeat) return setError('Die Passwörter stimmen nicht überein.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      notify('Dein Passwort wurde geändert.');
    } catch (e) {
      setError(toUserMessage(e));
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-panel">
        <div className="auth-head">
          <Logo size="l" />
          <p className="auth-wordmark">Vokabeltrainer</p>
          <h1 className="auth-heading">Neues Passwort festlegen</h1>
        </div>
        <div className="auth-card">
          <form className="auth-form" onSubmit={onSubmit}>
            {error ? (
              <InlineError>{error}</InlineError>
            ) : null}
            <wa-input
              label="Neues Passwort"
              type="password"
              autocomplete="new-password"
              password-toggle
              required
              minlength={MIN_PASSWORD_LENGTH}
              hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`}
              size="l"
              value={password}
              onInput={(e) => setPassword(valueOf(e))}
            ></wa-input>
            <wa-input
              label="Passwort wiederholen"
              type="password"
              autocomplete="new-password"
              password-toggle
              required
              size="l"
              value={passwordRepeat}
              onInput={(e) => setPasswordRepeat(valueOf(e))}
            ></wa-input>
            <wa-button type="submit" variant="brand" size="l" loading={busy} className="full-width">
              Passwort speichern
            </wa-button>
            <wa-button appearance="plain" onClick={() => void signOut()}>
              Abbrechen
            </wa-button>
          </form>
        </div>
      </div>
    </div>
  );
}
