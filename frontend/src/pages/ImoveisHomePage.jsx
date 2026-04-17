import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';
import { getAppNavItems } from '../lib/appNavItems';
import { PORTAL_IMOVEIS } from '../lib/appPortal';

/** Home do ambiente Imóveis (isolado do Hub na navegação). */
export function ImoveisHomePage() {
  const { isAdmin, hubAdmin, isHubOwner, isPlatformOwner, portal, setPortal } = useAuth();
  const hubGovernance = hubAdmin || isHubOwner || isPlatformOwner;

  useEffect(() => {
    setPortal(PORTAL_IMOVEIS);
  }, [setPortal]);

  const navItems = useMemo(
    () => getAppNavItems({ isAdmin, hubGovernance, portal }),
    [isAdmin, hubGovernance, portal]
  );

  return (
    <AppShell
      title="Imóveis"
      subtitle="Área imobiliária: corretores, imobiliárias, cadastros e clientes."
      navItems={navItems}
    >
      <div className="w-full max-w-[1100px] mx-auto px-4 py-8 space-y-6 min-w-0">
        <section className="bg-white border border-surface-container-high p-6 shadow-sm space-y-3">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-primary">Em construção</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Módulos de imóveis, equipes e catálogo serão evoluídos aqui.
          </p>
          <Link
            to="/crm"
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-tertiary border-b-2 border-tertiary pb-0.5 hover:text-primary hover:border-primary"
          >
            Negócios (CRM)
            <span className="material-symbols-outlined text-lg leading-none" aria-hidden>
              arrow_forward
            </span>
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
