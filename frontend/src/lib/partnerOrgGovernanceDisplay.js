/**
 * Labels e estruturas de UI para homologação de cadastros de organização (sem JSON bruto).
 * @typedef {{ icon: string, label: string, value: string }} GovField
 */

/** @type {Record<string, string>} */
export const PARTNER_KIND_LABELS = {
  imobiliaria: 'Imobiliária',
  arquitetura: 'Arquitetura',
  engenharia: 'Engenharia',
  prestador_servicos: 'Prestador de serviços',
  servicos: 'Serviços',
  produtos: 'Produtos',
  parceiros_produtos: 'Parceiros — Produtos',
  parceiros_imobiliario: 'Parceiros — Imobiliário',
  parceiros_arquitetura: 'Parceiros — Arquitetura',
  parceiros_servicos: 'Parceiros — Serviços',
  outro: 'Outro',
};

/** @type {Record<string, string>} */
export const TIPO_ORG_FOR_CODE = {
  imobiliaria: 'IMB',
  arquitetura: 'ARQ',
  produtos: 'PRO',
  prestador_servicos: 'SRV',
  servicos: 'SRV',
  outro: 'HUB',
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
 * @param {unknown} snap
 * @returns {{ title: string, sections: Array<{ id: string, title: string, fields: GovField[] }>, members: string[] }}
 */
export function buildCnpjSnapshotPresentation(snap) {
  if (!snap || typeof snap !== 'object') {
    return { title: 'Sem consulta automática', sections: [], members: [] };
  }
  const o = /** @type {Record<string, unknown>} */ (snap);
  if (o._fonte === 'brasilapi' && o.payload && typeof o.payload === 'object') {
    return buildBrasilApiPresentation(/** @type {Record<string, unknown>} */ (o.payload));
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
  return { title, sections, members: [] };
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

  return { title, sections, members: membersLines };
}

/**
 * @param {string | null | undefined} partnerKind
 */
export function orgCodePrefixFromPartnerKind(partnerKind) {
  const k = String(partnerKind || '').toLowerCase();
  if (k.includes('imob')) return 'IMB';
  if (k.includes('arq')) return 'ARQ';
  if (k.includes('prod')) return 'PRO';
  if (k.includes('serv') || k.includes('prestador')) return 'SRV';
  return 'HUB';
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
