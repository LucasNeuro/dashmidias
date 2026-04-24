/**
 * Labels e estruturas de UI para homologação de cadastros de organização (sem JSON bruto).
 * @typedef {{ icon: string, label: string, value: string }} GovField
 */

/** @type {Record<string, string>} */
export const PARTNER_KIND_LABELS = {
  imobiliaria: 'Imobiliária',
  imobiliarios: 'Imobiliários',
  arquitetura: 'Arquitetura',
  arquitetos: 'Arquitetos',
  engenharia: 'Engenharia',
  engenharias: 'Engenharias',
  prestador_servicos: 'Prestador de serviços',
  prestadores_servico: 'Prestadores de serviço',
  servicos: 'Serviços',
  produtos: 'Produtos',
  parceiros_produtos: 'Parceiros de produtos',
  parceiros_imobiliario: 'Parceiros — Imobiliário',
  parceiros_arquitetura: 'Parceiros — Arquitetura',
  parceiros_servicos: 'Parceiros — Serviços',
  outro: 'Outro',
};

/** @type {Record<string, string>} */
export const TIPO_ORG_FOR_CODE = {
  imobiliaria: 'IMB',
  imobiliarios: 'IMB',
  arquitetura: 'ARQ',
  arquitetos: 'ARQ',
  engenharias: 'SRV',
  produtos: 'PRO',
  prestador_servicos: 'SRV',
  prestadores_servico: 'SRV',
  servicos: 'SRV',
  parceiros_produtos: 'PRO',
  outro: 'SRV',
};

const MKT = [
  { code: 'IMB', label: 'Imobiliário', hint: 'Propriedades e imóveis' },
  { code: 'ARQ', label: 'Arquitetura', hint: 'Projetos e design' },
  { code: 'SRV', label: 'Serviços', hint: 'Prestação de serviços' },
  { code: 'PRO', label: 'Produtos', hint: 'Venda e distribuição' },
];

export function hubMarketLegendItems() {
  return MKT;
}

/**
 * @param {string | null | undefined} kind
 */
export function labelPartnerKind(kind) {
  const k = String(kind || '').trim();
  if (!k) return '—';
  return PARTNER_KIND_LABELS[k] || humanizeSnake(k);
}

/**
 * @param {string | null | undefined} f
 */
export function labelConsultaFonte(f) {
  const x = String(f || '').trim().toLowerCase();
  if (x === 'cnpja') return 'CNPJA';
  if (x === 'brasilapi') return 'Brasil API';
  return '—';
}

/**
 * Normaliza `cnpja_snapshot` (objeto, JSON em string, ou payload aninhado em `data`).
 * @param {unknown} raw
 * @returns {{ snapshot: Record<string, unknown> | null, inferredFonte: 'cnpja' | 'brasilapi' | null }}
 */
export function normalizeHubCnpjSnapshotInput(raw) {
  let o = raw;
  if (o == null) return { snapshot: null, inferredFonte: null };
  if (typeof o === 'string') {
    const t = o.trim();
    if (!t) return { snapshot: null, inferredFonte: null };
    try {
      o = JSON.parse(t);
    } catch {
      return { snapshot: null, inferredFonte: null };
    }
  }
  if (typeof o !== 'object' || o === null) return { snapshot: null, inferredFonte: null };
  const root = /** @type {Record<string, unknown>} */ (o);
  if (root._fonte === 'brasilapi' && root.payload && typeof root.payload === 'object') {
    return { snapshot: root, inferredFonte: 'brasilapi' };
  }
  const inner =
    root.data && typeof root.data === 'object' && !('company' in root) && !('taxId' in root)
      ? /** @type {Record<string, unknown>} */ (root.data)
      : root;
  if (inner._fonte === 'brasilapi' && inner.payload && typeof inner.payload === 'object') {
    return { snapshot: /** @type {Record<string, unknown>} */ (inner), inferredFonte: 'brasilapi' };
  }
  if (
    'company' in inner ||
    'taxId' in inner ||
    'mainActivity' in inner ||
    ('address' in inner && typeof inner.address === 'object')
  ) {
    return { snapshot: /** @type {Record<string, unknown>} */ (inner), inferredFonte: 'cnpja' };
  }
  return { snapshot: /** @type {Record<string, unknown>} */ (inner), inferredFonte: null };
}

/**
 * Rótulo para UI: usa `consulta_fonte` da linha ou infere pelo formato do snapshot.
 * @param {string | null | undefined} dbVal
 * @param {unknown} rawSnap
 */
export function resolveConsultaFonteLabel(dbVal, rawSnap) {
  const direct = labelConsultaFonte(dbVal);
  if (direct !== '—') return direct;
  const { inferredFonte } = normalizeHubCnpjSnapshotInput(rawSnap);
  if (inferredFonte) return labelConsultaFonte(inferredFonte);
  return 'Não registada';
}

/**
 * @param {string | null | undefined} id
 */
export function shortTemplateRef(id) {
  const s = String(id || '').trim();
  if (!s) return '—';
  if (s.length <= 14) return s;
  return `Formulário · …${s.slice(-8)}`;
}

function humanizeSnake(s) {
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function fmtMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(n));
  } catch {
    return String(n);
  }
}

/**
 * Campos do formulário público (chaves conhecidas).
 * @param {Record<string, unknown>} dados
 * @returns {GovField[]}
 */
export function buildFormularioGovFields(dados) {
  if (!dados || typeof dados !== 'object') return [];
  const d = /** @type {Record<string, unknown>} */ (dados);
  /** @type {GovField[]} */
  const out = [];
  const push = (icon, label, key, fmt = (v) => (v == null || v === '' ? '' : String(v))) => {
    if (!(key in d)) return;
    const v = fmt(d[key]);
    if (!v) return;
    out.push({ icon, label, value: v });
  };
  push('corporate_fare', 'Razão / nome empresarial', 'nome_empresa');
  push('badge', 'CNPJ', 'cnpj');
  push('badge', 'CPF', 'cpf');
  push('mail', 'E-mail', 'email');
  push('call', 'Telefone', 'telefone');
  push('pin', 'CEP', 'cep');
  push('home_work', 'Logradouro', 'logradouro');
  push('numbers', 'Número', 'numero');
  push('apartment', 'Complemento', 'complemento');
  push('location_city', 'Bairro', 'bairro');
  push('location_city', 'Cidade', 'cidade');
  push('map', 'UF', 'uf');
  push('tag', 'Código IBGE', 'codigo_ibge');

  if (d.extras && typeof d.extras === 'object' && !Array.isArray(d.extras)) {
    for (const [k, v] of Object.entries(d.extras)) {
      if (v === null || v === undefined || v === '') continue;
      out.push({ icon: 'tune', label: humanizeSnake(k), value: typeof v === 'object' ? JSON.stringify(v) : String(v) });
    }
  }
  return out;
}

/**
 * Agrupa campos do formulário em cartões (empresa, endereço, extras).
 * @param {Record<string, unknown>} dados
 * @returns {Array<{ id: string, title: string, icon: string, rows: Array<{ label: string, value: string }> }>}
 */
export function buildFormularioGroupedSections(dados) {
  if (!dados || typeof dados !== 'object') return [];
  const d = /** @type {Record<string, unknown>} */ (dados);
  const pick = (label, key) => {
    if (!(key in d) || d[key] == null || String(d[key]).trim() === '') return null;
    return { label, value: String(d[key]) };
  };
  /** @type {Array<{ id: string, title: string, icon: string, rows: Array<{ label: string, value: string }> }>} */
  const out = [];
  const empRows = [
    pick('Razão / nome empresarial', 'nome_empresa'),
    pick('CNPJ', 'cnpj'),
    pick('CPF', 'cpf'),
    pick('E-mail', 'email'),
    pick('Telefone', 'telefone'),
  ].filter(Boolean);
  if (empRows.length) out.push({ id: 'emp', title: 'Empresa e contacto', icon: 'corporate_fare', rows: /** @type {*} */ (empRows) });

  const addrRows = [
    pick('CEP', 'cep'),
    pick('Logradouro', 'logradouro'),
    pick('Número', 'numero'),
    pick('Complemento', 'complemento'),
    pick('Bairro', 'bairro'),
    pick('Cidade', 'cidade'),
    pick('UF', 'uf'),
    pick('Código IBGE', 'codigo_ibge'),
  ].filter(Boolean);
  if (addrRows.length) out.push({ id: 'addr', title: 'Endereço', icon: 'distance', rows: /** @type {*} */ (addrRows) });

  if (d.extras && typeof d.extras === 'object' && !Array.isArray(d.extras)) {
    const exRows = Object.entries(d.extras)
      .filter(([, v]) => v != null && String(v).trim() !== '')
      .map(([k, v]) => ({
        label: humanizeSnake(k),
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }));
    if (exRows.length) out.push({ id: 'extras', title: 'Campos adicionais (template)', icon: 'tune', rows: exRows });
  }
  return out;
}

/**
 * @param {unknown} snap
 * @returns {{ title: string, sections: Array<{ id: string, title: string, fields: GovField[] }>, members: string[], suframaLines: string[] }}
 */
export function buildCnpjSnapshotPresentation(snap) {
  const { snapshot } = normalizeHubCnpjSnapshotInput(snap);
  if (!snapshot) {
    return { title: 'Sem consulta automática', sections: [], members: [], suframaLines: [] };
  }
  const o = snapshot;
  if (o._fonte === 'brasilapi' && o.payload && typeof o.payload === 'object') {
    const br = buildBrasilApiPresentation(/** @type {Record<string, unknown>} */ (o.payload));
    return { ...br, suframaLines: [] };
  }
  return buildCnpjaPresentation(o);
}

function buildBrasilApiPresentation(p) {
  const razao = p.razao_social != null ? String(p.razao_social) : '';
  const fantasia = p.nome_fantasia != null ? String(p.nome_fantasia) : '';
  const title = razao || fantasia || 'Dados Receita (Brasil API)';
  /** @type {Array<{ id: string, title: string, fields: GovField[] }>} */
  const sections = [];
  /** @type {GovField[]} */
  const idFields = [];
  if (razao) idFields.push({ icon: 'corporate_fare', label: 'Razão social', value: razao });
  if (fantasia && fantasia !== razao) idFields.push({ icon: 'storefront', label: 'Nome fantasia', value: fantasia });
  if (p.cnpj) idFields.push({ icon: 'badge', label: 'CNPJ', value: String(p.cnpj) });
  if (p.descricao_situacao_cadastral) idFields.push({ icon: 'verified', label: 'Situação cadastral', value: String(p.descricao_situacao_cadastral) });
  if (p.cnae_fiscal_descricao) idFields.push({ icon: 'work', label: 'CNAE fiscal', value: String(p.cnae_fiscal_descricao) });
  if (idFields.length) sections.push({ id: 'id', title: 'Identificação', fields: idFields });

  const logr = [p.logradouro, p.numero, p.complemento, p.bairro, p.municipio, p.uf, p.cep].filter(Boolean).map(String);
  if (logr.length) {
    sections.push({
      id: 'addr',
      title: 'Endereço',
      fields: [{ icon: 'distance', label: 'Endereço completo', value: logr.join(', ') }],
    });
  }
  return { title, sections, members: [], suframaLines: [] };
}

function buildCnpjaPresentation(data) {
  const company = data.company && typeof data.company === 'object' ? data.company : null;
  const addr = data.address && typeof data.address === 'object' ? data.address : null;
  const name = company?.name != null ? String(company.name) : data.alias != null ? String(data.alias) : 'Empresa';
  const alias = data.alias != null && data.head === false ? String(data.alias) : '';
  const title = alias && name ? `${name} — ${alias}` : name;

  /** @type {Array<{ id: string, title: string, fields: GovField[] }>} */
  const sections = [];
  /** @type {GovField[]} */
  const idFields = [];
  if (data.taxId) idFields.push({ icon: 'badge', label: 'CNPJ', value: String(data.taxId) });
  const st = data.status && typeof data.status === 'object' ? data.status.text : null;
  if (st) idFields.push({ icon: 'verified', label: 'Situação', value: String(st) });
  const nat = company?.nature && typeof company.nature === 'object' ? company.nature.text : null;
  if (nat) idFields.push({ icon: 'gavel', label: 'Natureza jurídica', value: String(nat) });
  const size = company?.size && typeof company.size === 'object' ? company.size.text : null;
  if (size) idFields.push({ icon: 'groups', label: 'Porte', value: String(size) });
  const simples = company?.simples && typeof company.simples === 'object' ? company.simples : null;
  if (simples) {
    const opt = simples.optant === true ? 'Optante' : 'Não optante';
    const since = simples.since != null && simples.since !== '' ? ` · desde ${simples.since}` : '';
    idFields.push({ icon: 'receipt_long', label: 'Simples Nacional', value: `${opt}${since}` });
  }
  const simei = company?.simei && typeof company.simei === 'object' ? company.simei : null;
  if (simei) {
    const opt = simei.optant === true ? 'Optante' : 'Não optante';
    const since = simei.since != null && simei.since !== '' ? ` · desde ${simei.since}` : '';
    idFields.push({ icon: 'storefront', label: 'MEI / SIMEI', value: `${opt}${since}` });
  }
  if (company?.equity != null) {
    const eq = fmtMoney(company.equity);
    if (eq) idFields.push({ icon: 'account_balance', label: 'Capital social', value: eq });
  }
  if (data.founded) idFields.push({ icon: 'calendar_month', label: 'Início atividade', value: String(data.founded) });
  if (data.updated) {
    const u = String(data.updated);
    const d = new Date(u);
    idFields.push({
      icon: 'update',
      label: 'Atualizado na fonte',
      value: Number.isNaN(d.getTime()) ? u : d.toLocaleString('pt-BR'),
    });
  }
  if (idFields.length) sections.push({ id: 'id', title: 'Identificação', fields: idFields });

  if (addr) {
    const parts = [addr.street, addr.number, addr.details, addr.district, addr.city, addr.state, addr.zip].filter(Boolean).map(String);
    /** @type {GovField[]} */
    const af = [];
    if (parts.length) af.push({ icon: 'distance', label: 'Endereço', value: parts.join(', ') });
    const lat = addr.latitude;
    const lon = addr.longitude;
    if (lat != null && lon != null) af.push({ icon: 'map', label: 'Coordenadas', value: `${lat}, ${lon}` });
    if (af.length) sections.push({ id: 'addr', title: 'Endereço', fields: af });
  }

  const phones = Array.isArray(data.phones) ? data.phones : [];
  if (phones.length) {
    const txt = phones
      .map((ph) => {
        if (!ph || typeof ph !== 'object') return '';
        const t = String(ph.type || '').toLowerCase();
        const area = ph.area != null ? String(ph.area) : '';
        const num = ph.number != null ? String(ph.number) : '';
        return [t === 'landline' ? 'Fixo' : t, area && num ? `(${area}) ${num}` : num].filter(Boolean).join(' ');
      })
      .filter(Boolean);
    if (txt.length) sections.push({ id: 'phones', title: 'Telefones', fields: [{ icon: 'call', label: 'Lista', value: txt.join(' · ') }] });
  }

  const emails = Array.isArray(data.emails) ? data.emails : [];
  if (emails.length) {
    const txt = emails
      .map((e) => (e && typeof e === 'object' && e.address ? String(e.address) : ''))
      .filter(Boolean);
    if (txt.length) sections.push({ id: 'emails', title: 'E-mails na fonte', fields: [{ icon: 'mail', label: 'Lista', value: txt.join(' · ') }] });
  }

  const main = data.mainActivity && typeof data.mainActivity === 'object' ? data.mainActivity.text : null;
  const sides = Array.isArray(data.sideActivities) ? data.sideActivities : [];
  /** @type {GovField[]} */
  const actFields = [];
  if (main) actFields.push({ icon: 'precision_manufacturing', label: 'Atividade principal', value: String(main) });
  if (sides.length) {
    const stext = sides.map((s) => (s && typeof s === 'object' && s.text ? String(s.text) : '')).filter(Boolean);
    if (stext.length) actFields.push({ icon: 'category', label: 'Secundárias', value: stext.join(' · ') });
  }
  if (actFields.length) sections.push({ id: 'acts', title: 'Atividades econômicas', fields: actFields });

  const regs = Array.isArray(data.registrations) ? data.registrations : [];
  if (regs.length) {
    const lines = regs.map((r) => {
      if (!r || typeof r !== 'object') return '';
      const num = r.number != null ? String(r.number) : '';
      const uf = r.state != null ? String(r.state) : '';
      const stt = r.status && typeof r.status === 'object' ? r.status.text : '';
      return [num && uf ? `IE ${uf} ${num}` : num, stt].filter(Boolean).join(' — ');
    });
    sections.push({
      id: 'regs',
      title: 'Inscrições estaduais',
      fields: [{ icon: 'assignment', label: 'Registros', value: lines.filter(Boolean).join(' | ') || '—' }],
    });
  }

  const suframa = Array.isArray(data.suframa) ? data.suframa : [];
  /** @type {string[]} */
  const suframaLines = [];
  if (suframa.length) {
    const lines = suframa.map((s) => {
      if (!s || typeof s !== 'object') return '';
      const n = s.number != null ? String(s.number) : '';
      const stt = s.status && typeof s.status === 'object' ? s.status.text : '';
      return [n, stt].filter(Boolean).join(' — ');
    });
    sections.push({
      id: 'suframa',
      title: 'SUFRAMA',
      fields: [{ icon: 'forest', label: 'Registros', value: lines.filter(Boolean).join(' | ') }],
    });
    for (const s of suframa) {
      if (!s || typeof s !== 'object') continue;
      const n = s.number != null ? String(s.number) : '—';
      const head = [
        `Cadastro ${n}`,
        s.approved === true ? 'aprovado' : s.approved === false ? 'não aprovado' : null,
        s.status && typeof s.status === 'object' ? String(s.status.text) : null,
      ]
        .filter(Boolean)
        .join(' · ');
      suframaLines.push(head);
      if (s.since) suframaLines.push(`- Vigência: ${String(s.since)}`);
      if (s.approvalDate) suframaLines.push(`- Data aprovação: ${String(s.approvalDate)}`);
      const inc = Array.isArray(s.incentives) ? s.incentives : [];
      for (const it of inc) {
        if (!it || typeof it !== 'object') continue;
        const t = [it.basis, it.benefit, it.purpose, it.tribute].filter(Boolean).map(String);
        if (t.length) suframaLines.push(`- Incentivo: ${t.join(' · ')}`);
      }
    }
  }

  const members = Array.isArray(company?.members) ? company.members : [];
  const membersLines = members
    .map((m) => {
      if (!m || typeof m !== 'object') return '';
      const role = m.role && typeof m.role === 'object' ? m.role.text : '';
      const person = m.person && typeof m.person === 'object' ? m.person : null;
      const pname = person?.name != null ? String(person.name) : '';
      const since = m.since != null ? String(m.since) : '';
      return [role, pname, since ? `desde ${since}` : ''].filter(Boolean).join(' · ');
    })
    .filter(Boolean);

  return { title, sections, members: membersLines, suframaLines };
}

/**
 * @param {string | null | undefined} partnerKind
 */
export function orgCodePrefixFromPartnerKind(partnerKind) {
  const k = String(partnerKind || '').trim().toLowerCase();
  if (!k) return 'SRV';
  if (TIPO_ORG_FOR_CODE[k]) return TIPO_ORG_FOR_CODE[k];
  if (k.includes('imob')) return 'IMB';
  if (k.includes('arq')) return 'ARQ';
  if (k.includes('engenh')) return 'SRV';
  if (k.includes('prod')) return 'PRO';
  if (k.includes('serv') || k.includes('prestador')) return 'SRV';
  return 'SRV';
}

/**
 * @param {string | null | undefined} tipoOrgSelect
 * @param {string | null | undefined} partnerKind
 */
export function describeProvisioningCodeHint(tipoOrgSelect, partnerKind) {
  const tipo = String(tipoOrgSelect || '').trim().toLowerCase();
  const prefix = TIPO_ORG_FOR_CODE[tipo] || orgCodePrefixFromPartnerKind(partnerKind);
  const year = new Date().getFullYear();
  return {
    prefix,
    exemploOrg: `ORG-${prefix}-${year}-000001`,
    negExemplo: `NEG-${prefix}-${year}-001`,
    oppExemplo: `OPP-${prefix}-${year}-001`,
  };
}
