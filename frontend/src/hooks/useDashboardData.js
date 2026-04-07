import { useEffect, useState } from 'react';
import { buildMockPayload } from '../data/mockDashboard';
import { listAvailableReports, loadDashboardBySlug } from '../lib/loadDashboard';
import { getReportSlug, isSupabaseConfigured } from '../lib/supabaseClient';

export function useDashboardData() {
  const [loading, setLoading] = useState(true);
  const [mock, setMock] = useState(false);
  const [banner, setBanner] = useState(null);
  const [payload, setPayload] = useState(null);
  const [syncLabel, setSyncLabel] = useState('Live Data Sync');
  const [reportOptions, setReportOptions] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(getReportSlug());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setBanner(null);
      try {
        if (!isSupabaseConfigured()) {
          if (!cancelled) {
            setPayload(buildMockPayload());
            setMock(true);
            setBanner('Usando dados mock: copie .env.example para .env e preencha VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
            setSyncLabel(`Mock ? ${new Date().toLocaleString('pt-BR')}`);
            setReportOptions([
              {
                slug: 'mock',
                cycle_label: 'Mock',
                period_range_label: 'Dados locais',
              },
            ]);
          }
          return;
        }

        const options = await listAvailableReports();
        const data = await loadDashboardBySlug(selectedSlug);
        if (!cancelled) {
          setReportOptions(options);
          setPayload(data);
          setMock(false);
          if (data.notice) setBanner(data.notice);
          setSyncLabel(`Sincronizado ? ${new Date().toLocaleString('pt-BR')}`);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setPayload(buildMockPayload());
          setMock(true);
          setBanner(`Falha ao ler Supabase: ${e.message}. Exibindo dados mock.`);
          setSyncLabel(`Mock ? ${new Date().toLocaleString('pt-BR')}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedSlug]);

  return { loading, mock, banner, payload, syncLabel, reportOptions, selectedSlug, setSelectedSlug };
}
