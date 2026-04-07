import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logPanelAccess } from '../lib/panelAccessLog';

export function AdminAuditPage() {
  const { supabase, signOut, profile, session } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (uid) logPanelAccess(uid, '/adm');
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [pRes, lRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, email, full_name, role, can_access_audit, updated_at')
            .order('updated_at', { ascending: false }),
          supabase.from('panel_access_logs').select('id, user_id, path, accessed_at, user_agent').order('accessed_at', { ascending: false }).limit(400),
        ]);
        if (pRes.error) throw pRes.error;
        if (lRes.error) throw lRes.error;
        if (!cancelled) {
          setProfiles(pRes.data || []);
          setLogs(lRes.data || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Erro ao carregar auditoria');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const emailById = Object.fromEntries(profiles.map((p) => [p.id, p.email || p.full_name || p.id]));

  return (
    <div className="min-h-screen bg-surface-container-low text-primary">
      <header className="bg-white border-b-2 border-primary px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-tertiary">Admin</p>
          <h1 className="text-xl font-black">Auditoria do painel</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            Logado como <strong>{profile?.email || '—'}</strong>
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <Link
            to="/"
            className="text-[10px] font-black uppercase tracking-widest border border-primary px-4 py-2 hover:bg-primary hover:text-white transition-colors"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="text-[10px] font-black uppercase tracking-widest bg-primary text-white px-4 py-2 hover:bg-primary/90"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="w-[96vw] max-w-[1800px] mx-auto px-4 py-8 space-y-10">
        {loading && <p className="text-[10px] font-black uppercase text-on-surface-variant">Carregando…</p>}
        {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}

        <section className="bg-white border border-surface-container-high shadow-sm">
          <div className="px-6 py-4 border-b border-surface-container-high">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]">Usuários (profiles)</h2>
          </div>
          <div className="overflow-auto max-h-[360px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-container-low text-[10px] font-black uppercase text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3">E-mail</th>
                  <th className="px-6 py-3">Nome</th>
                  <th className="px-6 py-3">Papel</th>
                  <th className="px-6 py-3">Auditoria</th>
                  <th className="px-6 py-3">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-low/50">
                    <td className="px-6 py-3 font-mono text-xs">{p.email || '—'}</td>
                    <td className="px-6 py-3">{p.full_name || '—'}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 ${p.role === 'admin' ? 'bg-tertiary/20 text-primary' : 'bg-slate-100 text-on-surface-variant'}`}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 ${p.can_access_audit ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-on-surface-variant'}`}
                      >
                        {p.can_access_audit ? 'Sim' : 'Não'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-on-surface-variant">
                      {p.updated_at ? new Date(p.updated_at).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white border border-surface-container-high shadow-sm">
          <div className="px-6 py-4 border-b border-surface-container-high">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]">Acessos ao painel (últimos registros)</h2>
          </div>
          <div className="overflow-auto max-h-[480px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-surface-container-low text-[10px] font-black uppercase text-on-surface-variant">
                <tr>
                  <th className="px-6 py-3">Quando</th>
                  <th className="px-6 py-3">Usuário</th>
                  <th className="px-6 py-3">Rota</th>
                  <th className="px-6 py-3 hidden lg:table-cell">User-Agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {logs.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-container-low/50">
                    <td className="px-6 py-3 text-xs whitespace-nowrap">
                      {row.accessed_at ? new Date(row.accessed_at).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">{emailById[row.user_id] || row.user_id}</td>
                    <td className="px-6 py-3 text-xs">{row.path || '—'}</td>
                    <td className="px-6 py-3 text-[11px] text-on-surface-variant max-w-md truncate hidden lg:table-cell" title={row.user_agent || ''}>
                      {row.user_agent || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
