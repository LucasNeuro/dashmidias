/**
 * Carregamento inicial do painel — sem skeleton (evita sobreposição com o layout e AppShell).
 */
export function CampaignsDashboardLoading() {
  return (
    <div
      className="flex min-h-[min(70vh,720px)] w-full flex-col items-center justify-center gap-6 px-4 py-16"
      role="status"
      aria-live="polite"
    >
      <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-tertiary animate-spin" aria-hidden />
      <div className="max-w-md text-center space-y-2">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-primary">A carregar o painel</p>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          A sincronizar o relatório e as campanhas. O menu lateral continua disponível.
        </p>
      </div>
      <div className="h-1.5 w-40 rounded-full bg-slate-200/90 overflow-hidden">
        <div className="h-full w-2/5 rounded-full bg-tertiary/70 animate-pulse" />
      </div>
    </div>
  );
}
