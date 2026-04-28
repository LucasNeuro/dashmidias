import { HubButton } from './HubButton';

/**
 * Barra inferior fixa padrão para sideovers de formulário na aplicação.
 *
 * Padrão visual: [Cancelar] (secundário, ícone close) + ação principal (solid).
 * Para ações extra ou composição livre, use `children` em vez dos props de botão único.
 */
export function FormSideoverFooter({
  onCancel,
  cancelLabel = 'Cancelar',
  primaryLabel,
  primaryIcon = 'save',
  onPrimary,
  primaryDisabled,
  busy = false,
  loadingLabel,
  children,
  className = '',
}) {
  if (children != null) {
    return (
      <div className={`shrink-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] sm:px-6 ${className}`}>
        <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">{children}</div>
      </div>
    );
  }

  return (
    <div className={`shrink-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] sm:px-6 ${className}`}>
      <div className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3">
        <HubButton
          variant="secondary"
          icon="close"
          onClick={onCancel}
          className="!text-xs !font-semibold !tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {cancelLabel}
        </HubButton>
        <HubButton
          variant="primary"
          icon={primaryIcon}
          disabled={primaryDisabled || busy}
          onClick={onPrimary}
          className="!text-xs !font-semibold !tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35"
        >
          {busy && loadingLabel ? loadingLabel : primaryLabel}
        </HubButton>
      </div>
    </div>
  );
}
