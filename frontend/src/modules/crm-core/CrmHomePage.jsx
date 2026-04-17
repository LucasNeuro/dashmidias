import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { getAppNavItems } from '../../lib/appNavItems';
import { money } from '../../lib/format';

/**
 * Módulo CRM global: um funil de negócios por organização; RLS restringe o que cada perfil vê.
 */
export function CrmHomePage() {
  const { supabase, session, isAdmin, hubAdmin, isHubOwner, isPlatformOwner, portal } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;
  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      const { data, error } = await supabase
        .from('negocios')
        .select('id, titulo, origem, valor_estimado, moeda, criado_em, atualizado_em, organizacao_id')
        .order('atualizado_em', { ascending: false })
        .limit(200);
      if (cancelled) return;
      if (error) setErr(error.message);
      else setRows(data || []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <AppShell
      title="CRM Geral"
      subtitle="Negócios por organização (RLS). Quadros por segmento usam o menu à esquerda."
      navItems={navItems}
    >
      <div className="w-full max-w-[1800px] mx-auto px-4 py-8 space-y-6 min-w-0">
        <section className="bg-white border border-surface-container-high p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-1.5 h-6 bg-tertiary" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Pipeline de negócios</h2>
          </div>
          {loading && <p className="text-[10px] font-black uppercase text-on-surface-variant">Carregando…</p>}
          {err && <p className="text-sm text-red-600 font-semibold">{err}</p>}
          {!loading && !err && rows.length === 0 && (
            <p className="text-sm text-on-surface-variant">
              Nenhum negócio ainda. Quando sua organização criar oportunidades, elas aparecem aqui (isoladas por{' '}
              <code className="text-xs bg-surface-container px-1">organizacao_id</code>).
            </p>
          )}
          {!loading && !err && rows.length > 0 && (
            <div className="overflow-auto max-h-[560px] border border-surface-container-high">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface-container-low text-[10px] font-black uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Origem</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3 hidden md:table-cell">Última atualização</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {rows.map((n) => (
                    <tr key={n.id} className="hover:bg-surface-container-low/40">
                      <td className="px-4 py-3 font-bold text-primary">{n.titulo}</td>
                      <td className="px-4 py-3 text-on-surface-variant">{n.origem || '—'}</td>
                      <td className="px-4 py-3">
                        {n.valor_estimado != null ? money(n.valor_estimado) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant hidden md:table-cell">
                        {n.atualizado_em ? new Date(n.atualizado_em).toLocaleString('pt-BR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-sm text-on-surface-variant">
          Logado como <strong className="text-primary">{session?.user?.email || '—'}</strong>
          {' · '}
          <Link to="/" className="font-black text-primary hover:text-tertiary underline-offset-4">
            Ir ao Hub
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
