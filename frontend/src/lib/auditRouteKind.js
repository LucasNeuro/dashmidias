/**
 * Classificação de rotas para auditoria de acessos ao painel (UI: chips / sideover).
 */
export function getAuditRouteKind(path) {
  const p = path || '';
  if (p.startsWith('/adm')) {
    return { label: 'Governança', chip: 'bg-tertiary/20 text-primary ring-1 ring-tertiary/40' };
  }
  if (p === '/' || p.startsWith('/painel') || p.startsWith('/crm')) {
    return { label: 'Operação', chip: 'bg-sky-100 text-sky-900 ring-1 ring-sky-200' };
  }
  if (p.startsWith('/entrada') || p.startsWith('/login')) {
    return { label: 'Auth', chip: 'bg-violet-100 text-violet-900 ring-1 ring-violet-200' };
  }
  return { label: 'Outro', chip: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200' };
}
