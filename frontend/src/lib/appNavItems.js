import { PORTAL_HUB, PORTAL_IMOVEIS } from './appPortal';

/**
 * Navegação CRM: ícone + rótulo na gaveta.
 * Hub: Dashboard = painel mídias/campanhas; sem duplicar «Painel de insights».
 */
export function getAppNavItems({ isAdmin, hubGovernance, portal = PORTAL_HUB }) {
  if (portal === PORTAL_IMOVEIS) {
    return buildImoveisNav({ isAdmin, hubGovernance });
  }
  return buildHubNav({ isAdmin, hubGovernance });
}

function governanceBlock(isAdmin, hubGovernance) {
  if (hubGovernance) {
    return [
      {
        to: '/adm/auditoria',
        label: 'Governança',
        icon: 'admin_panel_settings',
        end: true,
      },
    ];
  }
  if (isAdmin) {
    return [{ to: '/adm/auditoria', label: 'Governança', icon: 'shield', end: true }];
  }
  return [];
}

function buildHubNav({ isAdmin, hubGovernance }) {
  const core = [
    { to: '/painel/campanhas', label: 'Dashboard', icon: 'space_dashboard', end: true },
    { to: '/crm', label: 'CRM Geral', icon: 'groups' },
    { to: '/crm/imobiliaria', label: 'Imobiliária', icon: 'real_estate_agent' },
    { to: '/crm/arquitetura', label: 'Arquitetura', icon: 'architecture' },
    { to: '/crm/servicos', label: 'Serviços', icon: 'design_services' },
    { to: '/crm/produtos', label: 'Produtos', icon: 'inventory_2' },
  ];
  const tail = [
    ...governanceBlock(isAdmin, hubGovernance),
    { to: '/crm/tarefas', label: 'Tarefas', icon: 'task_alt' },
    { to: '/crm/agenda', label: 'Agenda', icon: 'calendar_month' },
    { to: '/crm/relatorios', label: 'Relatórios', icon: 'bar_chart' },
  ];
  return [...core, ...tail];
}

function buildImoveisNav({ isAdmin, hubGovernance }) {
  const core = [
    { to: '/painel/campanhas', label: 'Dashboard', icon: 'space_dashboard', end: true },
    { to: '/crm', label: 'CRM Geral', icon: 'groups' },
    { to: '/crm/imobiliaria', label: 'Imobiliária', icon: 'real_estate_agent' },
    { to: '/crm/arquitetura', label: 'Arquitetura', icon: 'architecture' },
    { to: '/crm/servicos', label: 'Serviços', icon: 'design_services' },
    { to: '/crm/produtos', label: 'Produtos', icon: 'inventory_2' },
  ];
  const tail = [
    ...governanceBlock(isAdmin, hubGovernance),
    { to: '/crm/tarefas', label: 'Tarefas', icon: 'task_alt' },
    { to: '/crm/agenda', label: 'Agenda', icon: 'calendar_month' },
    { to: '/crm/relatorios', label: 'Relatórios', icon: 'bar_chart' },
  ];
  return [...core, ...tail];
}
