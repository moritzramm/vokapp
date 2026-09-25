import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSession, onAuthChange } from '../services/authService';

export type AuthState =
  | { status: 'loading' }
  /** Session check did not finish in time (e.g. offline with an expired token). */
  | { status: 'unreachable' }
  | { status: 'signed-out' }
  | { status: 'password-recovery'; user: User }
  | { status: 'signed-in'; user: User; session: Session };

const AuthContext = createContext<AuthState>({ status: 'loading' });

const SESSION_CHECK_TIMEOUT_MS = 8000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let recovering = false;
    const apply = (session: Session | null) => {
      if (!session) setState({ status: 'signed-out' });
      else if (recovering) setState({ status: 'password-recovery', user: session.user });
      else setState({ status: 'signed-in', user: session.user, session });
    };

    const unsubscribe = onAuthChange((event, session) => {
      // Opened via "Passwort vergessen" link: ask for a new password first.
      if (event === 'PASSWORD_RECOVERY') recovering = true;
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') recovering = false;
      // Token refreshes must not re-render the whole app with a new user object.
      if (event === 'TOKEN_REFRESHED') return;
      apply(session);
    });

    // Supabase keeps retrying a token refresh while offline; don't leave the user
    // looking at a spinner. A late result still replaces this state.
    const timeout = window.setTimeout(() => {
      setState((current) => (current.status === 'loading' ? { status: 'unreachable' } : current));
    }, SESSION_CHECK_TIMEOUT_MS);

    getSession()
      .then(apply)
      .catch(() => setState({ status: 'signed-out' }))
      .finally(() => window.clearTimeout(timeout));

    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** For components that are only rendered while signed in. */
export function useUser(): User {
  const state = useAuth();
  if (state.status !== 'signed-in') throw new Error('useUser requires a signed-in user');
  return state.user;
}
