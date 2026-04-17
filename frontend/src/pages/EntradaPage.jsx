import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { loginPathForPortal, PORTAL_HUB, PORTAL_IMOVEIS } from '../lib/appPortal';

const cardBase =
  'group flex flex-col items-center justify-center rounded-2xl border-2 border-primary/25 bg-white p-10 shadow-md transition hover:border-tertiary hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary';

export function EntradaPage() {
  const [searchParams] = useSearchParams();
  const tpl = searchParams.get('tpl');
  if (tpl) {
    return <Navigate to={`/cadastro/organizacao?tpl=${encodeURIComponent(tpl)}`} replace />;
  }

  return (
    <AuthSplitLayout heroTitle="Obra10+">
      <div className="w-full max-w-lg mx-auto space-y-8">
        <div className="grid gap-6 sm:grid-cols-1">
          <Link to={loginPathForPortal(PORTAL_IMOVEIS)} className={cardBase}>
            <span className="material-symbols-outlined text-5xl text-tertiary mb-3" aria-hidden>
              real_estate_agent
            </span>
            <span className="text-lg font-black uppercase tracking-[0.15em] text-primary">Imóveis</span>
          </Link>

          <Link to={loginPathForPortal(PORTAL_HUB)} className={cardBase}>
            <span className="material-symbols-outlined text-5xl text-tertiary mb-3" aria-hidden>
              construction
            </span>
            <span className="text-lg font-black uppercase tracking-[0.15em] text-primary">Hub</span>
          </Link>
        </div>
      </div>
    </AuthSplitLayout>
  );
}
