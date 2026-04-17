import { z } from 'zod';
import { normalizeCnpj14 } from '../lib/opencnpj';
import { normalizeCep8 } from '../lib/viacep';

const phoneRe = /^[\d\s().+-]{10,22}$/;
const ufRe = /^[A-Za-z]{2}$/;
const urlLooseRe = /^https?:\/\/[^\s]+$/i;

function parseExtrasMultiselect(raw) {
  if (raw === undefined || raw === '') return [];
  try {
    const j = JSON.parse(String(raw));
    return Array.isArray(j) ? j.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** @param {Array<{ key: string, type: string, required: boolean }>} extraFields */
export function buildPartnerOrgSignupSchema(extraFields = []) {
  return z
    .object({
      nome_empresa: z
        .string()
        .trim()
        .min(2, 'Informe o nome da empresa')
        .max(200, 'Nome muito longo'),
      cnpj: z
        .string()
        .trim()
        .refine((s) => normalizeCnpj14(s) !== null, 'CNPJ inválido — use 14 dígitos'),
      email: z.string().trim().email('E-mail inválido').max(320),
      telefone: z
        .string()
        .trim()
        .regex(phoneRe, 'Telefone inválido')
        .max(30),
      cep: z
        .string()
        .trim()
        .refine((s) => normalizeCep8(s) !== null, 'CEP inválido — use 8 dígitos'),
      logradouro: z.string().trim().min(2, 'Informe o logradouro').max(500),
      numero: z.string().trim().min(1, 'Informe o número').max(30),
      complemento: z.string().trim().max(200).optional(),
      bairro: z.string().trim().min(2, 'Informe o bairro').max(200),
      cidade: z.string().trim().min(2, 'Informe a cidade').max(200),
      uf: z
        .string()
        .trim()
        .min(2, 'UF')
        .max(2)
        .refine((s) => ufRe.test(s), 'UF inválida'),
      codigo_ibge: z.string().trim().max(10),
      senha: z.string().min(8, 'Senha: mínimo 8 caracteres').max(128),
      confirmar_senha: z.string(),
      extras: z.record(z.string(), z.union([z.string(), z.boolean()])),
    })
    .refine((data) => data.senha === data.confirmar_senha, {
      message: 'As senhas não coincidem',
      path: ['confirmar_senha'],
    })
    .superRefine((data, ctx) => {
      for (const f of extraFields) {
        const key = f.key;
        const raw = data.extras[key];
        const path = /** @type {const} */ (['extras', key]);
        if (f.required) {
          if (f.type === 'checkbox') {
            if (raw !== true) {
              ctx.addIssue({ code: 'custom', message: 'Campo obrigatório', path });
            }
          } else if (f.type === 'multiselect') {
            const arr = parseExtrasMultiselect(raw);
            if (arr.length === 0) {
              ctx.addIssue({ code: 'custom', message: 'Selecione ao menos uma opção', path });
            }
          } else if (raw === undefined || String(raw).trim() === '') {
            ctx.addIssue({ code: 'custom', message: 'Campo obrigatório', path });
          }
        }
        if (raw === undefined || raw === '') continue;
        if (f.type === 'multiselect') {
          const opts = f.options || [];
          const arr = parseExtrasMultiselect(raw);
          for (const item of arr) {
            if (opts.length && !opts.includes(item)) {
              ctx.addIssue({ code: 'custom', message: 'Opção inválida', path });
            }
          }
          continue;
        }
        const str = String(raw).trim();
        switch (f.type) {
          case 'number': {
            if (Number.isNaN(Number(str.replace(',', '.')))) {
              ctx.addIssue({ code: 'custom', message: 'Número inválido', path });
            }
            break;
          }
          case 'email': {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
              ctx.addIssue({ code: 'custom', message: 'E-mail inválido', path });
            }
            break;
          }
          case 'url': {
            if (str && !urlLooseRe.test(str)) {
              ctx.addIssue({ code: 'custom', message: 'URL inválida (use http:// ou https://)', path });
            }
            break;
          }
          case 'date': {
            if (str && !/^\d{4}-\d{2}-\d{2}$/.test(str)) {
              ctx.addIssue({ code: 'custom', message: 'Data inválida', path });
            }
            break;
          }
          case 'select':
          case 'radio': {
            const opts = f.options || [];
            if (opts.length && str && !opts.includes(str)) {
              ctx.addIssue({ code: 'custom', message: 'Opção inválida', path });
            }
            break;
          }
          default:
            break;
        }
      }
    });
}

/** @param {Array<{ key: string, type: string }>} extraFields */
export function defaultPartnerOrgValues(extraFields = []) {
  /** @type {Record<string, string | boolean>} */
  const extras = {};
  for (const f of extraFields) {
    if (f.type === 'checkbox') extras[f.key] = false;
    else if (f.type === 'multiselect') extras[f.key] = '[]';
    else extras[f.key] = '';
  }
  return {
    nome_empresa: '',
    cnpj: '',
    email: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    codigo_ibge: '',
    senha: '',
    confirmar_senha: '',
    extras,
  };
}
