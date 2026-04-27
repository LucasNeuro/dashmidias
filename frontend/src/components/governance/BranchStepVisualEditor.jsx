import { useCallback, useEffect, useMemo, useState } from 'react';
import { HubButton } from '../HubButton';
import {
  BRANCH_OUTCOME_OPTIONS,
  DEFAULT_BRANCH_CONFIG,
  parseBranchConfig,
  parseBranchConfigDraftJson,
  serializeBranchConfigDraft,
} from '../../lib/registrationFlowRules';

/**
 * @param {unknown} item
 * @param {number} i
 */
function normalizeOptionRow(item, i) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return {
      id: `opt-${i + 1}`,
      label: 'Nova opção',
      description: '',
      outcome: 'lead_segments',
      segment_slug: '',
    };
  }
  const x = /** @type {Record<string, unknown>} */ (item);
  const outcome = String(x.outcome ?? 'lead_segments').trim() || 'lead_segments';
  return {
    id: String(x.id ?? `opt-${i + 1}`).trim() || `opt-${i + 1}`,
    label: String(x.label ?? 'Opção').trim() || 'Opção',
    description: x.description != null ? String(x.description).trim() : '',
    outcome,
    segment_slug: x.segment_slug != null ? String(x.segment_slug).trim() : '',
  };
}

function buildDraftFromInitialJson(initialJson) {
  const obj = parseBranchConfigDraftJson(initialJson);
  const prompt = String(obj.prompt ?? '').trim() || DEFAULT_BRANCH_CONFIG.prompt;
  const subtitle = String(obj.subtitle ?? '').trim() || DEFAULT_BRANCH_CONFIG.subtitle;
  const raw = Array.isArray(obj.options) ? obj.options : DEFAULT_BRANCH_CONFIG.options;
  const options = raw.map((item, i) => normalizeOptionRow(item, i));
  return { prompt, subtitle, options };
}

/**
 * Editor visual para branch_config (pergunta inicial do cadastro público).
 * O rascunho fica só neste componente; `branchConfigRef` é atualizado sem `setState` no pai
 * (evita re-renderizar o MasterFlowSideover inteiro a cada tecla — travava o Chrome).
 *
 * @param {object} props
 * @param {string} props.stepId
 * @param {string} props.initialJson
 * @param {{ current: Record<string, unknown> | null }} props.branchConfigRef
 */
export function BranchStepVisualEditor({ stepId, initialJson, branchConfigRef }) {
  const [draft, setDraft] = useState(() => buildDraftFromInitialJson(initialJson));

  useEffect(() => {
    const next = buildDraftFromInitialJson(initialJson);
    setDraft(next);
  }, [stepId]);

  useEffect(() => {
    if (branchConfigRef) {
      branchConfigRef.current = serializeBranchConfigDraft(draft);
    }
  }, [draft, branchConfigRef]);

  const setField = useCallback((patch) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const setOption = useCallback((index, patch) => {
    setDraft((d) => {
      const options = d.options.map((row, i) => (i === index ? { ...row, ...patch } : row));
      return { ...d, options };
    });
  }, []);

  const addOption = useCallback(() => {
    setDraft((d) => {
      const n = d.options.length + 1;
      const options = [
        ...d.options,
        {
          id: `opcao-${n}`,
          label: 'Nova opção',
          description: '',
          outcome: 'lead_segments',
          segment_slug: '',
        },
      ];
      return { ...d, options };
    });
  }, []);

  const removeOption = useCallback((index) => {
    setDraft((d) => {
      if (d.options.length <= 1) return d;
      const options = d.options.filter((_, i) => i !== index);
      return { ...d, options };
    });
  }, []);

  const moveOption = useCallback((index, delta) => {
    setDraft((d) => {
      const j = index + delta;
      if (j < 0 || j >= d.options.length) return d;
      const options = [...d.options];
      [options[index], options[j]] = [options[j], options[index]];
      return { ...d, options };
    });
  }, []);

  const validation = useMemo(() => {
    const obj = serializeBranchConfigDraft(draft);
    const ok = parseBranchConfig(obj);
    if (ok) return { ok: true, message: null };
    if (!String(draft.prompt ?? '').trim()) return { ok: false, message: 'Indique o texto da pergunta (título).' };
    if (!draft.options.length) return { ok: false, message: 'Adicione pelo menos uma opção.' };
    return { ok: false, message: 'Cada opção precisa de um destino válido.' };
  }, [draft]);

  const previewJson = useMemo(() => JSON.stringify(serializeBranchConfigDraft(draft), null, 2), [draft]);

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-600">Pergunta (título)</span>
        <input
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={draft.prompt}
          onChange={(e) => setField({ prompt: e.target.value })}
          placeholder="Ex.: O que você procura?"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-600">Subtítulo / ajuda</span>
        <textarea
          rows={2}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={draft.subtitle}
          onChange={(e) => setField({ subtitle: e.target.value })}
          placeholder="Texto curto abaixo do título."
        />
      </label>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-wide text-slate-600">Opções (cada uma é um botão no público)</span>
          <HubButton type="button" variant="secondaryDashed" icon="add" className="!px-3 !py-1.5 !text-[9px]" onClick={addOption}>
            Opção
          </HubButton>
        </div>
        <ul className="space-y-3">
          {draft.options.map((row, index) => (
            <li key={`${row.id}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Opção {index + 1}</span>
                <div className="flex flex-wrap gap-1">
                  <HubButton
                    type="button"
                    variant="tableSecondary"
                    icon="arrow_upward"
                    iconClassName="text-[14px]"
                    className="!min-w-0 !px-1.5 !py-1"
                    disabled={index === 0}
                    aria-label="Subir"
                    onClick={() => moveOption(index, -1)}
                  />
                  <HubButton
                    type="button"
                    variant="tableSecondary"
                    icon="arrow_downward"
                    iconClassName="text-[14px]"
                    className="!min-w-0 !px-1.5 !py-1"
                    disabled={index === draft.options.length - 1}
                    aria-label="Descer"
                    onClick={() => moveOption(index, 1)}
                  />
                  <HubButton
                    type="button"
                    variant="danger"
                    icon="delete"
                    iconClassName="text-[14px]"
                    className="!px-2 !py-1 !text-[9px]"
                    disabled={draft.options.length <= 1}
                    onClick={() => removeOption(index)}
                  >
                    Remover
                  </HubButton>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase text-slate-500">Id (slug interno)</span>
                  <input
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs"
                    value={row.id}
                    onChange={(e) => setOption(index, { id: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-1">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase text-slate-500">Texto do botão</span>
                  <input
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    value={row.label}
                    onChange={(e) => setOption(index, { label: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase text-slate-500">Descrição (opcional)</span>
                  <input
                    className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                    value={row.description}
                    onChange={(e) => setOption(index, { description: e.target.value })}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-0.5 block text-[9px] font-semibold uppercase text-slate-500">Para onde enviar o visitante</span>
                  <select
                    className="mt-0.5 w-full rounded border border-slate-200 bg-white px-2 py-2 text-sm"
                    value={row.outcome}
                    onChange={(e) => {
                      const outcome = e.target.value;
                      setOption(index, {
                        outcome,
                        segment_slug: outcome === 'lead_direct' ? row.segment_slug : '',
                      });
                    }}
                  >
                    {BRANCH_OUTCOME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] leading-snug text-slate-500">
                    {BRANCH_OUTCOME_OPTIONS.find((o) => o.value === row.outcome)?.hint}
                  </p>
                </label>
                {row.outcome === 'lead_direct' ? (
                  <label className="block sm:col-span-2">
                    <span className="mb-0.5 block text-[9px] font-semibold uppercase text-slate-500">Slug do segmento de lead</span>
                    <input
                      className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs"
                      value={row.segment_slug}
                      onChange={(e) => setOption(index, { segment_slug: e.target.value })}
                      placeholder="Ex.: consumidor-final (tabela hub_lead_segment)"
                    />
                  </label>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {validation.ok ? null : (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">{validation.message}</p>
      )}

      <details className="rounded-lg border border-slate-200 bg-white">
        <summary className="cursor-pointer select-none px-3 py-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
          Resumo técnico (só leitura)
        </summary>
        <pre className="max-h-40 overflow-auto border-t border-slate-100 p-3 font-mono text-[10px] text-slate-700">{previewJson}</pre>
      </details>
    </div>
  );
}
