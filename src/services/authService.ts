import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { appUrl, getSupabase } from './supabase';

export type SignUpResult = 'signed-in' | 'confirmation-required' | 'already-registered';

export async function getSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  const { data } = getSupabase().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await getSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw error;
  // With e-mail confirmation enabled, Supabase does not reveal existing accounts
  // via an error; it returns a user without identities instead.
  if (data.user && data.user.identities?.length === 0) return 'already-registered';
  return data.session ? 'signed-in' : 'confirmation-required';
}

export async function signOut(): Promise<void> {
  // "local" ends the session on this device only; other devices stay logged in.
  const { error } = await getSupabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl() });
  if (error) throw error;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await getSupabase().auth.updateUser({ password });
  if (error) throw error;
}
