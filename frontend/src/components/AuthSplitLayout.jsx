import { HubBrandMark } from './HubBrandMark';

/**
 * Layout partilhado: faixa esquerda escura (marca Obra10+) + área de formulário branca.
 * Altura fixa 100dvh; scroll só na coluna do formulário quando necessário.
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
    <div className="relative isolate min-h-[100dvh] w-full bg-white text-on-surface">
      <div className="relative z-10 flex h-[100dvh] max-h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-white lg:grid lg:min-h-0 lg:grid-cols-[minmax(272px,320px)_minmax(0,1fr)]">
        <aside className="relative flex max-h-[44vh] shrink-0 flex-col overflow-y-auto overflow-x-hidden border-b border-white/10 bg-primary px-4 py-5 text-white sm:max-h-[44vh] sm:px-5 sm:py-6 lg:max-h-none lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:border-r-black/10 lg:px-7 lg:py-10 sidebar-scrollbar lg:overflow-y-auto">
          <div className="space-y-3 shrink-0 sm:space-y-4">
            {badge ? (
              <span className="inline-flex items-center bg-white/10 px-2 py-1 text-[9px] font-black tracking-[0.2em] text-white/90 uppercase">
                {badge}
              </span>
            ) : null}
            <HubBrandMark />
          </div>
          <div className="mt-6 min-h-0 w-full min-w-0 sm:mt-8 lg:mt-12">
            {showHeroTitle ? (
              <>
                <h1 className="break-words text-lg leading-snug font-black tracking-tight hyphens-auto sm:text-xl lg:text-2xl">
                  {heroTitle}
                </h1>
                {heroSubtitle ? (
                  <p className="mt-3 max-w-none text-xs leading-relaxed break-words text-white/75 sm:max-w-md sm:text-sm">
                    {heroSubtitle}
                  </p>
                ) : null}
              </>
            ) : heroSubtitle ? (
              <p className="max-w-none break-words text-xs leading-relaxed text-white/80 sm:max-w-sm sm:text-sm">
                {heroSubtitle}
              </p>
            ) : null}
          </div>
          <div className="mt-auto shrink-0 pt-6 sm:pt-8 lg:pt-10">
            <p className="text-[10px] tracking-widest text-white/50 uppercase">{buildLabel}</p>
          </div>
        </aside>

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white lg:h-full lg:min-h-0">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-white hub-table-scrollbar">
            <div className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-start bg-white px-3 py-3 sm:px-4 sm:py-5 lg:justify-center lg:px-6 lg:py-6 xl:px-8">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
