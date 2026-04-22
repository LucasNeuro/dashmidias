/** Skeletons alinhados ao padrão mídia: cartões com barra verde à esquerda + bloco de tabela. */

export function GovernanceMetricCardsSkeleton({
  count = 4,
  className = '',
  /** ex.: grid-cols-1 md:grid-cols-2 xl:grid-cols-3 (painel campanhas = 6 cards) */
  gridClassName = 'grid-cols-2 lg:grid-cols-4',
}) {
  return (
    <div
      className={`grid min-w-0 gap-4 ${gridClassName} ${className}`}
      aria-hidden
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-sm border border-slate-200/90 border-l-[3px] border-l-tertiary border-y border-r bg-white p-8 shadow-sm"
        >
          <div className="mb-4 h-2.5 w-28 rounded bg-slate-200" />
          <div className="mb-2 h-10 w-20 max-w-[40%] rounded bg-slate-200" />
          <div className="mt-2 h-3 w-40 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function GovernanceTableBlockSkeleton({ rows = 6 }) {
  return (
    <div className="min-w-0 space-y-4" aria-hidden>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full max-w-md animate-pulse rounded-lg bg-slate-100" />
        <div className="h-4 w-28 shrink-0 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5">
          <div className="h-3 w-48 animate-pulse rounded bg-slate-200/80" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex gap-3 px-4 py-3.5 sm:px-5">
              <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
              <div className="hidden h-4 w-32 animate-pulse rounded bg-slate-100 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

