import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../lib/database.types';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '';
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? '';

/**
 * Auth redirects (e.g. an expired reset link) come back as
 * "#error=...&error_code=...". Supabase clears the hash while initializing,
 * so it is captured here, before the client is created.
 */
export const initialAuthError: string | null = (() => {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('error_code') ?? params.get('error');
})();

/** Refuses keys that must never be shipped to a browser. */
function looksLikeSecretKey(value: string): boolean {
  if (value.startsWith('sb_secret_')) return true;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as { role?: string };
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export const configError: string | null = !url || !key || url.startsWith('your-') || key.startsWith('your-')
  ? 'Supabase ist nicht konfiguriert. Lege eine .env mit VITE_SUPABASE_URL und VITE_SUPABASE_PUBLISHABLE_KEY an (siehe .env.example).'
  : looksLikeSecretKey(key)
    ? 'Der konfigurierte Schlüssel ist ein Secret-/Service-Role-Key. Im Frontend darf nur der Publishable Key verwendet werden.'
    : null;

export type AppSupabaseClient = SupabaseClient<Database>;

const client: AppSupabaseClient | null = configError
  ? null
  : createClient<Database>(url, key, {
      auth: {
        persistSession: true, // session survives reloads (localStorage)
        autoRefreshToken: true,
        detectSessionInUrl: true, // handles confirmation and password-reset links
        storageKey: 'vokabel-app-auth',
      },
    });

export function getSupabase(): AppSupabaseClient {
  if (!client) throw new Error(configError ?? 'Supabase ist nicht konfiguriert.');
  return client;
}

/** Absolute URL of the app (respects the GitHub Pages sub-path). */
export function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).toString();
}
