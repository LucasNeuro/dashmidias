import { HubBrandMark } from './HubBrandMark';

/**
 * Layout partilhado: painel esquerdo (marca HUB) + área de formulário à direita.
 * Usado em login, recuperação de senha e rotas públicas de onboarding.
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
    <div className="min-h-screen bg-surface-container-low lg:h-[100dvh] lg:max-h-[100dvh] lg:overflow-hidden">
      <div className="min-h-screen lg:min-h-0 lg:h-full grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="relative bg-primary text-white border-b lg:border-b-0 lg:border-r border-white/10 px-6 py-10 lg:px-8 lg:py-12 flex flex-col lg:h-full lg:min-h-0 lg:overflow-y-auto lg:overscroll-y-contain">
          <div className="space-y-4 shrink-0">
            {badge ? (
              <span className="inline-flex items-center bg-white/10 text-white/90 text-[9px] font-black px-2 py-1 tracking-[0.2em] uppercase">
                {badge}
              </span>
            ) : null}
            <HubBrandMark />
          </div>
          <div className="mt-10 lg:mt-16 min-h-0">
            {showHeroTitle ? (
              <>
                <h1 className="text-3xl lg:text-4xl font-black leading-tight tracking-tight">{heroTitle}</h1>
                {heroSubtitle ? (
                  <p className="text-sm text-white/70 mt-4 max-w-md leading-relaxed">{heroSubtitle}</p>
                ) : null}
              </>
            ) : heroSubtitle ? (
              <p className="text-sm text-white/80 max-w-sm leading-relaxed">{heroSubtitle}</p>
            ) : null}
          </div>
          <div className="mt-auto pt-10 shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/50">{buildLabel}</p>
          </div>
        </aside>

        <section className="lg:min-h-0 lg:h-full lg:overflow-y-auto overscroll-y-contain">
          <div className="w-full flex flex-col items-center px-4 py-10 lg:py-12 pb-16">
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
