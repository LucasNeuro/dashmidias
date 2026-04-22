/**
 * Cartão de métrica alinhado ao painel de mídia: fundo branco, borda leve,
 * barra vertical verde (tertiary) à esquerda, rótulo em caixa alta cinza, valor forte, rodapé discreto.
 */

const SURFACE = {
  /** Padrão mídia: barra verde à esquerda (igual sumário executivo “Investimento”). */
  whiteMedia:
    'rounded-sm bg-white border border-slate-200/90 border-l-[3px] border-l-tertiary border-y border-r shadow-sm',
  white: 'rounded-sm bg-white border border-surface-container-high shadow-sm',
  /** Acento navy (legado / primeiro cartão). */
  whiteAccentPrimary:
    'rounded-sm bg-white border border-surface-container-high border-l-4 border-l-primary border-y border-r shadow-sm',
  whiteAccentAmber:
    'rounded-sm bg-white border border-amber-200/80 border-l-4 border-l-amber-500 border-y border-r shadow-sm',
  darkBlue: 'relative overflow-hidden rounded-sm bg-gradient-to-br from-primary to-[#152a3d] text-white shadow-md',
  darkSlate: 'relative overflow-hidden rounded-sm bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md',
  tertiary:
    'relative overflow-hidden rounded-sm bg-gradient-to-br from-tertiary/90 to-[#16a34a] text-primary shadow-md',
  amberPanel:
    'rounded-sm border border-amber-200/90 bg-gradient-to-b from-amber-50 to-amber-100/80 shadow-sm',
  /** Destaque escuro + valor verde (ex.: ROAS no painel de campanhas). */
  highlight: 'rounded-sm bg-primary border-l-4 border-l-tertiary shadow-sm text-white',
};

/**
 * @param {{
 *   label: string,
 *   value: import('react').ReactNode,
 *   footer?: import('react').ReactNode,
 *   surface?: keyof typeof SURFACE,
 *   icon?: string,
 *   valueClassName?: string,
 *   labelClassName?: string,
 *   className?: string,
 * }} props
 */
export function DashboardMetricCard({
  label,
  value,
  footer = null,
  surface = 'whiteMedia',
  icon = null,
  valueClassName = '',
  labelClassName = '',
  className = '',
}) {
  const isDark = surface === 'darkBlue' || surface === 'darkSlate' || surface === 'highlight';
  const isTertiary = surface === 'tertiary';
  const isAmber = surface === 'amberPanel';
  const isHighlight = surface === 'highlight';
  const isWhiteAmber = surface === 'whiteAccentAmber';
  const isWhiteMedia = surface === 'whiteMedia';

  const labelCls =
    labelClassName ||
    (isHighlight
      ? 'text-[10px] font-black uppercase tracking-widest text-white/60 mb-4'
      : isDark
        ? 'text-[10px] font-black uppercase tracking-widest text-white/75'
        : isTertiary
          ? 'text-[10px] font-black uppercase tracking-widest text-primary/90'
          : isAmber
            ? 'text-[10px] font-black uppercase tracking-widest text-amber-900/80'
            : isWhiteAmber
              ? 'text-[10px] font-black uppercase tracking-widest text-amber-900/80 mb-4'
              : 'text-[10px] font-black uppercase tracking-widest text-on-surface-variant mb-4');

  const defaultValueCls = isHighlight
    ? 'text-5xl font-black text-tertiary tracking-tighter mb-2'
    : isDark || isTertiary
      ? 'mt-1 text-3xl font-black tabular-nums'
      : isAmber
        ? 'mt-1 font-mono text-sm font-bold leading-snug text-amber-950'
        : isWhiteAmber
          ? 'text-3xl sm:text-4xl font-black tabular-nums text-amber-950 mb-2'
          : isWhiteMedia
            ? 'text-3xl sm:text-4xl font-black text-primary tracking-tighter tabular-nums mb-2'
            : 'text-3xl sm:text-4xl font-black text-primary tracking-tighter tabular-nums mb-2';

  const pad = isHighlight ? 'p-8' : isDark || isTertiary || isAmber ? 'p-4' : 'p-8';

  const footerRowClass =
    isHighlight
      ? 'flex items-center gap-2 text-white font-bold text-[11px] uppercase tracking-widest'
      : isDark
        ? 'mt-2 flex items-center gap-2 text-[11px] font-bold text-white/80'
        : isTertiary
          ? 'mt-2 flex items-center gap-2 text-[11px] font-bold text-primary/90'
          : isAmber
            ? 'mt-3 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide text-amber-950/90'
            : isWhiteAmber
              ? 'mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-amber-900/90 [&>span.material-symbols-outlined]:text-amber-800'
              : 'mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-on-surface-variant [&>span.material-symbols-outlined]:text-tertiary';

  return (
    <div className={`${SURFACE[surface] ?? SURFACE.whiteMedia} ${pad} ${className}`}>
      {icon && (isDark || isTertiary) ? (
        <span className="material-symbols-outlined pointer-events-none absolute right-3 top-3 text-[40px] opacity-[0.12]" aria-hidden>
          {icon}
        </span>
      ) : null}
      {isAmber && icon ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={labelCls}>{label}</p>
            <div className={`${defaultValueCls} ${valueClassName}`}>{value}</div>
          </div>
          <span className="material-symbols-outlined shrink-0 text-amber-800/50 text-[32px]" aria-hidden>
            {icon}
          </span>
        </div>
      ) : (
        <>
          <p className={labelCls}>{label}</p>
          <div className={`${defaultValueCls} ${valueClassName}`}>{value}</div>
        </>
      )}
      {footer ? <div className={footerRowClass}>{footer}</div> : null}
    </div>
  );
}
