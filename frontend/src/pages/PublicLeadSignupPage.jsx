import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { fetchActiveLeadSegments } from '../lib/leadSegmentsApi';
import { FALLBACK_LEAD_SEGMENTS } from '../lib/leadSegmentsFallback';
import { leadSegmentsPublicQueryKey } from '../lib/queryKeys';
import { PRIMARY_REGISTRATION_INTAKE_PATH } from '../lib/registrationPublicLinks';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { rpcSubmitPublicLead } from '../lib/submitPublicLead';

const LEAD_INTAKE_SESSION = 'ob10_lead_intake_v1';

function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** @returns {null | { docDigits?: string }} */
function readLeadIntakeSession() {
  try {
    const raw = sessionStorage.getItem(LEAD_INTAKE_SESSION);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : null;
  } catch {
    return null;
  }
}

export function PublicLeadSignupPage() {
  const { toast } = useUiFeedback();
  const [searchParams] = useSearchParams();
  const segmentSlug = (searchParams.get('segment') || '').trim().toLowerCase();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cpf, setCpf] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const intakeSession = useMemo(() => readLeadIntakeSession(), []);

  useEffect(() => {
    const digits = onlyDigits(intakeSession?.docDigits ?? '');
    if (digits.length === 11) setCpf(digits);
  }, [intakeSession]);

  const segmentsQuery = useQuery({
    queryKey: leadSegmentsPublicQueryKey(),
    queryFn: async () => {
      const sb = getSupabase();
      if (!isSupabaseConfigured() || !sb) return FALLBACK_LEAD_SEGMENTS;
      try {
        return await fetchActiveLeadSegments(sb);
      } catch {
        return FALLBACK_LEAD_SEGMENTS;
      }
    },
    staleTime: 60_000,
  });

  const segments = useMemo(() => segmentsQuery.data ?? FALLBACK_LEAD_SEGMENTS, [segmentsQuery.data]);
  const segmentMeta = useMemo(
    () => segments.find((s) => s.slug === segmentSlug) ?? null,
    [segments, segmentSlug]
  );

  const invalidSegment = Boolean(segmentSlug) && !segmentMeta && !segmentsQuery.isPending;

  async function onSubmit(e) {
    e.preventDefault();
    if (!segmentSlug || invalidSegment) {
      toast('Selecione um tipo de pedido válido a partir da página inicial.', { variant: 'warning' });
      return;
    }
    const sb = getSupabase();
    if (!isSupabaseConfigured() || !sb) {
      toast('Servidor não configurado. Os dados não foram guardados.', { variant: 'warning', duration: 6000 });
      return;
    }
    setBusy(true);
    try {
      const cpfDigits = onlyDigits(cpf);
      const r = await rpcSubmitPublicLead(sb, {
        segmentSlug,
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim() || null,
        cpf: cpfDigits.length ? cpfDigits : null,
        dadosFormulario: {
          mensagem: mensagem.trim(),
        },
        templateId: null,
        flowSlug: null,
      });
      if (!r.ok) {
        toast(r.error || 'Não foi possível enviar.', { variant: 'warning', duration: 6500 });
        return;
      }
      setDone(true);
      toast('Pedido enviado. Entraremos em contacto em breve.', { variant: 'success', duration: 5000 });
    } finally {
      setBusy(false);
    }
  }

  if (!segmentSlug) {
    return (
      <AuthSplitLayout heroTitle="Lead" heroSubtitle="Escolha primeiro o tipo de pedido.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={PRIMARY_REGISTRATION_INTAKE_PATH} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início do cadastro
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  if (invalidSegment) {
    return (
      <AuthSplitLayout heroTitle="Segmento inválido" heroSubtitle="Esta ligação não é válida ou expirou.">
        <div className="mx-auto max-w-md px-4 py-8 text-center text-sm text-on-surface-variant">
          <Link to={PRIMARY_REGISTRATION_INTAKE_PATH} className="font-medium text-primary underline underline-offset-2">
            Voltar ao início do cadastro
          </Link>
        </div>
      </AuthSplitLayout>
    );
  }

  return (
    <AuthSplitLayout
      heroTitle="Pedido de contacto"
      heroSubtitle={
        segmentMeta
          ? `${segmentMeta.label}. Preencha os dados para que a equipe Obra10+ possa entrar em contato.`
          : 'Preencha os dados para que a equipe possa entrar em contato.'
      }
    >
      <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
        {done ? (
          <div className="rounded-none border-2 border-primary bg-surface-container-low p-5 text-center shadow-md">
            <p className="text-sm font-bold text-primary">Obrigado pelo seu pedido.</p>
            <p className="mt-2 text-sm text-on-surface-variant">Vamos analisar e entrar em contacto pelo e-mail ou telefone indicados.</p>
            <Link
              to={PRIMARY_REGISTRATION_INTAKE_PATH}
              className="mt-4 inline-block text-xs font-black uppercase tracking-[0.12em] text-primary underline underline-offset-2"
            >
              Novo pedido
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 rounded-none border border-outline-variant bg-white p-4 shadow-md sm:p-5">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-nome">
                Nome completo
              </label>
              <input
                id="lead-nome"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-email">
                E-mail
              </label>
              <input
                id="lead-email"
                type="email"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-tel">
                Telefone
              </label>
              <input
                id="lead-tel"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                autoComplete="tel"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-cpf">
                CPF
              </label>
              <input
                id="lead-cpf"
                className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                inputMode="numeric"
                autoComplete="off"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor="lead-msg">
                Mensagem / detalhe do pedido
              </label>
              <textarea
                id="lead-msg"
                rows={4}
                className="mt-1 w-full resize-y rounded-sm border-2 border-outline-variant bg-white p-2 text-sm text-on-surface outline-none focus:border-primary"
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3">
              <Link
                to={PRIMARY_REGISTRATION_INTAKE_PATH}
                className="inline-flex justify-center rounded-sm border-2 border-outline-variant px-4 py-2.5 text-center text-[10px] font-black uppercase tracking-[0.12em] text-primary hover:bg-surface-container-low"
              >
                Voltar
              </Link>
              <button
                type="submit"
                disabled={busy}
                className="rounded-sm border-2 border-primary bg-primary px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.12em] text-white hover:opacity-95 disabled:opacity-60"
              >
                {busy ? 'A enviar…' : 'Enviar pedido'}
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthSplitLayout>
  );
}
