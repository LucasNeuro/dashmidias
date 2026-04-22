import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useUiFeedback } from '../context/UiFeedbackContext';

/** @param {import('@supabase/supabase-js').SupabaseClient | null} supabase */
function invalidateByTable(queryClient, table) {
  switch (table) {
    case 'registration_form_template':
      void queryClient.invalidateQueries({ queryKey: ['registration_form_templates'] });
      void queryClient.invalidateQueries({ queryKey: ['registration_form_template'] });
      break;
    case 'hub_partner_org_signups':
      void queryClient.invalidateQueries({ queryKey: ['governance', 'partner-org-signups'] });
      break;
    case 'hub_solicitacoes_admin':
    case 'profiles':
      void queryClient.invalidateQueries({ queryKey: ['governance', 'users-page'] });
      void queryClient.invalidateQueries({ queryKey: ['governance', 'profiles'] });
      void queryClient.invalidateQueries({ queryKey: ['governance', 'audit'] });
      break;
    case 'panel_access_logs':
      void queryClient.invalidateQueries({ queryKey: ['governance', 'audit'] });
      break;
    default:
      break;
  }
}

/**
 * Supabase Realtime → invalida queries do React Query (governança HUB).
 * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null, enabled: boolean }} opts
 */
export function useGovernanceRealtimeSync({ supabase, enabled }) {
  const queryClient = useQueryClient();
  const { toast } = useUiFeedback();
  const [channelStatus, setChannelStatus] = useState(/** @type {'idle' | 'connecting' | 'live' | 'error'} */ ('idle'));
  const toastTimer = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

  const scheduleFeedback = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      toast('Dados actualizados em tempo real.', { variant: 'success', duration: 4200 });
    }, 500);
  }, [toast]);

  useEffect(() => {
    if (!enabled || !supabase) {
      setChannelStatus('idle');
      return;
    }

    setChannelStatus('connecting');

    const onChange = (payload) => {
      const table = /** @type {{ table?: string }} */ (payload)?.table;
      if (table) invalidateByTable(queryClient, table);
      else {
        void queryClient.invalidateQueries({ queryKey: ['registration_form_templates'] });
        void queryClient.invalidateQueries({ queryKey: ['registration_form_template'] });
        void queryClient.invalidateQueries({ queryKey: ['governance'] });
      }
      scheduleFeedback();
    };

    const channel = supabase
      .channel('hub-governance-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'registration_form_template' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_partner_org_signups' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hub_solicitacoes_admin' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'panel_access_logs' }, onChange)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setChannelStatus('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setChannelStatus('error');
        else if (status === 'CLOSED') setChannelStatus('idle');
      });

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      void supabase.removeChannel(channel);
      setChannelStatus('idle');
    };
  }, [enabled, supabase, queryClient, scheduleFeedback]);

  return { channelStatus };
}
