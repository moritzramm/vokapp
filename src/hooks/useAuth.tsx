import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSession, onAuthChange } from '../services/authService';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'password-recovery'; user: User }
  | { status: 'signed-in'; user: User; session: Session };

const AuthContext = createContext<AuthState>({ status: 'loading' });

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

    getSession()
      .then(apply)
      .catch(() => setState({ status: 'signed-out' }));

    return unsubscribe;
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
