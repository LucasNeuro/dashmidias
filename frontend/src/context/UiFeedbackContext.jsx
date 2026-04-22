import { createContext, useCallback, useContext, useId, useMemo, useState } from 'react';

const UiFeedbackContext = createContext(null);

export function UiFeedbackProvider({ children }) {
  const baseId = useId();
  const [toasts, setToasts] = useState([]);
  /** @type {[{ message: string, title?: string, resolve: () => void } | null]} */
  const [alertPayload, setAlertPayload] = useState(null);
  /** @type {[{ message: string, title?: string, danger?: boolean, resolve: (v: boolean) => void } | null]} */
  const [confirmPayload, setConfirmPayload] = useState(null);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message, options = {}) => {
      const id = `${baseId}-t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const variant = options.variant || 'info';
      setToasts((prev) => [...prev, { id, message, variant }]);
      const ms = typeof options.duration === 'number' ? options.duration : 3800;
      if (ms > 0) {
        window.setTimeout(() => dismissToast(id), ms);
      }
      return id;
    },
    [baseId, dismissToast]
  );

  const alert = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setAlertPayload({
        message,
        title: options.title,
        resolve: () => {
          resolve();
          setAlertPayload(null);
        },
      });
    });
  }, []);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirmPayload({
        message,
        title: options.title,
        danger: options.danger === true,
        resolve: (v) => {
          resolve(v);
          setConfirmPayload(null);
        },
      });
    });
  }, []);

  const value = useMemo(() => ({ toast, alert, confirm }), [toast, alert, confirm]);

  return (
    <UiFeedbackContext.Provider value={value}>
      {children}

      {alertPayload ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) alertPayload.resolve();
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-alert-title`}
            className="w-full max-w-md border-2 border-primary bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {alertPayload.title ? (
              <h2 id={`${baseId}-alert-title`} className="text-sm font-black uppercase tracking-[0.12em] text-primary">
                {alertPayload.title}
              </h2>
            ) : (
              <h2 id={`${baseId}-alert-title`} className="sr-only">
                Aviso
              </h2>
            )}
            <p className={`text-sm leading-relaxed text-slate-700 ${alertPayload.title ? 'mt-3' : ''}`}>
              {alertPayload.message}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => alertPayload.resolve()}
                className="bg-tertiary px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-tertiary/90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmPayload ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) confirmPayload.resolve(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${baseId}-confirm-title`}
            className="w-full max-w-md border-2 border-primary bg-white p-6 shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id={`${baseId}-confirm-title`} className="text-sm font-black uppercase tracking-[0.12em] text-primary">
              {confirmPayload.title || 'Confirmar'}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">{confirmPayload.message}</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => confirmPayload.resolve(false)}
                className="border border-outline-variant bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant hover:bg-surface-container-low"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmPayload.resolve(true)}
                className={`px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white ${
                  confirmPayload.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-tertiary hover:bg-tertiary/90'
                }`}
              >
                {confirmPayload.danger ? 'Excluir' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[210] flex max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 border-2 px-4 py-3 shadow-lg ${
              t.variant === 'success'
                ? 'border-tertiary/60 bg-tertiary/10 text-primary'
                : t.variant === 'warning'
                  ? 'border-amber-400 bg-amber-50 text-amber-950'
                  : 'border-primary bg-white text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-primary opacity-90" aria-hidden>
              {t.variant === 'success' ? 'check_circle' : t.variant === 'warning' ? 'warning' : 'info'}
            </span>
            <p className="text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="-m-1 ml-auto shrink-0 p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-primary"
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        ))}
      </div>
    </UiFeedbackContext.Provider>
  );
}

export function useUiFeedback() {
  const ctx = useContext(UiFeedbackContext);
  if (!ctx) {
    throw new Error('useUiFeedback must be used within UiFeedbackProvider');
  }
  return ctx;
}
