import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { applyBrasilApiCnpjToForm, fetchBrasilApiCnpj } from '../../lib/brasil_public_cnpj';
import {
  applyCnpjaOfficeToForm,
  extractCnpjaOfficeHints,
  fetchCnpjaOffice,
  hasCnpjaApiKey,
} from '../../lib/cnpja';
import { ORG_STANDARD_META, partitionPartnerOrgExtraFields } from '../../lib/orgStandardFields';
import { formatCpfMask, normalizeCnpj14 } from '../../lib/opencnpj';
import { fetchViaCepJson, formatCepMask, normalizeCep8, onlyDigits } from '../../lib/viacep';
import {
  buildPartnerOrgSignupSchema,
  defaultPartnerOrgValues,
  normalizeSignupOptions,
  orgSignupFieldSchemas,
  parsePartnerSignupFileRef,
  validatePartnerSignupStep,
} from '../../schemas/partnerOrgSignup';
import { isSupabaseConfigured, uploadPartnerSignupExtraFile } from '../../lib/partnerSignupStorage';

/** @param {import('zod').ZodType} schema @param {unknown} value */
function zodFieldMessage(schema, value) {
  const r = schema.safeParse(value);
  return r.success ? undefined : r.error.issues[0]?.message;
}

function errorToText(err) {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') return err.message;
  return 'Verifique este campo.';
}

function FieldError({ errors }) {
  const list = Array.isArray(errors) ? errors.map(errorToText).filter(Boolean) : [];
  if (!list.length) return null;
  return (
    <p className="mt-1 text-xs text-red-700" role="alert">
      {list.join(' · ')}
    </p>
  );
}

/** @param {import('zod').ZodIssue[] | undefined} issues */
function zodIssuesToStepErrors(issues) {
  if (!issues?.length) return {};
  /** @type {Record<string, string>} */
  const o = {};
  for (const iss of issues) {
    const p = iss.path;
    if (!p?.length) continue;
    const key = p[0] === 'extras' && p[1] != null ? `extras.${p[1]}` : String(p[0]);
    o[key] = iss.message;
  }
  return o;
}

function mergeStepErrors(metaErrors, stepErrorsRecord, key) {
  const extra = stepErrorsRecord[key];
  const base = Array.isArray(metaErrors) ? [...metaErrors] : [];
  if (extra) base.push({ message: extra });
  return base;
}

function parseExtrasMultiJson(raw) {
  try {
    const j = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(j) ? j.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** @param {number} step @param {unknown[]} commercial @param {unknown[]} logistics */
function extrasSliceForStep(step, commercial, logistics) {
  const hasC = commercial.length > 0;
  const hasL = logistics.length > 0;
  if (step === 3) {
    if (hasC) return commercial;
    if (hasL) return logistics;
    return [];
  }
  if (step === 4 && hasC && hasL) return logistics;
  return [];
}

/** Campo extra tipo ficheiro: envia para Storage e guarda JSON em `extras.key`. */
function FileExtraInput({ id, value, onChange, onBlur, disabled }) {
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const ref = useMemo(() => parsePartnerSignupFileRef(value), [value]);

  async function onPick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!isSupabaseConfigured()) {
      setLocalErr('Envio de ficheiros indisponível: configure o Supabase e o bucket de documentos.');
      return;
    }
    setLocalErr('');
    setBusy(true);
    try {
      const json = await uploadPartnerSignupExtraFile(file);
      onChange(json);
    } catch (err) {
      setLocalErr(err instanceof Error ? err.message : 'Não foi possível enviar o ficheiro.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-none border border-outline-variant bg-surface-container-low px-3 py-2 text-sm font-semibold text-primary hover:border-primary">
          <input
            id={id}
            type="file"
            className="sr-only"
            accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            disabled={disabled || busy}
            onBlur={onBlur}
            onChange={onPick}
          />
          <span className="material-symbols-outlined text-[20px]">upload_file</span>
          {busy ? 'A enviar…' : 'Escolher ficheiro'}
        </label>
        {ref ? (
          <button
            type="button"
            className="text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
            disabled={disabled || busy}
            onClick={() => onChange('')}
          >
            Remover
          </button>
        ) : null}
      </div>
      {ref ? (
        <p className="text-xs text-on-surface-variant">
          <span className="font-medium text-primary">{ref.name || ref.path}</span>
          {ref.contentType ? ` · ${ref.contentType}` : null}
        </p>
      ) : (
        <p className="text-xs text-on-surface-variant">PDF, Word ou imagem até 15 MB. O ficheiro fica ligado ao pedido de cadastro.</p>
      )}
      {localErr ? (
        <p className="text-xs text-red-700" role="alert">
          {localErr}
        </p>
      ) : null}
    </div>
  );
}

function SignupExtraFieldsGrid({ form, slice, stepErrors }) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
      {slice.map((f) => (
        <form.Field key={f.id} name={`extras.${f.key}`}>
          {(field) => (
            <div
              className={
                f.type === 'textarea' || f.type === 'radio' || f.type === 'multiselect' || f.type === 'file'
                  ? 'md:col-span-2 xl:col-span-3'
                  : ''
              }
            >
              <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={`extra-${f.id}`}>
                {f.label}
                {f.required ? ' *' : ''}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  id={`extra-${f.id}`}
                  rows={f.rows != null ? Number(f.rows) : 3}
                  value={String(field.state.value ?? '')}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                />
              ) : f.type === 'checkbox' ? (
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.state.value === true}
                    onChange={(e) => field.handleChange(e.target.checked)}
                    onBlur={field.handleBlur}
                    className="h-4 w-4 rounded-none border-outline-variant accent-tertiary"
                  />
                  <span className="text-sm text-primary">Sim</span>
                </label>
              ) : f.type === 'select' ? (
                <select
                  id={`extra-${f.id}`}
                  value={String(field.state.value ?? '')}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full border border-outline-variant bg-white px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                >
                  <option value="">Selecione…</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : f.type === 'radio' ? (
                <div className="space-y-2.5">
                  {(f.options || []).length === 0 ? (
                    <p className="text-sm text-amber-800">Opções não configuradas. Fale com quem enviou o link.</p>
                  ) : (
                    (f.options || []).map((opt) => (
                      <label
                        key={opt}
                        className="flex cursor-pointer items-start gap-3 rounded-none border border-outline-variant bg-surface-container-low px-3 py-2.5 transition-colors hover:border-primary hover:bg-white"
                      >
                        <input
                          type="radio"
                          name={`extra-radio-${f.key}`}
                          value={opt}
                          checked={String(field.state.value ?? '') === opt}
                          onChange={() => field.handleChange(opt)}
                          onBlur={field.handleBlur}
                          className="mt-0.5 h-4 w-4 border-slate-300 text-primary"
                        />
                        <span className="text-sm text-primary">{opt}</span>
                      </label>
                    ))
                  )}
                </div>
              ) : f.type === 'multiselect' ? (
                <div className="space-y-2.5">
                  {(f.options || []).length === 0 ? (
                    <p className="text-sm text-amber-800">Opções não configuradas. Fale com quem enviou o link.</p>
                  ) : (
                    (f.options || []).map((opt) => {
                      const selected = parseExtrasMultiJson(field.state.value);
                      const on = selected.includes(opt);
                      return (
                        <label
                          key={opt}
                          className="flex cursor-pointer items-start gap-3 rounded-none border border-outline-variant bg-surface-container-low px-3 py-2.5 transition-colors hover:border-primary hover:bg-white"
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const next = on ? selected.filter((x) => x !== opt) : [...selected, opt];
                              field.handleChange(JSON.stringify(next));
                            }}
                            onBlur={field.handleBlur}
                            className="mt-0.5 h-4 w-4 rounded-none border-outline-variant accent-tertiary text-primary"
                          />
                          <span className="text-sm text-primary">{opt}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              ) : f.type === 'date' ? (
                <input
                  id={`extra-${f.id}`}
                  type="date"
                  value={String(field.state.value ?? '')}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full max-w-[12rem] border border-outline-variant px-3 py-2 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-0"
                />
              ) : f.type === 'file' ? (
                <FileExtraInput
                  id={`extra-${f.id}`}
                  value={field.state.value}
                  onChange={field.handleChange}
                  onBlur={field.handleBlur}
                  disabled={false}
                />
              ) : (
                <input
                  id={`extra-${f.id}`}
                  type={
                    f.type === 'number'
                      ? 'number'
                      : f.type === 'email'
                        ? 'email'
                        : f.type === 'url'
                          ? 'url'
                          : f.type === 'tel'
                            ? 'tel'
                            : 'text'
                  }
                  placeholder={f.type === 'url' ? 'https://' : undefined}
                  value={String(field.state.value ?? '')}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                />
              )}
              <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, `extras.${f.key}`)} />
            </div>
          )}
        </form.Field>
      ))}
    </div>
  );
}

export function PartnerOrgSignupForm({ extraFields = [], signupSettings: signupSettingsRaw, onSubmitSuccess, className = '' }) {
  const queryClient = useQueryClient();
  const signupOptions = useMemo(() => normalizeSignupOptions(signupSettingsRaw), [signupSettingsRaw]);
  const { commercial, logistics } = useMemo(() => partitionPartnerOrgExtraFields(extraFields), [extraFields]);
  const wizardLayout = useMemo(
    () => ({ signupOptions, commercial, logistics }),
    [signupOptions, commercial, logistics]
  );

  const hasC = commercial.length > 0;
  const hasL = logistics.length > 0;
  const lastStepIndex = useMemo(() => {
    if (hasC && hasL) return 4;
    if (hasC || hasL) return 3;
    return 2;
  }, [hasC, hasL]);

  const cnpjRequired = signupOptions.cnpjRequired !== false;
  const collectCpf = signupOptions.collectCpf === true;

  const schema = useMemo(() => buildPartnerOrgSignupSchema(extraFields, signupOptions), [extraFields, signupOptions]);
  const defaultValues = useMemo(() => defaultPartnerOrgValues(extraFields), [extraFields]);

  const [cepBusy, setCepBusy] = useState(false);
  const [cepHint, setCepHint] = useState('');
  const lastCepLookup = useRef('');
  const [cnpjHint, setCnpjHint] = useState('');
  /** Resumo da consulta CNPJA (atividade, situação) — só quando a API comercial responde. */
  const [cnpjDetailHints, setCnpjDetailHints] = useState(
    /** @type {{ mainActivity: string, status: string, nature: string }} */ ({
      mainActivity: '',
      status: '',
      nature: '',
    })
  );
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const lastCnpjLookup = useRef('');
  const [step, setStep] = useState(0);
  /** @type {Record<string, string>} */
  const [stepErrors, setStepErrors] = useState({});
  const wizardCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const wizardBodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));

  const stepLabels = useMemo(() => {
    const labels = ['Empresa', 'Endereço', 'Acesso'];
    if (hasC && hasL) {
      labels.push('Informações comerciais', 'Logística e doca');
    } else if (hasC) {
      labels.push('Informações comerciais');
    } else if (hasL) {
      labels.push('Logística e doca');
    }
    return labels;
  }, [hasC, hasL]);

  const form = useForm({
    defaultValues,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      await onSubmitSuccess?.(value);
    },
  });

  const runCepLookup = useCallback(
    async (cepRaw) => {
      const n = normalizeCep8(cepRaw);
      if (!n) {
        setCepHint('');
        return;
      }
      if (lastCepLookup.current === n) return;
      lastCepLookup.current = n;
      setCepBusy(true);
      setCepHint('Buscando endereço…');
      try {
        const data = await fetchViaCepJson(n);
        form.setFieldValue('logradouro', data.logradouro || '');
        form.setFieldValue('bairro', data.bairro || '');
        form.setFieldValue('cidade', data.localidade || '');
        form.setFieldValue('uf', (data.uf || '').toUpperCase());
        form.setFieldValue('codigo_ibge', data.ibge || '');
        const comp = (data.complemento || '').trim();
        if (comp && !String(form.getFieldValue('complemento') || '').trim()) {
          form.setFieldValue('complemento', comp);
        }
        const num = (data.numero || '').trim();
        if (num && !String(form.getFieldValue('numero') || '').trim()) {
          form.setFieldValue('numero', num);
        }
        setCepHint('Endereço encontrado. Confira número e complemento.');
      } catch (e) {
        lastCepLookup.current = '';
        const msg = e instanceof Error ? e.message : 'CEP não encontrado';
        setCepHint(msg);
        form.setFieldValue('logradouro', '');
        form.setFieldValue('bairro', '');
        form.setFieldValue('cidade', '');
        form.setFieldValue('uf', '');
        form.setFieldValue('codigo_ibge', '');
      } finally {
        setCepBusy(false);
      }
    },
    [form]
  );

  const runCnpjLookup = useCallback(
    async (cnpjRaw) => {
      const n = normalizeCnpj14(cnpjRaw);
      if (!n) {
        setCnpjHint('');
        setCnpjDetailHints({ mainActivity: '', status: '', nature: '' });
        return;
      }
      if (lastCnpjLookup.current === n) return;
      lastCnpjLookup.current = n;
      setCnpjBusy(true);
      setCnpjHint('Consultando dados da empresa…');
      setCnpjDetailHints({ mainActivity: '', status: '', nature: '' });
      const staleCnpj = 24 * 60 * 60 * 1000;
      try {
        if (hasCnpjaApiKey()) {
          try {
            const data = await queryClient.fetchQuery({
              queryKey: ['cnpja', 'office', n],
              queryFn: () => fetchCnpjaOffice(cnpjRaw),
              staleTime: staleCnpj,
            });
            applyCnpjaOfficeToForm(form, data);
            setCnpjDetailHints(extractCnpjaOfficeHints(data));
            const emailEmpty = !String(form.getFieldValue('email') || '').trim();
            const phoneEmpty = !String(form.getFieldValue('telefone') || '').trim();
            if (emailEmpty || phoneEmpty) {
              try {
                const br = await queryClient.fetchQuery({
                  queryKey: ['brasilapi', 'cnpj', n],
                  queryFn: () => fetchBrasilApiCnpj(n),
                  staleTime: staleCnpj,
                });
                applyBrasilApiCnpjToForm(form, br, { mergeOnly: true });
              } catch {
                /* só CNPJA */
              }
            }
            setCnpjHint('Dados preenchidos automaticamente. Avance para revisar o endereço e a senha.');
          } catch {
            setCnpjDetailHints({ mainActivity: '', status: '', nature: '' });
            const data = await queryClient.fetchQuery({
              queryKey: ['brasilapi', 'cnpj', n],
              queryFn: () => fetchBrasilApiCnpj(n),
              staleTime: staleCnpj,
            });
            applyBrasilApiCnpjToForm(form, data);
            setCnpjHint('Dados obtidos da base pública. Confira nome, contatos e endereço antes de continuar.');
          }
        } else {
          const data = await queryClient.fetchQuery({
            queryKey: ['brasilapi', 'cnpj', n],
            queryFn: () => fetchBrasilApiCnpj(n),
            staleTime: staleCnpj,
          });
          applyBrasilApiCnpjToForm(form, data);
          setCnpjHint(
            'Dados obtidos da base pública (sem chave comercial). Confira nome, contatos e endereço antes de continuar.'
          );
        }
      } catch (e) {
        lastCnpjLookup.current = '';
        setCnpjDetailHints({ mainActivity: '', status: '', nature: '' });
        setCnpjHint(e instanceof Error ? e.message : 'Não foi possível consultar o CNPJ');
      } finally {
        setCnpjBusy(false);
      }
    },
    [form, queryClient]
  );

  const values = useStore(form.store, (s) => s.values);

  const activeExtraSlice = useMemo(
    () => extrasSliceForStep(step, commercial, logistics),
    [step, commercial, logistics]
  );

  useEffect(() => {
    wizardBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const handleWizardPrimary = useCallback(() => {
    const v = values;
    if (step < lastStepIndex) {
      const r = validatePartnerSignupStep(step, v, wizardLayout);
      if (!r.success) {
        setStepErrors(zodIssuesToStepErrors(r.error?.issues));
        return;
      }
      setStepErrors({});
      setStep((x) => x + 1);
      return;
    }
    const rFinal = validatePartnerSignupStep(lastStepIndex, v, wizardLayout);
    if (!rFinal.success) {
      setStepErrors(zodIssuesToStepErrors(rFinal.error?.issues));
      return;
    }
    setStepErrors({});
    void form.handleSubmit();
  }, [values, step, lastStepIndex, wizardLayout, form]);

  return (
    <form
      className={`flex min-h-0 w-full max-w-none flex-1 flex-col [&_button]:rounded-none [&_input]:rounded-none [&_select]:rounded-none [&_textarea]:rounded-none ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div
        ref={wizardCardRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border-2 border-primary bg-white shadow-xl"
      >
        <header className="shrink-0 border-b border-outline-variant bg-white px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant">
            Passo {step + 1} de {stepLabels.length}
          </p>
          <div className="mt-2 flex gap-1.5 overflow-x-auto overflow-y-visible pb-1 -mx-1 px-1 no-scrollbar sm:mt-3 sm:flex-wrap sm:overflow-x-visible">
            {stepLabels.map((label, i) => (
              <span
                key={label}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-none border px-2 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  i === step
                    ? 'border-primary bg-primary text-white'
                    : i < step
                      ? 'border-tertiary/50 bg-tertiary/10 text-primary'
                      : 'border-outline-variant bg-white text-on-surface-variant'
                }`}
              >
                <span className="font-mono tabular-nums">{i + 1}</span>
                {label}
              </span>
            ))}
          </div>
          <h2 className="mt-3 text-lg font-black tracking-tight text-primary sm:mt-4 sm:text-2xl">{stepLabels[step]}</h2>
        </header>

        <div
          ref={wizardBodyRef}
          className="hub-table-scrollbar min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5 lg:px-8 lg:py-6"
        >
          {step === 0 ? (
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 lg:grid-cols-12">
              <form.Field name="cnpj">
                {(field) => (
                  <div className="lg:col-span-12">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                      {ORG_STANDARD_META.cnpj.label}
                      {cnpjRequired ? ' *' : ''}
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="00.000.000/0000-00"
                      disabled={cnpjBusy}
                      value={field.state.value}
                      onChange={(e) => {
                        const v = e.target.value;
                        const cur = normalizeCnpj14(v);
                        if (!cur || cur.length < 14) {
                          lastCnpjLookup.current = '';
                          setCnpjDetailHints({ mainActivity: '', status: '', nature: '' });
                        }
                        field.handleChange(v);
                      }}
                      onBlur={async (e) => {
                        field.handleBlur();
                        const n = normalizeCnpj14(e.target.value);
                        if (!n) {
                          lastCnpjLookup.current = '';
                          setCnpjHint('');
                          setCnpjDetailHints({ mainActivity: '', status: '', nature: '' });
                          return;
                        }
                        await runCnpjLookup(e.target.value);
                      }}
                      className="w-full border border-outline-variant px-3 py-2 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-0 disabled:opacity-60"
                    />
                    {cnpjHint ? (
                      <p
                        className={`mt-1 text-xs ${
                          cnpjHint.includes('…') ||
                          cnpjHint.includes('preenchidos') ||
                          cnpjHint.includes('automaticamente') ||
                          cnpjHint.includes('base pública')
                            ? 'text-slate-600'
                            : 'text-amber-800'
                        }`}
                        role="status"
                      >
                        {cnpjHint}
                      </p>
                    ) : null}
                    {cnpjDetailHints.status || cnpjDetailHints.nature || cnpjDetailHints.mainActivity ? (
                      <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] leading-snug text-slate-600" role="note">
                        {cnpjDetailHints.status ? <li>Situação cadastral: {cnpjDetailHints.status}</li> : null}
                        {cnpjDetailHints.nature ? <li>Natureza jurídica: {cnpjDetailHints.nature}</li> : null}
                        {cnpjDetailHints.mainActivity ? <li>Atividade principal (CNAE): {cnpjDetailHints.mainActivity}</li> : null}
                      </ul>
                    ) : null}
                    <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'cnpj')} />
                  </div>
                )}
              </form.Field>

              {collectCpf ? (
                <form.Field name="cpf">
                  {(field) => (
                    <div className="lg:col-span-12">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.cpf.label}
                      </label>
                      {!cnpjRequired ? (
                        <p className="mb-1 text-xs text-slate-500">Preencha CNPJ ou CPF (pelo menos um).</p>
                      ) : ORG_STANDARD_META.cpf.hint ? (
                        <p className="mb-1 text-xs text-slate-500">{ORG_STANDARD_META.cpf.hint}</p>
                      ) : null}
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="000.000.000-00"
                        value={formatCpfMask(field.state.value)}
                        onChange={(e) => {
                          const d = onlyDigits(e.target.value).slice(0, 11);
                          field.handleChange(d);
                        }}
                        onBlur={field.handleBlur}
                        className="w-full border border-outline-variant px-3 py-2 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'cpf')} />
                    </div>
                  )}
                </form.Field>
              ) : null}

              <form.Field name="nome_empresa">
                {(field) => (
                  <div className="lg:col-span-12">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                      {ORG_STANDARD_META.nome_empresa.label} *
                    </label>
                    {ORG_STANDARD_META.nome_empresa.hint ? (
                      <p className="mb-1 text-xs text-slate-500">{ORG_STANDARD_META.nome_empresa.hint}</p>
                    ) : null}
                    <input
                      id={field.name}
                      name={field.name}
                      type="text"
                      autoComplete="organization"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                    />
                    <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'nome_empresa')} />
                  </div>
                )}
              </form.Field>

              <form.Field
                name="email"
                validators={{
                  onBlur: ({ value }) => zodFieldMessage(orgSignupFieldSchemas.email, value),
                }}
              >
                {(field) => (
                  <div className="lg:col-span-6 xl:col-span-4">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                      {ORG_STANDARD_META.email.label} *
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="email"
                      autoComplete="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={(e) => {
                        field.handleBlur();
                        if (orgSignupFieldSchemas.email.safeParse(e.target.value).success) {
                          setStepErrors((p) => {
                            if (!p.email) return p;
                            const next = { ...p };
                            delete next.email;
                            return next;
                          });
                        }
                      }}
                      className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                    />
                    <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'email')} />
                  </div>
                )}
              </form.Field>

              <form.Field
                name="telefone"
                validators={{
                  onBlur: ({ value }) => zodFieldMessage(orgSignupFieldSchemas.telefone, value),
                }}
              >
                {(field) => (
                  <div className="lg:col-span-6 xl:col-span-4">
                    <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                      {ORG_STANDARD_META.telefone.label} *
                    </label>
                    <input
                      id={field.name}
                      name={field.name}
                      type="tel"
                      autoComplete="tel"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={(e) => {
                        field.handleBlur();
                        if (orgSignupFieldSchemas.telefone.safeParse(e.target.value).success) {
                          setStepErrors((p) => {
                            if (!p.telefone) return p;
                            const next = { ...p };
                            delete next.telefone;
                            return next;
                          });
                        }
                      }}
                      className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                    />
                    <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'telefone')} />
                  </div>
                )}
              </form.Field>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                <form.Field name="cep">
                  {(field) => (
                    <div className="w-full max-w-full sm:max-w-[20rem] lg:col-span-5 xl:col-span-4">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.cep.label} *
                      </label>
                      {ORG_STANDARD_META.cep.hint ? (
                        <p className="mb-1 text-xs text-slate-500">{ORG_STANDARD_META.cep.hint}</p>
                      ) : null}
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={cepBusy}
                        value={formatCepMask(field.state.value)}
                        onChange={(e) => {
                          const d = onlyDigits(e.target.value).slice(0, 8);
                          if (d.length !== 8) lastCepLookup.current = '';
                          field.handleChange(d);
                          setCepHint('');
                          if (d.length === 8) void runCepLookup(d);
                        }}
                        onBlur={(e) => {
                          field.handleBlur();
                          const d = onlyDigits(e.target.value);
                          if (d.length === 8) void runCepLookup(d);
                        }}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 font-mono text-base tracking-wide text-primary outline-none focus:border-primary focus:ring-0 disabled:opacity-60"
                      />
                      {cepHint ? (
                        <p
                          className={`mt-1 text-xs ${cepHint.includes('encontrado') || cepHint.includes('Buscando') ? 'text-slate-600' : 'text-amber-800'}`}
                          role="status"
                        >
                          {cepHint}
                        </p>
                      ) : null}
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'cep')} />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <form.Field name="logradouro">
                  {(field) => (
                    <div className="w-full">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.logradouro.label} *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        autoComplete="street-address"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'logradouro')} />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:gap-x-4 sm:gap-y-4">
                <form.Field name="numero">
                  {(field) => (
                    <div className="sm:col-span-12 md:col-span-4 lg:col-span-2">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.numero.label} *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        autoComplete="off"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'numero')} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="complemento">
                  {(field) => (
                    <div className="sm:col-span-12 md:col-span-8 lg:col-span-5">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.complemento.label}
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        autoComplete="off"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'complemento')} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="bairro">
                  {(field) => (
                    <div className="sm:col-span-12 lg:col-span-5">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.bairro.label} *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'bairro')} />
                    </div>
                  )}
                </form.Field>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12 sm:gap-x-4 sm:gap-y-4 lg:items-start">
                <form.Field name="cidade">
                  {(field) => (
                    <div className="sm:col-span-12 md:col-span-5 lg:col-span-6">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.cidade.label} *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        autoComplete="address-level2"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'cidade')} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="uf">
                  {(field) => (
                    <div className="w-full sm:col-span-12 md:col-span-2 lg:col-span-2 lg:max-w-[5.5rem]">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.uf.label} *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        maxLength={2}
                        autoComplete="address-level1"
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 2))
                        }
                        onBlur={field.handleBlur}
                        className="w-full min-h-[2.75rem] border border-outline-variant px-3 py-2.5 text-center font-mono text-sm uppercase text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'uf')} />
                    </div>
                  )}
                </form.Field>

                <form.Field name="codigo_ibge">
                  {(field) => (
                    <div className="sm:col-span-12 md:col-span-5 lg:col-span-4">
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        {ORG_STANDARD_META.codigo_ibge.label}
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="text"
                        inputMode="numeric"
                        readOnly
                        tabIndex={-1}
                        value={field.state.value}
                        className="w-full min-h-[2.75rem] border border-outline-variant bg-surface-container-low px-3 py-2.5 font-mono text-sm text-on-surface-variant"
                      />
                      <p className="mt-0.5 text-[11px] text-slate-500">Preenchido automaticamente com o CEP.</p>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Use o mesmo e-mail da etapa &quot;Empresa&quot; para entrar depois do cadastro.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <form.Field name="senha">
                  {(field) => (
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        Senha *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="password"
                        autoComplete="new-password"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'senha')} />
                    </div>
                  )}
                </form.Field>
                <form.Field name="confirmar_senha">
                  {(field) => (
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase text-on-surface-variant" htmlFor={field.name}>
                        Confirmar senha *
                      </label>
                      <input
                        id={field.name}
                        name={field.name}
                        type="password"
                        autoComplete="new-password"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        className="w-full border border-outline-variant px-3 py-2 text-sm text-primary outline-none focus:border-primary focus:ring-0"
                      />
                      <FieldError errors={mergeStepErrors(field.state.meta.errors, stepErrors, 'confirmar_senha')} />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          ) : null}

          {step >= 3 && activeExtraSlice.length > 0 ? (
            <SignupExtraFieldsGrid form={form} slice={activeExtraSlice} stepErrors={stepErrors} />
          ) : null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-outline-variant bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex flex-wrap gap-2">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setStepErrors({});
                  setStep((s) => Math.max(0, s - 1));
                }}
                className="rounded-none border border-outline-variant bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant hover:bg-surface-container-low"
              >
                Voltar
              </button>
            ) : null}
          </div>
          <form.Subscribe selector={(s) => [s.isSubmitting, s.errorMap]}>
            {([isSubmitting, errorMap]) => (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => void handleWizardPrimary()}
                  className="rounded-none bg-tertiary px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-tertiary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? 'Enviando…'
                    : step < lastStepIndex
                      ? 'Continuar'
                      : 'Enviar cadastro'}
                </button>
                {errorMap?.onSubmit ? (
                  <span className="text-sm text-red-700" role="alert">
                    {String(errorMap.onSubmit)}
                  </span>
                ) : null}
              </div>
            )}
          </form.Subscribe>
        </footer>
      </div>
    </form>
  );
}
