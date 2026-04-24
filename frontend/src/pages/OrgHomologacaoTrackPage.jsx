import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { HomologacaoCommentsPanel } from '../components/HomologacaoCommentsPanel';
import { useUiFeedback } from '../context/UiFeedbackContext';
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
  const { toast } = useUiFeedback();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const initialRef = (searchParams.get('codigo') || searchParams.get('ref') || '').trim();
  const [draftRef, setDraftRef] = useState(initialRef);

  useEffect(() => {
    if (initialRef) setDraftRef(initialRef);
  }, [initialRef]);

  const ref = initialRef || draftRef.trim();

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

  const publicTrackUrl = useMemo(() => {
    if (!ref) return '';
    const base = `${window.location.origin}${window.location.pathname || '/'}`;
    return `${base}#/homologacao/organizacao?codigo=${encodeURIComponent(ref)}`;
  }, [ref]);

  const copyLink = useCallback(async () => {
    if (!publicTrackUrl) return;
    try {
      await navigator.clipboard.writeText(publicTrackUrl);
      toast('Link copiado para a área de transferência.', { variant: 'success', duration: 4000 });
    } catch {
      toast('Não foi possível copiar. Seleccione o link manualmente.', { variant: 'warning', duration: 5000 });
    }
  }, [publicTrackUrl, toast]);

  const onConsultar = (e) => {
    e.preventDefault();
    const v = draftRef.trim();
    if (!v) {
      toast('Indique o código ORG-… ou o identificador do pedido.', { variant: 'warning' });
      return;
    }
    setSearchParams({ codigo: v }, { replace: true });
  };

  const row = trackQuery.data;
  const errMsg = trackQuery.error instanceof Error ? trackQuery.error.message : null;

  return (
    <AuthSplitLayout
      heroTitle="Homologação"
      heroSubtitle="Consulte o pedido com o código ORG que recebeu ao enviar o cadastro."
    >
      <HomologacaoCommentsPanel
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        codigoRastreio={row?.codigo_rastreio || ref || ''}
        nomeEmpresa={row?.nome_empresa || ''}
      />

      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 sm:gap-4">
        <div className={`shrink-0 border-l-[3px] border-l-tertiary p-4 sm:p-5 ${cardSurface}`}>
          <h1 className="text-xl font-black tracking-tight text-primary sm:text-2xl">Acompanhamento do pedido</h1>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Utilize o código <span className="font-mono text-xs">ORG-…</span> ou o ID do pedido. Com o parâmetro{' '}
            <span className="font-mono text-xs">codigo</span> na URL, este endereço fica associado ao seu processo.
          </p>
        </div>

        <form
          onSubmit={onConsultar}
          className={`flex shrink-0 flex-col gap-2 p-4 sm:flex-row sm:items-end sm:gap-3 ${cardSurface}`}
        >
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
            Código ou ID
            <input
              className="rounded-none border border-outline-variant bg-white px-3 py-2 text-sm font-normal normal-case text-on-surface"
              value={draftRef}
              onChange={(e) => setDraftRef(e.target.value)}
              placeholder="ex.: ORG-HUB-2026-000001"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="shrink-0 rounded-none bg-tertiary px-5 py-3 text-[10px] font-black uppercase tracking-[0.15em] text-primary hover:bg-tertiary/90"
          >
            Consultar
          </button>
        </form>

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
                onClick={() => setCommentsOpen(true)}
                className="shrink-0 rounded-none border-2 border-primary bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-primary hover:bg-surface-container-low"
              >
                Abrir comentários
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
                onClick={() => void copyLink()}
                className="rounded-none border border-outline-variant bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-surface-container-low"
              >
                Copiar link desta página
              </button>
              <button
                type="button"
                onClick={() => void trackQuery.refetch()}
                className="rounded-none border border-outline-variant bg-white px-3 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-low"
              >
                Actualizar
              </button>
              <button
                type="button"
                onClick={() => setCommentsOpen(true)}
                className="rounded-none bg-tertiary px-3 py-2 text-xs font-black uppercase tracking-wide text-primary hover:bg-tertiary/90"
              >
                Comentários
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
