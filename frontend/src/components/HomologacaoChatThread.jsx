import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HomologacaoMessageAttachments } from './HomologacaoMessageAttachments';
import { useUiFeedback } from '../context/UiFeedbackContext';
import {
  HUB_HOMOLOG_DOCS_MAX_BYTES,
  homologacaoFileToAnexoRpcPayload,
  hubHomologacaoDocsMimeAllowed,
  uploadHomologacaoDocFile,
} from '../lib/hubHomologacaoDocs';
import { rpcHubHomologacaoReply } from '../lib/hubPartnerOrgGovernance';
import { rpcPublicHomologacaoListMessages, rpcPublicHomologacaoSendMessage } from '../lib/hubPartnerOrgPublic';

function formatMsgTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Chat persistido (RPC) ligado ao pedido de homologação.
 *
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
 *   refKey: string,
 *   chatQueryId?: string | null,
 *   mode?: 'public' | 'hub',
 *   signupId?: string | null,
 *   readOnly?: boolean,
 *   pollMs?: number,
 *   className?: string,
 *   stacked?: boolean,
 * }} p
 * `stacked`: layout para sideover / painel — lista de mensagens com `flex-1 min-h-0 overflow-y-auto` (rolagem própria).
 */
export function HomologacaoChatThread({
  supabase,
  refKey,
  chatQueryId = null,
  mode = 'public',
  signupId = null,
  readOnly = false,
  pollMs = 14_000,
  className = '',
  stacked = false,
}) {
  const { toast } = useUiFeedback();
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');
  const [pendingFiles, setPendingFiles] = useState(/** @type {File[]} */ ([]));
  const fileInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const listRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const ref = String(refKey || '').trim();
  const cacheKey = String(chatQueryId || ref || '').trim();
  const enabled = Boolean(supabase && ref);

  const listQuery = useQuery({
    queryKey: ['homologacaoChat', cacheKey],
    queryFn: async () => {
      const r = await rpcPublicHomologacaoListMessages(supabase, ref);
      if (!r.ok) throw new Error(r.error || 'Erro ao carregar mensagens');
      return r.messages || [];
    },
    enabled,
    refetchInterval: enabled ? pollMs : false,
  });

  useEffect(() => {
    const el = listRef.current;
    if (!el || !listQuery.data?.length) return;
    el.scrollTop = el.scrollHeight;
  }, [listQuery.data]);

  const invalidateAllChat = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['homologacaoChat'] });
    void qc.invalidateQueries({ queryKey: ['homologacaoDocs'] });
  }, [qc]);

  const sendPublic = useMutation({
    mutationFn: async (/** @type {{ text: string, files: File[] }} */ payload) => {
      const files = Array.isArray(payload.files) ? payload.files : [];
      const anexos = [];
      for (const f of files) {
        const { path } = await uploadHomologacaoDocFile(supabase, ref, f);
        anexos.push(homologacaoFileToAnexoRpcPayload(path, f));
      }
      const r = await rpcPublicHomologacaoSendMessage(supabase, ref, payload.text || '', anexos);
      if (!r.ok) throw new Error(r.error || 'Erro ao enviar');
    },
    onSuccess: () => {
      setDraft('');
      setPendingFiles([]);
      invalidateAllChat();
    },
    onError: (e) => {
      toast(e instanceof Error ? e.message : 'Erro ao enviar', { variant: 'warning', duration: 6500 });
    },
  });

  const sendHub = useMutation({
    mutationFn: async (/** @type {{ text: string, files: File[] }} */ payload) => {
      const sid = String(signupId || '').trim();
      if (!sid) throw new Error('Pedido inválido');
      const files = Array.isArray(payload.files) ? payload.files : [];
      const anexos = [];
      for (const f of files) {
        const { path } = await uploadHomologacaoDocFile(supabase, sid, f);
        anexos.push(homologacaoFileToAnexoRpcPayload(path, f));
      }
      const r = await rpcHubHomologacaoReply(supabase, sid, payload.text || '', anexos);
      if (!r.ok) throw new Error(r.error || 'Erro ao enviar');
    },
    onSuccess: () => {
      setDraft('');
      setPendingFiles([]);
      invalidateAllChat();
    },
    onError: (e) => {
      toast(e instanceof Error ? e.message : 'Erro ao enviar', { variant: 'warning', duration: 6500 });
    },
  });

  const onSend = useCallback(() => {
    const t = draft.trim();
    if ((!t && !pendingFiles.length) || !enabled) return;
    const payload = { text: t, files: [...pendingFiles] };
    if (mode === 'hub') {
      sendHub.mutate(payload);
    } else {
      sendPublic.mutate(payload);
    }
  }, [draft, pendingFiles, enabled, mode, sendHub, sendPublic]);

  const onPickFiles = useCallback(
    (e) => {
      const input = e.target;
      const fl = input.files ? Array.from(input.files) : [];
      input.value = '';
      if (!fl.length) return;
      const next = [...pendingFiles];
      for (const f of fl) {
        if (f.size > HUB_HOMOLOG_DOCS_MAX_BYTES) {
          toast(`«${f.name}» excede o tamanho máximo.`, { variant: 'warning', duration: 5000 });
          continue;
        }
        if (!hubHomologacaoDocsMimeAllowed(f.type)) {
          toast(`Tipo não permitido: ${f.name}`, { variant: 'warning', duration: 5000 });
          continue;
        }
        next.push(f);
      }
      setPendingFiles(next);
    },
    [pendingFiles, toast],
  );

  const removePendingAt = useCallback((idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const busy = sendPublic.isPending || sendHub.isPending;
  const cannotType = readOnly || !enabled || (mode === 'hub' && !String(signupId || '').trim());
  const canSend = Boolean(draft.trim() || pendingFiles.length);

  const errMsg = listQuery.error instanceof Error ? listQuery.error.message : null;

  const rootClass = stacked
    ? `flex flex-1 flex-col min-h-0 h-full ${className}`
    : `flex flex-col min-h-[280px] ${className}`;

  const scrollClass = stacked
    ? 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden'
    : 'min-h-[200px] flex-1 overflow-y-auto overflow-x-hidden';

  return (
    <div className={rootClass}>
      {errMsg ? (
        <div
          className="mb-3 shrink-0 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2 text-xs text-amber-950"
          role="alert"
        >
          {errMsg}
          {/function public\.hub_public_homologacao_list_messages|schema cache|Could not find/i.test(errMsg) ? (
            <p className="mt-1 text-on-surface-variant">
              Aplique o SQL <span className="font-mono text-[11px]">hub_homologacao_chat.sql</span> e{' '}
              <span className="font-mono text-[11px]">hub_homologacao_documentos.sql</span> no Supabase e recarregue o schema.
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        ref={listRef}
        className={`${scrollClass} space-y-3 rounded-xl border border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white p-3 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)] hub-table-scrollbar`}
      >
        {listQuery.isFetching && !listQuery.data?.length ? (
          <p className="flex items-center justify-center gap-2 py-8 text-center text-xs text-on-surface-variant">
            <span className="material-symbols-outlined animate-pulse text-[18px] text-tertiary">progress_activity</span>
            A carregar mensagens…
          </p>
        ) : null}
        {!listQuery.isFetching && listQuery.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <span className="material-symbols-outlined text-[40px] text-slate-300" aria-hidden>
              forum
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-on-surface-variant">
              {mode === 'hub'
                ? 'Ainda sem mensagens. Escreva ao parceiro quando faltar documentação ou esclarecimentos.'
                : 'Ainda sem mensagens. A equipa Obra10+ responde aqui durante a homologação.'}
            </p>
          </div>
        ) : null}
        {(listQuery.data || []).map((m) => {
          const isHub = m.direcao === 'hub';
          const outgoing = mode === 'public' ? !isHub : isHub;
          const roleLabel = isHub ? 'Equipa Obra10+' : mode === 'hub' ? 'Parceiro' : 'Você';
          const anexos = Array.isArray(m.anexos) ? m.anexos : [];
          const hidePlaceholder =
            String(m.corpo || '').trim() === 'Documento anexado.' && anexos.length > 0;

          return (
            <div key={String(m.id)} className={`flex ${outgoing ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[min(92%,20rem)] rounded-xl px-3.5 py-2.5 text-sm shadow-sm ${
                  outgoing
                    ? 'border border-slate-200/90 bg-white text-primary'
                    : 'border border-slate-200/90 border-l-[3px] border-l-tertiary bg-gradient-to-br from-tertiary/[0.07] to-white text-primary'
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-on-surface-variant">{roleLabel}</p>
                {hidePlaceholder ? null : (
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-on-surface">{m.corpo}</p>
                )}
                <HomologacaoMessageAttachments supabase={supabase} anexos={anexos} compact />
                <p className="mt-2 text-[10px] tabular-nums text-on-surface-variant">{formatMsgTime(m.criado_em)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`mt-3 shrink-0 space-y-2 border-t border-slate-200 bg-white pt-3 ${stacked ? 'pb-1' : ''}`}>
        {readOnly && mode === 'public' ? (
          <p className="rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs text-on-surface-variant">
            Este pedido foi concluído ou encerrado — não é possível enviar novas mensagens por aqui.
          </p>
        ) : null}
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={onPickFiles}
        />
        {pendingFiles.length ? (
          <ul className="flex flex-wrap gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 p-2">
            {pendingFiles.map((f, idx) => (
              <li
                key={`${f.name}-${idx}`}
                className="flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-primary"
              >
                <span className="truncate" title={f.name}>
                  {f.name}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-on-surface-variant hover:text-red-600"
                  aria-label="Remover anexo"
                  onClick={() => removePendingAt(idx)}
                >
                  <span className="material-symbols-outlined text-[16px] leading-none">close</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={cannotType || busy}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black uppercase tracking-wider text-primary shadow-sm hover:bg-slate-50 disabled:opacity-40 sm:flex-initial"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">attach_file</span>
            Anexar
          </button>
        </div>
        <label className="sr-only" htmlFor="homolog-chat-input">
          Mensagem
        </label>
        <textarea
          id="homolog-chat-input"
          className="min-h-[76px] w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-on-surface shadow-sm placeholder:text-on-surface-variant/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/25 disabled:opacity-50"
          placeholder={
            mode === 'hub' ? 'Mensagem para o parceiro…' : 'Escreva se faltar documento ou informação…'
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={cannotType || busy}
        />
        <button
          type="button"
          disabled={cannotType || busy || !canSend}
          onClick={onSend}
          className="flex w-full items-center justify-center gap-2 rounded-sm bg-tertiary px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-primary shadow-sm hover:bg-tertiary/90 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[18px] leading-none">send</span>
          Enviar
        </button>
      </div>
    </div>
  );
}
