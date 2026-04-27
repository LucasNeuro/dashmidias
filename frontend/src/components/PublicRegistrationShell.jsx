import { HubBrandMark } from './HubBrandMark';

/**
 * Layout público de cadastro: cabeçalho branco alinhado ao painel + área central confortável (não coluna estreita).
 */
export function PublicRegistrationShell({ children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-slate-100 text-on-surface">
      <header className="shrink-0 border-b border-slate-200/90 bg-white shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-8 sm:py-5">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <HubBrandMark compact theme="light" size="lg" />
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-left">
              Cadastro na rede Obra10+
            </p>
          </div>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-8 sm:max-w-2xl sm:px-6 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
