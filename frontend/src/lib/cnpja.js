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
 * Aplica dados do office no formulário (só preenche campos vazios).
 * @param {{ getFieldValue: (name: string) => unknown, setFieldValue: (name: string, value: unknown) => void }} form
 * @param {Record<string, unknown>} data
 */
export function applyCnpjaOfficeToForm(form, data) {
  const company = data?.company;
  const addr = data?.address;
  const name = company?.name != null ? String(company.name) : '';
  const phones = Array.isArray(data?.phones) ? data.phones : [];
  const emails = Array.isArray(data?.emails) ? data.emails : [];

  const fill = (field, value) => {
    if (value == null || value === '') return;
    const cur = form.getFieldValue(field);
    if (cur != null && String(cur).trim() !== '') return;
    form.setFieldValue(field, value);
  };

  fill('nome_empresa', name);

  if (phones.length > 0) {
    const p = phones[0];
    const area = p?.area != null ? String(p.area) : '';
    const num = p?.number != null ? String(p.number) : '';
    const tel = area && num ? `(${area}) ${num}` : num || area;
    fill('telefone', tel);
  }

  if (emails.length > 0) {
    const em = emails[0]?.address;
    fill('email', em != null ? String(em) : '');
  }

  if (addr && typeof addr === 'object') {
    const zip = addr.zip != null ? onlyDigits(String(addr.zip)).slice(0, 8) : '';
    fill('cep', zip);
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
