import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { homologacaoSignedUrl } from '../lib/hubHomologacaoDocs';
import { rpcPublicHomologacaoListDocuments } from '../lib/hubPartnerOrgPublic';

function formatOrigem(o) {
  if (o === 'hub') return 'Equipa HUB';
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
          A carregar documentos…
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

  useEffect(() => {
    if (!supabase || !path) return;
    let cancelled = false;
    (async () => {
      const u = await homologacaoSignedUrl(supabase, path, 3600);
      if (!cancelled) setHref(u);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, path]);

  const isImg = mime.toLowerCase().startsWith('image/');
  const isPdf = mime.toLowerCase() === 'application/pdf';

  return (
    <li className="flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="flex min-h-[120px] items-center justify-center bg-slate-100/80">
        {isImg && href ? (
          <img src={href} alt="" className="max-h-36 w-full object-contain" />
        ) : (
          <span className="material-symbols-outlined text-[48px] text-slate-400" aria-hidden>
            {isPdf ? 'picture_as_pdf' : 'description'}
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-xs font-semibold text-primary" title={nome}>
          {nome}
        </p>
        <p className="text-[10px] text-on-surface-variant">
          {origem} · {formatBytes(doc.tamanho_bytes)} · {criado}
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-tertiary hover:underline"
          >
            Abrir / descarregar
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          </a>
        ) : (
          <p className="text-[10px] text-on-surface-variant">A preparar ligação…</p>
        )}
      </div>
    </li>
  );
}
