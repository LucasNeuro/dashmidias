import { useEffect, useState } from 'react';

/**
 * Painel lateral (mobile-first: largura total em telas pequenas).
 * tabItems opcional: cada item renderiza conteúdo próprio; sem tabs, use children.
 *
 * variant:
 * - default: cabeçalho branco
 * - governance: gradiente governança (painel padrão)
 * - operational: painel mais largo + cabeçalho denso (fluxos de cadastro, CRM, operações)
 */
export function AppSideover({
  open,
  onClose,
  title,
  subtitle,
  children,
  tabItems = null,
  className = '',
  bodyClassName = 'p-4',
  variant = 'default',
  eyebrow = null,
  panelClassName = '',
}) {
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
  const isGov = variant === 'governance';
  const isOps = variant === 'operational';
  const isDarkHeader = isGov || isOps;

  const panelWidth =
    variant === 'operational'
      ? 'sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[44rem]'
      : 'sm:max-w-md md:max-w-lg lg:max-w-xl';

  const headerBg = isOps
    ? 'border-b border-white/10 bg-gradient-to-br from-[#071018] via-primary to-[#1a3550]'
    : isGov
      ? 'border-b border-white/10 bg-gradient-to-r from-primary via-[#1a3050] to-[#24364a]'
      : 'border-b border-surface-container-high';

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="app-sideover-title">
      <button
        type="button"
        className={`absolute inset-0 backdrop-blur-[2px] ${isOps ? 'bg-black/50' : 'bg-black/40'}`}
        aria-label="Fechar painel"
        onClick={onClose}
      />
      <div
        className={`relative flex h-full w-full max-w-full ${panelWidth} flex-col bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),-12px_0_40px_rgba(15,23,42,0.12)] border-l border-slate-200/90 transition-transform duration-200 ease-out ${className} ${panelClassName}`}
      >
        <div className={`shrink-0 flex items-start justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 ${headerBg}`}>
          <div className="min-w-0">
            {eyebrow ? (
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${isDarkHeader ? 'text-white/70' : 'text-on-surface-variant'}`}>{eyebrow}</p>
            ) : null}
            <h2
              id="app-sideover-title"
              className={`${isOps ? 'text-xl sm:text-2xl' : 'text-lg'} font-black tracking-tight ${isDarkHeader ? 'text-white' : 'text-primary'}`}
            >
              {title}
            </h2>
            {subtitle ? (
              <p className={`mt-1 font-mono text-xs break-all ${isDarkHeader ? 'text-white/85' : 'text-on-surface-variant'}`}>{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 rounded-sm p-2 ${
              isDarkHeader
                ? 'border border-white/25 text-white hover:bg-white/10'
                : 'border border-surface-container-high text-on-surface-variant hover:bg-surface-container-low'
            }`}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-[22px] leading-none">close</span>
          </button>
        </div>

        {tabItems?.length ? (
          <div
            className={`shrink-0 flex gap-0 overflow-x-auto border-b px-2 no-scrollbar ${
              isDarkHeader ? 'border-surface-container-high bg-slate-50/90' : 'border-surface-container-high'
            }`}
          >
            {tabItems.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`shrink-0 border-b-[3px] px-3 py-2.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                  activeTab === t.id ? 'border-tertiary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${bodyClassName}`}>
          {tabItems?.length ? active?.content : children}
        </div>
      </div>
    </div>
  );
}
