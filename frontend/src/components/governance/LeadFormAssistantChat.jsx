import { useCallback, useState } from 'react';
import { HubButton } from '../HubButton';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { invokeLeadFormAssistant } from '../../lib/leadFormAssistantApi';
import { assignStableKeysFromLabels, FIELD_TYPES_WITH_OPTIONS, newFieldId } from '../../lib/registrationFormTemplates';

/**
 * Chat de apoio à criação de campos extra (só modelos lead_capture).
 * @param {{
 *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
 *   standardCatalog?: unknown,
 *   templateName: string,
 *   hasExistingFields: boolean,
 *   onApplyParsedFields: (fields: unknown[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export function LeadFormAssistantChat({
  supabase,
  standardCatalog = null,
  templateName,
  hasExistingFields,
  onApplyParsedFields,
  disabled = false,
}) {
  const { toast, confirm } = useUiFeedback();
  const [messages, setMessages] = useState(
    /** @type {Array<{ role: 'user' | 'assistant'; content: string }>} */ ([])
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  /** Ready: campos propostos esperando «Aplicar» */
  const [pendingFields, setPendingFields] = useState(/** @type {Array<Record<string, unknown>> | null} */ (null));

  const send = useCallback(async () => {
    const raw = input.trim();
    if (!raw || !supabase || busy || disabled) return;

    const nextThread = [...messages, { role: /** @type {const} */ ('user'), content: raw }];
    setInput('');
    setBusy(true);
    setPendingFields(null);
    setMessages(nextThread);

    try {
      const r = await invokeLeadFormAssistant(supabase, nextThread);
      const assistantContent = r.message || '(sem texto)';
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);

      if (r.status === 'ready' && Array.isArray(r.fields)) {
        setPendingFields(r.fields);
        if (r.fields.length === 0) {
          toast('A IA sugeriu não acrescentar perguntas extra (só contacto padrão). Pode editar à mão se quiser.', {
            variant: 'info',
            duration: 6000,
          });
        }
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            e instanceof Error
              ? `Não foi possível obter resposta: ${e.message}`
              : 'Ocorreu um erro. Tente de novo.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }, [input, supabase, busy, disabled, messages, toast]);

  const applyPending = useCallback(async () => {
    if (!pendingFields || !pendingFields.length) return;
    if (hasExistingFields) {
      const ok = await confirm('Substituir as perguntas actuais pelas sugeridas pela IA?', {
        title: 'Aplicar modelo sugerido',
      });
      if (!ok) return;
    }

    const mapped = pendingFields.map((row) => {
      const type = String(row.type ?? 'text').toLowerCase();
      /** @type {Record<string, unknown>} */
      const o = {
        id: newFieldId(),
        key: '',
        label: String(row.label ?? '').trim() || 'Campo',
        type,
        required: Boolean(row.required),
      };
      if (FIELD_TYPES_WITH_OPTIONS.includes(/** @type {any} */ (type)) && Array.isArray(row.options)) {
        o.options = row.options.map((x) => String(x ?? '')).filter(Boolean);
      }
      if (type === 'textarea' && typeof row.rows === 'number') {
        o.rows = row.rows;
      }
      return o;
    });

    const normalized = assignStableKeysFromLabels(mapped, standardCatalog);
    onApplyParsedFields(normalized);
    setPendingFields(null);
    toast('Perguntas aplicadas. Revise e guarde o modelo.', { variant: 'success', duration: 5000 });
  }, [pendingFields, hasExistingFields, confirm, onApplyParsedFields, standardCatalog, toast]);

  if (!supabase) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        Inicie sessão com Supabase configurado para usar o assistente de IA.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-violet-200/90 bg-gradient-to-b from-violet-50/40 to-white">
      <div className="border-b border-violet-100 bg-white/90 px-4 py-3">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined mt-0.5 text-[22px] text-violet-700" aria-hidden>
            smart_toy
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Assistente de perguntas (Mistral)</p>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-600">
              Descreva o objectivo (ex.: «leads de evento de arquitetura»). A IA pergunta o que faltar e propõe campos com tipos
              (texto, lista, escolhas múltiplas, ficheiro, etc.). Nome, e-mail e telefone já vêm no formulário público.
            </p>
            {templateName?.trim() ? (
              <p className="mt-1 text-[10px] text-slate-500">
                Modelo: <span className="font-medium text-slate-700">{templateName.trim()}</span>
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-h-64 min-h-[7rem] space-y-2 overflow-y-auto px-4 py-3 text-sm">
        {messages.length === 0 ? (
          <p className="text-xs leading-relaxed text-slate-500">
            Exemplo: «Quero saber se o lead procura projeto novo ou reforma, orçamento aproximado em lista e um upload de
            planta.»
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div
            key={`${i}-${m.role}`}
            className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
              m.role === 'user' ? 'ml-4 bg-violet-600 text-white' : 'mr-4 border border-slate-200 bg-white text-slate-800'
            }`}
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <p className="text-[11px] text-slate-500" role="status">
            A pensar…
          </p>
        ) : null}
      </div>

      {pendingFields && pendingFields.length > 0 ? (
        <div className="border-t border-violet-100 bg-emerald-50/50 px-4 py-2">
          <p className="text-[11px] font-semibold text-emerald-900">
            {pendingFields.length} pergunta(s) pronta(s) para aplicar à lista de campos.
          </p>
          <HubButton
            type="button"
            variant="primary"
            icon="check_circle"
            className="mt-2 !text-[11px]"
            onClick={() => void applyPending()}
            disabled={disabled || busy}
          >
            Aplicar ao modelo
          </HubButton>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-violet-100 bg-white p-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Mensagem</span>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={disabled || busy}
            placeholder="Escreva aqui… (Enter envia, Shift+Enter nova linha)"
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20"
          />
        </label>
        <HubButton
          type="button"
          variant="secondary"
          icon="send"
          className="shrink-0 !text-[11px]"
          disabled={disabled || busy || !input.trim()}
          onClick={() => void send()}
        >
          Enviar
        </HubButton>
      </div>
    </div>
  );
}
