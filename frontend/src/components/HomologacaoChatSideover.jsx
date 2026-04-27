import { AppSideover } from './AppSideover';
import { HomologacaoChatThread } from './HomologacaoChatThread';

/**
 * Painel lateral de chat na página pública de homologação.
 * Cromado unificado com o sideover de templates (`AppSideover`).
 */
export function HomologacaoChatSideover({
  open,
  onClose,
  codigoRastreio,
  signupId = null,
  pedidoStatus = null,
  supabase = null,
}) {
  const ref = String(codigoRastreio || '').trim();
  const readOnly = pedidoStatus === 'rejeitado' || pedidoStatus === 'processado';
  const sid = signupId != null && String(signupId).trim() !== '' ? String(signupId) : null;

  return (
    <AppSideover
      open={open}
      onClose={onClose}
      eyebrow="Homologação · chat"
      title="Chat com o HUB"
      subtitle={ref || '—'}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/50 p-0"
    >
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-slate-200/90 bg-white px-4 py-2.5 sm:px-5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Mensagens</p>
          <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
            A lista de mensagens tem rolagem própria.
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-5 sm:py-4">
          {!supabase ? (
            <p className="rounded-xl border border-amber-200/90 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Servidor não configurado — chat indisponível.
            </p>
          ) : !ref ? (
            <p className="text-sm text-on-surface-variant">Indique um código ORG válido para abrir o chat.</p>
          ) : (
            <HomologacaoChatThread
              supabase={supabase}
              refKey={ref}
              chatQueryId={sid}
              mode="public"
              readOnly={readOnly}
              stacked
              pollMs={8000}
            />
          )}
        </div>
      </div>
    </AppSideover>
  );
}
