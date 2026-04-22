import { useMemo } from 'react';
import { AppSideover } from '../AppSideover';
import {
  FIELD_TYPES,
  FIELD_TYPES_WITH_OPTIONS,
  slugKeyFromLabel,
  standardCatalogFieldKeyFromLabel,
} from '../../lib/registrationFormTemplates';

/**
 * Formulário de campo do catálogo (alinhado ao cartão «Campos extras» do template).
 * @param {{ sections?: unknown[], fields?: unknown[] } | null | undefined} [catalogForKeyPreview] — para pré-visualizar a chave gerada (novos campos).
 */
export function StandardCatalogFieldSideover({
  open,
  onClose,
  isNew,
  sectionId,
  setSectionId,
  sections,
  fieldKey,
  setFieldKey,
  keyReadonly,
  catalogForKeyPreview,
  label,
  setLabel,
  fieldType,
  setFieldType,
  required,
  setRequired,
  sortOrder,
  setSortOrder,
  placeholder,
  setPlaceholder,
  rows,
  setRows,
  optionsText,
  setOptionsText,
  isActive,
  setIsActive,
  onSave,
  busy,
}) {
  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(fieldType);
  const generatedKeyPreview = useMemo(() => {
    if (!isNew || !sectionId || !label.trim()) return '';
    if (catalogForKeyPreview && Array.isArray(catalogForKeyPreview.fields)) {
      return standardCatalogFieldKeyFromLabel(label, sectionId, catalogForKeyPreview, null);
    }
    return slugKeyFromLabel(label);
  }, [isNew, sectionId, label, catalogForKeyPreview]);

  const canSave =
    label.trim().length > 0 &&
    sectionId &&
    (!needsOptions || optionsText.trim().length > 0);

  return (
    <AppSideover
      open={open}
      onClose={onClose}
      variant="operational"
      eyebrow="Catálogo de campos padrão"
      title={isNew ? 'Novo campo padrão' : 'Editar campo padrão'}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.03] sm:p-5">
            <div className="flex flex-wrap items-start gap-3">
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Secção *</span>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  <option value="">Seleccione…</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
              {!isNew ? (
                <label className="block w-full min-[480px]:w-[220px]">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Chave técnica
                  </span>
                  <input
                    type="text"
                    value={fieldKey}
                    onChange={(e) => setFieldKey(e.target.value)}
                    readOnly={keyReadonly}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none read-only:bg-slate-50 focus:border-primary focus:ring-2 focus:ring-primary/15"
                    placeholder="—"
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-3">
              <label className="min-w-[160px] flex-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Rótulo (o que o utilizador vê) *
                </span>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="w-full min-[480px]:w-[200px]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo de campo</span>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-2.5 pb-1">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
                />
                <span className="text-sm font-medium text-slate-700">Obrigatório</span>
              </label>
            </div>
            {isNew && label.trim() && sectionId ? (
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                Chave técnica gerada a partir do rótulo (como nos campos extras):{' '}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] text-slate-800">
                  {generatedKeyPreview || '…'}
                </code>
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              <label className="block w-full min-[480px]:w-[8rem]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ordem</span>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="block min-w-[200px] flex-1">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Placeholder</span>
                <input
                  type="text"
                  value={placeholder}
                  onChange={(e) => setPlaceholder(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </label>
              <label className="block w-full min-[480px]:w-[8rem]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Linhas (textarea)
                </span>
                <input
                  type="number"
                  value={rows}
                  onChange={(e) => setRows(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  placeholder="—"
                />
              </label>
            </div>
            {needsOptions ? (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Opções (uma por linha) *
                </span>
                <textarea
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            ) : null}
            <label className="mt-4 flex cursor-pointer items-center gap-2.5">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm font-medium text-slate-700">Campo activo no catálogo</span>
            </label>
          </div>
        </div>
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] sm:px-6">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!canSave || busy}
              onClick={() => void onSave?.()}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-800 disabled:opacity-40"
            >
              {busy ? 'A guardar…' : isNew ? 'Adicionar campo' : 'Guardar alterações'}
            </button>
          </div>
        </div>
      </div>
    </AppSideover>
  );
}
