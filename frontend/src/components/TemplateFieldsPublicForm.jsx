/**
 * Renderiza campos extra de registration_form_template no cadastro público (lead).
 * @param {{ fields: Array<Record<string, unknown>>, values: Record<string, string>, onChange: (key: string, value: string) => void, idPrefix: string }} props
 */
export function TemplateFieldsPublicForm({ fields, values, onChange, idPrefix }) {
  const list = Array.isArray(fields) ? fields : [];
  return (
    <div className="space-y-4">
      {list.map((f) => {
        const key = String(f.key ?? '').trim();
        if (!key || f.inactive === true) return null;
        const label = String(f.label ?? key);
        const type = String(f.type ?? 'text').toLowerCase();
        const required = Boolean(f.required);
        const val = values[key] ?? '';
        const id = `${idPrefix}-${key}`;
        const commonLabel = (
          <label className="block text-[10px] font-black uppercase tracking-[0.12em] text-primary" htmlFor={id}>
            {label}
            {required ? <span className="text-red-600"> *</span> : null}
          </label>
        );

        if (type === 'textarea') {
          return (
            <div key={key}>
              {commonLabel}
              <textarea
                id={id}
                rows={4}
                required={required}
                className="mt-1 w-full resize-y rounded-sm border-2 border-outline-variant bg-white p-2 text-sm text-on-surface outline-none focus:border-primary"
                value={val}
                onChange={(e) => onChange(key, e.target.value)}
              />
            </div>
          );
        }

        if (type === 'select' && Array.isArray(f.options) && f.options.length > 0) {
          return (
            <div key={key}>
              {commonLabel}
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
            </div>
          );
        }

        const inputType =
          type === 'email' ? 'email' : type === 'tel' ? 'tel' : type === 'number' ? 'number' : 'text';

        return (
          <div key={key}>
            {commonLabel}
            <input
              id={id}
              type={inputType}
              required={required}
              className="mt-1 w-full border-b-2 border-outline-variant bg-transparent py-2 text-sm text-on-surface outline-none focus:border-primary"
              value={val}
              onChange={(e) => onChange(key, e.target.value)}
              autoComplete="off"
            />
          </div>
        );
      })}
    </div>
  );
}
