import { useLocation } from 'react-router-dom';
import { GovernanceMetricCardsSkeleton, GovernanceTableBlockSkeleton } from './GovernanceDataSkeleton';

/** Quantidade de cartões de métrica por rota /adm/* (alinhado às páginas reais). */
function governanceSkeletonMetricCount(pathname) {
  if (pathname.includes('/usuarios')) return 3;
  if (pathname.includes('/organizacoes')) return 4;
  if (pathname.includes('/auditoria')) return 4;
  if (pathname.includes('/templates')) return 0;
  if (pathname.includes('/configuracoes')) return 0;
  return 4;
}

/** Skeleton ao carregar rotas lazy de governança (Suspense): métricas + tabela. */
export function GovernancePageSkeleton() {
  const { pathname } = useLocation();
  const metricCount = governanceSkeletonMetricCount(pathname);

  return (
    <div className="w-full min-w-0 max-w-none space-y-5" aria-hidden>
      <div className="flex flex-col gap-3 border-b border-surface-container-high pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-9 w-44 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-6 w-1.5 animate-pulse bg-slate-200" />
        <div className="h-3 w-40 animate-pulse rounded bg-slate-200" />
      </div>
      {metricCount > 0 ? <GovernanceMetricCardsSkeleton count={metricCount} /> : null}
      <div className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-[#f8fafc] px-4 py-3 sm:px-5">
          <div className="h-3 w-52 animate-pulse rounded bg-slate-200/80" />
        </div>
        <div className="p-4 sm:p-5">
          <GovernanceTableBlockSkeleton rows={metricCount === 0 ? 8 : 5} />
        </div>
      </div>
    </div>
  );
}
