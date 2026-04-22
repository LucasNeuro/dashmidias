import { z } from 'zod';
import { normalizeCnpj14, normalizeCpf11 } from '../lib/opencnpj';
import { normalizeCep8 } from '../lib/viacep';

const phoneRe = /^[\d\s().+-]{10,22}$/;
const ufRe = /^[A-Za-z]{2}$/;
const urlLooseRe = /^https?:\/\/[^\s]+$/i;

/** @typedef {{ cnpjRequired?: boolean, collectCpf?: boolean }} SignupOptions */

/** Opções por defeito (cadastro “empresa” clássica). */
export const DEFAULT_SIGNUP_OPTIONS = /** @type {const} */ ({
  cnpjRequired: true,
  collectCpf: false,
});

/** @param {unknown} raw */
export function normalizeSignupOptions(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SIGNUP_OPTIONS };
  const o = /** @type {Record<string, unknown>} */ (raw);
  return {
    cnpjRequired: o.cnpjRequired !== false,
    collectCpf: o.collectCpf === true,
  };
}

/** Campos base reutilizados na validação por etapas e no schema completo. */
export const orgSignupFieldSchemas = {
  nome_empresa: z
    .string()
    .trim()
    .min(2, 'Informe o nome da empresa')
    .max(200, 'Nome muito longo'),
  cnpj: z.string().trim().refine((s) => normalizeCnpj14(s) !== null, 'CNPJ inválido — use 14 dígitos'),
  cpf: z.string().trim().refine((s) => !s.trim() || normalizeCpf11(s) !== null, 'CPF inválido — use 11 dígitos'),
  email: z
    .string()
    .trim()
    .min(1, 'Informe o e-mail')
    .max(320, 'E-mail muito longo')
    .email('E-mail inválido — verifique o formato (ex.: nome@empresa.com.br)'),
  telefone: z.string().trim().regex(phoneRe, 'Telefone inválido').max(30),
  cep: z.string().trim().refine((s) => normalizeCep8(s) !== null, 'CEP inválido — use 8 dígitos'),
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
};

function parseExtrasMultiselect(raw) {
  if (raw === undefined || raw === '') return [];
  try {
    const j = JSON.parse(String(raw));
    return Array.isArray(j) ? j.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

const signupStepEnderecoSchema = z.object({
  cep: orgSignupFieldSchemas.cep,
  logradouro: orgSignupFieldSchemas.logradouro,
  numero: orgSignupFieldSchemas.numero,
  complemento: orgSignupFieldSchemas.complemento,
  bairro: orgSignupFieldSchemas.bairro,
  cidade: orgSignupFieldSchemas.cidade,
  uf: orgSignupFieldSchemas.uf,
  codigo_ibge: orgSignupFieldSchemas.codigo_ibge,
});

const signupStepSenhaSchema = z
  .object({
    senha: orgSignupFieldSchemas.senha,
    confirmar_senha: orgSignupFieldSchemas.confirmar_senha,
  })
  .refine((data) => data.senha === data.confirmar_senha, {
    message: 'As senhas não coincidem',
    path: ['confirmar_senha'],
  });

/**
 * Etapa Empresa: CNPJ opcional conforme template; CPF quando `collectCpf`; pelo menos um documento se CNPJ não for obrigatório e CPF estiver activo.
 * @param {SignupOptions} signupOptions
 */
export function buildEmpresaStepSchema(signupOptions = {}) {
  const cnpjRequired = signupOptions.cnpjRequired !== false;
  const collectCpf = signupOptions.collectCpf === true;
  const cnpjSchema = cnpjRequired
    ? orgSignupFieldSchemas.cnpj
    : z
        .string()
        .trim()
        .refine((s) => !s.trim() || normalizeCnpj14(s) !== null, 'CNPJ inválido — use 14 dígitos');
  const cpfSchema = collectCpf
    ? orgSignupFieldSchemas.cpf
    : z.string().trim(); // campo oculto — mantém string vazia

  return z
    .object({
      cnpj: cnpjSchema,
      cpf: cpfSchema,
      nome_empresa: orgSignupFieldSchemas.nome_empresa,
      email: orgSignupFieldSchemas.email,
      telefone: orgSignupFieldSchemas.telefone,
    })
    .superRefine((data, ctx) => {
      if (!cnpjRequired && collectCpf) {
        const hasCnpj = normalizeCnpj14(data.cnpj) !== null;
        const hasCpf = normalizeCpf11(data.cpf) !== null;
        if (!hasCnpj && !hasCpf) {
          ctx.addIssue({
            code: 'custom',
            message: 'Informe CNPJ ou CPF',
            path: ['cnpj'],
          });
        }
      }
    });
}

/**
 * Valida só chaves `extras` presentes em `slice` (uma etapa do wizard).
 * @param {Array<{ key: string, type: string, required?: boolean, options?: string[] }>} slice
 */
export function buildExtrasSliceSchema(slice) {
  return z.object({ extras: orgSignupFieldSchemas.extras }).superRefine((data, ctx) => {
    for (const f of slice) {
      const key = f.key;
      const raw = data.extras[key];
      const path = /** @type {const} */ (['extras', key]);
      if (f.required) {
        if (f.type === 'checkbox') {
          if (raw !== true) ctx.addIssue({ code: 'custom', message: 'Campo obrigatório', path });
        } else if (f.type === 'multiselect') {
          const arr = parseExtrasMultiselect(raw);
          if (arr.length === 0) ctx.addIssue({ code: 'custom', message: 'Selecione ao menos uma opção', path });
        } else if (raw === undefined || String(raw).trim() === '') {
          ctx.addIssue({ code: 'custom', message: 'Campo obrigatório', path });
        }
      }
      if (raw === undefined || raw === '') continue;
      if (f.type === 'multiselect') {
        const opts = f.options || [];
        const arr = parseExtrasMultiselect(raw);
        for (const item of arr) {
          if (opts.length && !opts.includes(item)) ctx.addIssue({ code: 'custom', message: 'Opção inválida', path });
        }
        continue;
      }
      const str = String(raw).trim();
      switch (f.type) {
        case 'number': {
          if (Number.isNaN(Number(str.replace(',', '.')))) ctx.addIssue({ code: 'custom', message: 'Número inválido', path });
          break;
        }
        case 'email': {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) ctx.addIssue({ code: 'custom', message: 'E-mail inválido', path });
          break;
        }
        case 'url': {
          if (str && !urlLooseRe.test(str)) ctx.addIssue({ code: 'custom', message: 'URL inválida (use http:// ou https://)', path });
          break;
        }
        case 'date': {
          if (str && !/^\d{4}-\d{2}-\d{2}$/.test(str)) ctx.addIssue({ code: 'custom', message: 'Data inválida', path });
          break;
        }
        case 'select':
        case 'radio': {
          const opts = f.options || [];
          if (opts.length && str && !opts.includes(str)) ctx.addIssue({ code: 'custom', message: 'Opção inválida', path });
          break;
        }
        default:
          break;
      }
    }
  });
}

function extrasSuperRefine(extraFields, data, ctx) {
  for (const f of extraFields) {
    const key = f.key;
    const raw = data.extras[key];
    const path = /** @type {const} */ (['extras', key]);
    if (f.required) {
      if (f.type === 'checkbox') {
        if (raw !== true) ctx.addIssue({ code: 'custom', message: 'Campo obrigatório', path });
      } else if (f.type === 'multiselect') {
        const arr = parseExtrasMultiselect(raw);
        if (arr.length === 0) ctx.addIssue({ code: 'custom', message: 'Selecione ao menos uma opção', path });
      } else if (raw === undefined || String(raw).trim() === '') {
        ctx.addIssue({ code: 'custom', message: 'Campo obrigatório', path });
      }
    }
    if (raw === undefined || raw === '') continue;
    if (f.type === 'multiselect') {
      const opts = f.options || [];
      const arr = parseExtrasMultiselect(raw);
      for (const item of arr) {
        if (opts.length && !opts.includes(item)) ctx.addIssue({ code: 'custom', message: 'Opção inválida', path });
      }
      continue;
    }
    const str = String(raw).trim();
    switch (f.type) {
      case 'number': {
        if (Number.isNaN(Number(str.replace(',', '.')))) ctx.addIssue({ code: 'custom', message: 'Número inválido', path });
        break;
      }
      case 'email': {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) ctx.addIssue({ code: 'custom', message: 'E-mail inválido', path });
        break;
      }
      case 'url': {
        if (str && !urlLooseRe.test(str)) ctx.addIssue({ code: 'custom', message: 'URL inválida (use http:// ou https://)', path });
        break;
      }
      case 'date': {
        if (str && !/^\d{4}-\d{2}-\d{2}$/.test(str)) ctx.addIssue({ code: 'custom', message: 'Data inválida', path });
        break;
      }
      case 'select':
      case 'radio': {
        const opts = f.options || [];
        if (opts.length && str && !opts.includes(str)) ctx.addIssue({ code: 'custom', message: 'Opção inválida', path });
        break;
      }
      default:
        break;
    }
  }
}

/**
 * @param {number} stepIndex
 * @param {Record<string, unknown>} value
 * @param {object} layout
 * @param {SignupOptions} [layout.signupOptions]
 * @param {Array<{ key: string, type: string, required?: boolean, options?: string[], group?: string }>} [layout.commercial]
 * @param {Array<{ key: string, type: string, required?: boolean, options?: string[], group?: string }>} [layout.logistics]
 */
export function validatePartnerSignupStep(stepIndex, value, layout = {}) {
  const signupOptions = layout.signupOptions || DEFAULT_SIGNUP_OPTIONS;
  const commercial = layout.commercial || [];
  const logistics = layout.logistics || [];
  const hasC = commercial.length > 0;
  const hasL = logistics.length > 0;

  if (stepIndex === 0) {
    return buildEmpresaStepSchema(signupOptions).safeParse({
      cnpj: value.cnpj,
      cpf: value.cpf,
      nome_empresa: value.nome_empresa,
      email: value.email,
      telefone: value.telefone,
    });
  }
  if (stepIndex === 1) {
    return signupStepEnderecoSchema.safeParse({
      cep: value.cep,
      logradouro: value.logradouro,
      numero: value.numero,
      complemento: value.complemento,
      bairro: value.bairro,
      cidade: value.cidade,
      uf: value.uf,
      codigo_ibge: value.codigo_ibge,
    });
  }
  if (stepIndex === 2) {
    return signupStepSenhaSchema.safeParse({
      senha: value.senha,
      confirmar_senha: value.confirmar_senha,
    });
  }

  const firstExtrasStep = 3;
  if (stepIndex === firstExtrasStep) {
    if (hasC) return buildExtrasSliceSchema(commercial).safeParse({ extras: value.extras });
    if (hasL) return buildExtrasSliceSchema(logistics).safeParse({ extras: value.extras });
    return z.unknown().safeParse(value);
  }
  if (stepIndex === 4 && hasC && hasL) {
    return buildExtrasSliceSchema(logistics).safeParse({ extras: value.extras });
  }
  return z.unknown().safeParse(value);
}

/**
 * @param {Array<{ key: string, type: string, required?: boolean, options?: string[] }>} extraFields
 * @param {SignupOptions} [signupOptions]
 */
export function buildPartnerOrgSignupSchema(extraFields = [], signupOptions = {}) {
  const cnpjRequired = signupOptions.cnpjRequired !== false;
  const collectCpf = signupOptions.collectCpf === true;
  const cnpjSchema = cnpjRequired
    ? orgSignupFieldSchemas.cnpj
    : z
        .string()
        .trim()
        .refine((s) => !s.trim() || normalizeCnpj14(s) !== null, 'CNPJ inválido — use 14 dígitos');

  return z
    .object({
      nome_empresa: orgSignupFieldSchemas.nome_empresa,
      cnpj: cnpjSchema,
      cpf: collectCpf ? orgSignupFieldSchemas.cpf : z.string().trim(),
      email: orgSignupFieldSchemas.email,
      telefone: orgSignupFieldSchemas.telefone,
      cep: orgSignupFieldSchemas.cep,
      logradouro: orgSignupFieldSchemas.logradouro,
      numero: orgSignupFieldSchemas.numero,
      complemento: orgSignupFieldSchemas.complemento,
      bairro: orgSignupFieldSchemas.bairro,
      cidade: orgSignupFieldSchemas.cidade,
      uf: orgSignupFieldSchemas.uf,
      codigo_ibge: orgSignupFieldSchemas.codigo_ibge,
      senha: orgSignupFieldSchemas.senha,
      confirmar_senha: orgSignupFieldSchemas.confirmar_senha,
      extras: orgSignupFieldSchemas.extras,
    })
    .refine((data) => data.senha === data.confirmar_senha, {
      message: 'As senhas não coincidem',
      path: ['confirmar_senha'],
    })
    .superRefine((data, ctx) => {
      if (!cnpjRequired && collectCpf) {
        const hasCnpj = normalizeCnpj14(data.cnpj) !== null;
        const hasCpf = normalizeCpf11(data.cpf) !== null;
        if (!hasCnpj && !hasCpf) {
          ctx.addIssue({ code: 'custom', message: 'Informe CNPJ ou CPF', path: ['cnpj'] });
        }
      }
      extrasSuperRefine(extraFields, data, ctx);
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
    cpf: '',
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
