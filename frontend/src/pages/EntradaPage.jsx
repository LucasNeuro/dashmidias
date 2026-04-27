import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Rota de compatibilidade: links antigos a `/entrada` e `?tpl=` de convite.
 * Sem `tpl`, redirecciona para `/cadastro` (entrada inteligente). Com `tpl`, para `/cadastro/organizacao`.
 */
export function EntradaPage() {
  const [searchParams] = useSearchParams();
  const tpl = searchParams.get('tpl');
  if (tpl) {
    return <Navigate to={`/cadastro/organizacao?tpl=${encodeURIComponent(tpl)}`} replace />;
  }
  return <Navigate to="/cadastro" replace />;
}
