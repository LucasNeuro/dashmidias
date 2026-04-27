import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  homologacaoLooksLikeImage,
  homologacaoLooksLikePdf,
  homologacaoSignedUrlWithError,
} from '../lib/hubHomologacaoDocs';
import { rpcPublicHomologacaoListDocuments } from '../lib/hubPartnerOrgPublic';
import { HomologacaoMediaViewerModal } from './HomologacaoMediaViewerModal';

function formatOrigem(o) {
  if (o === 'hub') return 'Equipe HUB';
  if (o === 'parceiro') return 'Parceiro';
  return String(o || '—');
}

function formatBytes(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const b = Number(n);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Grelha de documentos do pedido (histórico) — aba no painel admin ou página pública.
 *
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
 *   refKey: string,
 *   cacheQueryId?: string | null,
 *   pollMs?: number,
 * }} p
 */
export function HomologacaoDocumentosPanel({ supabase, refKey, cacheQueryId = null, pollMs = 20_000 }) {
  const ref = String(refKey || '').trim();
  const cacheKey = String(cacheQueryId || ref || '').trim();
  const enabled = Boolean(supabase && ref);

  const q = useQuery({
    queryKey: ['homologacaoDocs', cacheKey],
    queryFn: async () => {
      const r = await rpcPublicHomologacaoListDocuments(supabase, ref);
      if (!r.ok) throw new Error(r.error || 'Erro ao carregar documentos');
      return r.documentos || [];
    },
    enabled,
    refetchInterval: enabled ? pollMs : false,
  });

  const errMsg = q.error instanceof Error ? q.error.message : null;

  if (!enabled) {
    return <p className="text-sm text-on-surface-variant">Configure o cliente para ver documentos.</p>;
  }

  return (
    <div className="space-y-4">
      {errMsg ? (
        <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950" role="alert">
          {errMsg}
        </div>
      ) : null}

      {q.isFetching && !q.data?.length ? (
        <p className="flex items-center justify-center gap-2 py-10 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined animate-pulse text-[18px]">progress_activity</span>
          Carregando documentos…
        </p>
      ) : null}

      {!q.isFetching && q.data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
          <span className="material-symbols-outlined text-[40px] text-slate-300">folder_open</span>
          <p className="max-w-sm text-sm text-on-surface-variant">Ainda não há documentos anexados a este pedido.</p>
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(q.data || []).map((d) => (
          <HomologacaoDocCard key={String(d.id)} supabase={supabase} doc={d} />
        ))}
      </ul>
    </div>
  );
}

/** @param {{ supabase: import('@supabase/supabase-js').SupabaseClient, doc: Record<string, unknown> }} p */
function HomologacaoDocCard({ supabase, doc }) {
  const path = String(doc.storage_path || doc.path || '').trim();
  const nome = String(doc.nome_original || doc.name || 'Documento');
  const mime = String(doc.mime_type || doc.mime || '');
  const origem = formatOrigem(doc.origem);
  const criado = doc.criado_em ? new Date(String(doc.criado_em)).toLocaleString('pt-BR') : '—';
  const [href, setHref] = useState(/** @type {string | null} */ (null));
  const [signErr, setSignErr] = useState(/** @type {string | null} */ (null));
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (!supabase || !path) return;
    let cancelled = false;
    (async () => {
      setSignErr(null);
      const { url, error } = await homologacaoSignedUrlWithError(supabase, path, 3600);
      if (cancelled) return;
      setHref(url);
      if (error && !url) setSignErr(error);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, path]);

  const isImg = homologacaoLooksLikeImage(mime);
  const isPdf = homologacaoLooksLikePdf(mime, nome);

  const previewClickable = Boolean(href && (isImg || isPdf));

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <button
        type="button"
        disabled={!previewClickable}
        onClick={() => previewClickable && setViewerOpen(true)}
        className={`relative flex min-h-[140px] w-full items-stretch justify-center bg-slate-100/80 text-left ${
          previewClickable ? 'cursor-zoom-in hover:bg-slate-100' : 'cursor-default'
        }`}
      >
        {isImg && href ? (
          <img src={href} alt="" className="max-h-40 w-full object-contain" />
        ) : null}
        {isPdf && href ? (
          <iframe
            title=""
            src={`${href}#page=1&zoom=page-fit`}
            className="pointer-events-none h-40 w-full border-0 bg-white"
            loading="lazy"
          />
        ) : null}
        {!href && (isImg || isPdf) ? (
          <div className="flex w-full items-center justify-center py-8">
            <span className="material-symbols-outlined animate-pulse text-[40px] text-slate-400">progress_activity</span>
          </div>
        ) : null}
        {!isImg && !isPdf ? (
          <div className="flex w-full items-center justify-center py-8">
            <span className="material-symbols-outlined text-[48px] text-slate-400" aria-hidden>
              description
            </span>
          </div>
        ) : null}
        {previewClickable ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Ver
          </span>
        ) : null}
      </button>
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-xs font-semibold text-primary" title={nome}>
          {nome}
        </p>
        <p className="text-[10px] text-on-surface-variant">
          {origem} · {formatBytes(doc.tamanho_bytes)} · {criado}
        </p>
        {href ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-tertiary hover:underline"
          >
            Abrir visualizador
            <span className="material-symbols-outlined text-[14px]">open_in_full</span>
          </button>
        ) : signErr ? (
          <p className="text-[10px] text-amber-800" title={signErr}>
            Não foi possível abrir a pré-visualização. Tente mais tarde ou entre em contato com o suporte.
          </p>
        ) : (
          <p className="text-[10px] text-on-surface-variant">A preparar ligação…</p>
        )}
      </div>

      <HomologacaoMediaViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        url={href}
        title={nome}
        mimeType={isPdf ? 'application/pdf' : mime}
      />
    </li>
  );
}
