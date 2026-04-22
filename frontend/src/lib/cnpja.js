/**
 * API comercial CNPJA — consulta CNPJ, CEP e (futuro) pessoa.
 * @see https://cnpja.com/api
 *
 * Autenticação: header `Authorization` com a chave completa (sem prefixo Bearer).
 * Chave: `import.meta.env.VITE_CNPJA_API_KEY` — nunca commitar valor real.
 */

import { normalizeCnpj14, onlyDigits } from './opencnpj';

const BASE = 'https://api.cnpja.com';

export function getCnpjaApiKey() {
  try {
    return (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CNPJA_API_KEY) || '';
  } catch {
    return '';
  }
}

export function hasCnpjaApiKey() {
  return Boolean(String(getCnpjaApiKey()).trim());
}

function authHeaders() {
  const key = String(getCnpjaApiKey()).trim();
  if (!key) {
    const err = new Error('Configure VITE_CNPJA_API_KEY');
    err.code = 'CNPJA_NO_KEY';
    throw err;
  }
  return {
    Accept: 'application/json',
    Authorization: key,
  };
}

async function parseCnpjaError(res) {
  let msg = `Erro HTTP ${res.status}`;
  try {
    const j = await res.json();
    if (j?.message) msg = String(j.message);
    else if (j?.code) msg = `${msg} (${j.code})`;
  } catch {
    /* ignore */
  }
  return msg;
}

/**
 * Consulta estabelecimento por CNPJ (14 dígitos).
 * @param {string} cnpjInput
 * @param {{ simples?: boolean, registrations?: string, suframa?: boolean, geocoding?: boolean }} [opts]
 */
export async function fetchCnpjaOffice(
  cnpjInput,
  { simples = true, registrations = 'ORIGIN', suframa = true, geocoding = true } = {}
) {
  const n = normalizeCnpj14(cnpjInput);
  if (!n) {
    const err = new Error('CNPJ inválido');
    err.code = 'CNPJ_INVALIDO';
    throw err;
  }
  const params = new URLSearchParams();
  if (simples) params.set('simples', 'true');
  if (registrations) params.set('registrations', registrations);
  if (suframa) params.set('suframa', 'true');
  if (geocoding) params.set('geocoding', 'true');
  const q = params.toString();
  const url = `${BASE}/office/${n}${q ? `?${q}` : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) {
    const err = new Error('Chave CNPJA inválida ou ausente');
    err.code = 'CNPJA_401';
    throw err;
  }
  if (res.status === 404) {
    const err = new Error('CNPJ não encontrado');
    err.code = 'CNPJA_404';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Limite de consultas CNPJA excedido');
    err.code = 'CNPJA_429';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(await parseCnpjaError(res));
    err.code = 'CNPJA_HTTP';
    err.status = res.status;
    throw err;
  }
  return res.json();
}

/**
 * Consulta CEP (8 dígitos) — mesmo catálogo CNPJA (0 créditos em cache).
 * @param {string} cepInput
 */
export async function fetchCnpjaZip(cepInput) {
  const d = onlyDigits(cepInput);
  if (d.length !== 8) {
    const err = new Error('CEP deve ter 8 dígitos');
    err.code = 'CEP_INVALIDO';
    throw err;
  }
  const res = await fetch(`${BASE}/zip/${d}`, { headers: authHeaders() });
  if (res.status === 401) {
    const err = new Error('Chave CNPJA inválida ou ausente');
    err.code = 'CNPJA_401';
    throw err;
  }
  if (res.status === 404) {
    const err = new Error('CEP não encontrado');
    err.code = 'CEP_NAO_ENCONTRADO';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Limite de consultas CNPJA excedido');
    err.code = 'CNPJA_429';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(await parseCnpjaError(res));
    err.code = 'CNPJA_HTTP';
    throw err;
  }
  return res.json();
}

/**
 * Normaliza resposta GET /zip para o formato usado pelo formulário (compatível com ViaCEP).
 * @param {Record<string, unknown>} z
 */
export function cnpjaZipToFormShape(z) {
  const m = z?.municipality;
  return {
    logradouro: String(z?.street ?? ''),
    bairro: String(z?.district ?? ''),
    localidade: String(z?.city ?? ''),
    uf: String(z?.state ?? ''),
    ibge: m != null ? String(m) : '',
    complemento: '',
    numero: z?.number != null ? String(z.number) : '',
    cepDigits: z?.code != null ? onlyDigits(String(z.code)).slice(0, 8) : '',
  };
}

/**
 * Escolhe o melhor e-mail da lista (prioriza corporativo, depois qualquer endereço válido).
 * @param {unknown[]} emails
 */
function pickEmailAddress(emails) {
  if (!Array.isArray(emails) || emails.length === 0) return '';
  const valid = (e) =>
    e &&
    typeof e === 'object' &&
    e.address != null &&
    String(e.address).trim().includes('@') &&
    !String(e.address).includes('***');
  const corp = emails.find((e) => valid(e) && e.ownership === 'CORPORATE');
  const partner = emails.find((e) => valid(e) && e.ownership === 'PARTNER');
  const any = emails.find((e) => valid(e));
  const em = corp ?? partner ?? any ?? emails.find((e) => e && typeof e === 'object' && e.address);
  const addr = em?.address;
  return addr != null ? String(addr).trim() : '';
}

/**
 * Formata um item de `phones[]` da CNPJA (área + número, só dígitos).
 * @param {unknown} p
 */
function formatPhoneFromCnpja(p) {
  if (!p || typeof p !== 'object') return '';
  const area = p.area != null ? onlyDigits(String(p.area)).slice(0, 3) : '';
  let num = p.number != null ? onlyDigits(String(p.number)) : '';
  if (area && num.length >= 10 && num.startsWith(area)) {
    num = num.slice(area.length);
  }
  if (area && num) return `(${area}) ${num}`;
  return num || (area ? `(${area})` : '');
}

const PHONE_TYPE_ORDER = /** @type {const} */ ({
  MOBILE: 0,
  LANDLINE: 1,
  FIXED: 2,
  FAX: 3,
});

/**
 * Escolhe telefone principal (prioriza celular, depois fixo, depois qualquer número válido).
 * @param {unknown[]} phones
 */
function pickPhone(phones) {
  if (!Array.isArray(phones) || phones.length === 0) return '';
  const rank = (t) => {
    const k = String(t || '');
    return k in PHONE_TYPE_ORDER ? PHONE_TYPE_ORDER[k] : 9;
  };
  const sorted = [...phones].sort((a, b) => rank(a?.type) - rank(b?.type));
  for (const p of sorted) {
    const s = formatPhoneFromCnpja(p);
    if (s.replace(/\D/g, '').length >= 10) return s;
  }
  return formatPhoneFromCnpja(sorted[0]);
}

/**
 * Snapshot enriquecido para persistência (ex.: `hub_partner_org_signups.cnpja_snapshot`).
 * @param {Record<string, unknown>} data resposta bruta do GET /office
 */
export function cnpjaOfficeToHubSnapshot(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    ...data,
    _consulta_em: new Date().toISOString(),
  };
}

/**
 * Aplica dados do office no formulário.
 * @param {{ getFieldValue: (name: string) => unknown, setFieldValue: (name: string, value: unknown) => void }} form
 * @param {Record<string, unknown>} data
 * @param {{ mergeOnly?: boolean }} [opts] mergeOnly=true mantém valores já preenchidos; false sobrescreve com o retorno da API (padrão).
 */
export function applyCnpjaOfficeToForm(form, data, opts = {}) {
  const mergeOnly = opts.mergeOnly === true;
  const company = data?.company;
  const addr = data?.address;
  const alias = data?.alias != null ? String(data.alias).trim() : '';
  const fromCompany = company?.name != null ? String(company.name).trim() : '';
  /** Nome de exibição: razão social; filiais mostram o apelido entre parênteses quando não é matriz. */
  let name = fromCompany || alias;
  if (fromCompany && alias && data?.head === false) {
    name = `${fromCompany} (${alias})`;
  }
  const phones = Array.isArray(data?.phones) ? data.phones : [];
  const emails = Array.isArray(data?.emails) ? data.emails : [];

  const fill = (field, value) => {
    if (value == null || value === '') return;
    if (mergeOnly) {
      const cur = form.getFieldValue(field);
      if (cur != null && String(cur).trim() !== '') return;
    }
    form.setFieldValue(field, value);
  };

  fill('nome_empresa', name);

  const tel = pickPhone(phones);
  fill('telefone', tel);

  const em = pickEmailAddress(emails);
  fill('email', em);

  if (addr && typeof addr === 'object') {
    const zipRaw = addr.zip != null ? onlyDigits(String(addr.zip)).slice(0, 8) : '';
    fill('cep', zipRaw);
    fill('logradouro', addr.street != null ? String(addr.street) : '');
    fill('numero', addr.number != null ? String(addr.number) : '');
    fill('complemento', addr.details != null ? String(addr.details) : '');
    fill('bairro', addr.district != null ? String(addr.district) : '');
    fill('cidade', addr.city != null ? String(addr.city) : '');
    fill('uf', addr.state != null ? String(addr.state).toUpperCase().slice(0, 2) : '');
    if (addr.municipality != null) fill('codigo_ibge', String(addr.municipality));
  }
}

/**
 * Textos úteis para UI (atividade, situação cadastral) — não são campos obrigatórios do formulário.
 * @param {Record<string, unknown>} data resposta GET /office
 */
export function extractCnpjaOfficeHints(data) {
  if (!data || typeof data !== 'object') {
    return { mainActivity: '', status: '', nature: '' };
  }
  const main = data.mainActivity && typeof data.mainActivity === 'object' ? data.mainActivity.text : null;
  const st = data.status && typeof data.status === 'object' ? data.status.text : null;
  const nat = data.company?.nature && typeof data.company.nature === 'object' ? data.company.nature.text : null;
  return {
    mainActivity: main != null ? String(main) : '',
    status: st != null ? String(st) : '',
    nature: nat != null ? String(nat) : '',
  };
}

/**
 * Futuro: GET /person/{personId} — exige UUID da pessoa retornado pelo office/members.
 * @param {string} personId
 */
export async function fetchCnpjaPerson(personId) {
  const id = String(personId || '').trim();
  if (!id) {
    const err = new Error('personId obrigatório');
    err.code = 'PERSON_ID';
    throw err;
  }
  const res = await fetch(`${BASE}/person/${encodeURIComponent(id)}`, { headers: authHeaders() });
  if (res.status === 404) {
    const err = new Error('Pessoa não encontrada');
    err.code = 'CNPJA_PERSON_404';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(await parseCnpjaError(res));
    err.code = 'CNPJA_PERSON_HTTP';
    err.status = res.status;
    throw err;
  }
  return res.json();
}
