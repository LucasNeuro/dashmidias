import { useEffect, useState } from 'react';

/**
 * Painel lateral (mobile-first). **Cromado unificado** com o sideover de templates:
 * cabeçalho em gradiente escuro, abas com realce verde (emerald), corpo claro.
 *
 * **Formulários (padrão da aplicação):** cabeçalho + `tabItems` (opcional) + área com scroll + **rodapé fixo**
 * na prop `footer` — usar `FormSideoverFooter` (Cancelar + ação principal).
 *
 * `variant` mantém-se por compatibilidade; `operational`, `governance` e `default` usam o mesmo visual.
 */
export function AppSideover({
  open,
  onClose,
  title,
  subtitle,
  children,
  tabItems = null,
  footer = null,
  className = '',
  bodyClassName = 'p-4 sm:p-5 bg-slate-50',
  variant = 'operational',
  eyebrow = null,
  panelClassName = '',
}) {
  void variant;
  const [activeTab, setActiveTab] = useState(tabItems?.[0]?.id ?? null);

  useEffect(() => {
    if (open && tabItems?.length) setActiveTab(tabItems[0].id);
  }, [open]);

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

  const active = tabItems?.find((t) => t.id === activeTab) ?? tabItems?.[0];

  const panelWidth = 'sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[44rem]';
  const headerBg =
    'border-b border-white/10 bg-gradient-to-br from-[#071018] via-primary to-[#1a3550]';

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="app-sideover-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/90 focus-visible:ring-inset"
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div
        className={`relative flex h-full w-full max-w-full ${panelWidth} flex-col bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),-12px_0_40px_rgba(15,23,42,0.12)] border-l border-slate-200/90 transition-transform duration-200 ease-out ${className} ${panelClassName}`}
      >
        <div className={`shrink-0 flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 ${headerBg}`}>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/70">{eyebrow}</p>
            ) : null}
            <h2
              id="app-sideover-title"
              className="text-xl font-black tracking-tight text-white sm:text-2xl"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 break-all font-mono text-xs text-white/85">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-sm border border-white/25 p-2 text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">close</span>
          </button>
        </div>

        {tabItems?.length ? (
          <div className="shrink-0 border-b border-slate-200/90 bg-white px-2 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="flex gap-0 overflow-x-auto no-scrollbar">
              {tabItems.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`shrink-0 border-b-[3px] px-5 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 ${
                    activeTab === t.id
                      ? 'border-emerald-600 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${bodyClassName}`}>
            {tabItems?.length ? active?.content : children}
          </div>
          {footer}
        </div>
      </div>
    </div>
  );
}
