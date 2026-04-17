import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { getAppNavItems } from '../lib/appNavItems';

const TITLES = {
  imobiliaria: 'CRM Imobiliária',
  arquitetura: 'CRM Arquitetura',
  servicos: 'CRM Serviços',
  produtos: 'CRM Produtos',
  tarefas: 'Tarefas',
  agenda: 'Agenda',
  relatorios: 'Relatórios',
};

/**
 * Placeholder para módulos CRM listados no menu (Kanban / listas virão aqui).
 */
export function CrmPlaceholderPage() {
  const { segment } = useParams();
  const { isAdmin, hubAdmin, isHubOwner, isPlatformOwner, portal } = useAuth();
  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;
  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );
  const title = TITLES[segment] || 'CRM';

  return (
    <AppShell title={title} subtitle="Módulo em construção — funis e quadros serão implementados nesta área." navItems={navItems}>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-xl border border-surface-container-high bg-white p-8 shadow-sm">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Área reservada ao fluxo deste segmento (lista, Kanban, métricas), alinhada ao layout de referência do CRM.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
