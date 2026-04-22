import { useEffect, useState } from 'react';
import { AppSideover } from '../AppSideover';
import { getOrgBuiltinPartnerFieldGroups } from '../../lib/orgStandardFields';
import { HUB_PARTNER_KINDS, normalizePartnerKindSlug } from '../../lib/hubPartnerKinds';
import {
  assignStableKeysFromLabels,
  FIELD_TYPES,
  FIELD_TYPES_WITH_OPTIONS,
  newFieldId,
} from '../../lib/registrationFormTemplates';

/** Lista editável opção a opção (dropdown / radio / multiselect). */
function FieldOptionsEditor({ fieldId, options, onChange }) {
  const raw = Array.isArray(options) ? options : [];
  const rows = raw.length === 0 ? [''] : raw;

  function setRow(i, val) {
    const next = [...rows];
    next[i] = val;
    onChange(next);
  }

  function removeRow(i) {
    const next = rows.filter((_, j) => j !== i);
    onChange(next.length ? next : ['']);
  }

  function addRow() {
    onChange([...rows, '']);
  }

  function moveRow(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Opções do campo</span>
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-primary hover:border-primary hover:bg-emerald-50/60"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Adicionar opção
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((opt, i) => (
          <div
            key={`${fieldId}-opt-${i}`}
            className="flex items-stretch gap-1.5 rounded-xl border border-slate-200/90 bg-white shadow-sm transition-shadow focus-within:border-emerald-400/50 focus-within:shadow-md focus-within:ring-2 focus-within:ring-emerald-500/15"
          >
            <span className="flex w-8 shrink-0 items-center justify-center rounded-l-[10px] bg-slate-100 text-[10px] font-bold text-slate-500">
              {i + 1}
            </span>
            <input
              type="text"
              value={opt}
              onChange={(e) => setRow(i, e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 pr-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Texto da opção"
            />
            <div className="flex shrink-0 items-center gap-0.5 pr-1">
              <button
                type="button"
                title="Subir"
                disabled={i <= 0}
                onClick={() => moveRow(i, -1)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
              <button
                type="button"
                title="Descer"
                disabled={i >= rows.length - 1}
                onClick={() => moveRow(i, 1)}
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
              </button>
              <button
                type="button"
                title="Remover"
                onClick={() => removeRow(i)}
                className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">Serve para lista, escolha única ou várias respostas. Linhas vazias são descartadas ao salvar.</p>
    </div>
  );
}

function FieldRow({ field, index, total, onChange, onRemove, onMove }) {
  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(field.type);

  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-[0_2px_8px_rgba(15,23,42,0.05)] ring-1 ring-slate-900/[0.03] sm:p-5">
      <div className="flex flex-wrap items-start gap-3">
        <label className="min-w-[160px] flex-1">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rótulo (o que o usuário vê)</span>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-shadow placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <label className="w-full min-[480px]:w-[200px]">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo de campo</span>
          <select
            value={field.type}
            onChange={(e) => {
              const nextType = e.target.value;
              const next = { ...field, type: nextType };
              if (FIELD_TYPES_WITH_OPTIONS.includes(nextType) && !Array.isArray(next.options)) {
                next.options = [];
              }
              onChange(next);
            }}
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
            checked={field.required}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          <span className="text-sm font-medium text-slate-700">Obrigatório</span>
        </label>
      </div>

      {needsOptions ? (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3 sm:p-4">
          <FieldOptionsEditor
            fieldId={field.id}
            options={field.options}
            onChange={(next) => onChange({ ...field, options: next })}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          disabled={index <= 0}
          onClick={() => onMove(-1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
          Subir
        </button>
        <button
          type="button"
          disabled={index >= total - 1}
          onClick={() => onMove(1)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
          Descer
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
        >
          Remover campo
        </button>
      </div>
    </div>
  );
}

export function RegistrationTemplateSideover({ open, onClose, draft, onChangeDraft, onSave, isNew, isSaving = false }) {
  const [tab, setTab] = useState('geral');

  useEffect(() => {
    if (open) setTab('geral');
  }, [open]);

  function updateField(i, next) {
    const fields = [...draft.fields];
    fields[i] = next;
    onChangeDraft({ ...draft, fields: assignStableKeysFromLabels(fields) });
  }

  function removeField(i) {
    onChangeDraft({ ...draft, fields: assignStableKeysFromLabels(draft.fields.filter((_, j) => j !== i)) });
  }

  function moveField(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= draft.fields.length) return;
    const fields = [...draft.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    onChangeDraft({ ...draft, fields: assignStableKeysFromLabels(fields) });
  }

  function addField() {
    const label = 'Novo campo';
    onChangeDraft({
      ...draft,
      fields: assignStableKeysFromLabels([
        ...draft.fields,
        {
          id: newFieldId(),
          key: 'temp',
          label,
          type: 'text',
          required: false,
        },
      ]),
    });
  }

  const tabItems = [
    {
      id: 'geral',
      label: 'Geral',
      content: (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nome do template *</span>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Ex.: Cadastro de parceiro"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Descrição</span>
            <input
              type="text"
              value={draft.description}
              maxLength={200}
              onChange={(e) => onChangeDraft({ ...draft, description: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Opcional"
            />
            <p className="mt-1 text-[11px] text-slate-400">{draft.description?.length ?? 0}/200</p>
          </label>
          <div className="rounded-xl border border-slate-200 bg-slate-50/90 px-4 py-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">Convite por link</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={draft.inviteLinkEnabled !== false}
                onClick={() => {
                  const on = draft.inviteLinkEnabled !== false;
                  onChangeDraft({ ...draft, inviteLinkEnabled: !on });
                }}
                className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${
                  draft.inviteLinkEnabled !== false ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    draft.inviteLinkEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo de parceiro</span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {HUB_PARTNER_KINDS.map((k) => {
                const active = normalizePartnerKindSlug(draft.partnerKind) === k.value;
                return (
                  <button
                    key={k.value}
                    type="button"
                    onClick={() => onChangeDraft({ ...draft, partnerKind: k.value })}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      active
                        ? 'border-emerald-600 bg-emerald-50/90 shadow-sm ring-2 ring-emerald-600/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">{k.label}</span>
                    {k.description ? (
                      <span className="mt-1 block text-xs leading-snug text-slate-500">{k.description}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'padrao',
      label: 'Padrão',
      content: (
        <div className="space-y-6">
          {getOrgBuiltinPartnerFieldGroups().map((g) => (
            <div key={g.id}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{g.label}</h3>
              <ul className="space-y-2">
                {g.fields.map((f) => {
                  const disabledList = draft.standardFieldsDisabled || [];
                  const isOn = !disabledList.some((k) => String(k).toLowerCase() === f.key.toLowerCase());
                  return (
                    <li
                      key={f.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                    >
                      <span className="min-w-0 text-sm text-slate-800">{f.label}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOn}
                        title={isOn ? 'Desativar no formulário' : 'Ativar no formulário'}
                        onClick={() => {
                          const next = [...disabledList];
                          const idx = next.findIndex((k) => String(k).toLowerCase() === f.key.toLowerCase());
                          if (isOn) {
                            if (idx < 0) next.push(f.key);
                          } else if (idx >= 0) next.splice(idx, 1);
                          onChangeDraft({ ...draft, standardFieldsDisabled: next });
                        }}
                        className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${
                          isOn ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                            isOn ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'campos',
      label: 'Campos extras',
      content: (
        <div className="space-y-4">
          <button
            type="button"
            onClick={addField}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-primary transition-colors hover:border-primary hover:bg-emerald-50/50 sm:w-auto sm:justify-start"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Adicionar campo extra
          </button>
          {draft.fields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
              <p className="text-sm text-slate-500">Nenhum campo extra</p>
            </div>
          ) : (
            <div className="space-y-4">
              {draft.fields.map((f, i) => (
                <FieldRow
                  key={f.id}
                  field={f}
                  index={i}
                  total={draft.fields.length}
                  onChange={(next) => updateField(i, next)}
                  onRemove={() => removeField(i)}
                  onMove={(d) => moveField(i, d)}
                />
              ))}
            </div>
          )}
        </div>
      ),
    },
  ];

  const active = tabItems.find((t) => t.id === tab) || tabItems[0];

  const canSave = draft.name.trim().length > 0;

  return (
    <AppSideover
      open={open}
      onClose={onClose}
      variant="operational"
      eyebrow="Formulários de cadastro"
      title={isNew ? 'Novo template' : 'Editar template'}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-slate-200/90 bg-white px-2 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="flex gap-0 overflow-x-auto">
            {tabItems.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-[3px] px-5 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t.id
                    ? 'border-emerald-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{active?.content}</div>
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
              disabled={!canSave || isSaving}
              onClick={() => void onSave?.()}
              className="rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-800 disabled:opacity-40"
            >
              {isSaving ? 'A guardar…' : isNew ? 'Criar template' : 'Guardar alterações'}
            </button>
          </div>
        </div>
      </div>
    </AppSideover>
  );
}
