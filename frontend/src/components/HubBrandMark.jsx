/**
 * Marca Obra10+ — só tipografia (sem ícone ao lado).
 * @param {'dark' | 'light'} [theme] — `light` para fundos claros (ex.: header público).
 * @param {'default' | 'lg'} [size] — `lg` amplia a marca no modo compacto (ex.: header público).
 */
export function HubBrandMark({ compact = false, theme = 'dark', size = 'default' }) {
  const isLight = theme === 'light';
  const mainCls = isLight ? 'text-primary' : 'text-white';
  const compactSizeCls =
    size === 'lg' ? 'text-xl font-black tracking-tight sm:text-2xl' : 'text-lg font-black tracking-tight sm:text-xl';

  if (compact) {
    if (isLight) {
      return (
        <div className="min-w-0" aria-label="Obra10+">
          <span className={`inline-flex min-w-0 items-baseline gap-0 truncate ${compactSizeCls}`}>
            <span className="text-primary">Obra</span>
            <span className="text-tertiary">10+</span>
          </span>
        </div>
      );
    }
    return (
      <div className="min-w-0" aria-label="Obra10+">
        <span className={`truncate ${compactSizeCls} text-white`}>
          Obra<span className="text-tertiary">10+</span>
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-0 leading-none" aria-label="Obra10+">
      <span className={`text-3xl font-black tracking-tight sm:text-[1.85rem] ${mainCls}`}>
        Obra<span className="text-tertiary">10+</span>
      </span>
    </div>
  );
}
