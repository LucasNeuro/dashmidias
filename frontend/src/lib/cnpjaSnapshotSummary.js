/**
 * Resumo legível do snapshot CNPJA (ou Brasil API em wrapper) para o painel do aprovador.
 * @param {unknown} snap
 * @returns {{ titulo: string, linhas: Array<{ k: string, v: string }>, membersPreview: string[] }}
 */
export function summarizeHubCnpjSnapshot(snap) {
  if (!snap || typeof snap !== 'object') {
    return { titulo: '—', linhas: [], membersPreview: [] };
  }
  const o = /** @type {Record<string, unknown>} */ (snap);
  if (o._fonte === 'brasilapi' && o.payload && typeof o.payload === 'object') {
    return summarizeBrasilPayload(/** @type {Record<string, unknown>} */ (o.payload));
  }
  return summarizeCnpjaOfficeShape(o);
}

function summarizeBrasilPayload(p) {
  const razao = p.razao_social != null ? String(p.razao_social) : '';
  const fantasia = p.nome_fantasia != null ? String(p.nome_fantasia) : '';
  const titulo = razao || fantasia || 'Consulta Brasil API';
  const linhas = [];
  if (fantasia && fantasia !== razao) linhas.push({ k: 'Nome fantasia', v: fantasia });
  if (p.cnpj) linhas.push({ k: 'CNPJ', v: String(p.cnpj) });
  if (p.descricao_situacao_cadastral) linhas.push({ k: 'Situação', v: String(p.descricao_situacao_cadastral) });
  if (p.cnae_fiscal_descricao) linhas.push({ k: 'CNAE', v: String(p.cnae_fiscal_descricao) });
  return { titulo, linhas, membersPreview: [] };
}

function summarizeCnpjaOfficeShape(data) {
  const company = data.company && typeof data.company === 'object' ? data.company : null;
  const addr = data.address && typeof data.address === 'object' ? data.address : null;
  const name =
    company?.name != null
      ? String(company.name)
      : data.alias != null
        ? String(data.alias)
        : 'Empresa';
  const alias = data.alias != null && data.head === false ? String(data.alias) : '';
  const titulo = alias && name ? `${name} (${alias})` : name;

  const linhas = [];
  const taxId = data.taxId != null ? String(data.taxId) : '';
  if (taxId) linhas.push({ k: 'CNPJ (raiz/filial)', v: taxId });
  const st = data.status && typeof data.status === 'object' ? data.status.text : null;
  if (st) linhas.push({ k: 'Situação', v: String(st) });
  const nat = company?.nature && typeof company.nature === 'object' ? company.nature.text : null;
  if (nat) linhas.push({ k: 'Natureza jurídica', v: String(nat) });
  const size = company?.size && typeof company.size === 'object' ? company.size.text : null;
  if (size) linhas.push({ k: 'Porte', v: String(size) });
  const main = data.mainActivity && typeof data.mainActivity === 'object' ? data.mainActivity.text : null;
  if (main) linhas.push({ k: 'Atividade principal', v: String(main) });
  if (addr) {
    const parts = [addr.street, addr.number, addr.district, addr.city, addr.state, addr.zip]
      .filter(Boolean)
      .map(String);
    if (parts.length) linhas.push({ k: 'Endereço', v: parts.join(', ') });
  }
  const corpEmail = Array.isArray(data.emails)
    ? data.emails.find((e) => e && typeof e === 'object' && String(e.ownership || '').toUpperCase() === 'CORPORATE')
    : null;
  if (corpEmail?.address) linhas.push({ k: 'E-mail corporativo (fonte)', v: String(corpEmail.address) });

  const members = Array.isArray(company?.members) ? company.members : [];
  const membersPreview = members.slice(0, 12).map((m) => {
    if (!m || typeof m !== 'object') return '';
    const role = m.role && typeof m.role === 'object' ? m.role.text : '';
    const person = m.person && typeof m.person === 'object' ? m.person : null;
    const pname = person?.name != null ? String(person.name) : '';
    const since = m.since != null ? String(m.since) : '';
    return [role, pname, since].filter(Boolean).join(' · ');
  });

  return { titulo, linhas, membersPreview: membersPreview.filter(Boolean) };
}
