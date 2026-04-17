/**
 * Consulta CEP (8 dígitos) para autopreencher endereço.
 * 1) Com `VITE_CNPJA_API_KEY`: GET https://api.cnpja.com/zip/{code} (CNPJA).
 * 2) Caso contrário (ou se CNPJA falhar): ViaCEP público.
 *
 * @see https://viacep.com.br/
 * @see https://cnpja.com/api
 */

import { cnpjaZipToFormShape, fetchCnpjaZip, hasCnpjaApiKey } from './cnpja';

export function onlyDigits(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** @returns {string|null} 8 dígitos ou null */
export function normalizeCep8(input) {
  const d = onlyDigits(input);
  if (d.length !== 8) return null;
  return d;
}

/** Exibe 00000-000 */
export function formatCepMask(digits) {
  const d = onlyDigits(digits).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Formato unificado para o formulário (compatível com o fluxo antigo ViaCEP).
 * @typedef {{
 *   logradouro: string,
 *   bairro: string,
 *   localidade: string,
 *   uf: string,
 *   ibge: string,
 *   complemento?: string,
 *   numero?: string,
 *   _fonte?: 'cnpja' | 'viacep'
 * }} CepLookupResult
 */

/**
 * @returns {Promise<CepLookupResult>}
 */
export async function fetchViaCepJson(cepInput) {
  const n = normalizeCep8(cepInput);
  if (!n) {
    const err = new Error('CEP deve ter 8 dígitos');
    err.code = 'CEP_INVALIDO';
    throw err;
  }

  if (hasCnpjaApiKey()) {
    try {
      const raw = await fetchCnpjaZip(n);
      const s = cnpjaZipToFormShape(raw);
      return {
        logradouro: s.logradouro,
        bairro: s.bairro,
        localidade: s.localidade,
        uf: s.uf,
        ibge: s.ibge,
        complemento: s.complemento || '',
        numero: s.numero || '',
        _fonte: 'cnpja',
      };
    } catch (e) {
      if (import.meta.env.DEV) console.warn('[CEP] CNPJA indisponível, tentando ViaCEP:', e);
    }
  }

  const res = await fetch(`https://viacep.com.br/ws/${n}/json/`);
  if (res.status === 400) {
    const err = new Error('Formato de CEP inválido');
    err.code = 'CEP_BAD_REQUEST';
    throw err;
  }
  if (!res.ok) {
    const err = new Error('Não foi possível consultar o CEP');
    err.code = 'HTTP';
    throw err;
  }
  const data = await res.json();
  if (data.erro === true) {
    const err = new Error('CEP não encontrado');
    err.code = 'CEP_NAO_ENCONTRADO';
    throw err;
  }
  return {
    logradouro: data.logradouro || '',
    bairro: data.bairro || '',
    localidade: data.localidade || '',
    uf: data.uf || '',
    ibge: data.ibge || '',
    complemento: (data.complemento || '').trim(),
    numero: '',
    _fonte: 'viacep',
  };
}
