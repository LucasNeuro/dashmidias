/**
 * Marca Obra10+ — só tipografia (sem ícone ao lado).
 */
export function HubBrandMark({ compact = false }) {
  if (compact) {
    return (
      <div className="min-w-0" aria-label="Obra10+">
        <span className="truncate text-lg font-black tracking-tight text-white sm:text-xl">
          Obra<span className="text-tertiary">10+</span>
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-0 leading-none" aria-label="Obra10+">
      <span className="text-3xl font-black tracking-tight text-white sm:text-[1.85rem]">
        Obra<span className="text-tertiary">10+</span>
      </span>
    </div>
  );
}
