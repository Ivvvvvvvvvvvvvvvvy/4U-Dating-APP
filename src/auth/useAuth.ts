import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';

export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: User; session: Session };

/**
 * Session source of truth for the app. Registers the auth listener before
 * checking for an existing session so a restored session is never missed.
 */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(
        session?.user
          ? { status: 'signedIn', user: session.user, session }
          : { status: 'signedOut' },
      );
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setState(
        session?.user
          ? { status: 'signedIn', user: session.user, session }
          : { status: 'signedOut' },
      );
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

export async function signInWithEmail(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return { error: error ? error.message : null };
}

export async function signUpWithEmail(email: string, password: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/` },
  });
  return { error: error ? error.message : null };
}

export async function signOutSession(): Promise<void> {
  await supabase.auth.signOut();
}
