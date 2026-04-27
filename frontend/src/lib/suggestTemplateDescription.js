const MAX_TITLE_LEN = 80;

function normalizeLoose(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Texto neutro para o catálogo quando a IA repetiu título e descrição.
 * @param {{
 *   partnerKindLabel?: string,
 *   leadSegmentLabel?: string,
 *   cnpjRequired?: boolean,
 *   collectCpf?: boolean,
 *   inviteLinkEnabled?: boolean,
 * }} input
 */
function panelNoteFromInput(input) {
  const kind = String(input.partnerKindLabel || '').trim();
  const seg = String(input.leadSegmentLabel || '').trim();
  const bits = [
    kind ? `Ramo: ${kind}.` : '',
    seg ? `Segmento no CRM: ${seg}.` : '',
    input.cnpjRequired ? 'CNPJ obrigatório no cadastro.' : '',
    input.collectCpf ? 'Pedido de CPF no formulário.' : '',
    input.inviteLinkEnabled !== false ? 'Convite por link activo.' : 'Convite por link desligado.',
  ]
    .filter(Boolean)
    .join(' ');
  let note = `Uso interno no painel: ${bits}`.replace(/\s+/g, ' ').trim();
  if (note.length < 24) {
    note =
      'Uso interno no painel: modelo de cadastro; confira ramo, segmento, CPF/CNPJ e convite antes de publicar.';
  }
  return note.slice(0, 200);
}

/**
 * Quando a IA não devolve `title`, gera um título curto a partir da descrição ou do segmento (leads).
 * @param {string} description
 * @param {{ templatePurpose?: 'partner_homologacao' | 'lead_capture', segmentLabel?: string }} [opts]
 * @returns {string}
 */
export function deriveTemplateTitleFallback(description, opts = {}) {
  const d = String(description || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!d) return '';

  const seg = String(opts.segmentLabel || '').trim();
  if (opts.templatePurpose === 'lead_capture' && seg) {
    const candidate = `${seg} — cadastro público`;
    if (candidate.length <= MAX_TITLE_LEN) return candidate;
    return `${candidate.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`;
  }

  const firstChunk = d.split(/(?<=[.!?])\s+/)[0]?.trim() || d;
  if (firstChunk.length <= MAX_TITLE_LEN) return firstChunk;
  return `${d.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`;
}

/**
 * Evita título e descrição quase iguais (a IA às vezes repete o mesmo bloco).
 * @param {string} title
 * @param {string} description
 * @param {{
 *   templatePurpose?: 'partner_homologacao' | 'lead_capture',
 *   partnerKindLabel?: string,
 *   leadSegmentLabel?: string,
 *   cnpjRequired?: boolean,
 *   collectCpf?: boolean,
 *   inviteLinkEnabled?: boolean,
 * }} input
 * @returns {{ title: string, description: string }}
 */
export function ensureDistinctTitleAndDescription(title, description, input = {}) {
  let t = String(title || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LEN);
  let d = String(description || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);

  if (!d) return { title: t, description: d };

  const nt = normalizeLoose(t);
  const nd = normalizeLoose(d);
  const kind = String(input.partnerKindLabel || '').trim();
  const seg = String(input.leadSegmentLabel || '').trim();

  const startsSame =
    nt.length >= 8 &&
    nd.length >= 8 &&
    (nd.startsWith(nt) || nt.startsWith(nd.slice(0, Math.min(nd.length, nt.length + 5))));
  const tooSimilar = !t || nt === nd || startsSame;

  if (tooSimilar) {
    if (input.templatePurpose === 'lead_capture' && seg) {
      t = deriveTemplateTitleFallback(d, { templatePurpose: 'lead_capture', segmentLabel: seg });
    } else if (kind) {
      const candidate = `Formulário — ${kind}`;
      t = candidate.length <= MAX_TITLE_LEN ? candidate : `${candidate.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`;
    } else {
      const words = d.split(/\s+/).filter(Boolean);
      const head = words.slice(0, 7).join(' ');
      t = head.length <= MAX_TITLE_LEN ? head : `${head.slice(0, MAX_TITLE_LEN - 1).trimEnd()}…`;
    }
  }

  const nt2 = normalizeLoose(t);
  let d2 = d;
  if (normalizeLoose(d2) === nt2 || (nt2.length >= 6 && normalizeLoose(d2).startsWith(nt2))) {
    const rest = d2.slice(t.length).replace(/^[\s,.;:-]+/, '').trim();
    if (rest.length >= 20) {
      d2 = rest.slice(0, 200);
    } else {
      d2 = panelNoteFromInput(input);
    }
  }

  if (normalizeLoose(d2) === normalizeLoose(t) || d2.length < 12) {
    d2 = panelNoteFromInput(input);
  }

  return { title: t, description: d2 };
}

/**
 * Corpo JSON devolvido pela função (sucesso ou erro de negócio).
 * @param {unknown} v
 * @returns {{ ok?: boolean, mensagem?: string, description?: string, title?: string } | null}
 */
function asInvokePayload(v) {
  if (!v || typeof v !== 'object') return null;
  return /** @type {{ ok?: boolean, mensagem?: string, description?: string, title?: string }} */ (v);
}

/**
 * @param {unknown} err — tipicamente FunctionsHttpError: context = Response
 */
async function messageFromFunctionsHttpError(err) {
  const name = /** @type {{ name?: string }} */ (err)?.name;
  const ctx = /** @type {{ context?: unknown }} */ (err)?.context;
  if (name !== 'FunctionsHttpError' || !ctx || typeof /** @type {Response} */ (ctx).json !== 'function') {
    return '';
  }
  try {
    const j = await /** @type {Response} */ (ctx).json();
    const m = asInvokePayload(j)?.mensagem;
    return typeof m === 'string' && m.trim() ? m.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Mensagem legível quando o supabase-js só expõe o erro genérico de HTTP.
 * @param {unknown} err
 */
function fallbackInvokeMessage(err) {
  const m = String(/** @type {{ message?: string }} */ (err)?.message || err || '').trim();
  if (!m) {
    return 'Não foi possível contactar o serviço de sugestão. Tente de novo ou contacte o suporte técnico.';
  }
  if (/non-2xx/i.test(m) || /edge function/i.test(m)) {
    return 'A sugestão por IA não respondeu. Verifique a ligação ou contacte o suporte técnico.';
  }
  return m;
}

/**
 * Chama a Edge Function `suggest-template-description` (Mistral no servidor).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   templateName: string,
 *   templatePurpose?: 'partner_homologacao' | 'lead_capture',
 *   partnerKind: string,
 *   partnerKindLabel: string,
 *   partnerKindDescription: string,
 *   leadSegmentSlug?: string,
 *   leadSegmentLabel?: string,
 *   leadSegmentDescription?: string,
 *   cnpjRequired: boolean,
 *   collectCpf: boolean,
 *   inviteLinkEnabled: boolean,
 * }} input
 * @returns {Promise<{ title: string, description: string }>} Título (≤80) e descrição (≤200)
 */
export async function suggestTemplateDescriptionWithMistral(supabase, input) {
  const { data, error } = await supabase.functions.invoke('suggest-template-description', {
    body: input,
  });

  if (!error) {
    const payload = asInvokePayload(data);
    if (payload?.ok === true) {
      const description = String(payload.description ?? '').trim();
      if (!description) throw new Error('Descrição vazia.');
      let title = String(payload.title ?? '').trim().slice(0, MAX_TITLE_LEN);
      if (!title) {
        title = deriveTemplateTitleFallback(description, {
          templatePurpose: input.templatePurpose,
          segmentLabel: input.leadSegmentLabel,
        });
      }
      const fixed = ensureDistinctTitleAndDescription(title, description, {
        templatePurpose: input.templatePurpose,
        partnerKindLabel: input.partnerKindLabel,
        leadSegmentLabel: input.leadSegmentLabel,
        cnpjRequired: input.cnpjRequired,
        collectCpf: input.collectCpf,
        inviteLinkEnabled: input.inviteLinkEnabled,
      });
      return { title: fixed.title, description: fixed.description };
    }
    if (typeof payload?.mensagem === 'string' && payload.mensagem.trim()) {
      throw new Error(payload.mensagem.trim());
    }
    throw new Error('Resposta inválida do servidor.');
  }

  const fromBody = await messageFromFunctionsHttpError(error);
  if (fromBody) {
    throw new Error(fromBody);
  }

  throw new Error(fallbackInvokeMessage(error));
}
