import { useEffect, useState } from 'react';
import { homologacaoSignedUrl } from '../lib/hubHomologacaoDocs';

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
        const u = await homologacaoSignedUrl(supabase, path, 3600);
        if (u) next[path] = u;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, anexos]);

  if (!anexos?.length) return null;

  return (
    <ul className={`mt-2 space-y-2 ${compact ? '' : ''}`}>
      {anexos.map((a) => {
        const path = String(a.storage_path || '').trim();
        const href = path ? urls[path] : null;
        const isImg = String(a.mime_type || '').toLowerCase().startsWith('image/');
        const isPdf = String(a.mime_type || '').toLowerCase() === 'application/pdf';
        const label = a.nome_original || 'Documento';

        return (
          <li key={path || a.id || label} className="rounded-lg border border-slate-200/90 bg-white/80 p-2">
            {isImg && href ? (
              <a href={href} target="_blank" rel="noreferrer" className="block">
                <img
                  src={href}
                  alt=""
                  className={`mx-auto max-h-40 w-auto max-w-full rounded object-contain ${compact ? 'max-h-32' : ''}`}
                />
                <p className="mt-1 truncate text-center text-[10px] font-medium text-primary">{label}</p>
              </a>
            ) : (
              <a
                href={href || undefined}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 text-xs font-medium ${href ? 'text-tertiary hover:underline' : 'pointer-events-none text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined text-[20px] text-slate-500" aria-hidden>
                  {isPdf ? 'picture_as_pdf' : 'description'}
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {href ? <span className="material-symbols-outlined text-[16px] text-slate-400">open_in_new</span> : null}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}
