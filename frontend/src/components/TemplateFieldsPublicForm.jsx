/**
 * Renderiza campos extra de registration_form_template no cadastro público (lead/captura).
 * Contactos ficam antes deste bloco em PublicLeadCapturePage — aqui: perguntas extra,
 * tipo alinhado ao PartnerOrgSignupForm (radio, multiselect, data, URL, documento).
 */
import { useCallback, useMemo, useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { uploadPartnerSignupExtraFile } from '../lib/partnerSignupStorage';
import { parsePartnerSignupFileRef } from '../schemas/partnerOrgSignup';

/** @param {unknown} raw */
function parseExtrasMultiJson(raw) {
  try {
    const j = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(j) ? j.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/**
 * Envio igual ao cadastro parceiro (bucket `partner_signup_documents` anon).
 */
function LeadFileDropField({ idPrefix, label, required, value, onChange, fieldKey }) {
  const id = `${idPrefix}-file-${fieldKey}`;
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const refDoc = useMemo(() => parsePartnerSignupFileRef(value), [value]);

  const uploadOne = useCallback(
    /** @param {File | null | undefined} file */ async (file) => {
      if (!file) return;
      if (!isSupabaseConfigured()) {
        setLocalErr('Envio indisponível neste ambiente.');
        return;
      }
      setLocalErr('');
      setBusy(true);
      try {
        const json = await uploadPartnerSignupExtraFile(file);
        onChange(json);
      } catch (e) {
        setLocalErr(e instanceof Error ? e.message : 'Não foi possível enviar o ficheiro.');
      } finally {
        setBusy(false);
      }
    },
    [onChange]
  );

  /** @param {React.DragEvent} e */
  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /** @param {React.DragEvent} e */
  async function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files?.[0];
    await uploadOne(f);
  }

  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <label
        htmlFor={id}
        onDragOver={onDragOver}
        onDrop={(e) => void onDrop(e)}
        className="flex cursor-pointer flex-col gap-2 rounded-none border-2 border-dashed border-outline-variant bg-surface-container-low/40 px-4 py-5 text-center transition-colors hover:border-primary hover:bg-white"
      >
        <span className="material-symbols-outlined mx-auto text-[28px] text-primary" aria-hidden>
          upload_file
        </span>
        <span className="text-xs font-semibold text-primary">
          Arraste o ficheiro para aqui ou clique para escolher
        </span>
        <span className="text-[11px] text-on-surface-variant">PDF, Word ou imagem até 15 MB.</span>
        <input
          id={id}
          type="file"
          className="sr-only"
          accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          disabled={busy}
          onChange={(e) => {
            void uploadOne(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </label>
      {refDoc ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-primary">{refDoc.name || refDoc.path}</span>
          <button
            type="button"
            className="font-semibold text-red-700 underline-offset-2 hover:underline"
            disabled={busy}
            onClick={() => onChange('')}
          >
            Remover
          </button>
        </div>
      ) : null}
      {busy ? <p className="text-xs text-on-surface-variant">A enviar…</p> : null}
      {localErr ? (
        <p className="text-xs text-red-700" role="alert">
          {localErr}
        </p>
      ) : null}
    </div>
  );
}

/**
 * @param {{ fields: Array<Record<string, unknown>>, values: Record<string, string>, onChange: (key: string, value: string) => void, idPrefix: string, errors?: Record<string, string>, showGroupTitles?: boolean }} props
 */
export function TemplateFieldsPublicForm({ fields, values, onChange, idPrefix, errors = {}, showGroupTitles = true }) {
  const list = Array.isArray(fields) ? fields : [];

  /** @type {typeof list} */
  const attachments = [];
  /** @type {typeof list} */
  const outros = [];

  const commonLabel = (
    /** @type {{ key: string, label?: unknown, inactive?: unknown, required?: unknown }} */ f
  ) => {
    const label = String(f.label ?? f.key);
    const required = Boolean(f.required);
    const id = `${idPrefix}-${String(f.key ?? '').trim()}`;
    return { label, required, id };
  };

  for (const f of list) {
    if (!f || f.inactive === true) continue;
    const k = String(f.key ?? '').trim();
    if (!k) continue;
    const t = String(f.type ?? 'text').toLowerCase();
    if (t === 'file') attachments.push(f);
    else outros.push(f);
  }

  const renderOne = /** @type {(f: Record<string, unknown>) => React.ReactNode} */ (f) => {
    const key = String(f.key ?? '').trim();
    const { label, required, id } = commonLabel(f);
    const type = String(f.type ?? 'text').toLowerCase();
    const val = values[key] ?? '';
    const errEl = errors[key] ? (
      <p className="mt-1 text-xs text-red-700" role="alert">
        {errors[key]}
      </p>
    ) : null;

    if (type === 'textarea') {
      return (
        <div key={key}>
          <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor={id}>
            {label}
            {required ? <span className="text-red-600"> *</span> : null}
          </label>
          <textarea
            id={id}
            rows={Math.min(12, Number(f.rows) > 0 ? Number(f.rows) : 4)}
            required={required}
            className="mt-1 w-full resize-y rounded-sm border-2 border-outline-variant bg-white p-2 text-sm text-on-surface outline-none focus:border-primary"
            value={val}
            onChange={(e) => onChange(key, e.target.value)}
          />
          {errEl}
        </div>
      );
    }

    if (type === 'select' && Array.isArray(f.options) && f.options.length > 0) {
      return (
        <div key={key}>
          <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor={id}>
            {label}
            {required ? <span className="text-red-600"> *</span> : null}
          </label>
          <select
            id={id}
            required={required}
            className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
            value={val}
            onChange={(e) => onChange(key, e.target.value)}
          >
            <option value="">Selecione…</option>
            {f.options.map((opt) => {
              const o = String(opt ?? '');
              return (
                <option key={o} value={o}>
                  {o}
                </option>
              );
            })}
          </select>
          {errEl}
        </div>
      );
    }

    if (type === 'radio' && Array.isArray(f.options) && f.options.length > 0) {
      return (
        <div key={key}>
          <fieldset className="space-y-2.5">
            <legend className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary">
              {label}
              {required ? <span className="text-red-600"> *</span> : null}
            </legend>
            {f.options.map((opt) => {
              const o = String(opt ?? '');
              return (
                <label
                  key={o}
                  className="flex cursor-pointer items-start gap-3 rounded-sm border border-outline-variant bg-surface-container-low/50 px-3 py-2.5 hover:border-primary"
                >
                  <input
                    type="radio"
                    name={`${idPrefix}-radio-${key}`}
                    value={o}
                    checked={val === o}
                    required={required}
                    onChange={() => onChange(key, o)}
                    className="mt-0.5 h-4 w-4 border-slate-300 text-primary"
                  />
                  <span className="text-sm text-on-surface">{o}</span>
                </label>
              );
            })}
          </fieldset>
          {errEl}
        </div>
      );
    }

    if (type === 'multiselect' && Array.isArray(f.options) && f.options.length > 0) {
      const selected = parseExtrasMultiJson(val);
      return (
        <div key={key}>
          <fieldset className="space-y-2.5">
            <legend className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary">
              {label}
              {required ? <span className="text-red-600"> *</span> : null}
            </legend>
            {f.options.map((opt) => {
              const o = String(opt ?? '');
              const on = selected.includes(o);
              return (
                <label
                  key={o}
                  className="flex cursor-pointer items-start gap-3 rounded-sm border border-outline-variant bg-surface-container-low/50 px-3 py-2.5 hover:border-primary"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => {
                      const next = on ? selected.filter((x) => x !== o) : [...selected, o];
                      onChange(key, JSON.stringify(next));
                    }}
                    className="mt-0.5 h-4 w-4 rounded-none border-outline-variant accent-tertiary"
                  />
                  <span className="text-sm text-on-surface">{o}</span>
                </label>
              );
            })}
          </fieldset>
          {errEl}
        </div>
      );
    }

    if (type === 'checkbox') {
      return (
        <div key={key}>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={val === 'true' || val === '1'}
              onChange={(e) => onChange(key, e.target.checked ? 'true' : '')}
              className="h-4 w-4 rounded-none border-outline-variant accent-tertiary"
            />
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-primary">
              {label}
              {required ? <span className="text-red-600"> *</span> : null}
            </span>
          </label>
          {errEl}
        </div>
      );
    }

    if (type === 'date') {
      return (
        <div key={key}>
          <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor={id}>
            {label}
            {required ? <span className="text-red-600"> *</span> : null}
          </label>
          <input
            id={id}
            type="date"
            required={required}
            value={val}
            onChange={(e) => onChange(key, e.target.value)}
            className="mt-1 w-full max-w-[12rem] border-b-2 border-outline-variant bg-transparent py-2 font-mono text-sm text-on-surface outline-none focus:border-primary"
          />
          {errEl}
        </div>
      );
    }

    if (type === 'file') {
      return (
        <div key={key}>
          <LeadFileDropField
            idPrefix={idPrefix}
            fieldKey={key}
            label={label}
            required={required}
            value={val}
            onChange={(v) => onChange(key, v)}
          />
          {errEl}
        </div>
      );
    }

    const inputType =
      type === 'email' ? 'email' : type === 'tel' ? 'tel' : type === 'number' ? 'number' : type === 'url' ? 'url' : 'text';

    return (
      <div key={key}>
        <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor={id}>
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
        <input
          id={id}
          type={inputType}
          required={required}
          placeholder={type === 'url' ? 'https://' : undefined}
          className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
          value={val}
          onChange={(e) => onChange(key, e.target.value)}
          autoComplete="off"
        />
        {errEl}
      </div>
    );
  };

  const hasAnything = outros.length > 0 || attachments.length > 0;
  if (!hasAnything) return null;

  return (
    <div className="space-y-5">
      {outros.length > 0 ? (
        <>
          {showGroupTitles ? (
            <h3 className="border-b border-outline-variant pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant">
              Informações complementares
            </h3>
          ) : null}
          <div className="space-y-4">{outros.map((f) => renderOne(f))}</div>
        </>
      ) : null}
      {attachments.length > 0 ? (
        <>
          {showGroupTitles ? (
            <h3 className="border-b border-outline-variant pb-2 text-[10px] font-black uppercase tracking-[0.14em] text-on-surface-variant">
              Documentos
            </h3>
          ) : null}
          <div className="space-y-6">{attachments.map((f) => renderOne(f))}</div>
        </>
      ) : null}
    </div>
  );
}
