import { useEffect, useId, useRef, useState } from 'react';

/** Versão da política: ao alterar o texto relevante, incremente para exigir novo aceite. */
export const DATA_POLICY_STORAGE_KEY = 'dashmidias_data_policy_accepted_v';
export const DATA_POLICY_VERSION = '1';

export function hasAcceptedDataPolicy() {
  try {
    return localStorage.getItem(`${DATA_POLICY_STORAGE_KEY}${DATA_POLICY_VERSION}`) === '1';
  } catch {
    return false;
  }
}

export function acceptDataPolicy() {
  try {
    localStorage.setItem(`${DATA_POLICY_STORAGE_KEY}${DATA_POLICY_VERSION}`, '1');
    localStorage.setItem('dashmidias_data_policy_accepted_at', new Date().toISOString());
  } catch {
    /* ignore */
  }
}

/**
 * @param {'required' | 'info'} mode — required: bloqueia até aceitar; info: só leitura, fecha livremente
 */
export function DataPolicyModal({ mode, open, onClose, onAccepted }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (open && mode === 'required') setChecked(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    el?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!open || mode === 'required') return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, mode, onClose]);

  if (!open) return null;

  const isRequired = mode === 'required';

  function handleAccept() {
    if (!checked && isRequired) return;
    acceptDataPolicy();
    onAccepted?.();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm"
      role="presentation"
      aria-hidden={!open}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isRequired) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white border-2 border-primary shadow-2xl w-full max-w-lg max-h-[min(85vh,640px)] flex flex-col"
      >
        <div className="px-6 py-4 border-b border-surface-container-high shrink-0">
          <h2 id={titleId} className="text-sm font-black uppercase tracking-[0.2em] text-primary">
            Política de dados
          </h2>
          <p className="text-[11px] text-on-surface-variant mt-1">
            {isRequired ? 'Leia e aceite para continuar utilizando o painel.' : 'Documento informativo.'}
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto text-[13px] text-on-surface-variant leading-relaxed space-y-4">
          <p>
            Este painel exibe métricas e dados operacionais com caráter <strong className="text-primary">confidencial</strong>. O acesso é
            restrito a pessoas autorizadas pela organização.
          </p>
          <p>
            <strong className="text-primary">Uso dos dados:</strong> as informações visualizadas destinam-se exclusivamente à análise
            interna de marketing e performance. É vedada a reprodução, distribuição ou compartilhamento externo sem aprovação formal.
          </p>
          <p>
            <strong className="text-primary">Dados pessoais e CRM:</strong> quando houver tratamento de dados pessoais em integrações
            futuras, o tratamento deverá observar a LGPD e as políticas internas da empresa, com base legal adequada e medidas de
            segurança.
          </p>
          <p>
            <strong className="text-primary">Registros e auditoria:</strong> o aceite desta política pode ser armazenado localmente no
            seu navegador apenas para fins de lembrete de consentimento à visualização deste ambiente; não substitui contratos ou
            termos corporativos formais.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-surface-container-high shrink-0 space-y-3 bg-surface-container-low/30">
          {isRequired && (
            <label className="flex items-start gap-3 cursor-pointer text-sm text-primary font-semibold">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 size-4 shrink-0 border-primary text-tertiary focus:ring-primary"
              />
              <span>Li e aceito a política de dados para acessar este painel.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-3 justify-end">
            {!isRequired && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-primary text-white hover:bg-primary/90"
              >
                Fechar
              </button>
            )}
            {isRequired && (
              <button
                type="button"
                disabled={!checked}
                onClick={handleAccept}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-tertiary text-primary hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Aceitar e continuar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
