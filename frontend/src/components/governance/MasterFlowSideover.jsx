import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppSideover } from '../AppSideover';
import { HubButton } from '../HubButton';
import { BranchStepVisualEditor } from './BranchStepVisualEditor';
import { useAuth } from '../../context/AuthContext';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { getSupabase } from '../../lib/supabaseClient';
import {
  masterFlowsAdminQueryKey,
  masterFlowStepsAdminQueryKey,
  registrationTemplatesListQueryKey,
} from '../../lib/queryKeys';
import { friendlyRegistrationFlowError, listMasterFlowStepsAdmin } from '../../lib/registrationMasterFlowApi';
import { DEFAULT_BRANCH_CONFIG, parseBranchConfig } from '../../lib/registrationFlowRules';

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Record<string, unknown> | null} props.flow — null quando `isNewMode`
 * @param {boolean} props.isNewMode
 * @param {Array<Record<string, unknown>>} props.steps
 * @param {boolean} props.stepsLoading
 * @param {unknown} [props.stepsError]
 * @param {() => void} [props.onRetrySteps]
 * @param {Array<Record<string, unknown>>} props.templates
 * @param {string} props.flowShareUrl — URL completa para partilhar este fluxo
 * @param {() => void} props.onCopyShareUrl
 * @param {(row: Record<string, unknown>) => void} props.onFlowCreated
 * @param {() => void} [props.onDeleteFlow]
 * @param {boolean} [props.deleteFlowBusy]
 */
export function MasterFlowSideover({
  open,
  onClose,
  flow,
  isNewMode,
  steps,
  stepsLoading,
  stepsError = null,
  onRetrySteps,
  templates,
  flowShareUrl,
  onCopyShareUrl,
  onFlowCreated,
  onDeleteFlow,
  deleteFlowBusy = false,
}) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const sb = getSupabase();
  const qc = useQueryClient();
  const { toast, alert } = useUiFeedback();
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [editingStep, setEditingStep] = useState(/** @type {null | Record<string, unknown>} */ (null));
  const [expandedStepId, setExpandedStepId] = useState(/** @type {string | null} */ (null));
  /** Rascunho branch_config (atualizado pelo editor sem re-render do sideover). */
  const branchConfigDraftRef = useRef(/** @type {Record<string, unknown> | null} */ (null));

  const flowId = flow?.id ? String(flow.id) : null;

  useEffect(() => {
    if (open && isNewMode) {
      setNewName('');
      setNewSlug('');
    }
  }, [open, isNewMode]);

  useEffect(() => {
    if (!open) {
      setEditingStep(null);
      setExpandedStepId(null);
    }
  }, [open]);

  const templateById = useMemo(() => {
    const m = new Map();
    for (const t of templates || []) {
      m.set(t.id, t);
    }
    return m;
  }, [templates]);

  const sortedSteps = useMemo(
    () => [...(steps || [])].sort((a, b) => Number(a.sort_order) - Number(b.sort_order)),
    [steps]
  );

  const patchFlowMutation = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await sb.from('hub_registration_master_flow').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      toast('Fluxo atualizado.', { variant: 'success' });
    },
    onError: (e) => toast(e?.message || 'Erro ao atualizar.', { variant: 'warning' }),
  });

  const createFlowMutation = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      const slug = newSlug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      if (name.length < 2) throw new Error('Indique um nome com pelo menos 2 caracteres.');
      if (slug.length < 2) throw new Error('Indique um identificador (slug) curto, ex.: meu-fluxo-vendas.');
      const { data, error } = await sb
        .from('hub_registration_master_flow')
        .insert({
          name,
          slug,
          description: '',
          is_active: true,
          invite_link_enabled: true,
          ...(userId ? { created_by_user_id: userId } : {}),
        })
        .select('id, name, slug, description, is_active, invite_link_enabled, created_at, updated_at')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      toast('Fluxo criado.', { variant: 'success' });
      onFlowCreated?.(data);
    },
    onError: async (e) => {
      const local =
        e instanceof Error && String(e.message || '').startsWith('Indique ') ? String(e.message) : null;
      await alert(local || friendlyRegistrationFlowError(e), { title: 'Não foi possível criar o fluxo' });
    },
  });

  const saveStepMutation = useMutation({
    mutationFn: async ({ id, values }) => {
      const isBranch = String(values.step_kind || '') === 'branch';
      if (isBranch) {
        let branch_config = branchConfigDraftRef.current;
        if (!branch_config || typeof branch_config !== 'object') {
          const rawB = String(values.branch_config_json || '').trim();
          if (!rawB) throw new Error('Defina a pergunta inicial (feche e volte a abrir o editor se necessário).');
          try {
            branch_config = JSON.parse(rawB);
          } catch {
            throw new Error('branch_config não é JSON válido.');
          }
        }
        const parsed = parseBranchConfig(branch_config);
        if (!parsed) throw new Error('A pergunta inicial precisa de título e opções com destino válido.');
        const { error } = await sb
          .from('hub_registration_master_flow_step')
          .update({
            sort_order: Number(values.sort_order) || 0,
            template_id: null,
            step_kind: 'branch',
            branch_config,
            entry_condition: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (error) throw error;
        return;
      }
      let entry_condition = null;
      const raw = String(values.entry_condition_json || '').trim();
      if (raw) {
        try {
          entry_condition = JSON.parse(raw);
        } catch {
          throw new Error('Condição de entrada não é JSON válido.');
        }
      }
      const tid = String(values.template_id || '').trim();
      if (!tid) throw new Error('Selecione um template.');
      const { error } = await sb
        .from('hub_registration_master_flow_step')
        .update({
          sort_order: Number(values.sort_order) || 0,
          template_id: tid,
          step_kind: 'template',
          branch_config: null,
          entry_condition,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (flowId) void qc.invalidateQueries({ queryKey: masterFlowStepsAdminQueryKey(flowId) });
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      setEditingStep(null);
      toast('Etapa salva.', { variant: 'success' });
    },
    onError: (e) => toast(e?.message || 'Erro ao salvar etapa.', { variant: 'warning' }),
  });

  const addStepMutation = useMutation({
    mutationFn: async () => {
      const firstTpl = templates?.[0];
      if (!flowId || !firstTpl?.id) throw new Error('É necessário um fluxo gravado e pelo menos um template.');
      const max = sortedSteps.reduce((a, s) => Math.max(a, Number(s.sort_order) || 0), 0) + 10;
      const { error } = await sb.from('hub_registration_master_flow_step').insert({
        master_flow_id: flowId,
        template_id: firstTpl.id,
        sort_order: max,
        step_kind: 'template',
        branch_config: null,
        entry_condition: { doc_type: 'cnpj', audience: 'partner' },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (flowId) void qc.invalidateQueries({ queryKey: masterFlowStepsAdminQueryKey(flowId) });
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      toast('Etapa adicionada.', { variant: 'success' });
    },
    onError: (e) => toast(e?.message || 'Erro ao criar etapa.', { variant: 'warning' }),
  });

  const addBranchStepMutation = useMutation({
    mutationFn: async () => {
      if (!flowId) throw new Error('Grave o fluxo antes de adicionar etapas.');
      const orders = sortedSteps.map((s) => Number(s.sort_order) || 0);
      const min = orders.length ? Math.min(...orders) : 100;
      const sort_order = Math.max(0, min - 10);
      const { error } = await sb.from('hub_registration_master_flow_step').insert({
        master_flow_id: flowId,
        template_id: null,
        sort_order,
        step_kind: 'branch',
        branch_config: DEFAULT_BRANCH_CONFIG,
        entry_condition: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      if (flowId) void qc.invalidateQueries({ queryKey: masterFlowStepsAdminQueryKey(flowId) });
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      toast('Pergunta inicial (ramificação) adicionada.', { variant: 'success' });
    },
    onError: (e) => toast(e?.message || 'Erro ao criar ramificação.', { variant: 'warning' }),
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (stepId) => {
      const { error } = await sb.from('hub_registration_master_flow_step').delete().eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      if (flowId) void qc.invalidateQueries({ queryKey: masterFlowStepsAdminQueryKey(flowId) });
      void qc.invalidateQueries({ queryKey: masterFlowsAdminQueryKey() });
      setEditingStep(null);
      toast('Etapa removida.', { variant: 'info' });
    },
    onError: (e) => toast(e?.message || 'Erro ao remover.', { variant: 'warning' }),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ stepId, direction }) => {
      if (!flowId || !sb) return;
      const current = await listMasterFlowStepsAdmin(sb, flowId);
      const arr = [...current].sort((a, b) => Number(a.sort_order) - Number(b.sort_order));
      const idx = arr.findIndex((s) => s.id === stepId);
      const j = direction === 'up' ? idx - 1 : idx + 1;
      if (idx < 0 || j < 0 || j >= arr.length) return;
      const next = [...arr];
      [next[idx], next[j]] = [next[j], next[idx]];
      const now = new Date().toISOString();
      const updates = next.map((s, i) => ({
        id: s.id,
        sort_order: (i + 1) * 10,
        updated_at: now,
      }));
      for (const u of updates) {
        const { error } = await sb
          .from('hub_registration_master_flow_step')
          .update({ sort_order: u.sort_order, updated_at: u.updated_at })
          .eq('id', u.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (flowId) void qc.invalidateQueries({ queryKey: masterFlowStepsAdminQueryKey(flowId) });
      toast('Ordem atualizada.', { variant: 'success' });
    },
    onError: (e) => toast(e?.message || 'Erro ao reordenar.', { variant: 'warning' }),
  });

  const toggleTemplateInviteMutation = useMutation({
    mutationFn: async ({ templateId, inviteLinkEnabled }) => {
      const { error } = await sb
        .from('registration_form_template')
        .update({ invite_link_enabled: inviteLinkEnabled, updated_at: new Date().toISOString() })
        .eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: registrationTemplatesListQueryKey(userId) });
      toast('Convite do template atualizado.', { variant: 'success' });
    },
    onError: (e) => toast(e?.message || 'Erro ao atualizar template.', { variant: 'warning' }),
  });

  const title = isNewMode ? 'Novo fluxo' : String(flow?.name || 'Fluxo');
  const subtitle = isNewMode ? 'Defina nome e slug' : String(flow?.slug || '');

  return (
    <>
      <AppSideover
        open={open}
        onClose={onClose}
        title={title}
        subtitle={subtitle}
        eyebrow="Cadastro público"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50 p-0"
        panelClassName="!max-w-full sm:!max-w-lg md:!max-w-xl"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {isNewMode ? (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Nome do fluxo *
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="Ex.: Entrada parceiros"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Slug *
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                placeholder="ob10-intake"
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
              />
            </label>
          </div>
        ) : flow ? (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <HubButton
                variant="tableSecondary"
                icon={flow.is_active ? 'toggle_off' : 'toggle_on'}
                iconClassName="text-[16px]"
                className="!tracking-widest"
                onClick={() =>
                  patchFlowMutation.mutate({
                    id: flow.id,
                    patch: { is_active: !flow.is_active, updated_at: new Date().toISOString() },
                  })
                }
              >
                {flow.is_active ? 'Desativar fluxo' : 'Ativar fluxo'}
              </HubButton>
              <HubButton
                variant="tableSecondary"
                icon={flow.invite_link_enabled ? 'link_off' : 'link'}
                iconClassName="text-[16px]"
                className="!tracking-widest"
                onClick={() =>
                  patchFlowMutation.mutate({
                    id: flow.id,
                    patch: {
                      invite_link_enabled: !flow.invite_link_enabled,
                      updated_at: new Date().toISOString(),
                    },
                  })
                }
              >
                {flow.invite_link_enabled ? 'Fechar convite' : 'Abrir convite'}
              </HubButton>
            </div>

            <div className="overflow-hidden rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-slate-50/40 shadow-[0_12px_40px_rgba(14,116,144,0.12)] ring-1 ring-slate-900/[0.05]">
              <div className="flex items-start gap-3 border-b border-sky-100/80 bg-white/60 px-4 py-3.5 backdrop-blur-[2px]">
                <span
                  className="material-symbols-outlined mt-0.5 shrink-0 text-[22px] text-sky-600"
                  aria-hidden
                >
                  link
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-950/90">Convite público</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-600">
                    Endereço único deste fluxo — envie por WhatsApp, e-mail ou site.
                  </p>
                </div>
              </div>
              <div className="px-4 py-4">
                {flowShareUrl ? (
                  <div className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                    <p className="select-all break-all font-mono text-[13px] font-medium leading-relaxed text-slate-800">
                      {flowShareUrl}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Guarde o fluxo para gerar o link.</p>
                )}
                <HubButton
                  variant="secondary"
                  icon="content_copy"
                  className="mt-3 w-full !px-3 !py-2.5 !text-[10px] sm:w-auto"
                  disabled={!flowShareUrl}
                  onClick={onCopyShareUrl}
                >
                  Copiar link
                </HubButton>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Etapas</h3>
                <div className="flex flex-wrap gap-2">
                  <HubButton
                    variant="secondary"
                    icon="quiz"
                    className="!px-3 !py-2 !text-[10px]"
                    disabled={addBranchStepMutation.isPending || !flowId}
                    onClick={() => addBranchStepMutation.mutate()}
                    title="Primeira pergunta com opções (ex.: comprar, parceria)"
                  >
                    Pergunta inicial
                  </HubButton>
                  <HubButton
                    variant="primary"
                    icon="add"
                    className="!px-3 !py-2 !text-[10px]"
                    disabled={addStepMutation.isPending || !(templates || []).length}
                    onClick={() => addStepMutation.mutate()}
                  >
                    Etapa template
                  </HubButton>
                </div>
              </div>

              {stepsError ? (
                <div className="rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950">
                  <p className="font-semibold">Não foi possível carregar as etapas.</p>
                  <p className="mt-1 text-[11px] opacity-90">
                    {String(/** @type {Error} */ (stepsError)?.message || 'Verifique a ligação e tente outra vez.')}
                  </p>
                  {typeof onRetrySteps === 'function' ? (
                    <button
                      type="button"
                      className="mt-2 text-[10px] font-black uppercase tracking-widest text-amber-900 underline"
                      onClick={() => onRetrySteps()}
                    >
                      Tentar novamente
                    </button>
                  ) : null}
                </div>
              ) : stepsLoading ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="material-symbols-outlined animate-spin text-[18px] text-slate-400" aria-hidden>
                    progress_activity
                  </span>
                  Carregando etapas…
                </div>
              ) : sortedSteps.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma etapa. Adicione uma pergunta inicial ou um template.</p>
              ) : (
                <ul className="space-y-2">
                  {sortedSteps.map((s, i) => {
                    const isBranch = String(s.step_kind || 'template') === 'branch';
                    const branchParsed = isBranch ? parseBranchConfig(s.branch_config) : null;
                    const tpl = !isBranch && s.template_id ? templateById.get(s.template_id) : null;
                    const fields = Array.isArray(tpl?.fields) ? tpl.fields : [];
                    const expanded = expandedStepId === s.id;
                    return (
                      <li key={s.id} className="rounded-lg border border-slate-200 bg-white p-2">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-900">
                              {i + 1}.{' '}
                              {isBranch
                                ? `Pergunta: ${branchParsed?.prompt || '— (edite para concluir)'}`
                                : tpl?.name || 'Template'}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              Ordem: {s.sort_order}
                              {isBranch ? ' · Ramificação' : ''}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1">
                            <HubButton
                              variant="tableSecondary"
                              icon="arrow_upward"
                              iconClassName="text-[14px]"
                              className="!min-w-0 !gap-0 !px-1.5 !py-1"
                              title="Subir"
                              aria-label="Subir etapa"
                              disabled={reorderMutation.isPending || i === 0}
                              onClick={() => reorderMutation.mutate({ stepId: s.id, direction: 'up' })}
                            />
                            <HubButton
                              variant="tableSecondary"
                              icon="arrow_downward"
                              iconClassName="text-[14px]"
                              className="!min-w-0 !gap-0 !px-1.5 !py-1"
                              title="Descer"
                              aria-label="Descer etapa"
                              disabled={reorderMutation.isPending || i === sortedSteps.length - 1}
                              onClick={() => reorderMutation.mutate({ stepId: s.id, direction: 'down' })}
                            />
                            <HubButton
                              variant="tableSecondary"
                              icon="edit"
                              iconClassName="text-[14px]"
                              className="!px-2 !py-1 !text-[10px]"
                              onClick={() =>
                                isBranch
                                  ? setEditingStep({
                                      ...s,
                                      step_kind: 'branch',
                                      branch_config_json: s.branch_config
                                        ? JSON.stringify(s.branch_config, null, 2)
                                        : JSON.stringify(DEFAULT_BRANCH_CONFIG, null, 2),
                                    })
                                  : setEditingStep({
                                      ...s,
                                      step_kind: 'template',
                                      entry_condition_json: s.entry_condition
                                        ? JSON.stringify(s.entry_condition, null, 2)
                                        : '',
                                    })
                              }
                            >
                              Editar
                            </HubButton>
                            <HubButton
                              variant="danger"
                              icon="delete"
                              iconClassName="text-[14px]"
                              className="!px-2 !py-1 !text-[10px]"
                              onClick={() => {
                                if (window.confirm('Remover esta etapa?')) deleteStepMutation.mutate(s.id);
                              }}
                            >
                              Apagar
                            </HubButton>
                          </div>
                        </div>
                        {!isBranch && tpl?.id ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                            <label className="flex cursor-pointer items-center gap-2 text-[10px] text-slate-700">
                              <input
                                type="checkbox"
                                className="rounded border-slate-300"
                                checked={tpl.inviteLinkEnabled !== false}
                                onChange={(e) =>
                                  toggleTemplateInviteMutation.mutate({
                                    templateId: tpl.id,
                                    inviteLinkEnabled: e.target.checked,
                                  })
                                }
                              />
                              Convite por link (template)
                            </label>
                            <Link
                              to="/adm/templates"
                              className="text-[10px] font-black uppercase tracking-wider text-primary underline"
                            >
                              Gerenciar campos no template
                            </Link>
                          </div>
                        ) : null}
                        {!isBranch ? (
                          <>
                            <button
                              type="button"
                              className="mt-2 text-[10px] font-medium text-slate-600 underline"
                              onClick={() => setExpandedStepId(expanded ? null : s.id)}
                            >
                              {expanded ? 'Ocultar campos' : `Ver campos (${fields.length})`}
                            </button>
                            {expanded ? (
                              <ul className="mt-2 max-h-40 overflow-auto rounded border border-slate-100 bg-slate-50/50 p-2 text-[11px] text-slate-700">
                                {fields.length === 0 ? (
                                  <li className="text-slate-500">Sem campos extra neste template.</li>
                                ) : (
                                  fields.map((f) => (
                                    <li key={f.id || f.key} className="border-b border-slate-100 py-1 last:border-0">
                                      <span className="font-medium">{f.label || f.key}</span>
                                      {f.required ? (
                                        <span className="ml-1 text-[9px] uppercase text-amber-800">obrigatório</span>
                                      ) : null}
                                    </li>
                                  ))
                                )}
                              </ul>
                            ) : null}
                          </>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        ) : null}
          </div>
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 shadow-[0_-4px_24px_rgba(15,23,42,0.06)] sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <HubButton variant="secondary" icon="close" onClick={onClose} className="!text-xs !font-semibold !tracking-wide">
                  {isNewMode ? 'Cancelar' : 'Fechar'}
                </HubButton>
                {isNewMode ? (
                  <HubButton
                    variant="primary"
                    icon="add"
                    disabled={createFlowMutation.isPending}
                    className="!text-xs !font-semibold !tracking-wide"
                    onClick={() => createFlowMutation.mutate()}
                  >
                    {createFlowMutation.isPending ? 'Criando…' : 'Criar fluxo'}
                  </HubButton>
                ) : null}
              </div>
              {!isNewMode && flow && typeof onDeleteFlow === 'function' ? (
                <HubButton
                  variant="danger"
                  icon="delete"
                  disabled={deleteFlowBusy}
                  className="!text-xs !font-semibold !tracking-wide"
                  onClick={() => void onDeleteFlow()}
                >
                  Excluir fluxo
                </HubButton>
              ) : null}
            </div>
          </div>
        </div>
      </AppSideover>

      {editingStep ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`max-h-[90vh] w-full overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl ${
              String(editingStep.step_kind || '') === 'branch' ? 'max-w-2xl' : 'max-w-lg'
            }`}
          >
            <h3 className="text-sm font-black text-primary">
              {String(editingStep.step_kind || '') === 'branch' ? 'Editar pergunta inicial' : 'Editar etapa'}
            </h3>
            <div className="mt-3 space-y-2">
              <label className="block text-[10px] font-black uppercase text-slate-600">Ordem</label>
              <input
                type="number"
                className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                value={Number(editingStep.sort_order) || 0}
                onChange={(e) => setEditingStep((x) => ({ ...x, sort_order: e.target.value }))}
              />
              {String(editingStep.step_kind || '') === 'branch' ? (
                <>
                  <p className="text-[10px] leading-relaxed text-slate-600">
                    Monte a primeira pergunta do wizard como no cadastro público: título, texto de ajuda e botões. Em cada
                    botão, defina se o visitante vai para <strong>segmentos de lead</strong>, <strong>parceiro (CPF/CNPJ)</strong>,{' '}
                    <strong>lead com segmento fixo</strong> ou <strong>outra pergunta</strong> (se existir mais de uma no fluxo).
                  </p>
                  <BranchStepVisualEditor
                    key={String(editingStep.id)}
                    stepId={String(editingStep.id)}
                    initialJson={String(editingStep.branch_config_json ?? '')}
                    branchConfigRef={branchConfigDraftRef}
                  />
                </>
              ) : (
                <>
                  <label className="block text-[10px] font-black uppercase text-slate-600">Template</label>
                  <select
                    className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                    value={String(editingStep.template_id || '')}
                    onChange={(e) => setEditingStep((x) => ({ ...x, template_id: e.target.value }))}
                  >
                    {(templates || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.inviteSlug || t.id.slice(0, 8)})
                      </option>
                    ))}
                  </select>
                  <label className="block text-[10px] font-black uppercase text-slate-600">Condição (JSON avançado)</label>
                  <textarea
                    rows={6}
                    className="w-full rounded border border-slate-200 p-2 font-mono text-xs"
                    value={String(editingStep.entry_condition_json ?? '')}
                    placeholder='Parceiro (CNPJ): {"doc_type":"cnpj","audience":"partner"} · Lead (CPF): {"doc_type":"cpf","audience":"lead"} · Só um segmento: {"doc_type":"cpf","audience":"lead","lead_segment":"slug"}'
                    onChange={(e) => setEditingStep((x) => ({ ...x, entry_condition_json: e.target.value }))}
                  />
                </>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <HubButton variant="secondary" icon="close" onClick={() => setEditingStep(null)} className="!text-xs !tracking-wide">
                Cancelar
              </HubButton>
              <HubButton
                variant="primary"
                icon="save"
                disabled={saveStepMutation.isPending}
                className="!text-xs !tracking-wide"
                onClick={() =>
                  saveStepMutation.mutate({
                    id: String(editingStep.id),
                    values: editingStep,
                  })
                }
              >
                Salvar
              </HubButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
