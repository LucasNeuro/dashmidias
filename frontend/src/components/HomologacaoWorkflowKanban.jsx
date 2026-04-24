import { useCallback, useMemo, useState } from 'react';
import { rpcHubAdminSetSignupWorkflowEtapa } from '../lib/hubPartnerOrgGovernance';

const COLS = [
  { id: 'pendente', label: 'Pendente', hint: 'Fila inicial' },
  { id: 'aguardando_retorno', label: 'Aguardando retorno', hint: 'À espera do parceiro ou documentos' },
  { id: 'em_analise', label: 'Em análise', hint: 'Análise pela equipa Obra10+' },
  { id: 'aprovado', label: 'Aprovado', hint: 'Pronto para formalizar (provisionar)' },
];

/**
 * Mini-Kanban vertical no painel HUB: move o pedido entre etapas operacionais.
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
 *   signupId: string,
 *   status: string | null | undefined,
 *   workflowEtapa: string | null | undefined,
 *   onUpdated?: () => void,
 * }} p
 */
export function HomologacaoWorkflowKanban({ supabase, signupId, status, workflowEtapa, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string | null} */ (null));

  const current = useMemo(() => {
    const st = String(status || '').toLowerCase();
    const w = String(workflowEtapa || '').toLowerCase().trim();
    if (st === 'processado' || st === 'rejeitado') return null;
    if (w && COLS.some((c) => c.id === w)) return w;
    if (st === 'aprovado') return 'aprovado';
    return 'pendente';
  }, [status, workflowEtapa]);

  const canEdit = String(status || '').toLowerCase() === 'pendente' || String(status || '').toLowerCase() === 'aprovado';

  const curIdx = COLS.findIndex((c) => c.id === current);

  const move = useCallback(
    async (etapa) => {
      if (!supabase || !signupId || !canEdit || etapa === current) return;
      setBusy(true);
      setErr(null);
      try {
        const r = await rpcHubAdminSetSignupWorkflowEtapa(supabase, signupId, etapa);
        if (!r.ok) {
          setErr(r.error || 'Não foi possível actualizar a etapa.');
          return;
        }
        onUpdated?.();
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro ao actualizar.');
      } finally {
        setBusy(false);
      }
    },
    [supabase, signupId, canEdit, current, onUpdated]
  );

  if (!canEdit || current == null) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 text-sm text-on-surface-variant">
        {String(status || '').toLowerCase() === 'processado'
          ? 'Pedido já provisionado — o fluxo interno está concluído.'
          : null}
        {String(status || '').toLowerCase() === 'rejeitado'
          ? 'Pedido rejeitado — o fluxo de etapas está encerrado.'
          : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Fluxo de homologação</p>
        <p className="mt-1 text-[11px] leading-relaxed text-on-surface-variant">
          Clique numa etapa para mover o pedido. O parceiro vê o histórico na página de acompanhamento.
        </p>
      </div>
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900" role="alert">
          {err}
        </p>
      ) : null}
      <ol className="relative flex flex-col gap-0 border-l-2 border-slate-200 pl-4">
        {COLS.map((col, idx) => {
          const active = col.id === current;
          const done = curIdx !== -1 && idx < curIdx;
          return (
            <li key={col.id} className="relative pb-4 last:pb-0">
              <span
                className={`absolute -left-[9px] top-1.5 h-3.5 w-3.5 rounded-full border-2 ${
                  active
                    ? 'border-tertiary bg-tertiary shadow-[0_0_0_3px_rgba(15,118,110,0.2)]'
                    : done
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-slate-300 bg-white'
                }`}
                aria-hidden
              />
              <button
                type="button"
                disabled={busy || active}
                onClick={() => void move(col.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition ${
                  active
                    ? 'border-tertiary bg-tertiary/10 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-tertiary/40 hover:bg-slate-50/80'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <p className="text-[10px] font-black uppercase tracking-wide text-primary">{col.label}</p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">{col.hint}</p>
                {active ? (
                  <p className="mt-1 text-[10px] font-semibold text-tertiary">Etapa actual</p>
                ) : (
                  <p className="mt-1 text-[10px] text-slate-500">Clicar para mover aqui</p>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
