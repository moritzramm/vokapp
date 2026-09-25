import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FullscreenMessage } from './components/FullscreenMessage';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { VocabularyProvider } from './hooks/useVocabulary';
import { AuthPage } from './pages/AuthPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { configError } from './services/supabase';

export function App() {
  return (
    <ThemeProvider>
      {configError ? (
        <FullscreenMessage icon="triangle-exclamation" title="Konfiguration fehlt">
          {configError}
        </FullscreenMessage>
      ) : (
        <ErrorBoundary>
          <AuthProvider>
            <AuthGate />
          </AuthProvider>
        </ErrorBoundary>
      )}
      <wa-toast placement="top-center"></wa-toast>
    </ThemeProvider>
  );
}

/** No protected data is loaded before the auth state is known. */
function AuthGate() {
  const auth = useAuth();
  switch (auth.status) {
    case 'loading':
      return <FullscreenMessage loading title="Vokabeltrainer" />;
    case 'signed-out':
      return <AuthPage />;
    case 'password-recovery':
      return <ResetPasswordPage />;
    case 'signed-in':
      return (
        // key: a different user gets a fresh provider (no data carried over)
        <VocabularyProvider key={auth.user.id} userId={auth.user.id}>
          <AppShell />
        </VocabularyProvider>
      );
  }
}
