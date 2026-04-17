import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../context/AuthContext';
import { getAppNavItems } from '../../lib/appNavItems';
import { PORTAL_HUB } from '../../lib/appPortal';

/**
 * Entrada do núcleo Obra10+ HUB (organizações, negócios, pipeline, RLS).
 * Implementação conforme docs/FLUXO_INICIO_DESENVOLVIMENTO.md e SCHEMA_DADOS_V0.md.
 */
export function HubHomePage() {
  const { isAdmin, hubAdmin, isHubOwner, isPlatformOwner, portal, setPortal } = useAuth();
  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;

  useEffect(() => {
    setPortal(PORTAL_HUB);
  }, [setPortal]);

  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );

  return (
    <AppShell
      title="Nucleo da plataforma"
      subtitle="Area em construcao: CRM multi-tenant, negocio central (negocio_id), pipeline e eventos de dominio."
      navItems={navItems}
    >
      <div className="w-full max-w-[1100px] mx-auto px-4 py-8 space-y-6 min-w-0">
        <section className="bg-white border border-surface-container-high p-6 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Proximos passos (documentacao)</h2>
          <ol className="list-decimal pl-5 text-sm text-on-surface-variant space-y-2">
            <li>Schema + RLS: <code className="text-xs">docs/SCHEMA_DADOS_V0.md</code></li>
            <li>Ordem de build: <code className="text-xs">docs/FLUXO_INICIO_DESENVOLVIMENTO.md</code></li>
            <li>Visao de produto: <code className="text-xs">docs/SPEC.md</code></li>
          </ol>
        </section>

        <section className="bg-white border border-surface-container-high p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-5 bg-tertiary" />
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Escopo atual</h3>
          </div>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Estrutura inicial orientada a autenticacao, tenant, modulos e permissao por perfil. A sidebar segue o mesmo
            estilo do dashboard para manter consistencia visual em toda a aplicacao.
          </p>
          <p className="text-sm">
            <Link to="/painel/campanhas" className="font-black text-primary hover:text-tertiary underline-offset-4">
              Voltar ao modulo Painel de campanhas e insights
            </Link>
          </p>
        </section>
      </div>
    </AppShell>
  );
}
