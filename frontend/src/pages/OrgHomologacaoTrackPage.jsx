import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { HomologacaoChatSideover } from '../components/HomologacaoChatSideover';
import { rpcPublicHomologacaoStatus } from '../lib/hubPartnerOrgPublic';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const cardSurface =
  'rounded-lg border border-slate-200/90 bg-white shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]';

function formatDatePt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function statusLabelPt(status) {
  const s = String(status || '').toLowerCase();
  const map = {
    pendente: 'Pendente',
    processado: 'Processado',
    aprovado: 'Aprovado',
    rejeitado: 'Rejeitado',
  };
  return map[s] || status || '—';
}

function workflowEtapaLabelPt(w) {
  const x = String(w || '').toLowerCase();
  const map = {
    pendente: 'Pedido na fila inicial de homologação',
    aguardando_retorno: 'Aguardamos sua resposta ou documentos',
    em_analise: 'A equipe Obra10+ está analisando o pedido',
    aprovado: 'Homologação aprovada — em preparação da formalização',
  };
  return map[x] || '';
}

function statusHeadline(row) {
  const st = row.status;
  if (st === 'rejeitado') return 'Pedido não aprovado';
  if (row.organizacao_criada) return 'Homologação concluída';
  if (st === 'processado') return 'Processamento concluído';
  if (st === 'aprovado') return 'Aprovado — provisionamento em andamento';
  if (st === 'pendente') {
    const wf = workflowEtapaLabelPt(row.workflow_etapa ?? row.workflowEtapa);
    return wf || 'Pedido em homologação';
  }
  return `Estado: ${st}`;
}

/** @param {unknown} raw */
function normalizeTimeline(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : [];
    } catch {
      return [];
    }
  }
  return [];
}

function statusDetail(row) {
  if (row.status === 'rejeitado') {
    return 'Se tiver dúvidas, entre em contato com a equipe Obra10+ pelo canal que foi indicado a você.';
  }
  if (row.organizacao_criada && row.convite_gerado) {
    return 'A organização foi criada e o convite está disponível. Verifique o e-mail registrado no cadastro.';
  }
  if (row.organizacao_criada) {
    return 'A organização foi criada. O convite pode estar em preparação — aguarde o e-mail ou atualize esta página mais tarde.';
  }
  if (row.status === 'pendente') {
    const wf = workflowEtapaLabelPt(row.workflow_etapa ?? row.workflowEtapa);
    if (wf) return `${wf}. Salve o código e este link para voltar quando quiser.`;
    return 'Seu pedido está na fila de homologação. Salve o código e este link para voltar quando quiser.';
  }
  if (row.status === 'aprovado') {
    return 'O pedido foi aprovado. A criação da conta e o convite podem levar alguns instantes.';
  }
  return null;
}

export function OrgHomologacaoTrackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** Identificador único do pedido: só vem da URL (?codigo= ou ?ref=), compartilhado por ORG. */
  const ref = (searchParams.get('codigo') || searchParams.get('ref') || '').trim();
  const [chatOpen, setChatOpen] = useState(false);

  const trackQuery = useQuery({
    queryKey: ['hubPublicHomologacao', ref],
    queryFn: async () => {
      const sb = getSupabase();
      if (!sb) throw new Error('Cliente indisponível');
      const r = await rpcPublicHomologacaoStatus(sb, ref);
      if (!r.ok) throw new Error(r.error || 'Erro');
      return r.row;
    },
    enabled: Boolean(ref) && isSupabaseConfigured(),
    staleTime: 15_000,
    retry: 0,
  });

  const row = trackQuery.data;
  const timeline = normalizeTimeline(row?.timeline);
  const errMsg = trackQuery.error instanceof Error ? trackQuery.error.message : null;

  const signupIdForChat = row?.signup_id ?? row?.signupId ?? null;

  return (
    <AuthSplitLayout
      heroTitle="Homologação"
      heroSubtitle="Cada link de acompanhamento é único para o seu pedido. Guarde-o ou use o recebido após o cadastro."
    >
      <HomologacaoChatSideover
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        codigoRastreio={row?.codigo_rastreio || ref || ''}
        signupId={signupIdForChat != null ? String(signupIdForChat) : null}
        pedidoStatus={row?.status ?? null}
        supabase={isSupabaseConfigured() ? getSupabase() : null}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 sm:gap-4">
        <div className={`shrink-0 border-l-[3px] border-l-tertiary p-4 sm:p-5 ${cardSurface}`}>
          <h1 className="text-xl font-black tracking-tight text-primary sm:text-2xl">Acompanhamento do pedido</h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Use o link completo que recebeu — ele já identifica o seu pedido.
          </p>
        </div>

        {!ref && isSupabaseConfigured() ? (
          <div className={`p-4 sm:p-5 ${cardSurface}`}>
            <p className="text-sm font-medium text-primary">Link incompleto</p>
            <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
              Abra o acompanhamento pelo link enviado após o cadastro ou pelo botão na página de confirmação — esse link já
              inclui o identificador da sua organização.
            </p>
            <p className="mt-3 text-sm">
              <Link to="/cadastro/organizacao" className="font-medium text-tertiary underline underline-offset-2">
                Fazer novo cadastro
              </Link>
            </p>
          </div>
        ) : null}

        {!isSupabaseConfigured() ? (
          <p className="text-sm text-amber-800">Servidor não configurado — consulta indisponível neste ambiente.</p>
        ) : null}

        {trackQuery.isFetching && ref ? (
          <p className="text-center text-sm text-on-surface-variant" role="status">
            Carregando…
          </p>
        ) : null}

        {trackQuery.isError && ref ? (
          <div className="rounded-lg border border-amber-200/90 bg-amber-50 px-4 py-3 text-sm text-amber-950">{errMsg}</div>
        ) : null}

        {row ? (
          <div className={`space-y-4 border-l-[3px] border-l-tertiary p-4 sm:p-5 ${cardSurface}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Organização</p>
                <p className="mt-1 text-lg font-bold text-primary">{row.nome_empresa}</p>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-sm border-2 border-primary bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary hover:bg-surface-container-low"
              >
                <span className="material-symbols-outlined text-[18px] leading-none">forum</span>
                Abrir chat
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Código</p>
                <p className="mt-1 font-mono text-sm">{row.codigo_rastreio || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Estado</p>
                <p className="mt-1 text-sm font-medium text-on-surface">{statusLabelPt(row.status)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Pedido recebido</p>
                <p className="mt-1 text-sm">{formatDatePt(row.criado_em)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Última atualização</p>
                <p className="mt-1 text-sm">
                  {formatDatePt(row.workflow_etapa_em ?? row.workflowEtapaEm ?? row.processado_em)}
                </p>
              </div>
            </div>
            {timeline.length > 0 ? (
              <div className="rounded-lg border border-slate-200/90 bg-slate-50/60 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-700">Histórico do pedido</p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Atualizações registradas pela equipe Obra10+ ao longo da homologação.
                </p>
                <ol className="relative mt-4 space-y-0 border-l-2 border-slate-200 pl-4">
                  {timeline.map((ev, i) => {
                    const id = ev?.id != null ? String(ev.id) : `ev-${i}`;
                    const rotulo = ev?.rotulo != null ? String(ev.rotulo) : '—';
                    const quando = formatDatePt(ev?.criado_em ?? ev?.criadoEm);
                    return (
                      <li key={id} className="relative pb-5 last:pb-0">
                        <span
                          className="absolute -left-[9px] top-1 h-3 w-3 rounded-full border-2 border-tertiary bg-white"
                          aria-hidden
                        />
                        <p className="text-sm font-medium leading-snug text-primary">{rotulo}</p>
                        <p className="mt-0.5 text-[11px] text-on-surface-variant">{quando}</p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ) : null}
            <div className="rounded-lg border border-tertiary/25 bg-tertiary/[0.06] px-4 py-3">
              <p className="text-sm font-bold text-primary">{statusHeadline(row)}</p>
              {statusDetail(row) ? (
                <p className="mt-2 text-sm leading-relaxed text-on-surface">{statusDetail(row)}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void trackQuery.refetch()}
                className="rounded-none border border-outline-variant bg-white px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-low"
              >
                Atualizar
              </button>
            </div>
          </div>
        ) : null}

        <p className="shrink-0 text-center text-sm text-on-surface-variant">
          <Link to="/cadastro/organizacao" className="font-medium text-primary underline underline-offset-2">
            Novo cadastro
          </Link>
          {' · '}
          <Link to="/login" className="font-medium text-primary underline underline-offset-2">
            Login
          </Link>
          {' · '}
          <button
            type="button"
            className="font-medium text-primary underline underline-offset-2"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>
        </p>
      </div>
    </AuthSplitLayout>
  );
}
