import { useEffect } from 'react';

/**
 * Visualizador em modal (PDF em iframe, imagem em &lt;img&gt;, restantes com link de descarga).
 *
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   url: string | null,
 *   title?: string,
 *   mimeType?: string,
 * }} p
 */
export function HomologacaoMediaViewerModal({ open, onClose, url, title = '', mimeType = '' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !url) return null;

  const m = String(mimeType || '').toLowerCase();
  const isPdf = m === 'application/pdf';
  const isImg = m.startsWith('image/');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        aria-label="Fechar visualizador"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <p className="min-w-0 truncate text-sm font-semibold text-primary" title={title}>
            {title || 'Documento'}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-tertiary hover:bg-slate-50"
            >
              Nova aba
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white p-2 text-primary hover:bg-slate-100"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-[22px] leading-none">close</span>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-slate-900/95">
          {isPdf ? (
            <iframe title={title || 'PDF'} src={url} className="h-[min(78vh,720px)] w-full border-0 bg-white" />
          ) : null}
          {isImg ? (
            <div className="flex h-[min(78vh,720px)] items-center justify-center overflow-auto p-4">
              <img src={url} alt="" className="max-h-full max-w-full object-contain" />
            </div>
          ) : null}
          {!isPdf && !isImg ? (
            <div className="flex h-[min(40vh,320px)] flex-col items-center justify-center gap-4 p-8 text-center text-white">
              <span className="material-symbols-outlined text-[56px] text-white/70">description</span>
              <p className="text-sm text-white/90">Pré-visualização não disponível para este tipo de ficheiro.</p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-tertiary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary"
              >
                Abrir ou descarregar
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
