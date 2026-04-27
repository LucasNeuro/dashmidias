/**
 * Botões padronizados HUB (governança / tabelas): cantos retos, caixa alta, ícone + rótulo.
 * Primário = fundo navy; secundário = fundo azul claro + borda (como “Copiar link público”).
 */
export const hubButtonClass = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-none border-0 bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-white hover:bg-[#0f2840] disabled:pointer-events-none disabled:opacity-50',
  secondary:
    'inline-flex items-center justify-center gap-2 rounded-none border border-sky-300 bg-sky-50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-50',
  /** Ações compactas em linhas de tabela (secundário). */
  tableSecondary:
    'inline-flex items-center justify-center gap-1 rounded-none border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-50',
  /** Ações compactas em tabela (primário). */
  tablePrimary:
    'inline-flex items-center justify-center gap-1 rounded-none border-0 bg-primary px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white hover:bg-[#0f2840] disabled:pointer-events-none disabled:opacity-50',
  /** Excluir / perigo. */
  danger:
    'inline-flex items-center justify-center gap-1 rounded-none border border-red-300 bg-red-50 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-red-900 hover:bg-red-100 disabled:pointer-events-none disabled:opacity-50',
  /** Secundário com borda tracejada (ex.: “Adicionar campo”). */
  secondaryDashed:
    'inline-flex items-center justify-center gap-2 rounded-none border border-dashed border-sky-400 bg-sky-50/80 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:border-sky-500 hover:bg-sky-100 disabled:pointer-events-none disabled:opacity-50',
};

/**
 * @param {object} props
 * @param {'primary' | 'secondary' | 'tableSecondary' | 'tablePrimary' | 'danger' | 'secondaryDashed'} [props.variant]
 * @param {string} [props.icon] — nome Material Symbols
 * @param {string} [props.iconClassName]
 * @param {import('react').ReactNode} props.children
 */
export function HubButton({ variant = 'primary', icon, iconClassName, children, className = '', type = 'button', ...rest }) {
  const cls = hubButtonClass[variant] || hubButtonClass.primary;
  const iconCls =
    iconClassName ||
    (variant === 'primary' || variant === 'secondary' || variant === 'secondaryDashed'
      ? 'text-[20px]'
      : 'text-[16px]');
  return (
    <button type={type} className={`${cls} ${className}`.trim()} {...rest}>
      {icon ? (
        <span className={`material-symbols-outlined shrink-0 ${iconCls}`} aria-hidden>
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}
