import { useState, type FormEvent } from 'react';
import { MIN_PASSWORD_LENGTH, valueOf } from '../components/fields';
import { toUserMessage } from '../lib/errors';
import { requestPasswordReset, signIn, signUp } from '../services/authService';
import { initialAuthError } from '../services/supabase';

type Mode = 'login' | 'register' | 'forgot';

const LINK_ERRORS: Record<string, string> = {
  otp_expired: 'Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere einen neuen an.',
  access_denied: 'Der Link ist ungültig oder abgelaufen.',
};

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(() =>
    initialAuthError ? (LINK_ERRORS[initialAuthError] ?? 'Der Link konnte nicht verarbeitet werden.') : null,
  );
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword('');
    setPasswordRepeat('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === 'register') {
      if (password.length < MIN_PASSWORD_LENGTH) return setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
      if (password !== passwordRepeat) return setError('Die Passwörter stimmen nicht überein.');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else if (mode === 'register') {
        const result = await signUp(email, password);
        if (result === 'already-registered') setError('Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde Dich an oder setze Dein Passwort zurück.');
        if (result === 'confirmation-required') {
          setInfo('Fast geschafft: Wir haben Dir eine E-Mail geschickt. Bestätige Deine Adresse über den Link und melde Dich dann an.');
          setMode('login');
          setPassword('');
          setPasswordRepeat('');
        }
      } else {
        await requestPasswordReset(email);
        // Same message whether or not an account exists (no account enumeration).
        setInfo('Falls es ein Konto mit dieser Adresse gibt, haben wir Dir einen Link zum Zurücksetzen geschickt.');
      }
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === 'login' ? 'Willkommen zurück' : mode === 'register' ? 'Konto erstellen' : 'Passwort vergessen';
  const submitLabel = mode === 'login' ? 'Einloggen' : mode === 'register' ? 'Konto erstellen' : 'Link senden';

  return (
    <div className="auth-screen">
      <div className="auth-panel wa-stack wa-gap-xl">
        <div className="wa-stack wa-gap-xs wa-align-items-center wa-text-center">
          <span className="brand-mark brand-mark-large" aria-hidden="true">
            <wa-icon name="layer-group"></wa-icon>
          </span>
          <p className="wa-heading-2xl">Vokabeltrainer</p>
          <h1 className="wa-body-l wa-color-text-quiet">{heading}</h1>
        </div>

        <wa-card className="auth-card">
          <form className="wa-stack wa-gap-l" onSubmit={onSubmit}>
            {error ? (
              <wa-callout variant="danger" size="s">
                <wa-icon slot="icon" name="circle-xmark"></wa-icon>
                {error}
              </wa-callout>
            ) : null}
            {info ? (
              <wa-callout variant="success" size="s">
                <wa-icon slot="icon" name="envelope"></wa-icon>
                {info}
              </wa-callout>
            ) : null}
            {mode === 'forgot' ? (
              <p className="wa-body-s wa-color-text-quiet">Gib Deine E-Mail-Adresse ein. Wir schicken Dir einen Link, mit dem Du ein neues Passwort festlegen kannst.</p>
            ) : null}

            <wa-input
              label="E-Mail"
              type="email"
              name="email"
              autocomplete="email"
              inputmode="email"
              autocapitalize="off"
              spellcheck={false}
              required
              size="l"
              value={email}
              onInput={(e) => setEmail(valueOf(e))}
            ></wa-input>

            {mode !== 'forgot' ? (
              <wa-input
                label="Passwort"
                type="password"
                name="password"
                autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
                password-toggle
                required
                minlength={mode === 'register' ? MIN_PASSWORD_LENGTH : undefined}
                hint={mode === 'register' ? `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen` : undefined}
                size="l"
                value={password}
                onInput={(e) => setPassword(valueOf(e))}
              ></wa-input>
            ) : null}

            {mode === 'register' ? (
              <wa-input
                label="Passwort wiederholen"
                type="password"
                name="password-repeat"
                autocomplete="new-password"
                password-toggle
                required
                size="l"
                value={passwordRepeat}
                onInput={(e) => setPasswordRepeat(valueOf(e))}
              ></wa-input>
            ) : null}

            <wa-button type="submit" variant="brand" size="l" loading={busy} className="full-width">
              {submitLabel}
            </wa-button>

            {mode === 'login' ? (
              <wa-button appearance="plain" size="m" onClick={() => switchMode('forgot')}>
                Passwort vergessen?
              </wa-button>
            ) : null}
          </form>
        </wa-card>

        <div className="wa-stack wa-gap-s wa-align-items-center">
          {mode === 'login' ? (
            <>
              <span className="wa-body-s wa-color-text-quiet">Noch kein Konto?</span>
              <wa-button appearance="outlined" size="l" className="full-width" onClick={() => switchMode('register')}>
                Konto erstellen
              </wa-button>
            </>
          ) : (
            <wa-button appearance="plain" size="m" onClick={() => switchMode('login')}>
              Zurück zum Login
            </wa-button>
          )}
        </div>
      </div>
    </div>
  );
}
