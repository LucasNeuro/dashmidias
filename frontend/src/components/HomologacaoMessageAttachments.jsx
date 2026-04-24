import { useEffect, useState } from 'react';
import {
  homologacaoLooksLikeImage,
  homologacaoLooksLikePdf,
  homologacaoSignedUrlWithError,
} from '../lib/hubHomologacaoDocs';
import { HomologacaoMediaViewerModal } from './HomologacaoMediaViewerModal';

/**
 * Miniaturas / ligações para anexos numa mensagem do chat de homologação.
 *
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
 *   anexos: Array<{ id?: string, nome_original: string, mime_type: string, storage_path: string }>,
 *   compact?: boolean,
 * }} p
 */
export function HomologacaoMessageAttachments({ supabase, anexos, compact = false }) {
  const [urls, setUrls] = useState(/** @type {Record<string, string>} */ ({}));
  const [viewer, setViewer] = useState(/** @type {{ url: string, title: string, mimeType: string } | null} */ (null));

  useEffect(() => {
    if (!supabase || !anexos?.length) {
      setUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const next = {};
      for (const a of anexos) {
        const path = String(a.storage_path || '').trim();
        if (!path || next[path]) continue;
        const { url } = await homologacaoSignedUrlWithError(supabase, path, 3600);
        if (url) next[path] = url;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, anexos]);

  if (!anexos?.length) return null;

  return (
    <>
      <ul className={`mt-2 space-y-2 ${compact ? '' : ''}`}>
        {anexos.map((a) => {
          const path = String(a.storage_path || '').trim();
          const href = path ? urls[path] : null;
          const label = a.nome_original || 'Documento';
          const mime = String(a.mime_type || '');
          const isImg = homologacaoLooksLikeImage(mime);
          const isPdf = homologacaoLooksLikePdf(mime, label);

          const openViewer = () => {
            if (!href) return;
            setViewer({
              url: href,
              title: label,
              mimeType: isPdf ? 'application/pdf' : mime,
            });
          };

          return (
            <li key={path || a.id || label} className="rounded-lg border border-slate-200/90 bg-white/80 p-2">
              {isImg && href ? (
                <button
                  type="button"
                  onClick={openViewer}
                  className="block w-full cursor-zoom-in text-left"
                >
                  <img
                    src={href}
                    alt=""
                    className={`mx-auto max-h-40 w-auto max-w-full rounded object-contain ${compact ? 'max-h-32' : ''}`}
                  />
                  <p className="mt-1 truncate text-center text-[10px] font-medium text-primary">{label}</p>
                </button>
              ) : null}

              {isImg && !href ? (
                <div className="flex items-center gap-2 py-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px] animate-pulse">progress_activity</span>
                  <span className="truncate">{label}</span>
                </div>
              ) : null}

              {isPdf && href ? (
                <button
                  type="button"
                  onClick={openViewer}
                  className="block w-full cursor-zoom-in overflow-hidden rounded-md text-left"
                >
                  <iframe
                    title=""
                    src={`${href}#page=1&zoom=page-fit`}
                    className={`pointer-events-none w-full border-0 bg-white ${compact ? 'h-28' : 'h-36'}`}
                    loading="lazy"
                  />
                  <p className="mt-1 truncate text-center text-[10px] font-medium text-tertiary">{label}</p>
                </button>
              ) : null}

              {isPdf && !href ? (
                <div className="flex items-center gap-2 py-2 text-xs text-on-surface-variant">
                  <span className="material-symbols-outlined text-[20px] animate-pulse">progress_activity</span>
                  <span className="truncate">{label}</span>
                </div>
              ) : null}

              {!isImg && !isPdf ? (
                <button
                  type="button"
                  onClick={href ? openViewer : undefined}
                  disabled={!href}
                  className={`flex w-full items-center gap-2 text-xs font-medium ${
                    href ? 'cursor-pointer text-tertiary hover:underline' : 'pointer-events-none text-on-surface-variant'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px] text-slate-500" aria-hidden>
                    description
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                  {href ? <span className="material-symbols-outlined text-[16px] text-slate-400">open_in_full</span> : null}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <HomologacaoMediaViewerModal
        open={Boolean(viewer?.url)}
        onClose={() => setViewer(null)}
        url={viewer?.url ?? null}
        title={viewer?.title}
        mimeType={viewer?.mimeType}
      />
    </>
  );
}
