import { useEffect } from 'react';
import { HomologacaoChatThread } from './HomologacaoChatThread';

/**
 * Painel lateral de chat na página pública de homologação.
 * Mesmo padrão do `AppSideover` operational: gradiente no cabeçalho, corpo com **rolagem só na lista de mensagens**.
 */
export function HomologacaoChatSideover({
  open,
  onClose,
  codigoRastreio,
  signupId = null,
  pedidoStatus = null,
  supabase = null,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const ref = String(codigoRastreio || '').trim();
  const readOnly = pedidoStatus === 'rejeitado' || pedidoStatus === 'processado';
  const sid = signupId != null && String(signupId).trim() !== '' ? String(signupId) : null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="homolog-chat-sideover-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Fechar chat"
        onClick={onClose}
      />
      <div
        className="relative flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col border-l border-slate-200/90 bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),-12px_0_40px_rgba(15,23,42,0.12)] transition-transform duration-200 ease-out sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[44rem]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-gradient-to-br from-[#071018] via-primary to-[#1a3550] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/70">Homologação · chat</p>
            <h2 id="homolog-chat-sideover-title" className="text-xl font-black tracking-tight text-white sm:text-2xl">
              Chat com o HUB
            </h2>
            <p className="mt-1 break-all font-mono text-xs text-white/85" title={ref || undefined}>
              {ref || '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm border border-white/25 p-2 text-white hover:bg-white/10"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-slate-50/50">
          <div className="shrink-0 border-b border-slate-200/90 bg-white px-4 py-2.5 sm:px-5">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Mensagens</p>
            <p className="mt-0.5 text-xs leading-relaxed text-on-surface-variant">
              A lista abaixo tem rolagem própria. O mesmo histórico aparece para a equipa no painel de organizações.
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
      </div>
    </div>
  );
}
