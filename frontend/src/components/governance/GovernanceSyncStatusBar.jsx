import { useGovernanceRealtimeSync } from '../../hooks/useGovernanceRealtimeSync';

/**
 * Card compacto: estado da sincronização em tempo real (Supabase → TanStack Query).
 */
export function GovernanceSyncStatusBar({ supabase, enabled }) {
  const { channelStatus } = useGovernanceRealtimeSync({ supabase, enabled });

  if (!enabled || !supabase) return null;

  const isLive = channelStatus === 'live';
  const isErr = channelStatus === 'error';
  const isPending = channelStatus === 'connecting';

  return (
    <div
      className={`mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm ${
        isErr
          ? 'border-amber-300 bg-amber-50 text-amber-950'
          : isLive
            ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
            : 'border-slate-200 bg-white text-slate-700'
      }`}
      role="status"
    >
      <span
        className={`inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
          isLive ? 'animate-pulse bg-emerald-600' : isErr ? 'bg-amber-500' : isPending ? 'bg-slate-400' : 'bg-slate-300'
        }`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-900">Sincronização em tempo real</p>
        <p className="text-xs leading-snug text-slate-600">
          {isLive
            ? 'Alterações na base aparecem automaticamente nestas telas (cache TanStack Query).'
            : isErr
              ? 'Não foi possível activar o canal em tempo real. Verifique Realtime na consola Supabase ou recarregue a página.'
              : isPending
                ? 'A ligar ao servidor…'
                : 'A aguardar ligação.'}
        </p>
      </div>
    </div>
  );
}
