/**
 * Consulta pública de CNPJ (sem chave) — fallback quando a API comercial não está configurada.
 * @see https://brasilapi.com.br/docs#tag/CNPJ
 */

import { onlyDigits } from './opencnpj';

const BASE = 'https://brasilapi.com.br/api/cnpj/v1';

/**
 * @param {string} cnpj14 14 dígitos
 */
export async function fetchBrasilApiCnpj(cnpj14) {
  const d = onlyDigits(String(cnpj14));
  if (d.length !== 14) {
    const err = new Error('CNPJ inválido');
    err.code = 'CNPJ_INVALIDO';
    throw err;
  }
  const res = await fetch(`${BASE}/${d}`);
  if (res.status === 404) {
    const err = new Error('CNPJ não encontrado');
    err.code = 'BRASILAPI_404';
    throw err;
  }
  if (res.status === 429) {
    const err = new Error('Muitas consultas em sequência. Tente daqui a instantes.');
    err.code = 'BRASILAPI_429';
    throw err;
  }
  if (!res.ok) {
    const err = new Error('Não foi possível consultar o CNPJ agora');
    err.code = 'BRASILAPI_HTTP';
    throw err;
  }
  return res.json();
}

/**
 * @param {{ getFieldValue: (name: string) => unknown, setFieldValue: (name: string, value: unknown) => void }} form
 * @param {Record<string, unknown>} data resposta GET /cnpj/v1/{cnpj}
 * @param {{ mergeOnly?: boolean }} [opts] mergeOnly=true só preenche campos ainda vazios (útil depois da CNPJA).
 */
export function applyBrasilApiCnpjToForm(form, data, opts = {}) {
  const mergeOnly = opts.mergeOnly === true;
  const razao = data?.razao_social != null ? String(data.razao_social).trim() : '';
  const fantasia = data?.nome_fantasia != null ? String(data.nome_fantasia).trim() : '';
  const name = razao || fantasia;

  const set = (field, value) => {
    if (value == null || value === '') return;
    if (mergeOnly) {
      const cur = form.getFieldValue(field);
      if (cur != null && String(cur).trim() !== '') return;
    }
    form.setFieldValue(field, value);
  };

  set('nome_empresa', name);

  const ddd =
    data?.ddd_telefone_1 != null ? String(data.ddd_telefone_1).replace(/\D/g, '').slice(0, 3) : '';
  const telNum =
    data?.telefone_1 != null
      ? String(data.telefone_1).replace(/\D/g, '').slice(0, 11)
      : '';
  if (ddd && telNum) {
    set('telefone', `(${ddd}) ${telNum}`);
  } else if (telNum) {
    set('telefone', telNum);
  }

  const em = data?.email;
  if (em && String(em).trim().includes('@')) {
    set('email', String(em).trim());
  }

  const cepRaw = data?.cep != null ? onlyDigits(String(data.cep)).slice(0, 8) : '';
  set('cep', cepRaw);
  set('logradouro', data?.logradouro != null ? String(data.logradouro).trim() : '');
  set('numero', data?.numero != null ? String(data.numero).trim() : '');
  set('complemento', data?.complemento != null ? String(data.complemento).trim() : '');
  set('bairro', data?.bairro != null ? String(data.bairro).trim() : '');
  set('cidade', data?.municipio != null ? String(data.municipio).trim() : '');
  set('uf', data?.uf != null ? String(data.uf).toUpperCase().slice(0, 2) : '');

  const ibge = data?.codigo_municipio_ibge ?? data?.codigo_ibge;
  if (ibge != null && String(ibge).trim() !== '') {
    set('codigo_ibge', String(ibge).replace(/\D/g, '').slice(0, 10));
  }
}
