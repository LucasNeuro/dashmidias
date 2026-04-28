import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppSideover } from '../AppSideover';
import { FormSideoverFooter } from '../FormSideoverFooter';
import { HorizontalScrollNav } from '../HorizontalScrollNav';
import { HubButton } from '../HubButton';
import { useAuth } from '../../context/AuthContext';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { getOrgBuiltinPartnerFieldGroups } from '../../lib/orgStandardFields';
import { HUB_PARTNER_KINDS, normalizePartnerKindSlug, PRESTADORES_SERVICO_KIND } from '../../lib/hubPartnerKinds';
import { suggestTemplateDescriptionWithMistral } from '../../lib/suggestTemplateDescription';
import { normalizeSignupOptions } from '../../schemas/partnerOrgSignup';
import { fetchActiveLeadSegments } from '../../lib/leadSegmentsApi';
import { leadSegmentsPublicQueryKey } from '../../lib/queryKeys';
import {
  assignStableKeysFromLabels,
  defaultDisabledBuiltinGroupsForPartnerKind,
  FIELD_TYPES,
  FIELD_TYPES_WITH_OPTIONS,
  newFieldId,
} from '../../lib/registrationFormTemplates';

/** Interruptor compacto — evita alternar o acordeão ao clicar no switch. */
function CompactSwitch({ checked, onToggle, disabled, title }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-emerald-600' : 'bg-slate-300'
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

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
        <label className="flex w-full min-[480px]:w-auto items-end gap-2.5 pb-1 min-[480px]:ml-2">
          <input
            type="checkbox"
            checked={field.inactive === true}
            onChange={(e) => onChange({ ...field, inactive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/30"
          />
          <span className="text-sm font-medium text-slate-700">Ocultar no cadastro público</span>
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

export function RegistrationTemplateSideover({
  open,
  onClose,
  draft,
  onChangeDraft,
  onSave,
  isNew,
  isSaving = false,
  standardCatalog = null,
  /** @type {'homologacao' | 'lead_capture'} */
  mode = 'homologacao',
}) {
  const { supabase, session, isAdmin } = useAuth();
  const { toast } = useUiFeedback();
  const isLeadMode = mode === 'lead_capture';
  const [tab, setTab] = useState('geral');
  /** Seções da aba «Padrão» expandidas (ids de grupo). */
  const [builtinOpenIds, setBuiltinOpenIds] = useState(/** @type {string[]} */ ([]));
  const [suggestDescBusy, setSuggestDescBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setTab('geral');
      setBuiltinOpenIds([]);
    }
  }, [open, mode]);

  const segmentsQuery = useQuery({
    queryKey: leadSegmentsPublicQueryKey(),
    queryFn: async () => {
      if (!supabase) return [];
      return fetchActiveLeadSegments(supabase);
    },
    enabled: open && isLeadMode && Boolean(supabase),
    staleTime: 60_000,
  });

  function toggleBuiltinSection(groupId) {
    setBuiltinOpenIds((prev) => (prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]));
  }

  async function handleSuggestDescription() {
    if (!supabase || !session) {
      toast('Inicie sessão para usar a sugestão por IA.', { variant: 'warning', duration: 5000 });
      return;
    }
    if (!isAdmin) {
      toast('Sem permissão para esta acção.', { variant: 'warning', duration: 5000 });
      return;
    }
    const su = normalizeSignupOptions(draft.signupSettings);
    const slug = normalizePartnerKindSlug(draft.partnerKind);
    const kindMeta = HUB_PARTNER_KINDS.find((k) => k.value === slug);
    const segSlug = su.leadSegmentSlug?.trim() ?? '';
    const segRow = (segmentsQuery.data ?? []).find((s) => s.slug === segSlug);
    setSuggestDescBusy(true);
    try {
      const { title, description } = await suggestTemplateDescriptionWithMistral(supabase, {
        templateName: draft.name.trim(),
        templatePurpose: isLeadMode ? 'lead_capture' : 'partner_homologacao',
        partnerKind: slug,
        partnerKindLabel: kindMeta?.label ?? '',
        partnerKindDescription: kindMeta?.description ?? '',
        leadSegmentSlug: segSlug,
        leadSegmentLabel: segRow?.label ?? '',
        leadSegmentDescription: segRow?.description ?? '',
        cnpjRequired: su.cnpjRequired,
        collectCpf: su.collectCpf,
        inviteLinkEnabled: draft.inviteLinkEnabled !== false,
      });
      onChangeDraft({
        ...draft,
        name: title || draft.name.trim(),
        description,
      });
      toast('Título e descrição sugeridos. Revise antes de salvar.', { variant: 'success', duration: 5200 });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não foi possível gerar a sugestão.', {
        variant: 'warning',
        duration: 6500,
      });
    } finally {
      setSuggestDescBusy(false);
    }
  }

  function updateField(i, next) {
    const fields = [...draft.fields];
    fields[i] = next;
    onChangeDraft({ ...draft, fields: assignStableKeysFromLabels(fields, standardCatalog) });
  }

  function removeField(i) {
    onChangeDraft({
      ...draft,
      fields: assignStableKeysFromLabels(draft.fields.filter((_, j) => j !== i), standardCatalog),
    });
  }

  function moveField(i, delta) {
    const j = i + delta;
    if (j < 0 || j >= draft.fields.length) return;
    const fields = [...draft.fields];
    [fields[i], fields[j]] = [fields[j], fields[i]];
    onChangeDraft({ ...draft, fields: assignStableKeysFromLabels(fields, standardCatalog) });
  }

  function addField() {
    const label = 'Novo campo';
    onChangeDraft({
      ...draft,
      fields: assignStableKeysFromLabels(
        [
          ...draft.fields,
          {
            id: newFieldId(),
            key: 'temp',
            label,
            type: 'text',
            required: false,
          },
        ],
        standardCatalog
      ),
    });
  }

  const suggestAiDisabled = suggestDescBusy || !supabase || !session || !isAdmin;

  const tabItems = [
    {
      id: 'geral',
      label: 'Geral',
      content: (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nome do modelo *</span>
            <div className="relative">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => onChangeDraft({ ...draft, name: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-[9.25rem] text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:pr-40"
                placeholder={isLeadMode ? 'Ex.: Inscrição — evento (ajuda a identificar na lista)' : 'Ex.: Cadastro de parceiro'}
                aria-describedby="template-name-ia-hint"
              />
              <button
                type="button"
                disabled={suggestAiDisabled}
                onClick={() => void handleSuggestDescription()}
                className="absolute right-1 top-1/2 flex h-8 max-w-[calc(100%-0.5rem)] -translate-y-1/2 items-center gap-0.5 overflow-hidden rounded-md border-0 bg-violet-50/95 px-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 shadow-none hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-45 sm:gap-1 sm:px-2.5 sm:text-[11px]"
                title={
                  isLeadMode
                    ? 'Sugere título e descrição com base no nome e no segmento CRM (se já escolher).'
                    : 'Sugere título e descrição com base no tipo de parceiro, no segmento CRM se já escolhido, e no texto que escreveu aqui.'
                }
              >
                <span
                  className={`material-symbols-outlined shrink-0 text-[18px] sm:text-[19px] ${suggestDescBusy ? 'animate-spin' : ''}`}
                  aria-hidden
                >
                  {suggestDescBusy ? 'progress_activity' : 'auto_awesome'}
                </span>
                <span className="min-w-0 truncate">
                  {suggestDescBusy ? 'A gerar…' : (
                    <>
                      <span className="sm:hidden">IA</span>
                      <span className="hidden sm:inline">Sugerir com IA</span>
                    </>
                  )}
                </span>
              </button>
            </div>
            <p id="template-name-ia-hint" className="mt-1 text-[11px] text-slate-400">
              {isLeadMode
                ? 'A IA usa o nome que escreveu e o segmento CRM quando já estiver definido abaixo.'
                : 'A IA usa o tipo de parceiro deste modelo e o texto atual do nome.'}{' '}
              Revise sempre antes de salvar.
            </p>
          </label>
          {isLeadMode ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-[11px] leading-snug text-slate-700">
              <span className="font-semibold text-slate-900">No link público </span>
              o visitante vê o título e a descrição deste modelo e preenche sempre{' '}
              <strong>nome completo, e-mail e telefone</strong>. Na aba <strong>Perguntas</strong> define o que mais quiser (texto, listas,
              anexos, etc.). Regras condicionais entre campos podem ser acrescentadas numa evolução do produto.
            </div>
          ) : null}
          <div className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Descrição</span>
            <input
              type="text"
              value={draft.description}
              maxLength={200}
              onChange={(e) => onChangeDraft({ ...draft, description: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Texto de ajuda no formulário público (opcional)"
              aria-describedby="template-desc-hint"
            />
            <p id="template-desc-hint" className="mt-1 text-[11px] text-slate-400">
              {draft.description?.length ?? 0}/200 · use <strong>Sugerir com IA</strong> no campo Nome do modelo para gerar título e texto de uma
              vez
            </p>
          </div>
          {isLeadMode ? (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Segmento no CRM (opcional)
              </span>
              <select
                value={normalizeSignupOptions(draft.signupSettings).leadSegmentSlug}
                onChange={(e) => {
                  const su = normalizeSignupOptions(draft.signupSettings);
                  onChangeDraft({ ...draft, signupSettings: { ...su, leadSegmentSlug: e.target.value } });
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                <option value="">— Não classificar / escolher depois —</option>
                {(segmentsQuery.data ?? []).map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">
                Se escolher PARCEIRO, CLIENTE ou IMOVEL, os envios públicos gravam com essa etiqueta. Pode deixar em branco e classificar no CRM
                depois.
              </p>
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Slug do link de convite (opcional)
            </span>
            <input
              type="text"
              value={draft.inviteSlug ?? ''}
              onChange={(e) => onChangeDraft({ ...draft, inviteSlug: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="ex.: evento-2025 (opcional)"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] leading-snug text-slate-500">
              Só letras minúsculas, números e hífens; o texto deve ser único. Se deixar em branco, o link público continua a usar o código
              interno gerado pelo sistema.
            </p>
          </label>
          <div className={`space-y-3 rounded-xl border px-4 py-3.5 ${isLeadMode ? 'border-emerald-100 bg-emerald-50/35' : 'border-slate-200 bg-slate-50/90'}`}>
            {!isLeadMode ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">CNPJ obrigatório</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Desligue para permitir cadastro só com CPF (ex.: empreiteiros sem firma).
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={normalizeSignupOptions(draft.signupSettings).cnpjRequired}
                  onClick={() => {
                    const su = normalizeSignupOptions(draft.signupSettings);
                    onChangeDraft({ ...draft, signupSettings: { ...su, cnpjRequired: !su.cnpjRequired } });
                  }}
                  className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${
                    normalizeSignupOptions(draft.signupSettings).cnpjRequired ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      normalizeSignupOptions(draft.signupSettings).cnpjRequired ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ) : null}
            {!isLeadMode ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">Pedir CPF</p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Mostra o campo CPF na etapa Empresa (validação com CNPJ conforme regras acima).
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={normalizeSignupOptions(draft.signupSettings).collectCpf}
                  onClick={() => {
                    const su = normalizeSignupOptions(draft.signupSettings);
                    onChangeDraft({ ...draft, signupSettings: { ...su, collectCpf: !su.collectCpf } });
                  }}
                  className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${
                    normalizeSignupOptions(draft.signupSettings).collectCpf ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                      normalizeSignupOptions(draft.signupSettings).collectCpf ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ) : null}
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
          {!isLeadMode ? (
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tipo de parceiro</span>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {HUB_PARTNER_KINDS.map((k) => {
                  const active = normalizePartnerKindSlug(draft.partnerKind) === k.value;
                  return (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => {
                        const isPrest = k.value === PRESTADORES_SERVICO_KIND;
                        onChangeDraft({
                          ...draft,
                          partnerKind: k.value,
                          signupSettings: normalizeSignupOptions(
                            isPrest
                              ? { cnpjRequired: false, collectCpf: true }
                              : { cnpjRequired: true, collectCpf: false }
                          ),
                          disabledBuiltinGroups: defaultDisabledBuiltinGroupsForPartnerKind(k.value),
                        });
                      }}
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
          ) : null}
        </div>
      ),
    },
    ...(isLeadMode
      ? []
      : [
          {
            id: 'padrao',
            label: 'Padrão',
            content: (
        <div className="space-y-6">
          <p className="text-xs leading-relaxed text-slate-600">
            Ligue ou desligue <strong>blocos inteiros</strong> (ex.: logística para prestadores; atuação em obra para fornecedores de produto).
            Depois você pode refinar campo a campo dentro de cada bloco ativo.
          </p>
          <p className="text-xs text-slate-500">
            <Link to="/adm/catalogo-padrao" className="font-semibold text-primary underline-offset-2 hover:underline">
              Campos
            </Link>
            — para gerenciar seções e configurações compartilhadas por todos os modelos (tabela + formulários no painel lateral).
          </p>
          {getOrgBuiltinPartnerFieldGroups(standardCatalog).map((g) => {
            const groupOff = new Set((draft.disabledBuiltinGroups || []).map((x) => String(x).toLowerCase()));
            const blockOn = !groupOff.has(String(g.id).toLowerCase());
            const expanded = builtinOpenIds.includes(g.id);
            return (
              <div key={g.id} className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <div className="flex min-h-[3rem] items-stretch divide-x divide-slate-200/90">
                  <button
                    type="button"
                    onClick={() => toggleBuiltinSection(g.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 sm:gap-3 sm:px-4"
                  >
                    <span
                      className={`material-symbols-outlined shrink-0 text-[22px] text-slate-500 transition-transform duration-200 ${
                        expanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden
                    >
                      expand_more
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">{g.label}</h3>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                        {blockOn
                          ? `${g.fields.length} campo${g.fields.length === 1 ? '' : 's'} · toque para expandir`
                          : 'Bloco desligado — não entra no convite nem nas etapas'}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 flex-col items-center justify-center gap-0.5 bg-slate-50/80 px-2.5 py-2 sm:flex-row sm:gap-2 sm:px-3">
                    <span className="text-center text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:text-[10px]">
                      Bloco
                    </span>
                    <CompactSwitch
                      checked={blockOn}
                      title={blockOn ? 'Ocultar bloco no formulário público' : 'Mostrar bloco no cadastro'}
                      onToggle={() => {
                        const id = String(g.id).toLowerCase();
                        const cur = [...(draft.disabledBuiltinGroups || [])].map((x) => String(x).toLowerCase());
                        const has = cur.includes(id);
                        const next = blockOn
                          ? has
                            ? cur
                            : [...cur, id]
                          : cur.filter((x) => x !== id);
                        const normalized = [...new Set(next)].filter(Boolean);
                        onChangeDraft({ ...draft, disabledBuiltinGroups: normalized });
                      }}
                    />
                  </div>
                </div>
                {expanded ? (
                  <div className="border-t border-slate-200/90 bg-slate-50/40 px-3 py-3 sm:px-4">
                    {!blockOn ? (
                      <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2.5 text-xs leading-relaxed text-slate-600">
                        Com o bloco desligado, estes campos deixam de aparecer no convite. Ligue o bloco para afinar campo
                        a campo.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {g.fields.map((f) => {
                          const disabledList = draft.standardFieldsDisabled || [];
                          const isOn = !disabledList.some((k) => String(k).toLowerCase() === f.key.toLowerCase());
                          return (
                            <li
                              key={f.key}
                              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/90 bg-white px-3 py-2"
                            >
                              <span className="min-w-0 text-sm text-slate-800">{f.label}</span>
                              <CompactSwitch
                                checked={isOn}
                                disabled={!blockOn}
                                title={isOn ? 'Desativar no formulário' : 'Ativar no formulário'}
                                onToggle={() => {
                                  const next = [...disabledList];
                                  const idx = next.findIndex((k) => String(k).toLowerCase() === f.key.toLowerCase());
                                  if (isOn) {
                                    if (idx < 0) next.push(f.key);
                                  } else if (idx >= 0) next.splice(idx, 1);
                                  onChangeDraft({ ...draft, standardFieldsDisabled: next });
                                }}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
            ),
          },
        ]),
    {
      id: 'campos',
      label: isLeadMode ? 'Perguntas' : 'Campos extras',
      content: (
        <div className="space-y-4">
          <HubButton
            type="button"
            variant="secondaryDashed"
            icon="add_circle"
            onClick={addField}
            className="w-full !text-[11px] sm:w-auto"
          >
            {isLeadMode ? 'Adicionar pergunta' : 'Adicionar campo extra'}
          </HubButton>
          {draft.fields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-5 py-10 text-center">
              <p className="text-sm text-slate-500">Nenhuma pergunta extra. O formulário público já pede nome, e-mail e telefone; adicione aqui o que mais precisar.</p>
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

  const savePrimaryLabel = isNew ? 'Criar modelo' : 'Salvar alterações';

  return (
    <AppSideover
      open={open}
      onClose={onClose}
      variant="operational"
      eyebrow={isLeadMode ? 'Cadastro geral leads' : 'Cadastro homologação'}
      title={isNew ? 'Novo modelo' : 'Editar modelo'}
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0"
      footer={
        <FormSideoverFooter
          onCancel={onClose}
          primaryIcon={isNew ? 'add' : 'save'}
          primaryDisabled={!canSave || isSaving}
          busy={isSaving}
          loadingLabel="Salvando…"
          primaryLabel={savePrimaryLabel}
          onPrimary={() => void onSave?.()}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-slate-200/90 bg-white px-1 shadow-[0_1px_0_rgba(15,23,42,0.04)] sm:px-2">
          <HorizontalScrollNav className="min-w-0">
            {tabItems.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 border-b-[3px] px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-colors sm:px-5 ${
                  tab === t.id
                    ? 'border-emerald-600 text-slate-900'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </HorizontalScrollNav>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{active?.content}</div>
      </div>
    </AppSideover>
  );
}
