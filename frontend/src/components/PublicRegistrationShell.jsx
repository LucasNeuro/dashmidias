import { HubBrandMark } from './HubBrandMark';

/**
 * Layout público de cadastro: faixa superior clara (azul muito suave, como a referência Obra10+) + conteúdo.
 */
export function PublicRegistrationShell({ children }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-on-surface">
      <header className="shrink-0 border-b border-sky-300/80 bg-gradient-to-r from-sky-100 from-[-10%] via-sky-50 via-45% to-white to-[105%] px-4 py-4 shadow-[inset_0_-1px_0_rgba(56,189,248,0.35)] sm:px-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center">
          <HubBrandMark compact theme="light" size="lg" />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
