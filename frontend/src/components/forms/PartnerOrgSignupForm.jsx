import { useForm } from '@tanstack/react-form';
import { useCallback, useMemo, useRef, useState } from 'react';
import { applyCnpjaOfficeToForm, fetchCnpjaOffice, hasCnpjaApiKey } from '../../lib/cnpja';
import { ORG_STANDARD_META } from '../../lib/orgStandardFields';
import { normalizeCnpj14 } from '../../lib/opencnpj';
import { fetchViaCepJson, formatCepMask, normalizeCep8, onlyDigits } from '../../lib/viacep';
import { buildPartnerOrgSignupSchema, defaultPartnerOrgValues } from '../../schemas/partnerOrgSignup';

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

function parseExtrasMultiJson(raw) {
  try {
    const j = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(j) ? j.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export function PartnerOrgSignupForm({ extraFields = [], onSubmitSuccess }) {
  const schema = useMemo(() => buildPartnerOrgSignupSchema(extraFields), [extraFields]);
  const defaultValues = useMemo(() => defaultPartnerOrgValues(extraFields), [extraFields]);

  const [cepBusy, setCepBusy] = useState(false);
  const [cepHint, setCepHint] = useState('');
  const lastCepLookup = useRef('');
  const [cnpjHint, setCnpjHint] = useState('');
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const lastCnpjLookup = useRef('');

  const form = useForm({
    defaultValues,
    validators: {
      onChange: schema,
    },
    onSubmit: async ({ value }) => {
      onSubmitSuccess?.(value);
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
        return;
      }
      if (!hasCnpjaApiKey()) {
        setCnpjHint(
          'Neste ambiente a consulta automática pelo CNPJ não está disponível. Preencha nome, e-mail e telefone manualmente.'
        );
        return;
      }
      if (lastCnpjLookup.current === n) return;
      lastCnpjLookup.current = n;
      setCnpjBusy(true);
      setCnpjHint('Consultando dados da empresa…');
      try {
        const data = await fetchCnpjaOffice(cnpjRaw);
        applyCnpjaOfficeToForm(form, data);
        setCnpjHint('Dados preenchidos automaticamente. Revise antes de enviar.');
      } catch (e) {
        lastCnpjLookup.current = '';
        setCnpjHint(e instanceof Error ? e.message : 'Não foi possível consultar o CNPJ');
      } finally {
        setCnpjBusy(false);
      }
    },
    [form]
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dados da empresa</h2>

        <form.Field name="cnpj">
          {(field) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
                {ORG_STANDARD_META.cnpj.label} *
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
                  if (!cur || cur.length < 14) lastCnpjLookup.current = '';
                  field.handleChange(v);
                }}
                onBlur={async (e) => {
                  field.handleBlur();
                  await runCnpjLookup(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              {cnpjHint ? (
                <p className={`mt-1 text-xs ${cnpjHint.includes('…') || cnpjHint.includes('preenchidos') || cnpjHint.includes('automaticamente') ? 'text-slate-600' : 'text-amber-800'}`} role="status">
                  {cnpjHint}
                </p>
              ) : null}
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <form.Field name="nome_empresa">
          {(field) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="email">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
                  {ORG_STANDARD_META.email.label} *
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="telefone">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
                  {ORG_STANDARD_META.telefone.label} *
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="tel"
                  autoComplete="tel"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-500">Senha de acesso</h3>
          <p className="mb-3 text-xs text-slate-500">Use o mesmo e-mail acima para entrar depois do cadastro.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <form.Field name="senha">
              {(field) => (
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
            <form.Field name="confirmar_senha">
              {(field) => (
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Endereço</h2>

        <form.Field name="cep">
          {(field) => (
            <div>
              <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                className="w-full max-w-[11rem] rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
              {cepHint ? (
                <p
                  className={`mt-1 text-xs ${cepHint.includes('encontrado') || cepHint.includes('Buscando') ? 'text-slate-600' : 'text-amber-800'}`}
                  role="status"
                >
                  {cepHint}
                </p>
              ) : null}
              <FieldError errors={field.state.meta.errors} />
            </div>
          )}
        </form.Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="logradouro">
            {(field) => (
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="numero">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="complemento">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
                  {ORG_STANDARD_META.complemento.label}
                </label>
                {ORG_STANDARD_META.complemento.hint ? (
                  <p className="mb-1 text-xs text-slate-500">{ORG_STANDARD_META.complemento.hint}</p>
                ) : null}
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  autoComplete="off"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="bairro">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
                  {ORG_STANDARD_META.bairro.label} *
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="cidade">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="uf">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
                  {ORG_STANDARD_META.uf.label} *
                </label>
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  maxLength={2}
                  autoComplete="address-level1"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 2))}
                  onBlur={field.handleBlur}
                  className="w-full max-w-[5rem] rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm uppercase text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <FieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="codigo_ibge">
            {(field) => (
              <div>
                <label className="mb-1 block text-sm font-medium text-primary" htmlFor={field.name}>
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
                  className="w-full max-w-[9rem] rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-700"
                />
                <p className="mt-0.5 text-[11px] text-slate-500">Preenchido automaticamente com o CEP.</p>
              </div>
            )}
          </form.Field>
        </div>
      </section>

      {extraFields.length > 0 ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Informações adicionais</h2>
          {extraFields.map((f) => (
            <form.Field key={f.id} name={`extras.${f.key}`}>
              {(field) => (
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary" htmlFor={`extra-${f.id}`}>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      id={`extra-${f.id}`}
                      rows={3}
                      value={String(field.state.value ?? '')}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  ) : f.type === 'checkbox' ? (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={field.state.value === true}
                        onChange={(e) => field.handleChange(e.target.checked)}
                        onBlur={field.handleBlur}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-primary">Sim</span>
                    </label>
                  ) : f.type === 'select' ? (
                    <select
                      id={`extra-${f.id}`}
                      value={String(field.state.value ?? '')}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-white"
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
                              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-white"
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                onChange={() => {
                                  const next = on ? selected.filter((x) => x !== opt) : [...selected, opt];
                                  field.handleChange(JSON.stringify(next));
                                }}
                                onBlur={field.handleBlur}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
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
                      className="w-full max-w-[12rem] rounded-lg border border-slate-200 px-3 py-2.5 font-mono text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-primary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                  )}
                  <FieldError errors={field.state.meta.errors} />
                </div>
              )}
            </form.Field>
          ))}
        </section>
      ) : null}

      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting, s.errorMap]}>
        {([canSubmit, isSubmitting, errorMap]) => (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              aria-disabled={!canSubmit}
              className="rounded-lg bg-primary px-6 py-3 text-[11px] font-black uppercase tracking-widest text-white shadow-sm hover:bg-[#0f2840] disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando…' : 'Enviar cadastro'}
            </button>
            {errorMap?.onSubmit ? (
              <span className="text-sm text-red-700" role="alert">
                {String(errorMap.onSubmit)}
              </span>
            ) : null}
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
