import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { formatAuthError } from '../lib/authErrors';
import { getStoredPortal, isValidPortal, PORTAL_HUB, setStoredPortal } from '../lib/appPortal';
import { isHubOwnerEmail } from '../lib/hubOwner';
import { getPostLoginPath } from '../lib/postLoginPath';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const supabase = useMemo(() => getSupabase(), []);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [hubAdmin, setHubAdmin] = useState(false);
  /** Solicitação em hub_solicitacoes_admin (pendente) para este user_id — aguarda owner. */
  const [hubSolicitacaoPendente, setHubSolicitacaoPendente] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  /** Sessão carregada e perfil/flags resolvidos (evita redirect no login antes do `isAdmin`). */
  const [identityReady, setIdentityReady] = useState(!isSupabaseConfigured());
  /** Ambiente escolhido na entrada (hub vs imóveis); persiste em localStorage. */
  const [portalChoice, setPortalChoice] = useState(null);

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

  const loadProfileForUser = useCallback(
    async (userId) => {
      if (!supabase || !userId) {
        setProfile(null);
        setHubAdmin(false);
        setHubSolicitacaoPendente(false);
        return { merged: null, hubAdminFlag: false, isAdmin: false, hubSolicitacaoPendente: false };
      }
      const [legacyProfileRes, perfisRes, hubRpcRes, solicRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('perfis').select('*').eq('user_id', userId).maybeSingle(),
        /** RPC evita SELECT direto em hub_admins (RLS) e alinha-se a is_hub_admin() no Postgres. */
        supabase.rpc('is_hub_admin'),
        supabase
          .from('hub_solicitacoes_admin')
          .select('id')
          .eq('user_id', userId)
          .eq('status', 'pendente')
          .maybeSingle(),
      ]);
      if (legacyProfileRes.error) console.warn('[profiles]', legacyProfileRes.error.message);
      if (perfisRes.error) console.warn('[perfis]', perfisRes.error.message);
      if (hubRpcRes.error) console.warn('[is_hub_admin rpc]', hubRpcRes.error.message);
      if (solicRes.error) console.warn('[hub_solicitacoes_admin]', solicRes.error.message);

      let byTable = false;
      if (!hubRpcRes.error && hubRpcRes.data !== null && hubRpcRes.data !== undefined) {
        byTable = Boolean(hubRpcRes.data);
      } else {
        const hubAdminRes = await supabase
          .from('hub_admins')
          .select('user_id, ativo')
          .eq('user_id', userId)
          .maybeSingle();
        if (hubAdminRes.error) {
          const msg = hubAdminRes.error.message || '';
          if (msg.toLowerCase().includes('recursion')) {
            console.warn(
              '[hub_admins] Recursão nas políticas RLS — execute no Supabase: database/fix_hub_admins_rls_recursion.sql'
            );
          } else {
            console.warn('[hub_admins]', msg);
          }
        }
        byTable = hubAdminRes.data?.ativo === true;
      }

      const merged = {
        ...(legacyProfileRes.data ?? {}),
        ...(perfisRes.data ?? {}),
        id: legacyProfileRes.data?.id ?? perfisRes.data?.user_id ?? userId,
        full_name: legacyProfileRes.data?.full_name ?? perfisRes.data?.nome_exibicao ?? null,
        can_access_audit: legacyProfileRes.data?.can_access_audit ?? false,
      };
      const byPerfil = perfisRes.data?.administrador_hub === true;
      const legacyElevated =
        legacyProfileRes.data?.role === 'admin' ||
        legacyProfileRes.data?.role === 'owner' ||
        legacyProfileRes.data?.can_access_audit === true;
      const byLegacy = legacyElevated;
      const hubAdminFlag = byTable || byPerfil || byLegacy;
      const isAdminComputed =
        hubAdminFlag ||
        merged?.role === 'admin' ||
        merged?.role === 'owner' ||
        merged?.can_access_audit === true;
      const pendingSolic = !isAdminComputed && !!solicRes.data;
      setProfile(merged);
      setHubAdmin(hubAdminFlag);
      setHubSolicitacaoPendente(pendingSolic);
      return {
        merged,
        hubAdminFlag,
        isAdmin: isAdminComputed,
        hubSolicitacaoPendente: pendingSolic,
      };
    },
    [supabase]
  );

  useEffect(() => {
    if (!supabase) {
      setIdentityReady(true);
      return;
    }
    if (!session?.user?.id) {
      setProfile(null);
      setHubAdmin(false);
      setHubSolicitacaoPendente(false);
      setIdentityReady(true);
      return;
    }
    setIdentityReady(false);
    let cancelled = false;
    loadProfileForUser(session.user.id).finally(() => {
      if (!cancelled) setIdentityReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, session?.user?.id, loadProfileForUser]);

  const isAdmin =
    hubAdmin ||
    profile?.can_access_audit === true ||
    profile?.role === 'admin' ||
    profile?.role === 'owner';
  /** Dono da plataforma (profiles.role — distinto de admin de tenant / outros admins). */
  const isPlatformOwner = profile?.role === 'owner';

  const portal = portalChoice ?? getStoredPortal() ?? PORTAL_HUB;

  const setPortal = useCallback((p) => {
    if (!isValidPortal(p)) return;
    setStoredPortal(p);
    setPortalChoice(p);
  }, []);

  const value = useMemo(
    () => ({
      supabase,
      session,
      profile,
      hubAdmin,
      loading,
      identityReady,
      /** Rota /adm: admin HUB, auditoria ou `profiles.role` admin | owner. */
      isAdmin,
      /** `profiles.role === 'owner'` — dono da plataforma (vs admin de tenant/outros). */
      isPlatformOwner,
      /** Aprovação de solicitações HUB (UI): só quando o e-mail coincide com VITE_HUB_OWNER_EMAIL. */
      isHubOwner: isHubOwnerEmail(session?.user?.email),
      /** `hub` | `imoveis` — entrada e home (rotas segregadas). */
      portal,
      setPortal,
      hubSolicitacaoPendente,
      postLoginPath: getPostLoginPath({ isHubAdmin: isAdmin, hubSolicitacaoPendente, portal }),
      loadProfileForUser,
      async signIn(email, password) {
        if (!supabase) throw new Error('Supabase não configurado');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(formatAuthError(error));
        const uid = data.user?.id;
        const p = getStoredPortal() ?? PORTAL_HUB;
        if (uid) {
          const { isAdmin: adm, hubSolicitacaoPendente: pend } = await loadProfileForUser(uid);
          return getPostLoginPath({ isHubAdmin: adm, hubSolicitacaoPendente: pend, portal: p });
        }
        return getPostLoginPath({ isHubAdmin: false, hubSolicitacaoPendente: false, portal: p });
      },
      /** Com “Confirm email” desligado no Supabase, retorna session e o usuário já fica logado. */
      async signUp(email, password, fullName) {
        if (!supabase) throw new Error('Supabase não configurado');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || '' },
            emailRedirectTo: origin ? `${origin}/` : undefined,
          },
        });
        if (error) throw new Error(formatAuthError(error));
        if (data.user?.id && data.session) {
          const { isAdmin: adm, hubSolicitacaoPendente: pend } = await loadProfileForUser(data.user.id);
          const p = getStoredPortal() ?? PORTAL_HUB;
          return {
            ...data,
            postLoginPath: getPostLoginPath({ isHubAdmin: adm, hubSolicitacaoPendente: pend, portal: p }),
          };
        }
        return data;
      },
      async signOut() {
        if (!supabase) return;
        await supabase.auth.signOut();
        setProfile(null);
        setHubAdmin(false);
        setHubSolicitacaoPendente(false);
      },
      async resetPasswordForEmail(email) {
        if (!supabase) throw new Error('Supabase não configurado');
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: origin ? `${origin}/#/login/redefinir` : undefined,
        });
        if (error) throw new Error(formatAuthError(error));
      },
      async updatePassword(newPassword) {
        if (!supabase) throw new Error('Supabase não configurado');
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw new Error(formatAuthError(error));
      },
    }),
    [
      session,
      profile,
      hubAdmin,
      hubSolicitacaoPendente,
      isAdmin,
      isPlatformOwner,
      loading,
      identityReady,
      supabase,
      loadProfileForUser,
      portal,
      setPortal,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora de AuthProvider');
  return ctx;
}
