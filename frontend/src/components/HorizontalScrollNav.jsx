import { useCallback, useLayoutEffect, useRef, useState } from 'react';

const SCROLL_HIDE =
  'overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden';

/**
 * Uma linha horizontal com scroll sem barra visível; setas quando o conteúdo transborda.
 * Coloque `aria-label` no `<nav>` filho (ou equivalente).
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
export function HorizontalScrollNav({ children, className = '' }) {
  const scrollerRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const trackRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [needsScroll, setNeedsScroll] = useState(false);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 1;
    setNeedsScroll(overflow);
    setCanLeft(overflow && scrollLeft > 2);
    setCanRight(overflow && scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useLayoutEffect(() => {
    update();
    const el = scrollerRef.current;
    const track = trackRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });
    ro.observe(el);
    if (track) ro.observe(track);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [update]);

  function scrollByDir(dir) {
    const el = scrollerRef.current;
    if (!el) return;
    const step = Math.max(160, Math.floor(el.clientWidth * 0.65));
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  }

  const arrowBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-primary disabled:pointer-events-none disabled:opacity-35';

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`.trim()} role="presentation">
      {needsScroll ? (
        <button
          type="button"
          className={arrowBtn}
          disabled={!canLeft}
          onClick={() => scrollByDir('left')}
          aria-label="Ver abas anteriores"
        >
          <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
            chevron_left
          </span>
        </button>
      ) : null}
      <div ref={scrollerRef} onScroll={update} className={`min-w-0 flex-1 ${SCROLL_HIDE}`}>
        <div ref={trackRef} className="inline-flex min-w-min align-middle">
          {children}
        </div>
      </div>
      {needsScroll ? (
        <button
          type="button"
          className={arrowBtn}
          disabled={!canRight}
          onClick={() => scrollByDir('right')}
          aria-label="Ver abas seguintes"
        >
          <span className="material-symbols-outlined text-[22px] leading-none" aria-hidden>
            chevron_right
          </span>
        </button>
      ) : null}
    </div>
  );
}
