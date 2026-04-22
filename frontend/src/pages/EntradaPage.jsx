import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Rota de compatibilidade: links antigos a `/entrada` e `?tpl=` de convite.
 * Login unificado em `/login`; pós-login segue [postLoginPath](../lib/postLoginPath.js) (admin, pendente, home).
 */
export function EntradaPage() {
  const [searchParams] = useSearchParams();
  const tpl = searchParams.get('tpl');
  if (tpl) {
    return <Navigate to={`/cadastro/organizacao?tpl=${encodeURIComponent(tpl)}`} replace />;
  }
  return <Navigate to="/login" replace />;
}
