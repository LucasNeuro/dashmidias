import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const supabase = useMemo(() => getSupabase(), []);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured());

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) {
        setSession(s);
        setLoading(false);
      }
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !session?.user?.id) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (!cancelled) {
        if (error) console.warn('[profiles]', error.message);
        setProfile(data ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, session?.user?.id]);

  const value = useMemo(
    () => ({
      supabase,
      session,
      profile,
      loading,
      /** Rota /adm: admin OU flag can_access_audit (definida no Supabase). */
      isAdmin: profile?.role === 'admin' || profile?.can_access_audit === true,
      async signIn(email, password) {
        if (!supabase) throw new Error('Supabase não configurado');
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      /** Com “Confirm email” desligado no Supabase, retorna session e o usuário já fica logado. */
      async signUp(email, password, fullName) {
        if (!supabase) throw new Error('Supabase não configurado');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || '' },
          },
        });
        if (error) throw error;
        return data;
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [session, profile, loading, supabase]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
