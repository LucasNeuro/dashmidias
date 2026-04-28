import { useState } from 'react';

const PREFIX = 'governance-expand:v1:';

function readStored(sectionId, defaultOpen) {
  try {
    const v = sessionStorage.getItem(`${PREFIX}${sectionId}`);
    if (v === '0') return false;
    if (v === '1') return true;
  } catch {
    /* ignore */
  }
  return defaultOpen;
}

function writeStored(sectionId, open) {
  try {
    sessionStorage.setItem(`${PREFIX}${sectionId}`, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/**
 * Secção expansível para painéis de governança (Controles e acessos).
 * Mantém estado aberto/fechado em sessionStorage pela `sectionId`.
 * O painel fica sempre no DOM (hidden quando fechado), para não reinicializar queries ou formulários dos filhos.
 */
export function GovernanceExpandableSection({
  sectionId,
  title,
  description,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(() => readStored(sectionId, defaultOpen));

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      writeStored(sectionId, next);
      return next;
    });
  }

  return (
    <section
      className="overflow-hidden rounded-sm border border-surface-container-high bg-white shadow-sm"
      data-expanded={open ? 'true' : 'false'}
    >
      <button
        type="button"
        id={sectionId ? `${sectionId}-heading` : undefined}
        aria-expanded={open}
        aria-controls={sectionId ? `${sectionId}-panel` : undefined}
        className="flex w-full cursor-pointer flex-wrap items-start justify-between gap-2 border-b border-slate-200 bg-[#f8fafc] px-4 py-3 text-left transition-colors hover:bg-slate-100/90 sm:px-5 sm:py-3.5"
        onClick={toggle}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span
              className="material-symbols-outlined shrink-0 text-[20px] text-slate-600 transition-transform"
              style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}
              aria-hidden
            >
              expand_more
            </span>
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-700">{title}</span>
              {description ? (
                <span className="mt-1 block text-xs font-normal normal-case tracking-normal text-on-surface-variant">
                  {description}
                </span>
              ) : null}
            </span>
          </span>
        </span>
      </button>
      <div
        id={sectionId ? `${sectionId}-panel` : undefined}
        role="region"
        aria-labelledby={sectionId ? `${sectionId}-heading` : undefined}
        hidden={!open}
        className="p-4 sm:p-5"
      >
        {children}
      </div>
    </section>
  );
}
