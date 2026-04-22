import { HubBrandMark } from './HubBrandMark';

/**
 * Layout partilhado: painel esquerdo (marca HUB) + área de formulário à direita.
 * Fundo cobre sempre o viewport (100dvh) para não aparecer “faixa branca” ao rolar.
 * Em desktop o scroll fica na coluna direita; em mobile, coluna única com altura de viewport.
 */
export function AuthSplitLayout({
  heroTitle,
  heroSubtitle,
  /** Opcional: faixa pequena acima da marca (ex.: campanha). Omitir para não mostrar. */
  badge,
  buildLabel = 'Build 2.4.0-GA',
  children,
}) {
  /** `HubBrandMark` já mostra “Obra10+”; não repetir o mesmo título na faixa. */
  const showHeroTitle = Boolean(heroTitle && heroTitle !== 'Obra10+');

  return (
    <div className="relative isolate min-h-[100dvh] w-full bg-primary text-on-surface">
      {/* Camada fixa: imagem + gradiente — permanecem atrás de todo o conteúdo ao rolar */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[url('/images/login-hero-bg.svg')] bg-cover bg-center bg-no-repeat opacity-[0.32] sm:opacity-40"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-br from-primary via-[#0b1622]/96 to-slate-950"
        aria-hidden
      />

      <div className="relative z-10 flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden lg:grid lg:min-h-0 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
        <aside className="relative flex max-h-[38vh] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-b border-white/10 bg-primary px-4 py-5 sm:max-h-[40vh] sm:px-5 sm:py-6 lg:max-h-none lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:px-7 lg:py-10 sidebar-scrollbar lg:overflow-y-auto">
          <div className="space-y-3 shrink-0 sm:space-y-4">
            {badge ? (
              <span className="inline-flex items-center bg-white/10 px-2 py-1 text-[9px] font-black tracking-[0.2em] text-white/90 uppercase">
                {badge}
              </span>
            ) : null}
            <HubBrandMark />
          </div>
          <div className="mt-6 min-h-0 sm:mt-8 lg:mt-12">
            {showHeroTitle ? (
              <>
                <h1 className="text-2xl leading-tight font-black tracking-tight sm:text-3xl lg:text-4xl">{heroTitle}</h1>
                {heroSubtitle ? (
                  <p className="mt-3 max-w-md text-xs leading-relaxed text-white/75 sm:text-sm">{heroSubtitle}</p>
                ) : null}
              </>
            ) : heroSubtitle ? (
              <p className="max-w-sm text-xs leading-relaxed text-white/80 sm:text-sm">{heroSubtitle}</p>
            ) : null}
          </div>
          <div className="mt-auto shrink-0 pt-6 sm:pt-8 lg:pt-10">
            <p className="text-[10px] tracking-widest text-white/50 uppercase">{buildLabel}</p>
          </div>
        </aside>

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:h-full lg:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain hub-table-scrollbar">
            <div className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-start px-3 py-3 sm:px-4 sm:py-5 lg:justify-center lg:px-6 lg:py-6 xl:px-8">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
