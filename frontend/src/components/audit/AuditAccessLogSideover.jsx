import { useMemo } from 'react';
import { AppSideover } from '../AppSideover';
import { getAuditRouteKind } from '../../lib/auditRouteKind';

export function AuditAccessLogSideover({ open, onClose, log, emailById, roleById = {} }) {
  const tabItems = useMemo(() => {
    if (!log) return [];
    const kind = getAuditRouteKind(log.path);
    const userLabel = emailById?.[log.user_id] || log.user_id || '—';
    const isOwner = roleById?.[log.user_id] === 'owner';
    return [
      {
        id: 'resumo',
        label: 'Resumo',
        content: (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${kind.chip}`}>{kind.label}</span>
              {isOwner ? (
                <span className="rounded border border-amber-300/90 bg-amber-100 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-950">
                  Owner
                </span>
              ) : null}
              <span className="text-[10px] font-mono text-on-surface-variant">ID {log.id}</span>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="rounded-sm border border-surface-container-high bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase text-on-surface-variant">Quando</dt>
                <dd className="mt-1 font-mono text-xs text-primary">
                  {log.accessed_at ? new Date(log.accessed_at).toLocaleString('pt-BR') : '—'}
                </dd>
              </div>
              <div className="rounded-sm border border-surface-container-high bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase text-on-surface-variant">Usuário</dt>
                <dd className="mt-1 break-all font-mono text-[11px] text-primary">{userLabel}</dd>
              </div>
              <div className="rounded-sm border border-surface-container-high bg-slate-50 p-3">
                <dt className="text-[10px] font-black uppercase text-on-surface-variant">Rota</dt>
                <dd className="mt-1 break-all font-mono text-xs text-primary">{log.path || '—'}</dd>
              </div>
            </dl>
          </div>
        ),
      },
      {
        id: 'ua',
        label: 'User-Agent',
        content: (
          <pre className="hub-table-scrollbar max-h-[50vh] overflow-auto rounded-sm border border-surface-container-high bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-primary whitespace-pre-wrap break-all">
            {log.user_agent || '—'}
          </pre>
        ),
      },
    ];
  }, [log, emailById, roleById]);

  return (
    <AppSideover
      open={open && !!log}
      onClose={onClose}
      variant="governance"
      title="Registro de acesso"
      subtitle={log?.path || '—'}
      tabItems={tabItems}
    />
  );
}
