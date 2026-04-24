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

function statusHeadline(row) {
  const st = row.status;
  if (st === 'rejeitado') return 'Pedido não aprovado';
  if (row.organizacao_criada) return 'Homologação concluída';
  if (st === 'processado') return 'Processamento concluído';
  if (st === 'aprovado') return 'Aprovado — provisionamento em curso';
  if (st === 'pendente') return 'Em análise pela equipa Obra10+';
  return `Estado: ${st}`;
}

function statusDetail(row) {
  if (row.status === 'rejeitado') {
    return 'Se tiver dúvidas, contacte a equipa Obra10+ pelo canal que lhe foi indicado.';
  }
  if (row.organizacao_criada && row.convite_gerado) {
    return 'A organização foi criada e o convite está disponível. Verifique o e-mail registado no cadastro.';
  }
  if (row.organizacao_criada) {
    return 'A organização foi criada. O convite pode estar em preparação — aguarde o e-mail ou actualize esta página mais tarde.';
  }
  if (row.status === 'pendente') {
    return 'O seu pedido está na fila de homologação. Guarde o código e este link para voltar quando quiser.';
  }
  if (row.status === 'aprovado') {
    return 'O pedido foi aprovado. A criação da conta e o convite podem levar alguns instantes.';
  }
  return null;
}

export function OrgHomologacaoTrackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  /** Identificador único do pedido: só vem da URL (?codigo= ou ?ref=), partilhado por ORG. */
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
  const errMsg = trackQuery.error instanceof Error ? trackQuery.error.message : null;

  const signupIdForChat = row?.signup_id ?? row?.signupId ?? null;

  return (
    <AuthSplitLayout
      heroTitle="Homologação"
      heroSubtitle="Cada link de acompanhamento é único para o seu pedido. Guarde-o ou use o que recebeu após o cadastro."
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
            Não é necessário introduzir código aqui: o endereço que abriu já identifica o pedido (parâmetro{' '}
            <span className="font-mono text-xs">codigo</span> ou <span className="font-mono text-xs">ref</span> na URL).
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
            A carregar…
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
                <p className="text-[10px] font-black uppercase tracking-widest text-on-surface-variant">Última actualização</p>
                <p className="mt-1 text-sm">{formatDatePt(row.processado_em)}</p>
              </div>
            </div>
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
                Actualizar
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
